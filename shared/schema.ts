import { pgTable, text, serial, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const logs = pgTable("logs", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // 'message_delete', 'member_join', 'automod', etc.
  content: text("content").notNull(),
  userId: text("user_id"), // Discord User ID
  username: text("username"), // Discord Username at the time
  metadata: jsonb("metadata"), // Extra details like channel ID, etc.
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const cases = pgTable("cases", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // 'warn', 'kick', 'ban'
  reason: text("reason"),
  moderatorId: text("moderator_id").notNull(),
  moderatorName: text("moderator_name").notNull(),
  targetId: text("target_id").notNull(),
  targetName: text("target_name").notNull(),
  active: boolean("active").default(true),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const rules = pgTable("rules", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(), // The actual rule text
  severity: text("severity").notNull(), // 'warn', 'kick', 'ban'
  enabled: boolean("enabled").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertLogSchema = createInsertSchema(logs).omit({ id: true, timestamp: true });
export const insertCaseSchema = createInsertSchema(cases).omit({ id: true, timestamp: true });
export const insertRuleSchema = createInsertSchema(rules).omit({ id: true, createdAt: true });

export type Log = typeof logs.$inferSelect;
export type InsertLog = z.infer<typeof insertLogSchema>;

export type Case = typeof cases.$inferSelect;
export type InsertCase = z.infer<typeof insertCaseSchema>;

export type Rule = typeof rules.$inferSelect;
export type InsertRule = z.infer<typeof insertRuleSchema>;
