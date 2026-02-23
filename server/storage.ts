import { db } from "./db";
import {
  logs, cases, rules, roleConfigs, settings,
  type Log, type InsertLog,
  type Case, type InsertCase,
  type Rule, type InsertRule,
  type RoleConfig, type InsertRoleConfig,
  type Setting, type InsertSetting
} from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";

export interface IStorage {
  // Logs
  createLog(log: InsertLog): Promise<Log>;
  getLogs(limit?: number): Promise<Log[]>;
  getCasesByUser(userId: string): Promise<Case[]>;

  // Cases
  createCase(c: InsertCase): Promise<Case>;
  getCases(limit?: number): Promise<Case[]>;
  getCase(id: number): Promise<Case | undefined>;
  getCasesByUser(userId: string): Promise<Case[]>;
  updateCase(id: number, c: Partial<InsertCase>): Promise<Case>;
  deleteCase(id: number): Promise<void>;

  // Rules
  createRule(r: InsertRule): Promise<Rule>;
  getRules(): Promise<Rule[]>;
  deleteRule(id: number): Promise<void>;

  // Roles
  createRoleConfig(r: InsertRoleConfig): Promise<RoleConfig>;
  getRoleConfigs(): Promise<RoleConfig[]>;
  updateRoleConfig(id: number, r: Partial<InsertRoleConfig>): Promise<RoleConfig>;
  deleteRoleConfig(id: number): Promise<void>;

  // Settings
  getSetting(key: string): Promise<Setting | undefined>;
  setSetting(s: InsertSetting): Promise<Setting>;
  
  // Stats
  getStats(): Promise<{ totalLogs: number; totalCases: number; recentActivity: Log[] }>;
}

export class DatabaseStorage implements IStorage {
  async createLog(log: InsertLog): Promise<Log> {
    const [newLog] = await db.insert(logs).values(log).returning();
    return newLog;
  }

  async getLogs(limit = 50): Promise<Log[]> {
    return await db.select().from(logs).orderBy(desc(logs.timestamp)).limit(limit);
  }

  async getLogsByUser(userId: string): Promise<Log[]> {
    return await db.select().from(logs)
      .where(eq(logs.userId, userId))
      .orderBy(desc(logs.timestamp));
  }

  async createCase(c: InsertCase): Promise<Case> {
    const [newCase] = await db.insert(cases).values(c).returning();
    return newCase;
  }

  async getCases(limit = 50): Promise<Case[]> {
    return await db.select().from(cases).orderBy(desc(cases.timestamp)).limit(limit);
  }

  async getCase(id: number): Promise<Case | undefined> {
    const [c] = await db.select().from(cases).where(eq(cases.id, id));
    return c;
  }

  async getCasesByUser(userId: string): Promise<Case[]> {
    return await db.select().from(cases)
      .where(eq(cases.targetId, userId))
      .orderBy(desc(cases.timestamp));
  }

  async updateCase(id: number, c: Partial<InsertCase>): Promise<Case> {
    const [updated] = await db.update(cases)
      .set(c)
      .where(eq(cases.id, id))
      .returning();
    return updated;
  }

  async deleteCase(id: number): Promise<void> {
    await db.delete(cases).where(eq(cases.id, id));
  }

  async createRule(r: InsertRule): Promise<Rule> {
    const [newRule] = await db.insert(rules).values(r).returning();
    return newRule;
  }

  async getRules(): Promise<Rule[]> {
    return await db.select().from(rules).orderBy(desc(rules.createdAt));
  }

  async deleteRule(id: number): Promise<void> {
    await db.delete(rules).where(eq(rules.id, id));
  }

  async createRoleConfig(r: InsertRoleConfig): Promise<RoleConfig> {
    const [newRole] = await db.insert(roleConfigs).values(r).returning();
    return newRole;
  }

  async getRoleConfigs(): Promise<RoleConfig[]> {
    return await db.select().from(roleConfigs).orderBy(desc(roleConfigs.rank));
  }

  async getRoleConfigByReaction(messageId: string, emoji: string): Promise<RoleConfig | undefined> {
    const results = await db.select().from(roleConfigs)
      .where(and(
        eq(roleConfigs.reactionMessageId, messageId),
        eq(roleConfigs.reactionEmoji, emoji)
      ));
    return results[0];
  }

  async updateRoleConfig(id: number, r: Partial<InsertRoleConfig>): Promise<RoleConfig> {
    const [updated] = await db.update(roleConfigs)
      .set(r)
      .where(eq(roleConfigs.id, id))
      .returning();
    return updated;
  }

  async deleteRoleConfig(id: number): Promise<void> {
    await db.delete(roleConfigs).where(eq(roleConfigs.id, id));
  }

  async getSetting(key: string): Promise<Setting | undefined> {
    const [s] = await db.select().from(settings).where(eq(settings.key, key));
    if (!s && key === 'discord_invite_link') {
      return await this.setSetting({ key: 'discord_invite_link', value: 'https://discord.gg/example' });
    }
    return s;
  }

  async setSetting(s: InsertSetting): Promise<Setting> {
    const [existing] = await db.select().from(settings).where(eq(settings.key, s.key));
    if (existing) {
      const [updated] = await db.update(settings)
        .set({ value: s.value, updatedAt: new Date() })
        .where(eq(settings.key, s.key))
        .returning();
      return updated;
    }
    const [newSetting] = await db.insert(settings).values(s).returning();
    return newSetting;
  }

  async getStats(): Promise<{ totalLogs: number; totalCases: number; recentActivity: Log[] }> {
    const logsCount = await db.select().from(logs);
    const casesCount = await db.select().from(cases);
    const recent = await db.select().from(logs).orderBy(desc(logs.timestamp)).limit(5);

    return {
      totalLogs: logsCount.length,
      totalCases: casesCount.length,
      recentActivity: recent,
    };
  }
}

export const storage = new DatabaseStorage();
