import { Client, GatewayIntentBits, Events, Partials, Message, PermissionsBitField, SlashCommandBuilder, REST, Routes, ChatInputCommandInteraction, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, InteractionType, PermissionFlagsBits, MessageReaction, User } from "discord.js";
import { storage } from "./storage";
import { OpenAI } from "openai";

// Using a global variable for the client to ensure singleton
let client: Client | null = null;
let openai: OpenAI | null = null;

export function initializeBot() {
  if (client) return client;

  if (!process.env.DISCORD_TOKEN) {
    console.log("DISCORD_TOKEN not found. Bot will not start.");
    return null;
  }

  // Initialize OpenAI (using Replit AI integration)
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || "replit", 
    baseURL: process.env.OPENAI_BASE_URL || "https://api.replit.com/v1", // Fallback, usually auto-injected
  });

  const clientOptions = {
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildModeration,
      GatewayIntentBits.GuildMessageReactions,
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction],
  };

  client = new Client(clientOptions);

  client.on(Events.ClientReady, async (c) => {
    console.log(`Ready! Logged in as ${c.user.tag}`);
    await registerSlashCommands(c.user.id);
  });

  // Log Message Deletions
  client.on(Events.MessageDelete, async (message) => {
    if (message.partial) {
      try {
        await message.fetch();
      } catch (e) {
        console.log('Could not fetch deleted message:', e);
      }
    }

    if (message.author?.bot) return; 

    await storage.createLog({
      type: 'message_delete',
      content: message.content || '[No Content / Image]',
      userId: message.author?.id || 'unknown',
      username: message.author?.tag || 'unknown',
      metadata: {
        channelId: message.channel.id,
        guildId: message.guild?.id,
      },
    });
  });

  // Log Member Joins + Auto Role Assignment
  client.on(Events.GuildMemberAdd, async (member) => {
    // Log join
    await storage.createLog({
      type: 'member_join',
      content: `User ${member.user.tag} joined the server.`,
      userId: member.id,
      username: member.user.tag,
      metadata: {
        guildId: member.guild.id,
      },
    });

    // Dynamic Welcome Message
    try {
      const welcomeSetting = await storage.getSetting('welcome_message');
      const welcomeMessage = welcomeSetting?.value || "Welcome to the server, {user}!";
      
      const channel = member.guild.systemChannel || member.guild.channels.cache.find(ch => ch.isTextBased() && ch.permissionsFor(member.guild.members.me!).has('SendMessages'));
      
      if (channel && 'send' in channel) {
        const formattedMessage = welcomeMessage.replace('{user}', `<@${member.id}>`).replace('{server}', member.guild.name);
        await (channel as any).send(formattedMessage);
      }
    } catch (error) {
      console.error("Error sending welcome message:", error);
    }

    // Auto Role Assignment
    try {
      const roleConfigs = await storage.getRoleConfigs();
      const autoRoles = roleConfigs.filter(r => r.isAutoRole);
      
      for (const config of autoRoles) {
        const role = member.guild.roles.cache.get(config.roleId);
        if (role) {
          await member.roles.add(role);
          await storage.createLog({
            type: 'auto_role',
            content: `Assigned auto-role ${role.name} to ${member.user.tag}`,
            userId: member.id,
            username: member.user.tag,
            metadata: { roleId: role.id, guildId: member.guild.id },
          });
        }
      }
    } catch (error) {
      console.error("Error assigning auto roles:", error);
    }
  });

  // Handle messages (Commands + AutoMod)
  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;

    // 1. Check commands
    if (message.content.startsWith('!')) {
      await handleCommand(message);
    } else {
      // 2. Check AutoMod Rules
      await handleAutoMod(message);
    }
  });

  // Handle Slash Commands
  client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isChatInputCommand()) {
      await handleSlashCommand(interaction);
    } else if (interaction.type === InteractionType.ModalSubmit) {
      await handleModalSubmit(interaction);
    }
  });

  // Handle Reactions
  client.on(Events.MessageReactionAdd, handleReactionAdd);
  client.on(Events.MessageReactionRemove, handleReactionRemove);

  client.login(process.env.DISCORD_TOKEN).catch(err => {
    console.error("Failed to login to Discord:", err);
  });

  return client;
}

