import { pgTable, text, serial, timestamp, jsonb, boolean, integer } from "drizzle-orm/pg-core";
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
  reason: text("reason"),
  moderatorId: text("moderator_id").notNull(),
  moderatorName: text("moderator_name").notNull(),
  targetId: text("target_id").notNull(),
  targetName: text("target_name").notNull(),
  active: boolean("active").default(true),
  metadata: jsonb("metadata"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
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

export const insertLogSchema = createInsertSchema(logs).omit({ id: true, timestamp: true });
export const insertCaseSchema = createInsertSchema(cases).omit({ id: true, timestamp: true });
export const insertRuleSchema = createInsertSchema(rules).omit({ id: true, createdAt: true });
export const insertRoleConfigSchema = createInsertSchema(roleConfigs).omit({ id: true, createdAt: true });
export const insertSettingsSchema = createInsertSchema(settings).omit({ id: true, updatedAt: true });
export const insertRoleListMemberSchema = createInsertSchema(roleListMembers).omit({ id: true, timestamp: true });

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
