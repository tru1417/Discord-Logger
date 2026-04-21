import { db } from "./db";
import {
  logs, cases, rules, roleConfigs, settings, roleListMembers,
  factions, factionMembers, killsLog, playerStats, dayzServers,
  type Log, type InsertLog,
  type Case, type InsertCase,
  type Rule, type InsertRule,
  type RoleConfig, type InsertRoleConfig,
  type Setting, type InsertSetting,
  type RoleListMember, type InsertRoleListMember,
  type Faction, type InsertFaction,
  type FactionMember,
  type KillsLog,
  type PlayerStats,
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
  getRoleConfigByReaction(messageId: string, emoji: string): Promise<RoleConfig | undefined>;
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

  // Factions
  createFaction(data: InsertFaction): Promise<Faction>;
  getFaction(factionId: number): Promise<Faction | null>;
  getFactionByName(name: string): Promise<Faction | null>;
  getFactionByTag(tag: string): Promise<Faction | null>;
  getFactionByMember(userId: string): Promise<Faction | null>;
  getAllFactions(): Promise<Faction[]>;
  updateFactionStats(factionId: number, updates: Partial<InsertFaction>): Promise<void>;
  deleteFaction(factionId: number): Promise<void>;

  // Faction Members
  addFactionMember(factionId: number, userId: string, username: string, rank?: string): Promise<FactionMember>;
  removeFactionMember(factionId: number, userId: string): Promise<void>;
  getFactionMembers(factionId: number): Promise<FactionMember[]>;
  getFactionMember(userId: string): Promise<FactionMember | null>;
  updateFactionMemberRank(factionId: number, userId: string, newRank: string): Promise<void>;
  getTopFactions(limit?: number): Promise<Faction[]>;

  // Kill Log
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
  getRecentKills(limit?: number): Promise<KillsLog[]>;

  // Player Stats
  getPlayerStats(userId: string, serverId: number): Promise<PlayerStats | null>;
  updatePlayerStats(userId: string, updates: Partial<PlayerStats>): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // ── Logs ────────────────────────────────────────────────────────────────
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

  // ── Cases ────────────────────────────────────────────────────────────────
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
    const [updated] = await db.update(cases).set(c).where(eq(cases.id, id)).returning();
    return updated;
  }

  async deleteCase(id: number): Promise<void> {
    await db.delete(cases).where(eq(cases.id, id));
  }

  // ── Rules ────────────────────────────────────────────────────────────────
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

  // ── Role Configs ─────────────────────────────────────────────────────────
  async createRoleConfig(r: InsertRoleConfig): Promise<RoleConfig> {
    const [newRole] = await db.insert(roleConfigs).values(r).returning();
    return newRole;
  }

  async getRoleConfigs(): Promise<RoleConfig[]> {
    return await db.select().from(roleConfigs).orderBy(desc(roleConfigs.rank));
  }

  async getRoleConfigByReaction(messageId: string, emoji: string): Promise<RoleConfig | undefined> {
    const [rc] = await db.select().from(roleConfigs).where(
      and(eq(roleConfigs.reactionMessageId, messageId), eq(roleConfigs.reactionEmoji, emoji))
    );
    return rc;
  }

  async updateRoleConfig(id: number, r: Partial<InsertRoleConfig>): Promise<RoleConfig> {
    const [updated] = await db.update(roleConfigs).set(r).where(eq(roleConfigs.id, id)).returning();
    return updated;
  }

  async deleteRoleConfig(id: number): Promise<void> {
    await db.delete(roleConfigs).where(eq(roleConfigs.id, id));
  }

  // ── Settings ─────────────────────────────────────────────────────────────
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

  // ── Role List Members ────────────────────────────────────────────────────
  async addRoleListMember(m: InsertRoleListMember): Promise<RoleListMember> {
    const [entry] = await db.insert(roleListMembers).values(m).returning();
    return entry;
  }

  async isRoleListMember(roleId: string, userId: string): Promise<boolean> {
    const [existing] = await db.select().from(roleListMembers).where(
      and(
        eq(roleListMembers.roleId, roleId),
        eq(roleListMembers.userId, userId),
        eq(roleListMembers.action, "add")
      )
    );
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

  // ── Stats ────────────────────────────────────────────────────────────────
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

  // ── Factions ─────────────────────────────────────────────────────────────
  async createFaction(data: InsertFaction): Promise<Faction> {
    const [faction] = await db.insert(factions).values(data).returning();
    return faction;
  }

  async getFaction(factionId: number): Promise<Faction | null> {
    const [f] = await db.select().from(factions).where(eq(factions.id, factionId));
    return f ?? null;
  }

  async getFactionByName(name: string): Promise<Faction | null> {
    const [f] = await db.select().from(factions)
      .where(eq(factions.name, name));
    return f ?? null;
  }

  async getFactionByTag(tag: string): Promise<Faction | null> {
    const [f] = await db.select().from(factions)
      .where(eq(factions.tag, tag));
    return f ?? null;
  }

  async getFactionByMember(userId: string): Promise<Faction | null> {
    const [member] = await db.select().from(factionMembers)
      .where(eq(factionMembers.userId, userId));
    if (!member) return null;
    return this.getFaction(member.factionId);
  }

  async getAllFactions(): Promise<Faction[]> {
    return await db.select().from(factions)
      .where(eq(factions.status, "active"))
      .orderBy(desc(factions.kills));
  }

  async updateFactionStats(factionId: number, updates: Partial<InsertFaction>): Promise<void> {
    await db.update(factions).set(updates).where(eq(factions.id, factionId));
  }

  async deleteFaction(factionId: number): Promise<void> {
    await db.delete(factionMembers).where(eq(factionMembers.factionId, factionId));
    await db.delete(factions).where(eq(factions.id, factionId));
  }

  async getTopFactions(limit = 10): Promise<Faction[]> {
    return await db.select().from(factions)
      .where(eq(factions.status, "active"))
      .orderBy(desc(factions.kills))
      .limit(limit);
  }

  // ── Faction Members ──────────────────────────────────────────────────────
  async addFactionMember(
    factionId: number,
    userId: string,
    username: string,
    rank = "member"
  ): Promise<FactionMember> {
    const [member] = await db.insert(factionMembers).values({
      factionId,
      userId,
      username,
      rank,
      kills: 0,
      deaths: 0,
      playtimeHours: 0,
      rolePermissions: {},
    }).returning();
    return member;
  }

  async removeFactionMember(factionId: number, userId: string): Promise<void> {
    await db.delete(factionMembers).where(
      and(eq(factionMembers.factionId, factionId), eq(factionMembers.userId, userId))
    );
  }

  async getFactionMembers(factionId: number): Promise<FactionMember[]> {
    return await db.select().from(factionMembers)
      .where(eq(factionMembers.factionId, factionId));
  }

  async getFactionMember(userId: string): Promise<FactionMember | null> {
    const [m] = await db.select().from(factionMembers)
      .where(eq(factionMembers.userId, userId));
    return m ?? null;
  }

  async updateFactionMemberRank(factionId: number, userId: string, newRank: string): Promise<void> {
    await db.update(factionMembers)
      .set({ rank: newRank })
      .where(and(eq(factionMembers.factionId, factionId), eq(factionMembers.userId, userId)));
  }

  // ── Kill Log ─────────────────────────────────────────────────────────────
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
    await db.insert(killsLog).values({
      serverId: kill.serverId,
      killerId: kill.killerId,
      killerName: kill.killerName,
      victimId: kill.victimId,
      victimName: kill.victimName,
      weapon: kill.weapon,
      distance: kill.distance,
      location: kill.location,
    });
  }

  async getRecentKills(limit = 10): Promise<KillsLog[]> {
    return await db.select().from(killsLog)
      .orderBy(desc(killsLog.timestamp))
      .limit(limit);
  }

  // ── Player Stats ─────────────────────────────────────────────────────────
  async getPlayerStats(userId: string, serverId: number): Promise<PlayerStats | null> {
    const [stats] = await db.select().from(playerStats).where(
      and(eq(playerStats.userId, userId), eq(playerStats.serverId, serverId))
    );
    return stats ?? null;
  }

  async updatePlayerStats(userId: string, updates: Partial<PlayerStats>): Promise<void> {
    await db.update(playerStats).set(updates).where(eq(playerStats.userId, userId));
  }
}

export const storage = new DatabaseStorage();
