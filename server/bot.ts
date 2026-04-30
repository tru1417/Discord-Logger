import {
  Client,
  GatewayIntentBits,
  Events,
  Partials,
  Message,
  SlashCommandBuilder,
  REST,
  Routes,
  ChatInputCommandInteraction,
  EmbedBuilder,
  InteractionType,
  PermissionFlagsBits,
  MessageReaction,
  User,
  MessageFlags,
  AttachmentBuilder,
  TextChannel,
  Guild,
} from "discord.js";
import { storage } from "./storage";
import { OpenAI } from "openai";
import { createCanvas, loadImage } from "canvas";
import { getRconStatus, getServerStatus, sayGlobal } from "./rcon";
import {
  getFivemServerStatus,
  getTxAdminStatus,
  runFivemConsoleCommand,
  fivemSay,
  fivemKick,
  fivemBan,
} from "./fivem";

/**
 * Build an embed pre-decorated with the Discord server's identity.
 * Adds: author = guild name + icon, thumbnail = guild icon, footer with icon,
 * timestamp. Callers can still override any of these afterwards.
 */
function serverEmbed(guild: Guild | null | undefined): EmbedBuilder {
  const e = new EmbedBuilder().setTimestamp();
  if (guild) {
    const icon = guild.iconURL({ size: 256 }) || undefined;
    e.setAuthor({ name: guild.name, iconURL: icon });
    if (icon) e.setThumbnail(icon);
    e.setFooter({ text: guild.name, iconURL: icon });
  }
  return e;
}

let client: Client | null = null;
let openai: OpenAI | null = null;

