import { db } from "./db";
import {
  logs, cases, rules, roleConfigs, settings, roleListMembers,
  kills_log, factions, faction_members, player_stats,
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

  // NEW — Kills / Factions / Player Stats
  recordKill(kill: {
    killerId: string;
    killerName: string;
    victimId: string;
    victimName: string;
    weapon?: string;
    distance?: number;
    location?: string;
    serverId: number;
  }): Promise<void>;

  createFaction(data: any): Promise<any>;
  getFaction(factionId: number): Promise<any | null>;
  getFactionByName(name: string): Promise<any | null>;
  getFactionByMember(userId: string): Promise<any | null>;

  addFactionMember(
    factionId: number,
    userId: string,
    username: string,
    rank?: string
  ): Promise<any>;

  removeFactionMember(factionId: number, userId: string): Promise<void>;
  getFactionMembers(factionId: number): Promise<any[]>;

  updateFactionMemberRank(
    factionId: number,
    userId: string,
    newRank: string
  ): Promise<void>;

  updateFactionStats(
    factionId: number,
    updates: any
  ): Promise<void>;

  getTopFactions(limit?: number): Promise<any[]>;

  getPlayerStats(userId: string, serverId: number): Promise<any | null>;
  updatePlayerStats(userId: string, updates: any): Promise<void>;

  getRecentKills(limit?: number): Promise<any[]>;
}

export class DatabaseStorage implements IStorage {
  // Logs
  async createLog(log: InsertLog): Promise<Log> {
    const [newLog] = await db.insert(logs).values(log).returning();
    return newLog;
  }

  async getLogs(limit = 50): Promise<Log[]> {
    return await db.select().from(logs).orderBy(desc(logs.timestamp)).limit(limit);
  }

  async getCasesByUser(userId: string): Promise<Case[]> {
    return await db.select().from(cases)
      .where(eq(cases.targetId, userId))
      .orderBy(desc(cases.timestamp));
  }

  // Cases
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

  // Rules
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

  // Role Configs
  async createRoleConfig(r: InsertRoleConfig): Promise<RoleConfig> {
    const [newRole] = await db.insert(roleConfigs).values(r).returning();
    return newRole;
  }

  async getRoleConfigs(): Promise<RoleConfig[]> {
    return await db.select().from(roleConfigs).orderBy(desc(roleConfigs.rank));
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

  // Settings
  async getSetting(key: string): Promise<Setting | undefined> {
    const [s] = await db.select().from(settings).where(eq(settings.key, key));
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

  // Role List Members
  async addRoleListMember(m: InsertRoleListMember): Promise<RoleListMember> {
    const [entry] = await db.insert(roleListMembers).values(m).returning();
    return entry;
  }

  async isRoleListMember(roleId: string, userId: string): Promise<boolean> {
    const [existing] = await db.select().from(roleListMembers)
      .where(and(
        eq(roleListMembers.roleId, roleId),
        eq(roleListMembers.userId, userId),
        eq(roleListMembers.action, "add")
      ));
    return !!existing;
  }

  async removeRoleListMember(roleId: string, userId: string): Promise<void> {
    await db.delete(roleListMembers).where(
      and(
        eq(roleListMembers.roleId, roleId),
        eq(roleListMembers.userId, userId),
        eq(roleListMembers.action, "add")
      )
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

  // Stats
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

  // NEW — Kills / Factions / Player Stats
  async recordKill(kill: {
    killerId: string;
    killerName: string;
    victimId: string;
    victimName: string;
    weapon?: string;
    distance?: number;
    location?: string;
    serverId: number;
  }): Promise<void> {
    await db.insert(kills_log).values({
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

  async createFaction(data: any): Promise<any> {
    const result = await db.insert(factions).values(data).returning();
    return result[0];
  }

  async getFaction(factionId: number): Promise<any | null> {
    return await db.query.factions.findFirst({
      where: (f, { eq }) => eq(f.id, factionId),
    });
  }

  async getFactionByName(name: string): Promise<any | null> {
    return await db.query.factions.findFirst({
      where: (f, { eq }) => eq(f.name, name),
    });
  }

  async getFactionByMember(userId: string): Promise<any | null> {
    const member = await db.query.faction_members.findFirst({
      where: (m, { eq }) => eq(m.user_id, userId),
    });
    if (!member) return null;
    return await this.getFaction(member.faction_id);
  }

  async addFactionMember(
    factionId: number,
    userId: string,
    username: string,
    rank: string = "member"
  ): Promise<any> {
    const result = await db.insert(faction_members).values({
      faction_id: factionId,
      user_id: userId,
      username,
      rank,
      kills: 0,
      deaths: 0,
      playtime_hours: 0,
      role_permissions: {},
    }).returning();
    return result[0];
  }

  async removeFactionMember(factionId: number, userId: string): Promise<void> {
    await db.delete(faction_members).where(
      and(
        eq(faction_members.faction_id, factionId),
        eq(faction_members.user_id, userId)
      )
    );
  }

  async getFactionMembers(factionId: number): Promise<any[]> {
    return await db.query.faction_members.findMany({
      where: (m, { eq }) => eq(m.faction_id, factionId),
    });
  }

  async updateFactionMemberRank(
    factionId: number,
    userId: string,
    newRank: string
  ): Promise<void> {
    await db.update(faction_members)
      .set({ rank: newRank })
      .where(
        and(
          eq(faction_members.faction_id, factionId),
          eq(faction_members.user_id, userId)
        )
      );
  }

  async updateFactionStats(
    factionId: number,
    updates: any
  ): Promise<void> {
    await db.update(factions)
      .set(updates)
      .where(eq(factions.id, factionId));
  }

  async getTopFactions(limit: number = 10): Promise<any[]> {
    return await db.query.factions.findMany({
      orderBy: (f, { desc }) => [desc(f.kills)],
      limit,
    });
  }

  async getPlayerStats(
    userId: string,
    serverId: number
  ): Promise<any | null> {
    return await db.query.player_stats.findFirst({
      where: (stats, { and, eq }) =>
        and(
          eq(stats.user_id, userId),
          eq(stats.server_id, serverId)
        ),
    });
  }

  async updatePlayerStats(
    userId: string,
    updates: any
  ): Promise<void> {
    await db.update(player_stats)
      .set(updates)
      .where(eq(player_stats.user_id, userId));
  }

  async getRecentKills(limit: number = 10): Promise<any[]> {
    return await db.query.kills_log.findMany({
      orderBy: (k, { desc }) => [desc(k.timestamp)],
      limit,
    });
  }
}

export const storage = new DatabaseStorage();

  return await db.query.kills_log.findMany({
    orderBy: (kills, { desc }) => [desc(kills.timestamp)],
    limit,
  });
}
