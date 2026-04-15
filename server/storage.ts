import { db } from "./db";
import {
  logs, cases, rules, roleConfigs, settings, roleListMembers,
  type Log, type InsertLog,
  type Case, type InsertCase,
  type Rule, type InsertRule,
  type RoleConfig, type InsertRoleConfig,
  type Setting, type InsertSetting,
  type RoleListMember, type InsertRoleListMember
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

  // Role List Members
  addRoleListMember(m: InsertRoleListMember): Promise<RoleListMember>;
  isRoleListMember(roleId: string, userId: string): Promise<boolean>;
  removeRoleListMember(roleId: string, userId: string): Promise<void>;
  getRoleListMembers(roleId?: string): Promise<RoleListMember[]>;
  getRoleListHistory(limit?: number): Promise<RoleListMember[]>;

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

  async addRoleListMember(m: InsertRoleListMember): Promise<RoleListMember> {
    const [entry] = await db.insert(roleListMembers).values(m).returning();
    return entry;
  }

  async isRoleListMember(roleId: string, userId: string): Promise<boolean> {
    const [existing] = await db.select().from(roleListMembers)
      .where(and(eq(roleListMembers.roleId, roleId), eq(roleListMembers.userId, userId), eq(roleListMembers.action, "add")));
    return !!existing;
  }

  async removeRoleListMember(roleId: string, userId: string): Promise<void> {
    await db.delete(roleListMembers).where(
      and(eq(roleListMembers.roleId, roleId), eq(roleListMembers.userId, userId), eq(roleListMembers.action, "add"))
    );
  }

  async getRoleListMembers(roleId?: string): Promise<RoleListMember[]> {
    if (roleId) {
      return await db.select().from(roleListMembers)
        .where(and(eq(roleListMembers.roleId, roleId), eq(roleListMembers.action, "add")))
        .orderBy(desc(roleListMembers.timestamp));
    }
    return await db.select().from(roleListMembers)
      .where(eq(roleListMembers.action, "add"))
      .orderBy(desc(roleListMembers.timestamp));
  }

  async getRoleListHistory(limit = 50): Promise<RoleListMember[]> {
    return await db.select().from(roleListMembers)
      .orderBy(desc(roleListMembers.timestamp))
      .limit(limit);
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
// Add these to your storage object/class

async recordKill(kill: {
  killerId: string;
  killerName: string;
  victimId: string;
  victimName: string;
  weapon?: string;
  distance?: number;
  location?: string;
  serverId: number;
}) {
  return await db.insert(schema.kills_log).values({
    server_id: kill.serverId,
    killer_id: kill.killerId,
    killer_name: kill.killerName,
    victim_id: kill.victimId,
    victim_name: kill.victimName,
    weapon: kill.weapon,
    distance: kill.distance,
    location: kill.location,
    timestamp: new Date(),
  });
}

async createFaction(data: any) {
  const result = await db.insert(schema.factions).values(data).returning();
  return result[0];
}

async getFaction(factionId: number) {
  return await db.query.factions.findFirst({
    where: (factions, { eq }) => eq(factions.id, factionId),
  });
}

async getFactionByName(name: string) {
  return await db.query.factions.findFirst({
    where: (factions, { eq }) => eq(factions.name, name),
  });
}

async getFactionByMember(userId: string) {
  const member = await db.query.faction_members.findFirst({
    where: (members, { eq }) => eq(members.user_id, userId),
  });
  if (!member) return null;
  return await this.getFaction(member.faction_id);
}

async addFactionMember(factionId: number, userId: string, username: string, rank: string = "member") {
  return await db.insert(schema.faction_members).values({
    faction_id: factionId,
    user_id: userId,
    username,
    rank,
    kills: 0,
    deaths: 0,
    playtime_hours: 0,
    role_permissions: {},
  }).returning();
}

async removeFactionMember(factionId: number, userId: string) {
  return await db.delete(schema.faction_members)
    .where(
      and(
        eq(schema.faction_members.faction_id, factionId),
        eq(schema.faction_members.user_id, userId)
      )
    );
}

async getFactionMembers(factionId: number) {
  return await db.query.faction_members.findMany({
    where: (members, { eq }) => eq(members.faction_id, factionId),
  });
}

async updateFactionMemberRank(factionId: number, userId: string, newRank: string) {
  return await db.update(schema.faction_members)
    .set({ rank: newRank })
    .where(
      and(
        eq(schema.faction_members.faction_id, factionId),
        eq(schema.faction_members.user_id, userId)
      )
    );
}

async updateFactionStats(factionId: number, updates: any) {
  return await db.update(schema.factions)
    .set(updates)
    .where(eq(schema.factions.id, factionId));
}

async getTopFactions(limit: number = 10) {
  return await db.query.factions.findMany({
    orderBy: (factions, { desc }) => [desc(factions.kills)],
    limit,
  });
}

async getPlayerStats(userId: string, serverId: number) {
  return await db.query.player_stats.findFirst({
    where: (stats, { and, eq }) =>
      and(
        eq(stats.user_id, userId),
        eq(stats.server_id, serverId)
      ),
  });
}

async updatePlayerStats(userId: string, updates: any) {
  return await db.update(schema.player_stats)
    .set(updates)
    .where(eq(schema.player_stats.user_id, userId));
}

async getRecentKills(limit: number = 10) {
  return await db.query.kills_log.findMany({
    orderBy: (kills, { desc }) => [desc(kills.timestamp)],
    limit,
  });
}
