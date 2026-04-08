import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";
import { sql } from "drizzle-orm";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

export const db = drizzle(pool, { schema });

export async function initializeDatabase() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS role_list_members (
        id SERIAL PRIMARY KEY,
        role_id TEXT NOT NULL,
        role_name TEXT NOT NULL,
        user_id TEXT NOT NULL,
        username TEXT NOT NULL,
        added_by_id TEXT NOT NULL,
        added_by_name TEXT NOT NULL,
        action TEXT NOT NULL DEFAULT 'add',
        timestamp TIMESTAMP DEFAULT NOW() NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS settings (
        id SERIAL PRIMARY KEY,
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);
    console.log("Database tables initialized");
  } catch (error) {
    console.error("Failed to initialize database:", error);
  }
}

export default pool;
