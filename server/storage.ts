import { db } from "./db";
import {
  logs, cases,
  type Log, type InsertLog,
  type Case, type InsertCase
} from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // Logs
  createLog(log: InsertLog): Promise<Log>;
  getLogs(limit?: number): Promise<Log[]>;
  getLogsByUser(userId: string): Promise<Log[]>;

  // Cases
  createCase(c: InsertCase): Promise<Case>;
  getCases(limit?: number): Promise<Case[]>;
  getCase(id: number): Promise<Case | undefined>;
  getCasesByTarget(targetId: string): Promise<Case[]>;
  
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

  async getCasesByTarget(targetId: string): Promise<Case[]> {
    return await db.select().from(cases)
      .where(eq(cases.targetId, targetId))
      .orderBy(desc(cases.timestamp));
  }

  async getStats(): Promise<{ totalLogs: number; totalCases: number; recentActivity: Log[] }> {
    const logsCount = await db.select().from(logs); // Inefficient for large DBs, but fine for MVP
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
