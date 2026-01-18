import { Client, GatewayIntentBits, Events, Partials, Message } from "discord.js";
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

  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildModeration,
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction],
  });

  client.on(Events.ClientReady, (c) => {
    console.log(`Ready! Logged in as ${c.user.tag}`);
  });

  // Log Message Deletions
  client.on(Events.MessageDelete, async (message) => {
    if (message.partial) {
      // Try to fetch if partial, though content might be lost
      try {
        await message.fetch();
      } catch (e) {
        console.log('Could not fetch deleted message:', e);
      }
    }

    if (message.author?.bot) return; // Ignore bots

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

  // Log Member Joins
  client.on(Events.GuildMemberAdd, async (member) => {
    await storage.createLog({
      type: 'member_join',
      content: `User ${member.user.tag} joined the server.`,
      userId: member.id,
      username: member.user.tag,
      metadata: {
        guildId: member.guild.id,
      },
    });
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

  client.login(process.env.DISCORD_TOKEN).catch(err => {
    console.error("Failed to login to Discord:", err);
  });

  return client;
}

async function handleCommand(message: Message) {
  const args = message.content.slice(1).trim().split(/ +/);
  const command = args.shift()?.toLowerCase();

  // Check permissions (simple check: must have Kick/Ban perms)
  
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
        await message.channel.send(`👢 **KICKED** ${message.author.tag}: ${reason}`);
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
        await message.channel.send(`🔨 **BANNED** ${message.author.tag}: ${reason}`);
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
