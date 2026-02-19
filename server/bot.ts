import { Client, GatewayIntentBits, Events, Partials, Message, PermissionsBitField, SlashCommandBuilder, REST, Routes, ChatInputCommandInteraction, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, InteractionType, PermissionFlagsBits, MessageReaction, User, MessageFlags, AttachmentBuilder } from "discord.js";
import { storage } from "./storage";
import { OpenAI } from "openai";
import { createCanvas, loadImage } from "canvas";

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

    // Dynamic Image Welcome Card
    try {
      const welcomeChannelSetting = await storage.getSetting('welcome_channel_id');
      const logChannelId = welcomeChannelSetting?.value;
      
      const channel = member.guild.channels.cache.get(logChannelId || "") || member.guild.systemChannel;
      
      if (channel && 'send' in channel) {
        // Create canvas
        const canvas = createCanvas(1000, 350);
        const ctx = canvas.getContext("2d");

        // Background (dark gradient)
        const gradient = ctx.createLinearGradient(0, 0, 1000, 0);
        gradient.addColorStop(0, "#0f0f14");
        gradient.addColorStop(1, "#1f2230");

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Title
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 48px sans-serif";
        ctx.fillText("WELCOME TO", 320, 120);

        ctx.font = "bold 56px sans-serif";
        ctx.fillStyle = "#ff4da6";
        ctx.fillText("🔹🔸 Tragic Scene (NLMB) 🔸🔹", 320, 180);

        // Username
        ctx.font = "bold 44px sans-serif";
        ctx.fillStyle = "#ffffff";
        ctx.fillText(member.user.username, 320, 250);

        // Avatar circle
        try {
          const avatar = await loadImage(
            member.user.displayAvatarURL({ extension: "png", size: 512 })
          );

          ctx.save();
          ctx.beginPath();
          ctx.arc(150, 175, 110, 0, Math.PI * 2, true);
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(avatar, 40, 65, 220, 220);
          ctx.restore();
        } catch (avatarError) {
          console.error("Failed to load avatar for welcome image:", avatarError);
        }

        // Create attachment
        const attachment = new AttachmentBuilder(canvas.toBuffer(), {
          name: "welcome.png"
        });

        const welcomeSetting = await storage.getSetting('welcome_message');
        const customMessage = welcomeSetting?.value || 
`Welcome {user}!
Please hit the big ✅ in #rules then head to #subscriptions for roles.
Ranked players → #claim-your-rank`;

        const formattedMessage = customMessage
          .replace('{user}', `<@${member.id}>`)
          .replace('{server}', member.guild.name);

        await (channel as any).send({
          content: formattedMessage,
          files: [attachment]
        });
      }
    } catch (error) {
      console.error("Error generating welcome image:", error);
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
      // Command Logger System
      try {
        const logSetting = await storage.getSetting('command_log_channel');
        const logChannelId = logSetting?.value;
        if (logChannelId) {
          const logChannel = interaction.guild?.channels.cache.get(logChannelId);
          if (logChannel && 'send' in logChannel) {
            const user = interaction.user;
            let optionsUsed = "None";
            if (interaction.options.data.length > 0) {
              optionsUsed = interaction.options.data
                .map(o => `${o.name}: ${o.value}`)
                .join("\n");
            }

            const embed = new EmbedBuilder()
              .setColor(0xff4d6d)
              .setTitle("📜 Command Logger")
              .addFields(
                { name: "User", value: `${user.tag}`, inline: true },
                { name: "User ID", value: `${user.id}`, inline: true },
                { name: "Command", value: `/${interaction.commandName}`, inline: true },
                { name: "Channel", value: `${interaction.channel}`, inline: true },
                { name: "Server", value: `${interaction.guild?.name}`, inline: true },
                { name: "Options", value: optionsUsed.substring(0, 1024) },
                { name: "Time", value: `<t:${Math.floor(Date.now()/1000)}:F>` }
              )
              .setThumbnail(user.displayAvatarURL())
              .setFooter({ text: "Command Logger System" });

            await (logChannel as any).send({ embeds: [embed] });
          }
        }
      } catch (error) {
        console.error("Error in command logger:", error);
      }

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
      .setName('ars')
      .setDescription('ARS System for incident reports')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
      .addSubcommand(sub =>
        sub.setName('add')
          .setDescription('Create a new incident report')
          .addUserOption(opt => opt.setName('user').setDescription('Subject of the report').setRequired(true))
          .addIntegerOption(opt => opt.setName('priority').setDescription('Priority (1-5)').setRequired(true).setMinValue(1).setMaxValue(5))
          .addStringOption(opt => opt.setName('summary').setDescription('Incident summary').setRequired(true)))
      .addSubcommand(sub =>
        sub.setName('search')
          .setDescription('Search existing reports')
          .addStringOption(opt => opt.setName('case_id').setDescription('Case ID to search').setRequired(false))
          .addUserOption(opt => opt.setName('user').setDescription('User to search reports for').setRequired(false)))
      .addSubcommand(sub =>
        sub.setName('edit')
          .setDescription('Modify a report')
          .addStringOption(opt => opt.setName('case_id').setDescription('Case ID').setRequired(true))
          .addStringOption(opt => opt.setName('status').setDescription('New status').setRequired(false).addChoices({ name: 'Open', value: 'Open' }, { name: 'Closed', value: 'Closed' }))
          .addIntegerOption(opt => opt.setName('priority').setDescription('New priority (1-5)').setRequired(false).setMinValue(1).setMaxValue(5))
          .addStringOption(opt => opt.setName('summary').setDescription('New summary').setRequired(false)))
      .addSubcommand(sub =>
        sub.setName('delete')
          .setDescription('Remove a report')
          .addStringOption(opt => opt.setName('case_id').setDescription('Case ID').setRequired(true)))
      .addSubcommand(sub =>
        sub.setName('close')
          .setDescription('Close an active report')
          .addStringOption(opt => opt.setName('case_id').setDescription('Case ID').setRequired(true))),
    new SlashCommandBuilder()
      .setName('announce')
      .setDescription('Create a structured announcement')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .addStringOption(option =>
        option.setName('title').setDescription('Heading / title of the announcement').setRequired(true))
      .addStringOption(option =>
        option.setName('message').setDescription('Main announcement message').setRequired(true))
      .addChannelOption(option =>
        option.setName('channel').setDescription('Channel to send the announcement in').setRequired(false))
      .addStringOption(option =>
        option.setName('point1').setDescription('Announcement point #1').setRequired(false))
      .addStringOption(option =>
        option.setName('point2').setDescription('Announcement point #2').setRequired(false))
      .addStringOption(option =>
        option.setName('point3').setDescription('Announcement point #3').setRequired(false))
      .addStringOption(option =>
        option.setName('point4').setDescription('Announcement point #4').setRequired(false))
      .addStringOption(option =>
        option.setName('point5').setDescription('Announcement point #5').setRequired(false))
      .addBooleanOption(option =>
        option.setName('ping').setDescription('Ping @everyone?').setRequired(false)),
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
      return interaction.reply({ content: 'You do not have permission to use this command.', flags: [MessageFlags.Ephemeral] });
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
      return interaction.reply({ content: 'You do not have permission to use this command.', flags: [MessageFlags.Ephemeral] });
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
      return interaction.reply({ content: 'You do not have permission to use this command.', flags: [MessageFlags.Ephemeral] });
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
    
    const embed = new EmbedBuilder()
      .setTitle("📊 Bot Dashboard")
      .setDescription(
        `Click the link below to access the dashboard:\n\n🔗 **[Open Dashboard](${dashboardUrl})**`
      )
      .setColor(0x2f3136)
      .setFooter({ text: "Dashboard Access" })
      .setTimestamp();

    await interaction.reply({
      embeds: [embed],
      flags: [MessageFlags.Ephemeral]
    });
  }

  if (commandName === 'ping') {
    await interaction.reply('Pong!');
  }

  if (commandName === 'ars') {
    const subcommand = options.getSubcommand();

    if (subcommand === 'add') {
      const targetUser = options.getUser('user', true);
      const priority = options.getInteger('priority', true);
      const summary = options.getString('summary', true);
      const caseId = `ARS-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`;

      await storage.createCase({
        type: 'ars_report',
        targetId: targetUser.id,
        targetName: targetUser.tag,
        moderatorId: user.id,
        moderatorName: user.tag,
        reason: summary,
        active: true,
        metadata: { caseId, priority, status: 'Open' }
      });

      const embed = new EmbedBuilder()
        .setTitle("🚓 ARS INCIDENT REPORT")
        .setColor(0x243b55)
        .addFields(
          { name: "Case #", value: caseId, inline: true },
          { name: "Status", value: "🟡 Open", inline: true },
          { name: "Priority", value: priority.toString(), inline: true },
          { name: "Subject", value: `<@${targetUser.id}>` },
          { name: "Reporting Officer", value: `<@${user.id}>` },
          { name: "Incident Summary", value: summary }
        )
        .setFooter({ text: "ARS Report Logged Automatically" })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    if (subcommand === 'search') {
      const caseId = options.getString('case_id');
      const targetUser = options.getUser('user');
      const allCases = await storage.getCases();
      
      const results = allCases.filter(c => {
        if (c.type !== 'ars_report' && c.type !== 'cad_report') return false;
        const meta = c.metadata as any;
        if (caseId && meta?.caseId !== caseId) return false;
        if (targetUser && c.targetId !== targetUser.id) return false;
        return true;
      });

      if (results.length === 0) {
        return interaction.reply({ content: '🔍 No matching ARS reports found.', flags: [MessageFlags.Ephemeral] });
      }

      const embed = new EmbedBuilder()
        .setTitle("🔍 ARS SEARCH RESULTS")
        .setColor(0x2b3a67)
        .setDescription(results.map(r => {
          const meta = r.metadata as any;
          return `**${meta?.caseId}** - ${meta?.status} (P${meta?.priority})\nSubject: ${r.targetName}\nSummary: ${r.reason ? r.reason.substring(0, 50) : 'No summary'}...`;
        }).join('\n\n'))
        .setFooter({ text: "ARS Search Module" });

      return interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
    }

    if (subcommand === 'edit') {
      const caseId = options.getString('case_id', true);
      const status = options.getString('status');
      const priority = options.getInteger('priority');
      const summary = options.getString('summary');

      const allCases = await storage.getCases();
      const report = allCases.find(c => (c.metadata as any)?.caseId === caseId);

      if (!report) {
        return interaction.reply({ content: '❌ Report not found.', flags: [MessageFlags.Ephemeral] });
      }

      const meta = report.metadata as any;
      if (status) meta.status = status;
      if (priority) meta.priority = priority;
      
      await storage.updateCase(report.id, {
        reason: summary || report.reason,
        active: status === 'Open',
        metadata: meta
      });

      return interaction.reply({ content: `✅ ARS Report ${caseId} updated.`, flags: [MessageFlags.Ephemeral] });
    }

    if (subcommand === 'close') {
      const caseId = options.getString('case_id', true);
      const allCases = await storage.getCases();
      const report = allCases.find(c => (c.metadata as any)?.caseId === caseId);

      if (!report) {
        return interaction.reply({ content: '❌ Report not found.', flags: [MessageFlags.Ephemeral] });
      }

      const meta = report.metadata as any;
      meta.status = 'Closed';
      
      await storage.updateCase(report.id, {
        active: false,
        metadata: meta
      });

      return interaction.reply({ content: `✅ ARS Report ${caseId} has been closed.`, flags: [MessageFlags.Ephemeral] });
    }

    if (subcommand === 'delete') {
      const caseId = options.getString('case_id', true);
      const allCases = await storage.getCases();
      const report = allCases.find(c => (c.metadata as any)?.caseId === caseId);

      if (!report) {
        return interaction.reply({ content: '❌ Report not found.', flags: [MessageFlags.Ephemeral] });
      }

      await storage.deleteCase(report.id);
      return interaction.reply({ content: `🗑️ ARS Report ${caseId} deleted.`, flags: [MessageFlags.Ephemeral] });
    }
  }

  if (commandName === 'announce') {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({ content: 'You do not have permission to use this command.', flags: [MessageFlags.Ephemeral] });
    }

    const title = options.getString('title', true);
    const message = options.getString('message', true);
    const targetChannel = options.getChannel('channel') || interaction.channel;
    const ping = options.getBoolean('ping') || false;

    if (!targetChannel || !('send' in targetChannel)) {
      return interaction.reply({ content: '❌ Invalid channel selected.', flags: [MessageFlags.Ephemeral] });
    }

    const points = [];
    for (let i = 1; i <= 5; i++) {
      const point = options.getString(`point${i}`);
      if (point) points.push(`**${i}.** ${point}`);
    }

    const embed = new EmbedBuilder()
      .setTitle(`📢 ${title}`)
      .setDescription(message)
      .setColor(0xff0000)
      .setFooter({ text: `Announcement by ${user.tag}` })
      .setTimestamp();

    if (points.length > 0) {
      embed.addFields({
        name: '📌 Details',
        value: points.join('\n'),
      });
    }

    try {
      await (targetChannel as any).send({
        content: ping ? '@everyone' : null,
        embeds: [embed],
        allowedMentions: { parse: ping ? ['everyone'] : [] }
      });

      await interaction.reply({
        content: `✅ Announcement sent to <#${targetChannel.id}>`,
        flags: [MessageFlags.Ephemeral]
      });
    } catch (error) {
      console.error('Failed to send announcement:', error);
      await interaction.reply({
        content: '❌ Failed to send announcement. Make sure I have permission to send messages in that channel.',
        flags: [MessageFlags.Ephemeral]
      });
    }
  }

  if (commandName === 'reactionrole') {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: 'Admins only.', flags: [MessageFlags.Ephemeral] });
    }

    const title = interaction.options.getString('title', true);
    const description = interaction.options.getString('description', true);
    const emoji = interaction.options.getString('emoji', true);
    const role = interaction.options.getRole('role', true);

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(`${description}\n\nReact with ${emoji} to get **${role.name}**`)
      .setColor('Blue');

    const channel = interaction.channel as any;
    const message = await channel?.send({ embeds: [embed] });
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

      await interaction.reply({ content: '✅ Reaction role panel created.', flags: [MessageFlags.Ephemeral] });
    } else {
      await interaction.reply({ content: '❌ Failed to create panel.', flags: [MessageFlags.Ephemeral] });
    }
  }

  if (commandName === 'note') {
    const subcommand = options.getSubcommand();

    if (subcommand === 'create') {
      const modal = new ModalBuilder()
        .setCustomId('noteModal')
        .setTitle('Note Report Form');

      const titleInput = new TextInputBuilder()
        .setCustomId('noteTitle')
        .setLabel('Title')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const subjectInput = new TextInputBuilder()
        .setCustomId('noteSubject')
        .setLabel('Subject / Person')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const detailsInput = new TextInputBuilder()
        .setCustomId('noteDetails')
        .setLabel('Details')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      const row1 = new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput);
      const row2 = new ActionRowBuilder<TextInputBuilder>().addComponents(subjectInput);
      const row3 = new ActionRowBuilder<TextInputBuilder>().addComponents(detailsInput);

      modal.addComponents(row1, row2, row3);

      await interaction.showModal(modal);
    } else if (subcommand === 'search') {
      const queryValue = interaction.options.getString('query', true).toLowerCase();

      // Fetch logs of type 'note_report' from storage
      const logs = await storage.getLogs();
      const results = logs.filter(log => {
        if (log.type !== 'note_report') return false;
        const metadata = log.metadata as any;
        return (
          metadata?.title?.toLowerCase().includes(queryValue) ||
          metadata?.subject?.toLowerCase().includes(queryValue) ||
          metadata?.details?.toLowerCase().includes(queryValue) ||
          log.username?.toLowerCase().includes(queryValue)
        );
      });

      if (results.length === 0) {
        return interaction.reply({
          content: '🔍 No matching notes found.',
          flags: [MessageFlags.Ephemeral]
        });
      }

      const list = results.map(n => {
        const meta = n.metadata as any;
        return `**ID ${n.id}** — ${meta?.title || 'No Title'}\nSubject: ${meta?.subject || 'Unknown'}\nAuthor: ${n.username}`;
      }).join('\n\n');

      const embed = new EmbedBuilder()
        .setTitle(`🔍 Search Results (${results.length})`)
        .setDescription(list.substring(0, 4000))
        .setColor('Purple');

      return interaction.reply({
        embeds: [embed],
        flags: [MessageFlags.Ephemeral]
      });
    }
  }
}

async function handleReactionAdd(reaction: MessageReaction | any, user: User | any) {
  if (user.bot) return;
  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch (error) {
      console.error('Something went wrong when fetching the reaction:', error);
      return;
    }
  }

  const rc = await (storage as any).getRoleConfigByReaction(reaction.message.id, reaction.emoji.name || "");
  if (rc) {
    const member = await reaction.message.guild?.members.fetch(user.id);
    if (member) await member.roles.add(rc.roleId);
  }
}

async function handleReactionRemove(reaction: MessageReaction | any, user: User | any) {
  if (user.bot) return;
  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch (error) {
      console.error('Something went wrong when fetching the reaction:', error);
      return;
    }
  }

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
        const channel = message.channel;
        if (channel && 'send' in channel) {
          await (channel as any).send(`👢 **KICKED** ${message.author.tag}: ${reason}`);
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
        const channel = message.channel;
        if (channel.isTextBased() && 'send' in channel) {
          await (channel as any).send(`🔨 **BANNED** ${message.author.tag}: ${reason}`);
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
