import cron from "node-cron";
import { pool } from "./db";
import http from "http";
import https from "https";

export function initializeKeepAlive() {
  const replitDomain =
    process.env.REPLIT_DEV_DOMAIN ||
    process.env.REPLIT_DOMAINS?.split(",")[0];

  // ── HTTP self-ping every 4 minutes ─────────────────────────────────────────
  // This is what actually keeps the Replit container awake.
  // A plain DB query does NOT prevent Replit from putting the process to sleep.
  cron.schedule("*/4 * * * *", () => {
    try {
      if (replitDomain) {
        const url = `https://${replitDomain}/api/stats`;
        const lib = url.startsWith("https") ? https : http;
        const req = lib.get(url, (res) => {
          console.log(`[KeepAlive] HTTP ping → ${res.statusCode}`);
          res.resume(); // drain the response so the socket closes
        });
        req.on("error", (err) => {
          console.error("[KeepAlive] HTTP ping failed:", err.message);
          // Fallback: at least keep the DB alive
          pool.query("SELECT 1").catch(() => {});
        });
        req.setTimeout(10000, () => {
          req.destroy();
          console.error("[KeepAlive] HTTP ping timed out");
        });
      } else {
        // No public domain available (e.g., first start) — just ping DB
        pool.query("SELECT 1").catch((err) =>
          console.error("[KeepAlive] DB ping failed:", err)
        );
        console.log("[KeepAlive] No domain found, DB ping used as fallback");
      }
    } catch (err) {
      console.error("[KeepAlive] Unexpected error:", err);
    }
  });

  // ── Database heartbeat every 5 minutes ─────────────────────────────────────
  // Keeps the Postgres connection pool warm.
  cron.schedule("*/5 * * * *", async () => {
    try {
      const start = Date.now();
      await pool.query("SELECT NOW()");
      console.log(`[KeepAlive] DB heartbeat (${Date.now() - start}ms)`);
    } catch (err) {
      console.error("[KeepAlive] DB heartbeat failed:", err);
    }
  });

  console.log(
    `[KeepAlive] Initialized — HTTP ping every 4 min${replitDomain ? ` → https://${replitDomain}` : " (domain not yet available)"}, DB heartbeat every 5 min`
  );
}
