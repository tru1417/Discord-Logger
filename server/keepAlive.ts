import cron from "node-cron";
import { pool } from "./db";

export function initializeKeepAlive() {
  // Every 5 minutes: hit the database to keep it and the Repl active
  cron.schedule("*/5 * * * *", async () => {
    try {
      const start = Date.now();
      await pool.query("SELECT NOW()");
      const duration = Date.now() - start;
      console.log(`[KeepAlive] Heartbeat sent to database (${duration}ms)`);
    } catch (err) {
      console.error("[KeepAlive] Heartbeat failed:", err);
    }
  });

  console.log("[KeepAlive] Service initialized (5m interval)");
}
