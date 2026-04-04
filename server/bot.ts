import { Client, GatewayIntentBits, Events, Partials, Message, SlashCommandBuilder, REST, Routes, ChatInputCommandInteraction, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, InteractionType, PermissionFlagsBits, MessageReaction, User, MessageFlags, AttachmentBuilder } from "discord.js";
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

  client.on('error', (err) => {
    console.error('[Discord] Client error (non-fatal):', err);
  });

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

    // !dashboard command
    if (message.content === "!dashboard") {
      if (!message.member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return message.reply("❌ Moderator only");
      }

      const password = process.env.DASHBOARD_PASSWORD || "No password set";
      const link = process.env.REPL_SLUG && process.env.REPL_OWNER
        ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co/mod?pwd=${password}`
        : "Dashboard URL not configured.";

      return message.reply(`🛠 Moderator Panel:\n${link}`);
    }

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
      // Command Logger — fire-and-forget so it never blocks the interaction response
      void (async () => {
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
      })();

      try {
        await handleSlashCommand(interaction);
      } catch (err) {
        console.error('[Discord] Unhandled error in slash command:', err);
        try {
          const msg = { content: '❌ An unexpected error occurred.', flags: [MessageFlags.Ephemeral] };
          if (interaction.deferred || interaction.replied) {
            await interaction.editReply(msg);
          } else {
            await interaction.reply(msg);
          }
        } catch { /* interaction may have expired */ }
      }
    } else if (interaction.type === InteractionType.ModalSubmit) {
      try {
        await handleModalSubmit(interaction);
      } catch (err) {
        console.error('[Discord] Unhandled error in modal submit:', err);
      }
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
      .setName('testjoin')
      .setDescription('Simulate a member joining to test the welcome image')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
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
    new SlashCommandBuilder()
      .setName('stats')
      .setDescription('Show live database and bot stats')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    new SlashCommandBuilder()
      .setName('rolelist')
      .setDescription('Add or remove members from a role list')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
      .addSubcommand(sub =>
        sub.setName('add')
          .setDescription('Add a member to a role list')
          .addRoleOption(opt => opt.setName('role').setDescription('The role to add the member to').setRequired(true))
          .addUserOption(opt => opt.setName('user').setDescription('The user to add').setRequired(true)))
      .addSubcommand(sub =>
        sub.setName('remove')
          .setDescription('Remove a member from a role list')
          .addRoleOption(opt => opt.setName('role').setDescription('The role to remove the member from').setRequired(true))
          .addUserOption(opt => opt.setName('user').setDescription('The user to remove').setRequired(true)))
      .addSubcommand(sub =>
        sub.setName('view')
          .setDescription('View members in a role list')
          .addRoleOption(opt => opt.setName('role').setDescription('The role to view').setRequired(true))),
    new SlashCommandBuilder()
      .setName('timeout')
      .setDescription('Timeout (mute) a member for a set duration')
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .addUserOption(opt => opt.setName('user').setDescription('The member to timeout').setRequired(true))
      .addIntegerOption(opt => opt.setName('duration').setDescription('Duration in minutes').setRequired(true).setMinValue(1).setMaxValue(40320))
      .addStringOption(opt => opt.setName('reason').setDescription('Reason for the timeout').setRequired(false)),
    new SlashCommandBuilder()
      .setName('syncroles')
      .setDescription('Sync all Discord role members into the role list tracking database')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
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
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.KickMembers)) {
      return interaction.reply({ content: '❌ You need the Kick Members permission to warn users.', flags: [MessageFlags.Ephemeral] });
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
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.KickMembers)) {
      return interaction.reply({ content: '❌ You need the Kick Members permission.', flags: [MessageFlags.Ephemeral] });
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
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.BanMembers)) {
      return interaction.reply({ content: '❌ You need the Ban Members permission.', flags: [MessageFlags.Ephemeral] });
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

  if (commandName === 'stats') {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({ content: '❌ You need the Manage Server permission.', flags: [MessageFlags.Ephemeral] });
    }

    try {
      const start = Date.now();
      const stats = await storage.getStats();
      const dbPing = Date.now() - start;

      const embed = new EmbedBuilder()
        .setTitle("🛠 Moderator Database Dashboard")
        .setDescription("Quick access to live stats and management links")
        .addFields(
          { name: "DB Ping", value: `${dbPing}ms`, inline: true },
          { name: "Total Logs", value: stats.totalLogs.toString(), inline: true },
          { name: "Total Cases", value: stats.totalCases.toString(), inline: true },
          { name: "Dashboard", value: `[Click Here](${process.env.REPL_SLUG && process.env.REPL_OWNER ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co/mod` : 'Not Configured'})` }
        )
        .setColor(0x5865F2)
        .setFooter({ text: "Moderator only" })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
    } catch (err) {
      console.error(err);
      await interaction.reply({ content: "❌ Stats failed to load.", flags: [MessageFlags.Ephemeral] });
    }
  }

  if (commandName === 'testjoin') {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: 'Admins only.', flags: [MessageFlags.Ephemeral] });
    }
    
    await interaction.reply({ content: '🔄 Simulating join event...', flags: [MessageFlags.Ephemeral] });
    client?.emit(Events.GuildMemberAdd, interaction.member as any);
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

  if (commandName === 'rolelist') {
    const subcommand = options.getSubcommand();
    const role = options.getRole('role', true);

    if (subcommand === 'add') {
      const targetUser = options.getUser('user', true);
      const guildMember = options.getMember('user');

      // Always save to the list regardless of Discord role assignment
      await storage.addRoleListMember({
        roleId: role.id,
        roleName: role.name,
        userId: targetUser.id,
        username: targetUser.tag,
        addedById: user.id,
        addedByName: user.tag,
        action: 'add',
      });

      await storage.createLog({
        type: 'role_list_add',
        content: `${user.tag} added ${targetUser.tag} to role list: ${role.name}`,
        userId: user.id,
        username: user.tag,
        metadata: { roleId: role.id, roleName: role.name, targetUserId: targetUser.id, targetUsername: targetUser.tag },
      });

      // Attempt Discord role assignment separately (may fail due to hierarchy)
      let roleAssigned = false;
      if (guildMember && 'roles' in guildMember) {
        try {
          await (guildMember as any).roles.add(role.id);
          roleAssigned = true;
        } catch {
          roleAssigned = false;
        }
      }

      const embed = new EmbedBuilder()
        .setTitle('✅ Role List — Member Added')
        .setColor(0x57F287)
        .addFields(
          { name: 'User', value: `<@${targetUser.id}> (${targetUser.tag})`, inline: true },
          { name: 'Role', value: `<@&${role.id}> (${role.name})`, inline: true },
          { name: 'Added By', value: `<@${user.id}>`, inline: true },
          { name: 'Discord Role Assigned', value: roleAssigned ? '✅ Yes' : '⚠️ No (bot lacks hierarchy)', inline: false },
        )
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    if (subcommand === 'remove') {
      const targetUser = options.getUser('user', true);
      const guildMember = options.getMember('user');

      // Always remove from list regardless of Discord role removal
      await storage.removeRoleListMember(role.id, targetUser.id);

      await storage.createLog({
        type: 'role_list_remove',
        content: `${user.tag} removed ${targetUser.tag} from role list: ${role.name}`,
        userId: user.id,
        username: user.tag,
        metadata: { roleId: role.id, roleName: role.name, targetUserId: targetUser.id, targetUsername: targetUser.tag },
      });

      // Attempt Discord role removal separately
      let roleRemoved = false;
      if (guildMember && 'roles' in guildMember) {
        try {
          await (guildMember as any).roles.remove(role.id);
          roleRemoved = true;
        } catch {
          roleRemoved = false;
        }
      }

      const embed = new EmbedBuilder()
        .setTitle('🗑️ Role List — Member Removed')
        .setColor(0xED4245)
        .addFields(
          { name: 'User', value: `<@${targetUser.id}> (${targetUser.tag})`, inline: true },
          { name: 'Role', value: `<@&${role.id}> (${role.name})`, inline: true },
          { name: 'Removed By', value: `<@${user.id}>`, inline: true },
          { name: 'Discord Role Removed', value: roleRemoved ? '✅ Yes' : '⚠️ No (bot lacks hierarchy)', inline: false },
        )
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    if (subcommand === 'view') {
      const members = await storage.getRoleListMembers(role.id);

      // Pull the live Discord role object for color, position, etc.
      const liveRole = guild.roles.cache.get(role.id);
      const roleColor = liveRole?.color || 0x5865F2;
      const rolePosition = liveRole?.position ?? '—';
      const roleMentionable = liveRole?.mentionable ? '✅ Yes' : '❌ No';
      const roleHoisted = liveRole?.hoist ? '✅ Yes' : '❌ No';
      const liveCount = liveRole?.members.size ?? 0;

      if (members.length === 0) {
        const emptyEmbed = new EmbedBuilder()
          .setTitle(`📋 Role List — ${role.name}`)
          .setColor(roleColor)
          .setDescription('> No members have been added to this role list yet.')
          .addFields(
            { name: '🎭 Role', value: `<@&${role.id}>`, inline: true },
            { name: '🔢 Discord Position', value: `#${rolePosition}`, inline: true },
            { name: '📌 Hoisted', value: roleHoisted, inline: true },
            { name: '🔔 Mentionable', value: roleMentionable, inline: true },
            { name: '👥 Live Members', value: `${liveCount}`, inline: true },
            { name: '📝 List Count', value: '0', inline: true },
          )
          .setFooter({ text: `Role ID: ${role.id}` })
          .setTimestamp();

        return interaction.reply({ embeds: [emptyEmbed] });
      }

      // Build numbered member lines — mention + username + added date
      const memberLines = members.map((m, i) => {
        const addedDate = new Date(m.timestamp);
        const dateStr = `<t:${Math.floor(addedDate.getTime() / 1000)}:R>`;
        return `\`${String(i + 1).padStart(2, '0')}.\` <@${m.userId}> **${m.username}** — added ${dateStr} by **${m.addedByName}**`;
      });

      // Chunk into pages of 1024 chars max per field
      const chunks: string[] = [];
      let current = '';
      for (const line of memberLines) {
        if ((current + '\n' + line).length > 1024) {
          chunks.push(current.trim());
          current = line;
        } else {
          current += (current ? '\n' : '') + line;
        }
      }
      if (current) chunks.push(current.trim());

      const embed = new EmbedBuilder()
        .setTitle(`📋 Role List — ${role.name}`)
        .setColor(roleColor)
        .addFields(
          { name: '🎭 Role', value: `<@&${role.id}>`, inline: true },
          { name: '🔢 Discord Position', value: `#${rolePosition}`, inline: true },
          { name: '📌 Hoisted', value: roleHoisted, inline: true },
          { name: '🔔 Mentionable', value: roleMentionable, inline: true },
          { name: '👥 Live Members', value: `${liveCount}`, inline: true },
          { name: '📝 List Count', value: `${members.length}`, inline: true },
        );

      chunks.forEach((chunk, idx) => {
        embed.addFields({
          name: idx === 0 ? '👤 Members' : '​', // zero-width space for continuation fields
          value: chunk,
        });
      });

      embed
        .setFooter({ text: `Role ID: ${role.id} • Last updated` })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }
  }

  // ── /timeout ──────────────────────────────────────────────────────────────
  if (commandName === 'timeout') {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)) {
      return interaction.reply({ content: '❌ You need the Moderate Members permission.', flags: [MessageFlags.Ephemeral] });
    }

    const target = options.getMember('user');
    if (!target || !('timeout' in target)) {
      return interaction.reply({ content: '❌ User not found in this server.', flags: [MessageFlags.Ephemeral] });
    }

    const targetUser = options.getUser('user', true);
    const durationMins = options.getInteger('duration', true);
    const reason = options.getString('reason') || 'No reason provided';
    const durationMs = durationMins * 60 * 1000;

    try {
      await (target as any).timeout(durationMs, reason);
    } catch {
      return interaction.reply({ content: '❌ Could not timeout this user (check role hierarchy and bot permissions).', flags: [MessageFlags.Ephemeral] });
    }

    await storage.createCase({
      type: 'timeout',
      targetId: targetUser.id,
      targetName: targetUser.tag,
      moderatorId: user.id,
      moderatorName: user.tag,
      reason,
      active: true,
      metadata: { durationMins, expiresAt: new Date(Date.now() + durationMs).toISOString() },
    });

    await storage.createLog({
      type: 'timeout',
      content: `${user.tag} timed out ${targetUser.tag} for ${durationMins} minute(s): ${reason}`,
      userId: user.id,
      username: user.tag,
      metadata: { targetUserId: targetUser.id, durationMins, reason },
    });

    const durationLabel = durationMins >= 1440
      ? `${Math.round(durationMins / 1440)} day(s)`
      : durationMins >= 60
      ? `${Math.round(durationMins / 60)} hour(s)`
      : `${durationMins} minute(s)`;

    const embed = new EmbedBuilder()
      .setTitle('🔇 Member Timed Out')
      .setColor(0xFEE75C)
      .addFields(
        { name: 'User', value: `<@${targetUser.id}> (${targetUser.tag})`, inline: true },
        { name: 'Duration', value: durationLabel, inline: true },
        { name: 'Moderator', value: `<@${user.id}>`, inline: true },
        { name: 'Reason', value: reason },
        { name: 'Expires', value: `<t:${Math.floor((Date.now() + durationMs) / 1000)}:F>` },
      )
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  }

  // ── /syncroles ────────────────────────────────────────────────────────────
  if (commandName === 'syncroles') {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ Administrator permission required.', flags: [MessageFlags.Ephemeral] });
    }

    await interaction.deferReply();

    try {
      // Fetch ALL guild members
      const allMembers = await guild.members.fetch();

      // Get all non-default roles (exclude @everyone)
      const guildRoles = guild.roles.cache.filter(r => r.id !== guild.id);

      let added = 0;
      let skipped = 0;

      for (const [, guildMember] of allMembers) {
        if (guildMember.user.bot) continue;

        for (const [, memberRole] of guildMember.roles.cache) {
          if (memberRole.id === guild.id) continue; // skip @everyone

          const alreadyTracked = await storage.isRoleListMember(memberRole.id, guildMember.id);
          if (alreadyTracked) {
            skipped++;
            continue;
          }

          await storage.addRoleListMember({
            roleId: memberRole.id,
            roleName: memberRole.name,
            userId: guildMember.id,
            username: guildMember.user.tag,
            addedById: client!.user!.id,
            addedByName: client!.user!.tag,
            action: 'add',
          });
          added++;
        }
      }

      const embed = new EmbedBuilder()
        .setTitle('✅ Role Sync Complete')
        .setColor(0x57F287)
        .addFields(
          { name: '👥 Members Scanned', value: `${allMembers.size}`, inline: true },
          { name: '🎭 Roles Found', value: `${guildRoles.size}`, inline: true },
          { name: '➕ Entries Added', value: `${added}`, inline: true },
          { name: '⏭️ Already Tracked', value: `${skipped}`, inline: true },
        )
        .setFooter({ text: `Synced by ${user.tag}` })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('syncroles error:', err);
      return interaction.editReply({ content: '❌ Role sync failed. Check bot permissions (needs Read Members intent).' });
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