async function registerSlashCommands(clientId: string) {
  const commands = [
    new SlashCommandBuilder()
      .setName('warn')
      .setDescription('Warn a user')
      .addUserOption(option => option.setName('user').setDescription('The user to warn').setRequired(true))
      .addStringOption(option => option.setName('reason').setDescription('The reason for the warning')),
    new SlashCommandBuilder()
      .setName('kick')
      .setDescription('Kick a member from the server')
      .addUserOption(option => option.setName('user').setDescription('The user to kick').setRequired(true))
      .addStringOption(option => option.setName('reason').setDescription('Reason for kick').setRequired(false)),
    new SlashCommandBuilder()
      .setName('ban')
      .setDescription('Ban a user')
      .addUserOption(option => option.setName('user').setDescription('The user to ban').setRequired(true))
      .addStringOption(option => option.setName('reason').setDescription('The reason for the ban')),
    new SlashCommandBuilder()
      .setName('logs')
      .setDescription('View recent logs for a user')
      .addUserOption(option => option.setName('user').setDescription('The user to view logs for').setRequired(true)),
    new SlashCommandBuilder()
      .setName('dashboard')
      .setDescription('Get the link to the moderation dashboard'),
    new SlashCommandBuilder()
      .setName('ping')
      .setDescription('Replies with Pong!'),
    new SlashCommandBuilder()
      .setName('note')
      .setDescription('Staff notes management')
      .addSubcommand(sub =>
        sub.setName('create')
          .setDescription('Create a note report form'))
      .addSubcommand(sub =>
        sub.setName('search')
          .setDescription('Search staff notes')
          .addStringOption(opt =>
            opt.setName('query')
              .setDescription('Search keyword')
              .setRequired(true))),
    new SlashCommandBuilder()
      .setName('reactionrole')
      .setDescription('Create a reaction role panel')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addStringOption(opt =>
        opt.setName('title')
          .setDescription('Panel title')
          .setRequired(true))
      .addStringOption(opt =>
        opt.setName('description')
          .setDescription('Panel description')
          .setRequired(true))
      .addStringOption(opt =>
        opt.setName('emoji')
          .setDescription('Emoji for the role')
          .setRequired(true))
      .addRoleOption(opt =>
        opt.setName('role')
          .setDescription('Role to assign')
          .setRequired(true)),
  ].map(command => command.toJSON());

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);

  try {
    console.log('Started refreshing application (/) commands.');
    await rest.put(Routes.applicationCommands(clientId), { body: commands });
    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
}

async function handleSlashCommand(interaction: ChatInputCommandInteraction) {
  const { commandName, options, member, user, guild } = interaction;

  if (!guild) return;

  if (commandName === 'warn') {
    if (!(member?.permissions as Readonly<PermissionsBitField>).has(PermissionsBitField.Flags.KickMembers)) {
      return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }
    const target = options.getUser('user', true);
    const reason = options.getString('reason') || 'No reason provided';

    await storage.createCase({
      type: 'warn',
      targetId: target.id,
      targetName: target.tag,
      moderatorId: user.id,
      moderatorName: user.tag,
      reason,
      active: true,
    });

    await interaction.reply(`Warned ${target.tag} for: ${reason}`);
  }

  if (commandName === 'kick') {
    if (!(member?.permissions as Readonly<PermissionsBitField>).has(PermissionsBitField.Flags.KickMembers)) {
      return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }
    const target = options.getMember('user');
    if (!target || !('kick' in target)) return interaction.reply('User not found in this server.');
    if (!target.kickable) return interaction.reply('I cannot kick this user.');

    const reason = options.getString('reason') || 'No reason provided';
    await target.kick(reason);

    await storage.createCase({
      type: 'kick',
      targetId: target.user.id,
      targetName: target.user.tag,
      moderatorId: user.id,
      moderatorName: user.tag,
      reason,
      active: false,
    });

    await interaction.reply(`Kicked ${target.user.tag} for: ${reason}`);
  }

  if (commandName === 'ban') {
    if (!(member?.permissions as Readonly<PermissionsBitField>).has(PermissionsBitField.Flags.BanMembers)) {
      return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
    }
    const target = options.getMember('user');
    if (!target || !('ban' in target)) return interaction.reply('User not found in this server.');
    if (!target.bannable) return interaction.reply('I cannot ban this user.');

    const reason = options.getString('reason') || 'No reason provided';
    await target.ban({ reason });

    await storage.createCase({
      type: 'ban',
      targetId: target.user.id,
      targetName: target.user.tag,
      moderatorId: user.id,
      moderatorName: user.tag,
      reason,
      active: true,
    });

    await interaction.reply(`Banned ${target.user.tag} for: ${reason}`);
  }

  if (commandName === 'logs') {
    const target = options.getUser('user', true);
    const logs = await storage.getLogsByUser(target.id);
    
    if (logs.length === 0) {
      return interaction.reply(`No logs found for ${target.tag}.`);
    }

    const logSummary = logs.slice(0, 5).map(l => `[${l.type}] ${l.content}`).join('\n');
    await interaction.reply(`Recent logs for ${target.tag}:\n${logSummary}`);
  }

  if (commandName === 'dashboard') {
    const dashboardUrl = process.env.REPL_SLUG && process.env.REPL_OWNER 
      ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
      : 'Dashboard URL not configured.';
    
    await interaction.reply({
      content: `🔗 **Moderation Dashboard**: ${dashboardUrl}`,
      ephemeral: true
    });
  }

  if (commandName === 'ping') {
    await interaction.reply('Pong!');
  }

  if (commandName === 'reactionrole') {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: 'Admins only.', ephemeral: true });
    }

    const title = interaction.options.getString('title', true);
    const description = interaction.options.getString('description', true);
    const emoji = interaction.options.getString('emoji', true);
    const role = interaction.options.getRole('role', true);

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(`${description}\n\nReact with ${emoji} to get **${role.name}**`)
      .setColor('Blue');

    const message = await interaction.channel?.send({ embeds: [embed] });
    if (message) {
      await message.react(emoji);

      await storage.createRoleConfig({
        roleId: role.id,
        roleName: role.name,
        reactionMessageId: message.id,
        reactionEmoji: emoji,
        rank: 0,
        isAutoRole: false,
        permissions: {},
      });

      await interaction.reply({ content: '✅ Reaction role panel created.', ephemeral: true });
    } else {
      await interaction.reply({ content: '❌ Failed to create panel.', ephemeral: true });
    }
  }
}