export function initializeBot() {
  if (client) return client;

  if (!process.env.DISCORD_TOKEN) {
    console.log("DISCORD_TOKEN not found. Bot will not start.");
    return null;
  }

  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || "replit",
    baseURL: process.env.OPENAI_BASE_URL || "https://api.replit.com/v1",
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

  client.on("error", (err) => {
    console.error("[Discord] Client error (non-fatal):", err);
  });

  client.on(Events.ShardDisconnect, (event, shardId) => {
    console.warn(
      `[Discord] Shard ${shardId} disconnected (code ${event.code}). Discord.js will auto-reconnect.`
    );
  });

  client.on(Events.ShardReconnecting, (shardId) => {
    console.log(`[Discord] Shard ${shardId} reconnecting…`);
  });

  client.on(Events.ShardResume, (shardId, replayedEvents) => {
    console.log(
      `[Discord] Shard ${shardId} resumed (${replayedEvents} events replayed).`
    );
  });

  client.on(Events.ShardError, (err, shardId) => {
    console.error(
      `[Discord] Shard ${shardId} error (non-fatal):`,
      (err as Error).message
    );
  });

  client.on(Events.ClientReady, async (c) => {
    console.log(`Ready! Logged in as ${c.user.tag}`);
    const guild = c.guilds.cache.first();
    if (guild) {
      await registerSlashCommands(c.user.id, guild.id);
    } else {
      console.warn("[Bot] No guilds found — slash commands not registered.");
    }
  });

  client.on(Events.MessageDelete, async (message) => {
    if (message.partial) {
      try {
        await message.fetch();
      } catch (e) {
        console.log("Could not fetch deleted message:", e);
      }
    }

    if (message.author?.bot) return;

    await storage.createLog({
      type: "message_delete",
      content: message.content || "[No Content / Image]",
      userId: message.author?.id || "unknown",
      username: message.author?.tag || "unknown",
      metadata: {
        channelId: message.channel.id,
        guildId: message.guild?.id,
      },
    });
  });

  client.on(Events.GuildMemberAdd, async (member) => {
    await storage.createLog({
      type: "member_join",
      content: `User ${member.user.tag} joined the server.`,
      userId: member.id,
      username: member.user.tag,
      metadata: {
        guildId: member.guild.id,
      },
    });

    try {
      const welcomeChannelSetting = await storage.getSetting(
        "welcome_channel_id"
      );
      const logChannelId = welcomeChannelSetting?.value;

      const channel =
        member.guild.channels.cache.get(logChannelId || "") ||
        member.guild.systemChannel;

      if (channel && "send" in channel) {
        const canvas = createCanvas(1000, 350);
        const ctx = canvas.getContext("2d");

        const gradient = ctx.createLinearGradient(0, 0, 1000, 0);
        gradient.addColorStop(0, "#0f0f14");
        gradient.addColorStop(1, "#1f2230");

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 48px sans-serif";
        ctx.fillText("WELCOME TO", 320, 120);

        ctx.font = "bold 56px sans-serif";
        ctx.fillStyle = "#ff4da6";
        ctx.fillText("🔹🔸 Tragic Scene (NLMB) 🔸🔹", 320, 180);

        ctx.font = "bold 44px sans-serif";
        ctx.fillStyle = "#ffffff";
        ctx.fillText(member.user.username, 320, 250);

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

        const attachment = new AttachmentBuilder(canvas.toBuffer(), {
          name: "welcome.png",
        });

        const welcomeSetting = await storage.getSetting("welcome_message");
        const customMessage =
          welcomeSetting?.value ||
          `Welcome {user}!\nPlease hit the big ✅ in #rules then head to #subscriptions for roles.\nRanked players → #claim-your-rank`;

        const formattedMessage = customMessage
          .replace("{user}", `<@${member.id}>`)
          .replace("{server}", member.guild.name);

        await (channel as TextChannel).send({
          content: formattedMessage,
          files: [attachment],
        });
      }
    } catch (error) {
      console.error("Error generating welcome image:", error);
    }

    try {
      const roleConfigs = await storage.getRoleConfigs();
      const autoRoles = roleConfigs.filter((r) => r.isAutoRole);

      for (const config of autoRoles) {
        const role = member.guild.roles.cache.get(config.roleId);
        if (role) {
          await member.roles.add(role);
          await storage.createLog({
            type: "auto_role",
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

  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;

    if (message.content === "!dashboard") {
      if (!message.member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return message.reply("❌ Moderator only");
      }

      const password = process.env.DASHBOARD_PASSWORD || "No password set";
      const link =
        process.env.REPL_SLUG && process.env.REPL_OWNER
          ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co/mod?pwd=${password}`
          : "Dashboard URL not configured.";

      return message.reply(`🛠 Moderator Panel:\n${link}`);
    }

    if (message.content.startsWith("!")) {
      await handleCommand(message);
    } else {
      await handleAutoMod(message);
    }
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (interaction.isChatInputCommand()) {
      void (async () => {
        try {
          const logSetting = await storage.getSetting("command_log_channel");
          const logChannelId = logSetting?.value;
          if (logChannelId) {
            const logChannel = interaction.guild?.channels.cache.get(
              logChannelId
            );
            if (logChannel && "send" in logChannel) {
              const user = interaction.user;
              let optionsUsed = "None";
              if (interaction.options.data.length > 0) {
                optionsUsed = interaction.options.data
                  .map((o) => `${o.name}: ${o.value}`)
                  .join("\n");
              }

              const embed = serverEmbed(interaction.guild)
                .setColor(0xff4d6d)
                .setTitle("📜 Command Executed")
                .addFields(
                  { name: "User", value: `${user.tag}`, inline: true },
                  { name: "User ID", value: `${user.id}`, inline: true },
                  {
                    name: "Command",
                    value: `/${interaction.commandName}`,
                    inline: true,
                  },
                  { name: "Channel", value: `${interaction.channel}`, inline: true },
                  {
                    name: "Server",
                    value: `${interaction.guild?.name}`,
                    inline: true,
                  },
                  {
                    name: "Options",
                    value: optionsUsed.substring(0, 1024),
                  },
                  {
                    name: "Time",
                    value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
                  }
                )
                .setThumbnail(user.displayAvatarURL())
                .setFooter({ text: "Command Logger System" });

              await (logChannel as TextChannel).send({ embeds: [embed] });
            }
          }
        } catch (error) {
          console.error("Error in command logger:", error);
        }
      })();

      try {
        await handleSlashCommand(interaction);
      } catch (err) {
        console.error("[Discord] Unhandled error in slash command:", err);
        try {
          const msg = {
            content: "❌ An unexpected error occurred.",
            flags: [MessageFlags.Ephemeral],
          };
          if (interaction.deferred || interaction.replied) {
            await interaction.editReply(msg);
          } else {
            await interaction.reply(msg);
          }
        } catch {
          /* interaction may have expired */
        }
      }
    } else if (interaction.type === InteractionType.ModalSubmit) {
      try {
        await handleModalSubmit(interaction);
      } catch (err) {
        console.error("[Discord] Unhandled error in modal submit:", err);
      }
    }
  });

  client.on(Events.MessageReactionAdd, handleReactionAdd);
  client.on(Events.MessageReactionRemove, handleReactionRemove);

  client.login(process.env.DISCORD_TOKEN).catch((err) => {
    console.error("Failed to login to Discord:", err);
  });

  return client;
}

async function registerSlashCommands(clientId: string, guildId: string) {
  const commands = [
    new SlashCommandBuilder()
      .setName("warn")
      .setDescription("Warn a user")
      .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
      .addUserOption((option) =>
        option
          .setName("user")
          .setDescription("The user to warn")
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName("reason")
          .setDescription("The reason for the warning")
      ),
    new SlashCommandBuilder()
      .setName("kick")
      .setDescription("Kick a member from the server")
      .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
      .addUserOption((option) =>
        option
          .setName("user")
          .setDescription("The user to kick")
          .setRequired(true)
      )
      .addStringOption((option) =>
        option.setName("reason").setDescription("Reason for kick")
      ),
    new SlashCommandBuilder()
      .setName("ban")
      .setDescription("Ban a user")
      .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
      .addUserOption((option) =>
        option
          .setName("user")
          .setDescription("The user to ban")
          .setRequired(true)
      )
      .addStringOption((option) =>
        option.setName("reason").setDescription("The reason for the ban")
      ),
    new SlashCommandBuilder()
      .setName("logs")
      .setDescription("View recent logs for a user")
      .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
      .addUserOption((option) =>
        option
          .setName("user")
          .setDescription("The user to view logs for")
          .setRequired(true)
      ),
    new SlashCommandBuilder()
      .setName("dashboard")
      .setDescription("Get the link to the moderation dashboard")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    new SlashCommandBuilder()
      .setName("ping")
      .setDescription("Replies with Pong!"),
    new SlashCommandBuilder()
      .setName("testjoin")
      .setDescription("Simulate a member joining to test the welcome image")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder()
      .setName("ars")
      .setDescription("ARS System for incident reports")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
      .addSubcommand((sub) =>
        sub
          .setName("add")
          .setDescription("Create a new incident report")
          .addUserOption((opt) =>
            opt
              .setName("user")
              .setDescription("Subject of the report")
              .setRequired(true)
          )
          .addIntegerOption((opt) =>
            opt
              .setName("priority")
              .setDescription("Priority (1-5)")
              .setRequired(true)
              .setMinValue(1)
              .setMaxValue(5)
          )
          .addStringOption((opt) =>
            opt
              .setName("summary")
              .setDescription("Incident summary")
              .setRequired(true)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("search")
          .setDescription("Search existing reports")
          .addStringOption((opt) =>
            opt
              .setName("case_id")
              .setDescription("Case ID to search")
              .setRequired(false)
          )
          .addUserOption((opt) =>
            opt
              .setName("user")
              .setDescription("User to search reports for")
              .setRequired(false)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("edit")
          .setDescription("Modify a report")
          .addStringOption((opt) =>
            opt.setName("case_id").setDescription("Case ID").setRequired(true)
          )
          .addStringOption((opt) =>
            opt
              .setName("status")
              .setDescription("New status")
              .setRequired(false)
              .addChoices(
                { name: "Open", value: "Open" },
                { name: "Closed", value: "Closed" }
              )
          )
          .addIntegerOption((opt) =>
            opt
              .setName("priority")
              .setDescription("New priority (1-5)")
              .setRequired(false)
              .setMinValue(1)
              .setMaxValue(5)
          )
          .addStringOption((opt) =>
            opt
              .setName("summary")
              .setDescription("New summary")
              .setRequired(false)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("delete")
          .setDescription("Remove a report")
          .addStringOption((opt) =>
            opt.setName("case_id").setDescription("Case ID").setRequired(true)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("close")
          .setDescription("Close an active report")
          .addStringOption((opt) =>
            opt.setName("case_id").setDescription("Case ID").setRequired(true)
          )
      ),
    new SlashCommandBuilder()
      .setName("announce")
      .setDescription("Create a structured announcement")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .addStringOption((option) =>
        option
          .setName("title")
          .setDescription("Heading / title of the announcement")
          .setRequired(true)
      )
      .addStringOption((option) =>
        option
          .setName("message")
          .setDescription("Main announcement message")
          .setRequired(true)
      )
      .addChannelOption((option) =>
        option
          .setName("channel")
          .setDescription("Channel to send the announcement in")
          .setRequired(false)
      )
      .addStringOption((option) =>
        option
          .setName("point1")
          .setDescription("Announcement point #1")
          .setRequired(false)
      )
      .addStringOption((option) =>
        option
          .setName("point2")
          .setDescription("Announcement point #2")
          .setRequired(false)
      )
      .addStringOption((option) =>
        option
          .setName("point3")
          .setDescription("Announcement point #3")
          .setRequired(false)
      )
      .addStringOption((option) =>
        option
          .setName("point4")
          .setDescription("Announcement point #4")
          .setRequired(false)
      )
      .addStringOption((option) =>
        option
          .setName("point5")
          .setDescription("Announcement point #5")
          .setRequired(false)
      )
      .addBooleanOption((option) =>
        option
          .setName("ping")
          .setDescription("Ping @everyone?")
          .setRequired(false)
      ),
    new SlashCommandBuilder()
      .setName("note")
      .setDescription("Staff notes management")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
      .addSubcommand((sub) =>
        sub
          .setName("create")
          .setDescription("Create a note report form")
      )
      .addSubcommand((sub) =>
        sub
          .setName("search")
          .setDescription("Search staff notes")
          .addStringOption((opt) =>
            opt
              .setName("query")
              .setDescription("Search keyword")
              .setRequired(true)
          )
      ),
    new SlashCommandBuilder()
      .setName("reactionrole")
      .setDescription("Create a reaction role panel")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addStringOption((opt) =>
        opt
          .setName("title")
          .setDescription("Panel title")
          .setRequired(true)
      )
      .addStringOption((opt) =>
        opt
          .setName("description")
          .setDescription("Panel description")
          .setRequired(true)
      )
      .addStringOption((opt) =>
        opt
          .setName("emoji")
          .setDescription("Emoji for the role")
          .setRequired(true)
      )
      .addRoleOption((opt) =>
        opt
          .setName("role")
          .setDescription("Role to assign")
          .setRequired(true)
      ),
    new SlashCommandBuilder()
      .setName("stats")
      .setDescription("Show live database and bot stats")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    new SlashCommandBuilder()
      .setName("rolelist")
      .setDescription("Add or remove members from a role list")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
      .addSubcommand((sub) =>
        sub
          .setName("add")
          .setDescription("Add a member to a role list")
          .addRoleOption((opt) =>
            opt
              .setName("role")
              .setDescription("The role to add the member to")
              .setRequired(true)
          )
          .addUserOption((opt) =>
            opt
              .setName("user")
              .setDescription("The user to add")
              .setRequired(true)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("remove")
          .setDescription("Remove a member from a role list")
          .addRoleOption((opt) =>
            opt
              .setName("role")
              .setDescription("The role to remove the member from")
              .setRequired(true)
          )
          .addUserOption((opt) =>
            opt
              .setName("user")
              .setDescription("The user to remove")
              .setRequired(true)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("view")
          .setDescription("View members in a role list")
          .addRoleOption((opt) =>
            opt
              .setName("role")
              .setDescription("The role to view")
              .setRequired(true)
          )
      ),
    new SlashCommandBuilder()
      .setName("timeout")
      .setDescription("Timeout (mute) a member for a set duration")
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .addUserOption((opt) =>
        opt
          .setName("user")
          .setDescription("The member to timeout")
          .setRequired(true)
      )
      .addIntegerOption((opt) =>
        opt
          .setName("duration")
          .setDescription("Duration in minutes")
          .setRequired(true)
          .setMinValue(1)
          .setMaxValue(40320)
      )
      .addStringOption((opt) =>
        opt
          .setName("reason")
          .setDescription("Reason for the timeout")
          .setRequired(false)
      ),
    new SlashCommandBuilder()
      .setName("syncroles")
      .setDescription(
        "Sync all Discord role members into the role list tracking database"
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    new SlashCommandBuilder()
      .setName("faction")
      .setDescription("DayZ faction management")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .addSubcommand((sub) =>
        sub
          .setName("create")
          .setDescription("Create a new faction")
          .addStringOption((opt) =>
            opt
              .setName("name")
              .setDescription("Faction name")
              .setRequired(true)
          )
          .addStringOption((opt) =>
            opt
              .setName("tag")
              .setDescription("Faction tag (3-5 chars)")
              .setRequired(true)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("info")
          .setDescription("View faction information")
          .addStringOption((opt) =>
            opt
              .setName("faction")
              .setDescription("Faction name")
              .setRequired(true)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("members")
          .setDescription("List faction members")
          .addStringOption((opt) =>
            opt
              .setName("faction")
              .setDescription("Faction name")
              .setRequired(true)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("invite")
          .setDescription("Invite a Discord user to your faction")
          .addUserOption((opt) =>
            opt
              .setName("user")
              .setDescription("The user to invite")
              .setRequired(true)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("kick")
          .setDescription("Remove a member from your faction")
          .addUserOption((opt) =>
            opt
              .setName("user")
              .setDescription("The user to remove")
              .setRequired(true)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("leave")
          .setDescription("Leave your current faction")
      )
      .addSubcommand((sub) =>
        sub
          .setName("promote")
          .setDescription("Promote a faction member to officer")
          .addUserOption((opt) =>
            opt
              .setName("user")
              .setDescription("The member to promote")
              .setRequired(true)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("demote")
          .setDescription("Demote a faction officer back to member")
          .addUserOption((opt) =>
            opt
              .setName("user")
              .setDescription("The officer to demote")
              .setRequired(true)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("leaderboard")
          .setDescription("View top factions by kills")
      ),
    new SlashCommandBuilder()
      .setName("fivem")
      .setDescription("FiveM / RedM server management via txAdmin")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .addSubcommand((sub) =>
        sub
          .setName("status")
          .setDescription("Check live FiveM server status, players, and txAdmin link")
      )
      .addSubcommand((sub) =>
        sub
          .setName("players")
          .setDescription("List every player currently connected to the FiveM server")
      )
      .addSubcommand((sub) =>
        sub
          .setName("say")
          .setDescription("Broadcast a chat message to every player in-game")
          .addStringOption((opt) =>
            opt.setName("message").setDescription("Message to broadcast").setRequired(true)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("console")
          .setDescription("Run a raw FXServer console command (admin only)")
          .addStringOption((opt) =>
            opt.setName("command").setDescription("Console command to execute").setRequired(true)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("kick")
          .setDescription("Kick a player from the FiveM server by their ID")
          .addIntegerOption((opt) =>
            opt.setName("id").setDescription("Player server ID (from /fivem players)").setRequired(true)
          )
          .addStringOption((opt) =>
            opt.setName("reason").setDescription("Reason for the kick").setRequired(false)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("ban")
          .setDescription("Ban a player from the FiveM server by their ID")
          .addIntegerOption((opt) =>
            opt.setName("id").setDescription("Player server ID").setRequired(true)
          )
          .addStringOption((opt) =>
            opt.setName("reason").setDescription("Reason for the ban").setRequired(false)
          )
          .addIntegerOption((opt) =>
            opt
              .setName("duration_hours")
              .setDescription("Ban length in hours (omit for permanent)")
              .setRequired(false)
          )
      ),
    new SlashCommandBuilder()
      .setName("dayz")
      .setDescription("DayZ server management")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .addSubcommand((sub) =>
        sub
          .setName("status")
          .setDescription("Check live DayZ server status and player count")
      )
      .addSubcommand((sub) =>
        sub
          .setName("players")
          .setDescription("List all players currently online")
      )
      .addSubcommand((sub) =>
        sub
          .setName("say")
          .setDescription("Send a global in-game server announcement")
          .addStringOption((opt) =>
            opt
              .setName("message")
              .setDescription("Message to broadcast to all players")
              .setRequired(true)
          )
      ),
    new SlashCommandBuilder()
      .setName("killfeed")
      .setDescription("DayZ killfeed management")
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .addSubcommand((sub) =>
        sub
          .setName("setup")
          .setDescription("Set killfeed channel")
          .addChannelOption((opt) =>
            opt
              .setName("channel")
              .setDescription("Channel for kills")
              .setRequired(true)
          )
      )
      .addSubcommand((sub) =>
        sub
          .setName("post")
          .setDescription("Manually post a kill")
          .addStringOption((opt) =>
            opt
              .setName("killer")
              .setDescription("Killer name")
              .setRequired(true)
          )
          .addStringOption((opt) =>
            opt
              .setName("victim")
              .setDescription("Victim name")
              .setRequired(true)
          )
          .addStringOption((opt) =>
            opt
              .setName("weapon")
              .setDescription("Weapon used")
              .setRequired(false)
          )
          .addNumberOption((opt) =>
            opt
              .setName("distance")
              .setDescription("Distance in meters")
              .setRequired(false)
          )
          .addStringOption((opt) =>
            opt
              .setName("location")
              .setDescription("Location")
              .setRequired(false)
          )
      ),
  ].map((command) => command.toJSON());

  const rest = new REST({ version: "10" }).setToken(
    process.env.DISCORD_TOKEN!
  );

  try {
    console.log("Registering slash commands for guild...");
    await rest.put(Routes.applicationCommands(clientId), { body: [] });
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
      body: commands,
    });
    console.log(`Successfully registered ${commands.length} guild commands.`);
  } catch (error) {
    console.error("[Bot] Failed to register slash commands:", error);
  }
}

async function handleSlashCommand(interaction: ChatInputCommandInteraction) {
  const { commandName, options, member, user, guild } = interaction;

  if (!guild) return;

  if (commandName === "warn") {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.KickMembers)) {
      return interaction.reply({
        content: "❌ You need the Kick Members permission to warn users.",
        flags: [MessageFlags.Ephemeral],
      });
    }
    const target = options.getUser("user", true);
    const reason = options.getString("reason") || "No reason provided";

    const c = await storage.createCase({
      type: "warn",
      targetId: target.id,
      targetName: target.tag,
      moderatorId: user.id,
      moderatorName: user.tag,
      reason,
      active: true,
    });

    const embed = new EmbedBuilder()
      .setColor(0xffa500)
      .setTitle("⚠️ Member Warned")
      .addFields(
        { name: "User", value: `<@${target.id}> (${target.tag})`, inline: true },
        { name: "Moderator", value: `<@${user.id}>`, inline: true },
        { name: "Case #", value: `${c.id}`, inline: true },
        { name: "Reason", value: reason }
      )
      .setThumbnail(target.displayAvatarURL())
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }

  if (commandName === "kick") {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.KickMembers)) {
      return interaction.reply({
        content: "❌ You need the Kick Members permission.",
        flags: [MessageFlags.Ephemeral],
      });
    }
    const target = options.getMember("user");
    if (!target || !("kick" in target))
      return interaction.reply({ content: "❌ User not found in this server.", flags: [MessageFlags.Ephemeral] });
    if (!target.kickable)
      return interaction.reply({ content: "❌ I cannot kick this user (higher role).", flags: [MessageFlags.Ephemeral] });

    const reason = options.getString("reason") || "No reason provided";
    await target.kick(reason);

    const c = await storage.createCase({
      type: "kick",
      targetId: target.user.id,
      targetName: target.user.tag,
      moderatorId: user.id,
      moderatorName: user.tag,
      reason,
      active: false,
    });

    const embed = new EmbedBuilder()
      .setColor(0xff6b00)
      .setTitle("👢 Member Kicked")
      .addFields(
        { name: "User", value: `${target.user.tag}`, inline: true },
        { name: "Moderator", value: `<@${user.id}>`, inline: true },
        { name: "Case #", value: `${c.id}`, inline: true },
        { name: "Reason", value: reason }
      )
      .setThumbnail(target.user.displayAvatarURL())
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }

  if (commandName === "ban") {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.BanMembers)) {
      return interaction.reply({
        content: "❌ You need the Ban Members permission.",
        flags: [MessageFlags.Ephemeral],
      });
    }
    const target = options.getMember("user");
    if (!target || !("ban" in target))
      return interaction.reply({ content: "❌ User not found in this server.", flags: [MessageFlags.Ephemeral] });
    if (!target.bannable)
      return interaction.reply({ content: "❌ I cannot ban this user (higher role).", flags: [MessageFlags.Ephemeral] });

    const reason = options.getString("reason") || "No reason provided";
    await target.ban({ reason });

    const c = await storage.createCase({
      type: "ban",
      targetId: target.user.id,
      targetName: target.user.tag,
      moderatorId: user.id,
      moderatorName: user.tag,
      reason,
      active: true,
    });

    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle("🔨 Member Banned")
      .addFields(
        { name: "User", value: `${target.user.tag}`, inline: true },
        { name: "Moderator", value: `<@${user.id}>`, inline: true },
        { name: "Case #", value: `${c.id}`, inline: true },
        { name: "Reason", value: reason }
      )
      .setThumbnail(target.user.displayAvatarURL())
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }

  if (commandName === "logs") {
    const target = options.getUser("user", true);
    const allLogs = await storage.getLogs(100);
    const userLogs = allLogs.filter((l) => l.userId === target.id);

    if (userLogs.length === 0) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle(`📋 Logs — ${target.tag}`)
            .setDescription("No logs found for this user.")
            .setThumbnail(target.displayAvatarURL())
            .setTimestamp()
        ],
      });
    }

    const logLines = userLogs
      .slice(0, 8)
      .map((l) => `\`${l.type}\` — ${l.content.substring(0, 80)}`)
      .join("\n");

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`📋 Logs — ${target.tag}`)
      .setDescription(logLines)
      .setFooter({ text: `Showing ${Math.min(userLogs.length, 8)} of ${userLogs.length} entries` })
      .setThumbnail(target.displayAvatarURL())
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }

  if (commandName === "ping") {
    const ping = interaction.client.ws.ping;
    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle("🏓 Pong!")
      .addFields({ name: "Latency", value: `${ping}ms`, inline: true })
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }

  if (commandName === "timeout") {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ModerateMembers)) {
      return interaction.reply({
        content: "❌ You need the Moderate Members permission.",
        flags: [MessageFlags.Ephemeral],
      });
    }

    const targetUser = options.getUser("user", true);
    const duration = options.getInteger("duration", true);
    const reason = options.getString("reason") || "No reason provided";

    // Always fetch a full GuildMember so .timeout() and .user are available
    const target = await guild.members.fetch(targetUser.id).catch(() => null);

    if (!target) {
      return interaction.reply({ content: "❌ User not found in this server.", flags: [MessageFlags.Ephemeral] });
    }
    if (!target.moderatable) {
      return interaction.reply({ content: "❌ I cannot timeout this user — they have a higher role than me or are a server administrator.", flags: [MessageFlags.Ephemeral] });
    }
    if (target.id === user.id) {
      return interaction.reply({ content: "❌ You cannot timeout yourself.", flags: [MessageFlags.Ephemeral] });
    }

    try {
      await target.timeout(duration * 60 * 1000, reason);

      await storage.createLog({
        type: "timeout",
        content: `${user.tag} timed out ${target.user.tag} for ${duration} minute(s): ${reason}`,
        userId: user.id,
        username: user.tag,
        metadata: { reason, durationMins: duration, targetUserId: target.user.id },
      });

      const expiresTs = Math.floor((Date.now() + duration * 60 * 1000) / 1000);

      const embed = new EmbedBuilder()
        .setColor(0xffd700)
        .setTitle("⏱️ Member Timed Out")
        .addFields(
          { name: "User", value: `<@${target.user.id}> (${target.user.tag})`, inline: true },
          { name: "Moderator", value: `<@${user.id}>`, inline: true },
          { name: "Duration", value: `${duration} minute${duration !== 1 ? "s" : ""}`, inline: true },
          { name: "Expires", value: `<t:${expiresTs}:R> (<t:${expiresTs}:t>)`, inline: true },
          { name: "Reason", value: reason }
        )
        .setThumbnail(target.user.displayAvatarURL())
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error: any) {
      console.error("[timeout] Error:", error?.message);
      await interaction.reply({ content: "❌ Failed to timeout user — check my role position and permissions.", flags: [MessageFlags.Ephemeral] });
    }
  }

  // ── /syncroles ────────────────────────────────────────────────────────────
  // Reads every member's current Discord roles, diffs against the database,
  // and only records what actually changed:
  //   • ADDED     — present in Discord, missing in DB
  //   • REMOVED   — present in DB, missing in Discord (role was taken away)
  //   • UNCHANGED — present in both → silently skipped (auto-recognized)
  if (commandName === "syncroles") {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        content: "❌ Administrator permission required.",
        flags: [MessageFlags.Ephemeral],
      });
    }

    await interaction.deferReply();

    try {
      // ── Snapshot of Discord (source of truth) ────────────────────────────
      const allMembers = await guild.members.fetch();
      const everyoneId = guild.id;

      // Map<roleId, { name, members: Map<userId, username> }>
      const discordSnapshot = new Map<string, { name: string; members: Map<string, string> }>();
      let humansScanned = 0;
      let botsSkipped = 0;

      for (const [, gm] of allMembers) {
        if (gm.user.bot) {
          botsSkipped++;
          continue;
        }
        humansScanned++;
        for (const [, role] of gm.roles.cache) {
          if (role.id === everyoneId) continue;
          let bucket = discordSnapshot.get(role.id);
          if (!bucket) {
            bucket = { name: role.name, members: new Map() };
            discordSnapshot.set(role.id, bucket);
          }
          bucket.members.set(gm.id, gm.user.tag);
        }
      }

      // ── Snapshot of database ──────────────────────────────────────────────
      const dbEntries = await storage.getRoleListMembers();
      // Map<roleId, Set<userId>>
      const dbSnapshot = new Map<string, Set<string>>();
      for (const e of dbEntries) {
        let set = dbSnapshot.get(e.roleId);
        if (!set) {
          set = new Set();
          dbSnapshot.set(e.roleId, set);
        }
        set.add(e.userId);
      }

      // ── Diff ──────────────────────────────────────────────────────────────
      let added = 0;
      let removed = 0;
      let unchanged = 0;
      const rolesTouched = new Set<string>();
      const rolesActuallyChanged = new Set<string>();

      // ADDS + UNCHANGED
      for (const [roleId, bucket] of discordSnapshot) {
        rolesTouched.add(roleId);
        const dbSet = dbSnapshot.get(roleId) ?? new Set<string>();

        for (const [userId, username] of bucket.members) {
          if (dbSet.has(userId)) {
            unchanged++;
          } else {
            await storage.addRoleListMember({
              roleId,
              roleName: bucket.name,
              userId,
              username,
              addedById: client!.user!.id,
              addedByName: client!.user!.tag,
              action: "add",
            });
            added++;
            rolesActuallyChanged.add(roleId);
          }
        }
      }

      // REMOVES — anyone in DB whose role assignment is no longer in Discord
      for (const [roleId, dbUserIds] of dbSnapshot) {
        rolesTouched.add(roleId);
        const liveSet = discordSnapshot.get(roleId)?.members ?? new Map<string, string>();
        for (const userId of dbUserIds) {
          if (!liveSet.has(userId)) {
            await storage.removeRoleListMember(roleId, userId);
            removed++;
            rolesActuallyChanged.add(roleId);
          }
        }
      }

      // ── Audit log entry (only if something actually changed) ──────────────
      if (added > 0 || removed > 0) {
        await storage.createLog({
          type: "role_sync",
          content: `${user.tag} ran /syncroles → +${added} / -${removed} / =${unchanged}`,
          userId: user.id,
          username: user.tag,
          metadata: { added, removed, unchanged, humansScanned, botsSkipped },
        });
      }

      // ── Embed ─────────────────────────────────────────────────────────────
      const isClean = added === 0 && removed === 0;
      const embed = serverEmbed(guild)
        .setColor(isClean ? 0x57f287 : 0x5865f2)
        .setTitle(isClean ? "✅ Role Sync — Already In Sync" : "🔄 Role Sync Complete")
        .setDescription(
          isClean
            ? "Every Discord role assignment already matches the database. **No changes needed.**"
            : "Discord and the database have been reconciled."
        )
        .addFields(
          { name: "👥 Humans Scanned", value: `**${humansScanned}**`, inline: true },
          { name: "🤖 Bots Skipped", value: `**${botsSkipped}**`, inline: true },
          { name: "🎭 Roles Touched", value: `**${rolesTouched.size}**`, inline: true },
          { name: "➕ Added to DB", value: `**${added}**`, inline: true },
          { name: "➖ Removed from DB", value: `**${removed}**`, inline: true },
          { name: "✓ Unchanged", value: `**${unchanged}**`, inline: true }
        );

      if (rolesActuallyChanged.size > 0 && rolesActuallyChanged.size <= 15) {
        const changedNames = [...rolesActuallyChanged]
          .map((rid) => {
            const r = guild.roles.cache.get(rid);
            return r ? `<@&${rid}>` : `\`${rid}\``;
          })
          .join(" • ");
        embed.addFields({ name: "🛠️ Roles With Changes", value: changedNames });
      }

      embed.setFooter({
        text: `${guild.name} • Synced by ${user.tag}`,
        iconURL: guild.iconURL({ size: 256 }) || undefined,
      });

      return interaction.editReply({ embeds: [embed] });
    } catch (err: any) {
      console.error("[syncroles] Error:", err);
      return interaction.editReply({
        content: `❌ Role sync failed: ${err?.message || "unknown error"}. Make sure I have the **Server Members Intent** enabled in the Discord Developer Portal.`,
      });
    }
  }

  if (commandName === "faction") {
    const subcommand = options.getSubcommand();

    // ── CREATE ─────────────────────────────────────────────────────────────
    if (subcommand === "create") {
      const name = options.getString("name", true).trim();
      const tag = options.getString("tag", true).trim().toUpperCase();

      if (tag.length < 2 || tag.length > 5) {
        return interaction.reply({ content: "❌ Tag must be 2-5 characters.", flags: [MessageFlags.Ephemeral] });
      }

      const [existingName, existingTag, existingMembership] = await Promise.all([
        storage.getFactionByName(name),
        storage.getFactionByTag(tag),
        storage.getFactionByMember(user.id),
      ]);

      if (existingName) {
        return interaction.reply({ content: `❌ A faction named **${name}** already exists.`, flags: [MessageFlags.Ephemeral] });
      }
      if (existingTag) {
        return interaction.reply({ content: `❌ The tag **[${tag}]** is already taken.`, flags: [MessageFlags.Ephemeral] });
      }
      if (existingMembership) {
        return interaction.reply({ content: `❌ You are already in **${existingMembership.name}**. Leave it first.`, flags: [MessageFlags.Ephemeral] });
      }

      const faction = await storage.createFaction({
        name,
        tag,
        leaderId: user.id,
        leaderName: user.username,
        description: "No description set.",
        color: "#5865F2",
        hq: "Unknown",
        kills: 0,
        status: "active",
      });

      await storage.addFactionMember(faction.id, user.id, user.username, "leader");

      await storage.createLog({
        type: "faction_create",
        content: `${user.tag} created faction ${name} [${tag}]`,
        userId: user.id,
        username: user.tag,
        metadata: { factionId: faction.id, factionName: name, tag },
      });

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`🏴 Faction Created: ${name} [${tag}]`)
        .setDescription("Your faction is now active. Use `/faction invite` to recruit members.")
        .addFields(
          { name: "Leader", value: `<@${user.id}>`, inline: true },
          { name: "Tag", value: `[${tag}]`, inline: true },
          { name: "Status", value: "🟢 Active", inline: true },
          { name: "Kills", value: "0", inline: true },
          { name: "Members", value: "1", inline: true },
          { name: "HQ", value: "Unknown", inline: true },
          { name: "Description", value: "No description set." }
        )
        .setFooter({ text: `Faction ID: ${faction.id} • Created by ${user.tag}` })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    // ── INVITE ─────────────────────────────────────────────────────────────
    if (subcommand === "invite") {
      const target = options.getUser("user", true);

      if (target.id === user.id) {
        return interaction.reply({ content: "❌ You can't invite yourself.", flags: [MessageFlags.Ephemeral] });
      }
      if (target.bot) {
        return interaction.reply({ content: "❌ You can't invite bots.", flags: [MessageFlags.Ephemeral] });
      }

      const callerFaction = await storage.getFactionByMember(user.id);
      if (!callerFaction) {
        return interaction.reply({ content: "❌ You are not in a faction.", flags: [MessageFlags.Ephemeral] });
      }

      const callerMember = await storage.getFactionMember(user.id);
      if (!callerMember || !["leader", "officer"].includes(callerMember.rank)) {
        return interaction.reply({ content: "❌ Only the faction leader or officers can invite members.", flags: [MessageFlags.Ephemeral] });
      }

      const targetFaction = await storage.getFactionByMember(target.id);
      if (targetFaction) {
        return interaction.reply({ content: `❌ <@${target.id}> is already in **${targetFaction.name}**.`, flags: [MessageFlags.Ephemeral] });
      }

      await storage.addFactionMember(callerFaction.id, target.id, target.username, "member");

      await storage.createLog({
        type: "faction_invite",
        content: `${user.tag} invited ${target.tag} to faction ${callerFaction.name}`,
        userId: user.id,
        username: user.tag,
        metadata: { factionId: callerFaction.id, targetId: target.id, targetTag: target.tag },
      });

      const members = await storage.getFactionMembers(callerFaction.id);

      const embed = new EmbedBuilder()
        .setColor(callerFaction.color as any)
        .setTitle(`✅ Member Invited — ${callerFaction.name} [${callerFaction.tag}]`)
        .setDescription(`<@${target.id}> has been added to the faction.`)
        .addFields(
          { name: "Invited By", value: `<@${user.id}>`, inline: true },
          { name: "New Member", value: `<@${target.id}> (${target.tag})`, inline: true },
          { name: "Rank", value: "Member", inline: true },
          { name: "Total Members", value: `${members.length}`, inline: true }
        )
        .setThumbnail(target.displayAvatarURL())
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    // ── KICK (from faction) ────────────────────────────────────────────────
    if (subcommand === "kick") {
      const target = options.getUser("user", true);

      const callerFaction = await storage.getFactionByMember(user.id);
      if (!callerFaction) {
        return interaction.reply({ content: "❌ You are not in a faction.", flags: [MessageFlags.Ephemeral] });
      }

      const callerMember = await storage.getFactionMember(user.id);
      if (!callerMember || callerMember.rank !== "leader") {
        return interaction.reply({ content: "❌ Only the faction leader can remove members.", flags: [MessageFlags.Ephemeral] });
      }

      if (target.id === user.id) {
        return interaction.reply({ content: "❌ You can't kick yourself. Use `/faction leave` to disband.", flags: [MessageFlags.Ephemeral] });
      }

      const targetMember = await storage.getFactionMember(target.id);
      if (!targetMember || targetMember.factionId !== callerFaction.id) {
        return interaction.reply({ content: `❌ <@${target.id}> is not in your faction.`, flags: [MessageFlags.Ephemeral] });
      }

      await storage.removeFactionMember(callerFaction.id, target.id);

      await storage.createLog({
        type: "faction_kick",
        content: `${user.tag} removed ${target.tag} from faction ${callerFaction.name}`,
        userId: user.id,
        username: user.tag,
        metadata: { factionId: callerFaction.id, targetId: target.id },
      });

      const embed = new EmbedBuilder()
        .setColor(0xff6b00)
        .setTitle(`👢 Member Removed — ${callerFaction.name} [${callerFaction.tag}]`)
        .setDescription(`<@${target.id}> has been removed from the faction.`)
        .addFields(
          { name: "Removed By", value: `<@${user.id}>`, inline: true },
          { name: "Member", value: `${target.tag}`, inline: true }
        )
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    // ── LEAVE ──────────────────────────────────────────────────────────────
    if (subcommand === "leave") {
      const callerFaction = await storage.getFactionByMember(user.id);
      if (!callerFaction) {
        return interaction.reply({ content: "❌ You are not in a faction.", flags: [MessageFlags.Ephemeral] });
      }

      const callerMember = await storage.getFactionMember(user.id);
      if (callerMember?.rank === "leader") {
        return interaction.reply({ content: "❌ Leaders cannot leave — transfer leadership or disband the faction first.", flags: [MessageFlags.Ephemeral] });
      }

      await storage.removeFactionMember(callerFaction.id, user.id);

      await storage.createLog({
        type: "faction_leave",
        content: `${user.tag} left faction ${callerFaction.name}`,
        userId: user.id,
        username: user.tag,
        metadata: { factionId: callerFaction.id },
      });

      const embed = new EmbedBuilder()
        .setColor(0x99aab5)
        .setTitle(`🚪 Left Faction — ${callerFaction.name}`)
        .setDescription(`You have left **${callerFaction.name} [${callerFaction.tag}]**.`)
        .setTimestamp();

      return interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
    }

    // ── INFO ───────────────────────────────────────────────────────────────
    if (subcommand === "info") {
      const factionName = options.getString("faction", true);
      const faction = await storage.getFactionByName(factionName);

      if (!faction) {
        return interaction.reply({ content: "❌ Faction not found.", flags: [MessageFlags.Ephemeral] });
      }

      // ── PRIVACY ──────────────────────────────────────────────────────────
      // Only members of this faction (or admins) may view its info.
      const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ?? false;
      if (!isAdmin) {
        const callerMember = await storage.getFactionMember(user.id);
        const inThisFaction = callerMember?.factionId === faction.id;
        if (!inThisFaction) {
          return interaction.reply({
            content: "🔒 Faction intel is classified — you must be a member of this faction (or a server admin) to view it.",
            flags: [MessageFlags.Ephemeral],
          });
        }
      }

      const members = await storage.getFactionMembers(faction.id);
      const officers = members.filter((m) => m.rank === "officer").length;
      const statusEmoji = faction.status === "active" ? "🟢" : "🔴";
      const foundedTs = Math.floor(new Date(faction.createdAt).getTime() / 1000);

      const embed = new EmbedBuilder()
        .setColor(faction.color as any)
        .setTitle(`🏴 ${faction.name} [${faction.tag}]`)
        .setDescription(faction.description)
        .addFields(
          { name: "Leader", value: `<@${faction.leaderId}>`, inline: true },
          { name: "Status", value: `${statusEmoji} ${faction.status.charAt(0).toUpperCase() + faction.status.slice(1)}`, inline: true },
          { name: "HQ", value: faction.hq, inline: true },
          { name: "Total Kills", value: `${faction.kills}`, inline: true },
          { name: "Members", value: `${members.length}`, inline: true },
          { name: "Officers", value: `${officers}`, inline: true },
          { name: "Founded", value: `<t:${foundedTs}:D> (<t:${foundedTs}:R>)` }
        )
        .setFooter({ text: `Faction ID: ${faction.id}` })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    // ── MEMBERS ────────────────────────────────────────────────────────────
    if (subcommand === "members") {
      const factionName = options.getString("faction", true);
      const faction = await storage.getFactionByName(factionName);

      if (!faction) {
        return interaction.reply({ content: "❌ Faction not found.", flags: [MessageFlags.Ephemeral] });
      }

      // ── PRIVACY ──────────────────────────────────────────────────────────
      const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ?? false;
      if (!isAdmin) {
        const callerMember = await storage.getFactionMember(user.id);
        const inThisFaction = callerMember?.factionId === faction.id;
        if (!inThisFaction) {
          return interaction.reply({
            content: "🔒 Roster locked — only members of this faction (or admins) may view it.",
            flags: [MessageFlags.Ephemeral],
          });
        }
      }

      const members = await storage.getFactionMembers(faction.id);
      if (members.length === 0) {
        return interaction.reply({ content: "❌ No members in this faction.", flags: [MessageFlags.Ephemeral] });
      }

      const rankOrder: Record<string, number> = { leader: 0, officer: 1, member: 2 };
      const sorted = [...members].sort((a, b) => (rankOrder[a.rank] ?? 9) - (rankOrder[b.rank] ?? 9));

      const rankEmoji: Record<string, string> = { leader: "👑", officer: "⭐", member: "🔹" };
      const memberList = sorted
        .map((m) => `${rankEmoji[m.rank] ?? "🔹"} **${m.username}** — ${m.rank} | ${m.kills}K / ${m.deaths}D`)
        .join("\n");

      const embed = new EmbedBuilder()
        .setColor(faction.color as any)
        .setTitle(`🏴 ${faction.name} [${faction.tag}] — Members (${members.length})`)
        .setDescription(memberList)
        .setFooter({ text: `K = Kills  •  D = Deaths` })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    // ── PROMOTE ────────────────────────────────────────────────────────────
    if (subcommand === "promote") {
      const target = options.getUser("user", true);

      const callerFaction = await storage.getFactionByMember(user.id);
      if (!callerFaction) {
        return interaction.reply({ content: "❌ You are not in a faction.", flags: [MessageFlags.Ephemeral] });
      }

      const callerMember = await storage.getFactionMember(user.id);
      if (callerMember?.rank !== "leader") {
        return interaction.reply({ content: "❌ Only the faction leader can promote members.", flags: [MessageFlags.Ephemeral] });
      }

      if (target.id === user.id) {
        return interaction.reply({ content: "❌ You can't promote yourself.", flags: [MessageFlags.Ephemeral] });
      }

      const targetMember = await storage.getFactionMember(target.id);
      if (!targetMember || targetMember.factionId !== callerFaction.id) {
        return interaction.reply({ content: `❌ <@${target.id}> is not in your faction.`, flags: [MessageFlags.Ephemeral] });
      }

      if (targetMember.rank === "officer") {
        return interaction.reply({ content: `❌ <@${target.id}> is already an officer.`, flags: [MessageFlags.Ephemeral] });
      }
      if (targetMember.rank === "leader") {
        return interaction.reply({ content: `❌ <@${target.id}> is already the leader.`, flags: [MessageFlags.Ephemeral] });
      }

      await storage.updateFactionMemberRank(callerFaction.id, target.id, "officer");

      await storage.createLog({
        type: "faction_promote",
        content: `${user.tag} promoted ${target.tag} to officer in ${callerFaction.name}`,
        userId: user.id,
        username: user.tag,
        metadata: { factionId: callerFaction.id, targetId: target.id },
      });

      const embed = new EmbedBuilder()
        .setColor(0xffd700)
        .setTitle(`⭐ Member Promoted — ${callerFaction.name} [${callerFaction.tag}]`)
        .setDescription(`<@${target.id}> has been promoted to **Officer**.`)
        .addFields(
          { name: "Promoted By", value: `<@${user.id}>`, inline: true },
          { name: "Member", value: `${target.tag}`, inline: true },
          { name: "New Rank", value: "⭐ Officer", inline: true }
        )
        .setThumbnail(target.displayAvatarURL())
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    // ── DEMOTE ─────────────────────────────────────────────────────────────
    if (subcommand === "demote") {
      const target = options.getUser("user", true);

      const callerFaction = await storage.getFactionByMember(user.id);
      if (!callerFaction) {
        return interaction.reply({ content: "❌ You are not in a faction.", flags: [MessageFlags.Ephemeral] });
      }

      const callerMember = await storage.getFactionMember(user.id);
      if (callerMember?.rank !== "leader") {
        return interaction.reply({ content: "❌ Only the faction leader can demote members.", flags: [MessageFlags.Ephemeral] });
      }

      if (target.id === user.id) {
        return interaction.reply({ content: "❌ You can't demote yourself.", flags: [MessageFlags.Ephemeral] });
      }

      const targetMember = await storage.getFactionMember(target.id);
      if (!targetMember || targetMember.factionId !== callerFaction.id) {
        return interaction.reply({ content: `❌ <@${target.id}> is not in your faction.`, flags: [MessageFlags.Ephemeral] });
      }

      if (targetMember.rank === "member") {
        return interaction.reply({ content: `❌ <@${target.id}> is already a regular member.`, flags: [MessageFlags.Ephemeral] });
      }
      if (targetMember.rank === "leader") {
        return interaction.reply({ content: "❌ You cannot demote the faction leader. Transfer leadership first.", flags: [MessageFlags.Ephemeral] });
      }

      await storage.updateFactionMemberRank(callerFaction.id, target.id, "member");

      await storage.createLog({
        type: "faction_demote",
        content: `${user.tag} demoted ${target.tag} to member in ${callerFaction.name}`,
        userId: user.id,
        username: user.tag,
        metadata: { factionId: callerFaction.id, targetId: target.id },
      });

      const embed = new EmbedBuilder()
        .setColor(0xff6b00)
        .setTitle(`🔹 Member Demoted — ${callerFaction.name} [${callerFaction.tag}]`)
        .setDescription(`<@${target.id}> has been demoted back to **Member**.`)
        .addFields(
          { name: "Demoted By", value: `<@${user.id}>`, inline: true },
          { name: "Member", value: `${target.tag}`, inline: true },
          { name: "New Rank", value: "🔹 Member", inline: true }
        )
        .setThumbnail(target.displayAvatarURL())
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    // ── LEADERBOARD ────────────────────────────────────────────────────────
    if (subcommand === "leaderboard") {
      const topFactions = await storage.getTopFactions(10);

      if (topFactions.length === 0) {
        return interaction.reply({ content: "❌ No factions have been created yet.", flags: [MessageFlags.Ephemeral] });
      }

      // Fetch member counts for all factions in parallel
      const memberCounts = await Promise.all(
        topFactions.map((f) => storage.getFactionMembers(f.id).then((m) => m.length))
      );

      const medals = ["🥇", "🥈", "🥉"];
      const rows = topFactions.map((f, i) => {
        const medal = medals[i] ?? `\`${i + 1}.\``;
        const kd = f.kills > 0 ? f.kills : 0;
        return `${medal} **${f.name}** [${f.tag}] — ${kd} kills • ${memberCounts[i]} members`;
      });

      // Split into two columns visually using fields
      const half = Math.ceil(rows.length / 2);
      const col1 = rows.slice(0, half).join("\n");
      const col2 = rows.slice(half).join("\n");

      const embed = new EmbedBuilder()
        .setColor(0xffd700)
        .setTitle("🏆 Faction Leaderboard")
        .setDescription("Ranked by total kills across all time.")
        .addFields(
          { name: "Top Factions", value: col1, inline: col2.length > 0 },
          ...(col2.length > 0 ? [{ name: "\u200b", value: col2, inline: true }] : [])
        )
        .setFooter({ text: `${topFactions.length} active faction${topFactions.length !== 1 ? "s" : ""} • Updated` })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }
  }

  if (commandName === "dayz") {
    const subcommand = options.getSubcommand();

    if (subcommand === "status") {
      await interaction.deferReply();
      const rcon = getRconStatus();

      if (rcon.status === "unconfigured") {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x99aab5)
              .setTitle("🖥️ DayZ Server Status")
              .setDescription("RCON is not configured. Set `DAYZ_RCON_HOST`, `DAYZ_RCON_PORT`, and `DAYZ_RCON_PASSWORD`.")
              .setTimestamp()
          ],
        });
      }

      if (rcon.status !== "connected") {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xff0000)
              .setTitle("🖥️ DayZ Server Status")
              .addFields(
                { name: "RCON", value: "🔴 Disconnected", inline: true },
                { name: "Host", value: `${rcon.host}:${rcon.port}`, inline: true },
                { name: "Error", value: rcon.error || "Unknown error" }
              )
              .setTimestamp()
          ],
        });
      }

      const server = await getServerStatus();
      const playerBar = buildPlayerBar(server.players, server.maxPlayers);

      const embed = new EmbedBuilder()
        .setColor(server.online ? 0x57f287 : 0xff0000)
        .setTitle("🖥️ DayZ Server Status")
        .addFields(
          { name: "Status", value: server.online ? "🟢 Online" : "🔴 Offline", inline: true },
          { name: "Players", value: `${server.players} / ${server.maxPlayers}`, inline: true },
          { name: "RCON", value: `🟢 Connected to \`${rcon.host}:${rcon.port}\``, inline: false },
          { name: "Player Load", value: playerBar }
        )
        .setFooter({ text: "Live data via RCON" })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    if (subcommand === "players") {
      await interaction.deferReply();
      const rcon = getRconStatus();

      if (rcon.status !== "connected") {
        return interaction.editReply({ content: "❌ RCON is not connected." });
      }

      const server = await getServerStatus();

      if (!server.online) {
        return interaction.editReply({ content: "❌ Server is offline or unreachable." });
      }

      const listText = server.playerList.length > 0
        ? server.playerList.map((p, i) => `\`${i + 1}.\` ${p}`).join("\n")
        : "_No players online_";

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`👥 Players Online — ${server.players}/${server.maxPlayers}`)
        .setDescription(listText.substring(0, 4000))
        .setFooter({ text: "Live data via RCON" })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    if (subcommand === "say") {
      const message = options.getString("message", true);
      await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

      const rcon = getRconStatus();
      if (rcon.status !== "connected") {
        return interaction.editReply({ content: "❌ RCON is not connected." });
      }

      try {
        await sayGlobal(message);

        await storage.createLog({
          type: "rcon_say",
          content: `${user.tag} broadcast in-game: ${message}`,
          userId: user.id,
          username: user.tag,
          metadata: { message },
        });

        const embed = new EmbedBuilder()
          .setColor(0x57f287)
          .setTitle("📢 In-Game Announcement Sent")
          .addFields(
            { name: "Message", value: message },
            { name: "Sent By", value: `<@${user.id}>`, inline: true }
          )
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      } catch (err: any) {
        return interaction.editReply({ content: `❌ Failed to send: ${err.message}` });
      }
    }
  }

  if (commandName === "fivem") {
    const subcommand = options.getSubcommand();

    // ── STATUS ─────────────────────────────────────────────────────────────
    if (subcommand === "status") {
      await interaction.deferReply();

      const [server, tx] = await Promise.all([
        getFivemServerStatus(),
        getTxAdminStatus(),
      ]);

      const txLine =
        tx.status === "connected"
          ? `🟢 Connected to \`${tx.url}\``
          : tx.status === "disconnected"
            ? `🔴 Offline — ${tx.error}`
            : "⚪ Not configured";

      const embed = serverEmbed(guild)
        .setColor(server.online ? 0x00d26a : 0xff2d55)
        .setTitle(server.online ? "🟢 FIVEM SERVER — ONLINE" : "🔴 FIVEM SERVER — OFFLINE")
        .setDescription(
          server.online
            ? `**${server.hostname}**\nLocked, loaded, and live. ${server.players}/${server.maxPlayers} operatives in the field.`
            : `**Server unreachable.** ${server.error || "No response."}`
        )
        .addFields(
          { name: "👥 Players", value: `**${server.players}** / ${server.maxPlayers}`, inline: true },
          { name: "🗺️ Map", value: server.mapname || "—", inline: true },
          { name: "🎮 Gametype", value: server.gametype || "—", inline: true },
          { name: "📦 Resources", value: `${server.resources.length} loaded`, inline: true },
          { name: "🛠️ txAdmin", value: txLine, inline: false }
        );

      return interaction.editReply({ embeds: [embed] });
    }

    // ── PLAYERS ────────────────────────────────────────────────────────────
    if (subcommand === "players") {
      await interaction.deferReply();
      const server = await getFivemServerStatus();

      if (!server.online) {
        return interaction.editReply({
          embeds: [
            serverEmbed(guild)
              .setColor(0xff2d55)
              .setTitle("🔴 SERVER OFFLINE")
              .setDescription(server.error || "Server is not reachable."),
          ],
        });
      }

      const list =
        server.playerList.length > 0
          ? server.playerList
              .map((p) => `\`#${String(p.id).padStart(2, "0")}\` **${p.name}** — ${p.ping}ms`)
              .join("\n")
          : "_No players currently connected._";

      const embed = serverEmbed(guild)
        .setColor(0x0099ff)
        .setTitle(`👥 ACTIVE OPERATIVES — ${server.players}/${server.maxPlayers}`)
        .setDescription(list.substring(0, 4000));

      return interaction.editReply({ embeds: [embed] });
    }

    // ── SAY (broadcast) ────────────────────────────────────────────────────
    if (subcommand === "say") {
      const message = options.getString("message", true);
      await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

      try {
        await fivemSay(message);
        await storage.createLog({
          type: "fivem_say",
          content: `${user.tag} broadcast in FiveM: ${message}`,
          userId: user.id,
          username: user.tag,
          metadata: { message },
        });

        const embed = serverEmbed(guild)
          .setColor(0x00d26a)
          .setTitle("📢 BROADCAST DELIVERED")
          .setDescription(`Message pushed to every connected operative.`)
          .addFields(
            { name: "📡 Message", value: `> ${message}` },
            { name: "🎙️ Sent By", value: `<@${user.id}>`, inline: true }
          );

        return interaction.editReply({ embeds: [embed] });
      } catch (err: any) {
        return interaction.editReply({ content: `❌ Broadcast failed: ${err.message}` });
      }
    }

    // ── CONSOLE ────────────────────────────────────────────────────────────
    if (subcommand === "console") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({
          content: "❌ Only administrators may execute raw console commands.",
          flags: [MessageFlags.Ephemeral],
        });
      }

      const command = options.getString("command", true);
      await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

      try {
        await runFivemConsoleCommand(command);
        await storage.createLog({
          type: "fivem_console",
          content: `${user.tag} ran FiveM console command: ${command}`,
          userId: user.id,
          username: user.tag,
          metadata: { command },
        });

        const embed = serverEmbed(guild)
          .setColor(0xffd60a)
          .setTitle("⚡ CONSOLE COMMAND DISPATCHED")
          .addFields(
            { name: "📟 Command", value: `\`\`\`${command.substring(0, 1000)}\`\`\`` },
            { name: "👤 Executed By", value: `<@${user.id}>`, inline: true }
          )
          .setFooter({ text: `${guild.name} • Output is shown in the live txAdmin console`, iconURL: guild.iconURL({ size: 256 }) || undefined });

        return interaction.editReply({ embeds: [embed] });
      } catch (err: any) {
        return interaction.editReply({ content: `❌ Console command failed: ${err.message}` });
      }
    }

    // ── KICK ───────────────────────────────────────────────────────────────
    if (subcommand === "kick") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.KickMembers)) {
        return interaction.reply({
          content: "❌ You need the Kick Members permission.",
          flags: [MessageFlags.Ephemeral],
        });
      }

      const playerId = options.getInteger("id", true);
      const reason = options.getString("reason") || "No reason provided";
      await interaction.deferReply();

      try {
        await fivemKick(playerId, reason);
        await storage.createLog({
          type: "fivem_kick",
          content: `${user.tag} kicked FiveM player #${playerId}: ${reason}`,
          userId: user.id,
          username: user.tag,
          metadata: { playerId, reason },
        });

        const embed = serverEmbed(guild)
          .setColor(0xff8c00)
          .setTitle(`👢 PLAYER KICKED — #${playerId}`)
          .setDescription(`Operative **#${playerId}** has been ejected from the server.`)
          .addFields(
            { name: "🛡️ Moderator", value: `<@${user.id}>`, inline: true },
            { name: "📝 Reason", value: reason, inline: false }
          );

        return interaction.editReply({ embeds: [embed] });
      } catch (err: any) {
        return interaction.editReply({ content: `❌ Kick failed: ${err.message}` });
      }
    }

    // ── BAN ────────────────────────────────────────────────────────────────
    if (subcommand === "ban") {
      if (!interaction.memberPermissions?.has(PermissionFlagsBits.BanMembers)) {
        return interaction.reply({
          content: "❌ You need the Ban Members permission.",
          flags: [MessageFlags.Ephemeral],
        });
      }

      const playerId = options.getInteger("id", true);
      const reason = options.getString("reason") || "No reason provided";
      const durationHours = options.getInteger("duration_hours");
      const durationSec = durationHours && durationHours > 0 ? durationHours * 3600 : undefined;
      await interaction.deferReply();

      try {
        await fivemBan(playerId, reason, durationSec);
        await storage.createLog({
          type: "fivem_ban",
          content: `${user.tag} banned FiveM player #${playerId} (${durationHours ? durationHours + "h" : "perm"}): ${reason}`,
          userId: user.id,
          username: user.tag,
          metadata: { playerId, reason, durationHours },
        });

        const embed = serverEmbed(guild)
          .setColor(0xb91c1c)
          .setTitle(`🔨 PLAYER BANNED — #${playerId}`)
          .setDescription(`The hammer has dropped on operative **#${playerId}**.`)
          .addFields(
            { name: "🛡️ Moderator", value: `<@${user.id}>`, inline: true },
            { name: "⏳ Duration", value: durationHours ? `${durationHours} hour${durationHours !== 1 ? "s" : ""}` : "Permanent", inline: true },
            { name: "📝 Reason", value: reason, inline: false }
          );

        return interaction.editReply({ embeds: [embed] });
      } catch (err: any) {
        return interaction.editReply({ content: `❌ Ban failed: ${err.message}` });
      }
    }
  }

  if (commandName === "killfeed") {
    const subcommand = options.getSubcommand();

    if (subcommand === "setup") {
      const channel = options.getChannel("channel", true);
      await storage.setSetting({ key: "killfeed_channel", value: channel.id });
      await interaction.reply(`✅ Killfeed channel set to ${channel}`);
    }

    if (subcommand === "post") {
      const killer = options.getString("killer", true);
      const victim = options.getString("victim", true);
      const weapon = options.getString("weapon");
      const distance = options.getNumber("distance");
      const location = options.getString("location");

      const killfeedChannelId = await storage.getSetting("killfeed_channel");
      if (!killfeedChannelId?.value) {
        return interaction.reply("❌ Killfeed channel not configured.");
      }

      const channel = guild.channels.cache.get(killfeedChannelId.value);
      if (!channel || !("send" in channel)) {
        return interaction.reply("❌ Killfeed channel not found.");
      }

      const weaponEmoji = getWeaponEmoji(weapon);
      const distanceStr = distance ? `${distance.toFixed(0)}m` : "Unknown";
      const locationStr = location || "Unknown";

      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle(`${weaponEmoji} Kill Feed`)
        .addFields(
          { name: "Killer", value: `\`${killer}\``, inline: true },
          { name: "Victim", value: `\`${victim}\``, inline: true },
          { name: "Weapon", value: weapon || "Unknown", inline: true },
          { name: "Distance", value: distanceStr, inline: true },
          { name: "Location", value: locationStr, inline: true }
        )
        .setTimestamp();

      try {
        await (channel as TextChannel).send({ embeds: [embed] });
        await interaction.reply("✅ Kill posted to killfeed.");
      } catch (error) {
        console.error("Error posting kill:", error);
        await interaction.reply("❌ Failed to post kill.");
      }
    }
  }
}

