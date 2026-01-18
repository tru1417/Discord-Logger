import { Client, GatewayIntentBits, Events, Partials } from "discord.js";
import { storage } from "./storage";

// Using a global variable for the client to ensure singleton
let client: Client | null = null;

export function initializeBot() {
  if (client) return client;

  if (!process.env.DISCORD_TOKEN) {
    console.log("DISCORD_TOKEN not found. Bot will not start.");
    return null;
  }

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

  // Simple Moderation Commands (!warn, !kick, !ban)
  client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith('!')) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift()?.toLowerCase();
    
    // Check permissions (simple check: must be admin or have specific role - for now just check Kick/Ban perms)
    if (!message.member?.permissions.has('KickMembers')) return; 

    if (command === 'warn') {
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
  });

  client.login(process.env.DISCORD_TOKEN).catch(err => {
    console.error("Failed to login to Discord:", err);
  });

  return client;
}