async function handleReactionAdd(reaction: MessageReaction, user: User) {
  if (user.bot) return;
  if (reaction.partial) await reaction.fetch();

  const rc = await (storage as any).getRoleConfigByReaction(reaction.message.id, reaction.emoji.name || "");
  if (rc) {
    const member = await reaction.message.guild?.members.fetch(user.id);
    if (member) await member.roles.add(rc.roleId);
  }
}

async function handleReactionRemove(reaction: MessageReaction, user: User) {
  if (user.bot) return;
  if (reaction.partial) await reaction.fetch();

  const rc = await (storage as any).getRoleConfigByReaction(reaction.message.id, reaction.emoji.name || "");
  if (rc) {
    const member = await reaction.message.guild?.members.fetch(user.id);
    if (member) await member.roles.remove(rc.roleId);
  }
}

async function handleModalSubmit(interaction: any) {
  if (interaction.customId === 'noteModal') {
    const title = interaction.fields.getTextInputValue('noteTitle');
    const subject = interaction.fields.getTextInputValue('noteSubject');
    const details = interaction.fields.getTextInputValue('noteDetails');

    const embed = new EmbedBuilder()
      .setTitle('📝 Note Report')
      .addFields(
        { name: 'Title', value: title },
        { name: 'Subject', value: subject },
        { name: 'Details', value: details }
      )
      .setFooter({ text: `Submitted by ${interaction.user.tag}` })
      .setTimestamp()
      .setColor('Blue');

    await interaction.reply({
      embeds: [embed]
    });
    
    // Log the note to the dashboard
    await storage.createLog({
      type: 'note_report',
      content: `Note Report submitted by ${interaction.user.tag}: ${title}`,
      userId: interaction.user.id,
      username: interaction.user.tag,
      metadata: { title, subject, details },
    });
  }
}