function buildPlayerBar(current: number, max: number): string {
  const filledCount = Math.round((current / Math.max(max, 1)) * 10);
  const filled = "█".repeat(filledCount);
  const empty = "░".repeat(10 - filledCount);
  const pct = Math.round((current / Math.max(max, 1)) * 100);
  return `\`${filled}${empty}\` ${pct}% (${current}/${max})`;
}

function getWeaponEmoji(weapon?: string | null): string {
  if (!weapon) return "🔫";
  const lower = weapon.toLowerCase();
  if (lower.includes("mosin") || lower.includes("sniper")) return "🎯";
  if (lower.includes("ak") || lower.includes("rifle")) return "🔫";
  if (lower.includes("shotgun")) return "🔱";
  if (lower.includes("pistol") || lower.includes("glock")) return "🔶";
  if (lower.includes("melee") || lower.includes("axe")) return "🪓";
  if (lower.includes("grenade")) return "💣";
  return "🔫";
}

async function handleCommand(message: Message) {
  console.log(`Text command: ${message.content}`);
}

async function handleAutoMod(message: Message) {
  // AutoMod logic here
}

async function handleModalSubmit(interaction: any) {
  // Modal handling here
}

async function handleReactionAdd(reaction: MessageReaction, user: User) {
  // Reaction add logic here
}

async function handleReactionRemove(reaction: MessageReaction, user: User) {
  // Reaction remove logic here
}
