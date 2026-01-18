import { storage } from "./storage";

async function seed() {
  const stats = await storage.getStats();
  if (stats.totalLogs > 0) {
    console.log("Database already seeded.");
    return;
  }

  console.log("Seeding database...");

  // Create some Logs
  await storage.createLog({
    type: "member_join",
    content: "User Gamer123 joined the server.",
    userId: "123456789012345678",
    username: "Gamer123",
    metadata: { guildId: "111222333" },
  });

  await storage.createLog({
    type: "message_delete",
    content: "Please do not spam.",
    userId: "876543210987654321",
    username: "Spammer99",
    metadata: { channelId: "999888777", guildId: "111222333" },
  });

  await storage.createLog({
    type: "automod",
    content: "Blocked message containing filtered word.",
    userId: "112233445566778899",
    username: "TrollAccount",
    metadata: { rule: "bad_words", guildId: "111222333" },
  });

  // Create some Cases
  await storage.createCase({
    type: "warn",
    targetId: "876543210987654321",
    targetName: "Spammer99",
    moderatorId: "555555555555555555",
    moderatorName: "AdminUser",
    reason: "Excessive spamming in general chat",
    active: true,
  });

  await storage.createCase({
    type: "mute",
    targetId: "112233445566778899",
    targetName: "TrollAccount",
    moderatorId: "555555555555555555",
    moderatorName: "AdminUser",
    reason: "Using inappropriate language",
    active: true,
  });

  await storage.createCase({
    type: "ban",
    targetId: "999999999999999999",
    targetName: "HackerOne",
    moderatorId: "555555555555555555",
    moderatorName: "AdminUser",
    reason: "Exploiting server bugs",
    active: true,
  });

  console.log("Seeding complete!");
}

seed().catch(console.error).finally(() => process.exit(0));