async function handleCommand(message: Message) {
  const args = message.content.slice(1).trim().split(/ +/);
  const command = args.shift()?.toLowerCase();
  
  // --- Admin Commands ---
  
  // Sync Permissions (Apply role permissions based on DB config)
  if (command === 'syncperms') {
    if (!message.member?.permissions.has('Administrator')) return;
    
    try {
      const roleConfigs = await storage.getRoleConfigs();
      const guild = message.guild;
      if (!guild) return;

      let count = 0;
      for (const config of roleConfigs) {
        const role = guild.roles.cache.get(config.roleId);
        if (role && config.permissions) {
          // Note: Real permission syncing is complex. 
          // For MVP, we'll just log that we would sync them or maybe set a few basic ones if specified.
          // Setting actual Discord permissions requires converting DB permissions json to bitfield.
          // This is a placeholder for that logic.
          count++;
        }
      }
      message.reply(`Synced permissions for ${count} roles (Simulated).`);
    } catch (error) {
      console.error(error);
      message.reply('Failed to sync permissions.');
    }
  }

  // --- Moderation Commands ---

  if (command === 'warn') {
    if (!message.member?.permissions.has('KickMembers')) return;
    const target = message.mentions.users.first();
    if (!target) return message.reply('Please mention a user to warn.');
    const reason = args.slice(1).join(' ') || 'No reason provided';

    await storage.createCase({
      type: 'warn',
      targetId: target.id,
      targetName: target.tag,
      moderatorId: message.author.id,
      moderatorName: message.author.tag,
      reason,
      active: true,
    });

    message.reply(`Warned ${target.tag} for: ${reason}`);
  }

  if (command === 'kick') {
    if (!message.member?.permissions.has('KickMembers')) return;
    const target = message.mentions.members?.first();
    if (!target) return message.reply('Please mention a user to kick.');
    if (!target.kickable) return message.reply('I cannot kick this user.');
    
    const reason = args.slice(1).join(' ') || 'No reason provided';

    await target.kick(reason);

    await storage.createCase({
      type: 'kick',
      targetId: target.user.id,
      targetName: target.user.tag,
      moderatorId: message.author.id,
      moderatorName: message.author.tag,
      reason,
      active: false, // Instant action
    });

    message.reply(`Kicked ${target.user.tag} for: ${reason}`);
  }

  if (command === 'ban') {
    if (!message.member?.permissions.has('BanMembers')) return;
    const target = message.mentions.members?.first();
    if (!target) return message.reply('Please mention a user to ban.');
    if (!target.bannable) return message.reply('I cannot ban this user.');
    
    const reason = args.slice(1).join(' ') || 'No reason provided';

    await target.ban({ reason });

    await storage.createCase({
      type: 'ban',
      targetId: target.user.id,
      targetName: target.user.tag,
      moderatorId: message.author.id,
      moderatorName: message.author.tag,
      reason,
      active: true,
    });

    message.reply(`Banned ${target.user.tag} for: ${reason}`);
  }
}

async function handleAutoMod(message: Message) {
  // Fetch active rules
  const rules = await storage.getRules();
  if (rules.length === 0) return;

  const ruleText = rules.map(r => `- ${r.content} (Severity: ${r.severity})`).join('\n');

  try {
    const prompt = `
      You are a Discord moderation bot. Analyze the following message against these server rules:
      ${ruleText}

      Message: "${message.content}"

      If the message violates a rule, return a JSON object with:
      - "violation": true
      - "rule": "The rule content that was violated"
      - "severity": "warn", "kick", or "ban" (from the rule definition)
      - "reason": "Short explanation"
      
      If no violation, return {"violation": false}.
      ONLY return JSON.
    `;

    const completion = await openai!.chat.completions.create({
      messages: [{ role: "system", content: "You are a helpful assistant." }, { role: "user", content: prompt }],
      model: "gpt-4o-mini", // Use a fast model
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(completion.choices[0].message.content || '{}');

    if (result.violation) {
      const { severity, reason, rule } = result;
      const target = message.member;

      // Log the violation
      await storage.createLog({
        type: 'automod_violation',
        content: `Message flagged: "${message.content}". Violated: ${rule}`,
        userId: message.author.id,
        username: message.author.tag,
        metadata: { severity, reason, channelId: message.channel.id },
      });

      // Execute Action
      if (severity === 'warn') {
        await message.reply(`⚠️ **WARNING**: ${reason}`);
        await storage.createCase({
          type: 'warn',
          targetId: message.author.id,
          targetName: message.author.tag,
          moderatorId: client!.user!.id,
          moderatorName: 'AutoMod',
          reason: `AutoMod: ${reason}`,
          active: true,
        });
      } else if (severity === 'kick' && target?.kickable) {
        await target.kick(`AutoMod: ${reason}`);
        if (message.channel.isTextBased() && 'send' in message.channel) {
          await (message.channel as any).send(`👢 **KICKED** ${message.author.tag}: ${reason}`);
        }
        await storage.createCase({
          type: 'kick',
          targetId: message.author.id,
          targetName: message.author.tag,
          moderatorId: client!.user!.id,
          moderatorName: 'AutoMod',
          reason: `AutoMod: ${reason}`,
          active: false,
        });
      } else if (severity === 'ban' && target?.bannable) {
        await target.ban({ reason: `AutoMod: ${reason}` });
        if (message.channel.isTextBased() && 'send' in message.channel) {
          await (message.channel as any).send(`🔨 **BANNED** ${message.author.tag}: ${reason}`);
        }
        await storage.createCase({
          type: 'ban',
          targetId: message.author.id,
          targetName: message.author.tag,
          moderatorId: client!.user!.id,
          moderatorName: 'AutoMod',
          reason: `AutoMod: ${reason}`,
          active: true,
        });
      }
    }
  } catch (error) {
    console.error("AutoMod Error:", error);
  }
}
