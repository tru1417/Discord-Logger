import { pgTable, text, serial, timestamp, jsonb, boolean, integer, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const logs = pgTable("logs", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), 
  content: text("content").notNull(),
  userId: text("user_id"), 
  username: text("username"), 
  metadata: jsonb("metadata"), 
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const cases = pgTable("cases", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  moderatorId: text("moderator_id"),
  command: text("command"),
  moderatorName: text("moderator_name").notNull(),
  targetId: text("target_id").notNull(),
  targetName: text("target_name").notNull(),
  active: boolean("active").default(true),
  metadata: jsonb("metadata"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  reason: text("reason"),
});

export const rules = pgTable("rules", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(), 
  severity: text("severity").notNull(), 
  enabled: boolean("enabled").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const roleConfigs = pgTable("role_configs", {
  id: serial("id").primaryKey(),
  roleId: text("role_id").notNull(), // Discord Role ID
  roleName: text("role_name").notNull(),
  isAutoRole: boolean("is_auto_role").default(false), // Assign on join?
  rank: integer("rank").default(0), // Higher rank = more perms
  permissions: jsonb("permissions"), // JSON of allowed actions/perms
  reactionMessageId: text("reaction_message_id"), // For reaction roles
  reactionEmoji: text("reaction_emoji"), // For reaction roles
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const roleListMembers = pgTable("role_list_members", {
  id: serial("id").primaryKey(),
  roleId: text("role_id").notNull(),
  roleName: text("role_name").notNull(),
  userId: text("user_id").notNull(),
  username: text("username").notNull(),
  addedById: text("added_by_id").notNull(),
  addedByName: text("added_by_name").notNull(),
  action: text("action").notNull().default("add"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── DayZ Faction System ────────────────────────────────────────────────────
export const factions = pgTable("factions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  tag: text("tag").notNull(),
  leaderId: text("leader_id").notNull(),
  leaderName: text("leader_name").notNull(),
  description: text("description").default("No description set.").notNull(),
  color: text("color").default("#5865F2").notNull(),
  hq: text("hq").default("Unknown").notNull(),
  kills: integer("kills").default(0).notNull(),
  status: text("status").default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const factionMembers = pgTable("faction_members", {
  id: serial("id").primaryKey(),
  factionId: integer("faction_id").notNull(),
  userId: text("user_id").notNull(),
  username: text("username").notNull(),
  rank: text("rank").default("member").notNull(), // leader | officer | member
  kills: integer("kills").default(0).notNull(),
  deaths: integer("deaths").default(0).notNull(),
  playtimeHours: integer("playtime_hours").default(0).notNull(),
  rolePermissions: jsonb("role_permissions").default({}).notNull(),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});

// ── DayZ Kill Log ──────────────────────────────────────────────────────────
export const killsLog = pgTable("kills_log", {
  id: serial("id").primaryKey(),
  serverId: integer("server_id").notNull(),
  killerId: text("killer_id").notNull(),
  killerName: text("killer_name").notNull(),
  victimId: text("victim_id").notNull(),
  victimName: text("victim_name").notNull(),
  weapon: text("weapon"),
  distance: integer("distance"),
  location: text("location"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

// ── DayZ Player Stats ──────────────────────────────────────────────────────
export const playerStats = pgTable("player_stats", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  serverId: integer("server_id").notNull(),
  kills: integer("kills").default(0).notNull(),
  deaths: integer("deaths").default(0).notNull(),
  playtimeHours: integer("playtime_hours").default(0).notNull(),
  lastSeen: timestamp("last_seen").defaultNow().notNull(),
});

// ── DayZ Server Tracking ───────────────────────────────────────────────────
export const dayzServers = pgTable("dayz_servers", {
  id: serial("id").primaryKey(),
  label: text("label").notNull(),
  battlemetricsId: text("battlemetrics_id").notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertLogSchema = createInsertSchema(logs).omit({ id: true, timestamp: true });
export const insertCaseSchema = createInsertSchema(cases).omit({ id: true, timestamp: true });
export const insertRuleSchema = createInsertSchema(rules).omit({ id: true, createdAt: true });
export const insertRoleConfigSchema = createInsertSchema(roleConfigs).omit({ id: true, createdAt: true });
export const insertSettingsSchema = createInsertSchema(settings).omit({ id: true, updatedAt: true });
export const insertRoleListMemberSchema = createInsertSchema(roleListMembers).omit({ id: true, timestamp: true });
export const insertFactionSchema = createInsertSchema(factions).omit({ id: true, createdAt: true });
export const insertFactionMemberSchema = createInsertSchema(factionMembers).omit({ id: true, joinedAt: true });
export const insertKillsLogSchema = createInsertSchema(killsLog).omit({ id: true, timestamp: true });
export const insertPlayerStatsSchema = createInsertSchema(playerStats).omit({ id: true, lastSeen: true });
export const insertDayzServerSchema = createInsertSchema(dayzServers).omit({ id: true, createdAt: true });

export type Log = typeof logs.$inferSelect;
export type InsertLog = z.infer<typeof insertLogSchema>;

export type Case = typeof cases.$inferSelect;
export type InsertCase = z.infer<typeof insertCaseSchema>;

export type Rule = typeof rules.$inferSelect;
export type InsertRule = z.infer<typeof insertRuleSchema>;

export type RoleConfig = typeof roleConfigs.$inferSelect;
export type InsertRoleConfig = z.infer<typeof insertRoleConfigSchema>;

export type Setting = typeof settings.$inferSelect;
export type InsertSetting = z.infer<typeof insertSettingsSchema>;

export type RoleListMember = typeof roleListMembers.$inferSelect;
export type InsertRoleListMember = z.infer<typeof insertRoleListMemberSchema>;

export type Faction = typeof factions.$inferSelect;
export type InsertFaction = z.infer<typeof insertFactionSchema>;

export type FactionMember = typeof factionMembers.$inferSelect;
export type InsertFactionMember = z.infer<typeof insertFactionMemberSchema>;

export type KillsLog = typeof killsLog.$inferSelect;
export type InsertKillsLog = z.infer<typeof insertKillsLogSchema>;

export type PlayerStats = typeof playerStats.$inferSelect;
export type InsertPlayerStats = z.infer<typeof insertPlayerStatsSchema>;

export type DayzServer = typeof dayzServers.$inferSelect;
export type InsertDayzServer = z.infer<typeof insertDayzServerSchema>;
