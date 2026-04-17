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
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
  InteractionType,
  PermissionFlagsBits,
  MessageReaction,
  User,
  MessageFlags,
  AttachmentBuilder,
  TextChannel,
} from "discord.js";
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

  // Log Message Deletions
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

  // Log Member Joins + Auto Role Assignment + Welcome Image
  client.on(Events.GuildMemberAdd, async (member) => {
    // Log join
    await storage.createLog({
      type: "member_join",
      content: `User ${member.user.tag} joined the server.`,
      userId: member.id,
      username: member.user.tag,
      metadata: {
        guildId: member.guild.id,
      },
    });

    // Dynamic Image Welcome Card
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
          console.error(
            "Failed to load avatar for welcome image:",
            avatarError
          );
        }

        const attachment = new AttachmentBuilder(canvas.toBuffer(), {
          name: "welcome.png",
        });

        const welcomeSetting = await storage.getSetting("welcome_message");
        const customMessage =
          welcomeSetting?.value ||
          `Welcome {user}!
Please hit the big ✅ in #rules then head to #subscriptions for roles.
Ranked players → #claim-your-rank`;

        const formattedMessage = customMessage
          .replace("{user}", `<@${member.id}>`)
          .replace("{server}", member.guild.name);

        await (channel as TextChannel).send({
          content: formattedMessage,
          files
