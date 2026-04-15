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

  client.on(Events.ShardDisconnect, (event, shardId) => {
    console.warn(`[Discord] Shard ${shardId} disconnected (code ${event.code}). Discord.js will auto-reconnect.`);
  });

  client.on(Events.ShardReconnecting, (shardId) => {
    console.log(`[Discord] Shard ${shardId} reconnecting…`);
  });

  client.on(Events.ShardResume, (shardId, replayedEvents) => {
    console.log(`[Discord] Shard ${shardId} resumed (${replayedEvents} events replayed).`);
  });

  client.on(Events.ShardError, (err, shardId) => {
    console.error(`[Discord] Shard ${shardId} error (non-fatal):`, err.message);
  });

  client.on(Events.ClientReady, async (c) => {
    console.log(`Ready! Logged in as ${c.user.tag}`);
    const guild = c.guilds.cache.first();
    if (guild) {
      await registerSlashCommands(c.user.id, guild.id);
    } else {
      console.warn('[Bot] No guilds found — slash commands not registered.');
    }
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
if (commandName === 'faction') {
  const subcommand = options.getSubcommand();
  
  if (subcommand === 'create') {
    const name = options.getString('name', true);
    const tag = options.getString('tag', true);
    
    if (tag.length < 3 || tag.length > 5) {
      return interaction.reply('❌ Tag must be 3-5 characters.');
    }
    
    const faction = await dayz.createFaction(name, tag, user.id, user.tag);
    if (!faction) {
      return interaction.reply('❌ Failed to create faction.');
    }
    
    await interaction.reply(`✅ Faction **${name}** [${tag}] created! You are the leader.`);
  }
  
  if (subcommand === 'info') {
    const factionName = options.getString('faction', true);
    const faction = await storage.getFactionByName(factionName);
    
    if (!faction) {
      return interaction.reply('❌ Faction not found.');
    }
    
    const embed = new EmbedBuilder()
      .setColor(faction.color as any)
      .setTitle(`${faction.name} [${faction.tag}]`)
      .addFields(
        { name: 'Leader', value: faction.leader_name, inline: true },
        { name: 'Status', value: faction.status, inline: true },
        { name: 'Kills', value: faction.kills.toString(), inline: true },
        { name: 'Treasury', value: `$${faction.treasury}`, inline: true },
        { name: 'Territory', value: faction.territory, inline: true },
        { name: 'HQ', value: faction.hq, inline: true },
        { name: 'Description', value: faction.description }
      );
    
    await interaction.reply({ embeds: [embed] });
  }
  
  if (subcommand === 'members') {
    const factionName = options.getString('faction', true);
    const faction = await storage.getFactionByName(factionName);
    
    if (!faction) {
      return interaction.reply('❌ Faction not found.');
    }
    
    const members = await storage.getFactionMembers(faction.id);
    if (members.length === 0) {
      return interaction.reply('❌ No members in this faction.');
    }
    
    const memberList = members
      .map(m => `**${m.username}** - ${m.rank} (${m.kills} kills, ${m.deaths} deaths)`)
      .join('\n');
    
    const embed = new EmbedBuilder()
      .setColor(faction.color as any)
      .setTitle(`${faction.name} Members (${members.length})`)
      .setDescription(memberList);
    
    await interaction.reply({ embeds: [embed] });
  }
  
  if (subcommand === 'leaderboard') {
    const factions = await dayz.getFactionLeaderboard(10);
    
    if (factions.length === 0) {
      return interaction.reply('❌ No factions found.');
    }
    
    const leaderboard = factions
      .map((f, i) => `**${i + 1}.** ${f.name} [${f.tag}] - ${f.kills} kills`)
      .join('\n');
    
    const embed = new EmbedBuilder()
      .setColor(0xffd700)
      .setTitle('🏆 Faction Leaderboard')
      .setDescription(leaderboard);
    
    await interaction.reply({ embeds: [embed] });
  }
}

if (commandName === 'killfeed') {
  const subcommand = options.getSubcommand();
  
  if (subcommand === 'setup') {
    const channel = options.getChannel('channel', true);
    await storage.setSetting('killfeed_channel', channel.id);
    await interaction.reply(`✅ Killfeed channel set to ${channel}`);
  }
  
  if (subcommand === 'post') {
    const killer = options.getString('killer', true);
    const victim = options.getString('victim', true);
    const weapon = options.getString('weapon');
    const distance = options.getNumber('distance');
    const location = options.getString('location');
    
    const killfeedChannelId = await storage.getSetting('killfeed_channel');
    if (!killfeedChannelId?.value) {
      return interaction.reply('❌ Killfeed channel not configured.');
    }
    
    const channel = guild.channels.cache.get(killfeedChannelId.value);
    if (!channel || !('send' in channel)) {
      return interaction.reply('❌ Killfeed channel not found.');
    }
    
    const success = await dayz.postKillToFeed(channel as any, {
      killerId: 'manual',
      killerName: killer,
      victimId: 'manual',
      victimName: victim,
      weapon,
      distance: distance || undefined,
      location,
      serverId: 1,
    });
    
    if (success) {
      await interaction.reply('✅ Kill posted to killfeed.');
    } else {
      await interaction.reply('❌ Failed to post kill.');
    }
  }
}
  // Handle Reactions
  client.on(Events.MessageReactionAdd, handleReactionAdd);
  client.on(Events.MessageReactionRemove, handleReactionRemove);

  client.login(process.env.DISCORD_TOKEN).catch(err => {
    console.error("Failed to login to Discord:", err);
  });

  return client;
}

async function registerSlashCommands(clientId: string, guildId: string) {
  const commands = [
    new SlashCommandBuilder()
      .setName('warn')
      .setDescription('Warn a user')
      .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
      .addUserOption(option => option.setName('user').setDescription('The user to warn').setRequired(true))
      .addStringOption(option => option.setName('reason').setDescription('The reason for the warning')),
    new SlashCommandBuilder()
      .setName('kick')
      .setDescription('Kick a member from the server')
      .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
      .addUserOption(option => option.setName('user').setDescription('The user to kick').setRequired(true))
      .addStringOption(option => option.setName('reason').setDescription('Reason for kick').setRequired(false)),
    new SlashCommandBuilder()
      .setName('ban')
      .setDescription('Ban a user')
      .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
      .addUserOption(option => option.setName('user').setDescription('The user to ban').setRequired(true))
      .addStringOption(option => option.setName('reason').setDescription('The reason for the ban')),
    new SlashCommandBuilder()
      .setName('logs')
      .setDescription('View recent logs for a user')
      .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
      .addUserOption(option => option.setName('user').setDescription('The user to view logs for').setRequired(true)),
    new SlashCommandBuilder()
      .setName('dashboard')
      .setDescription('Get the link to the moderation dashboard')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
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
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
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
    console.log('Registering slash commands for guild...');
    await rest.put(Routes.applicationCommands(clientId), { body: [] });
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
    console.log(`Successfully registered ${commands.length} guild commands.`);
  } catch (error) {
    console.error('[Bot] Failed to register slash commands:', error);
  }
}
    }
  } catch (error) {
    console.error("AutoMod Error:", error);
  }
}
new SlashCommandBuilder()
  .setName('faction')
  .setDescription('DayZ faction management')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand(sub =>
    sub.setName('create')
      .setDescription('Create a new faction')
      .addStringOption(opt => opt.setName('name').setDescription('Faction name').setRequired(true))
      .addStringOption(opt => opt.setName('tag').setDescription('Faction tag (3-5 chars)').setRequired(true)))
  .addSubcommand(sub =>
    sub.setName('info')
      .setDescription('View faction information')
      .addStringOption(opt => opt.setName('faction').setDescription('Faction name').setRequired(true)))
  .addSubcommand(sub =>
    sub.setName('members')
      .setDescription('List faction members')
      .addStringOption(opt => opt.setName('faction').setDescription('Faction name').setRequired(true)))
  .addSubcommand(sub =>
    sub.setName('invite')
      .setDescription('Invite player to faction')
      .addStringOption(opt => opt.setName('faction').setDescription('Faction name').setRequired(true))
      .addStringOption(opt => opt.setName('player').setDescription('Player name').setRequired(true)))
  .addSubcommand(sub =>
    sub.setName('kick')
      .setDescription('Remove member from faction')
      .addStringOption(opt => opt.setName('faction').setDescription('Faction name').setRequired(true))
      .addStringOption(opt => opt.setName('player').setDescription('Player name').setRequired(true)))
  .addSubcommand(sub =>
    sub.setName('promote')
      .setDescription('Promote faction member')
      .addStringOption(opt => opt.setName('faction').setDescription('Faction name').setRequired(true))
      .addStringOption(opt => opt.setName('player').setDescription('Player name').setRequired(true))
      .addStringOption(opt => opt.setName('rank').setDescription('New rank').setRequired(true)
        .addChoices(
          { name: 'Member', value: 'member' },
          { name: 'Officer', value: 'officer' },
          { name: 'Leader', value: 'leader' }
        )))
  .addSubcommand(sub =>
    sub.setName('stats')
      .setDescription('View faction statistics')
      .addStringOption(opt => opt.setName('faction').setDescription('Faction name').setRequired(true)))
  .addSubcommand(sub =>
    sub.setName('leaderboard')
      .setDescription('View top factions by kills')),
new SlashCommandBuilder()
  .setName('killfeed')
  .setDescription('DayZ killfeed management')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand(sub =>
    sub.setName('setup')
      .setDescription('Set killfeed channel')
      .addChannelOption(opt => opt.setName('channel').setDescription('Channel for kills').setRequired(true)))
  .addSubcommand(sub =>
    sub.setName('post')
      .setDescription('Manually post a kill')
      .addStringOption(opt => opt.setName('killer').setDescription('Killer name').setRequired(true))
      .addStringOption(opt => opt.setName('victim').setDescription('Victim name').setRequired(true))
      .addStringOption(opt => opt.setName('weapon').setDescription('Weapon used').setRequired(false))
      .addNumberOption(opt => opt.setName('distance').setDescription('Distance in meters').setRequired(false))
      .addStringOption(opt => opt.setName('location').setDescription('Location').setRequired(false))),
