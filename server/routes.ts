import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { initializeBot } from "./bot";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Initialize Discord Bot
  try {
await initializeBot();
  } catch (err) {
    console.error("Failed to initialize Discord bot:", err);
  }

  // --- API Routes ---

  // Logs
  app.get(api.logs.list.path, async (req, res) => {
    const logs = await storage.getLogs();
    res.json(logs);
  });

  app.post(api.logs.create.path, async (req, res) => {
    try {
      const input = api.logs.create.input.parse(req.body);
      const log = await storage.createLog(input);
      res.status(201).json(log);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  // Cases
  app.get(api.cases.list.path, async (req, res) => {
    const cases = await storage.getCases();
    res.json(cases);
  });

  app.get(api.cases.get.path, async (req, res) => {
    const c = await storage.getCase(Number(req.params.id));
    if (!c) return res.status(404).json({ message: "Case not found" });
    res.json(c);
  });

  app.post(api.cases.create.path, async (req, res) => {
    try {
      const input = api.cases.create.input.parse(req.body);
      const c = await storage.createCase(input);
      res.status(201).json(c);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  // Rules
  app.get(api.rules.list.path, async (req, res) => {
    const rules = await storage.getRules();
    res.json(rules);
  });

  app.post(api.rules.create.path, async (req, res) => {
    try {
      const input = api.rules.create.input.parse(req.body);
      const rule = await storage.createRule(input);
      res.status(201).json(rule);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.delete(api.rules.delete.path, async (req, res) => {
    await storage.deleteRule(Number(req.params.id));
    res.status(204).send();
  });

  // Roles
  app.get(api.roles.list.path, async (req, res) => {
    const roles = await storage.getRoleConfigs();
    res.json(roles);
  });

  app.post(api.roles.create.path, async (req, res) => {
    try {
      const input = api.roles.create.input.parse(req.body);
      const role = await storage.createRoleConfig(input);
      res.status(201).json(role);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.put(api.roles.update.path, async (req, res) => {
    try {
      const input = api.roles.update.input.parse(req.body);
      const role = await storage.updateRoleConfig(Number(req.params.id), input);
      res.json(role);
    } catch (err) {
       if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.delete(api.roles.delete.path, async (req, res) => {
    await storage.deleteRoleConfig(Number(req.params.id));
    res.status(204).send();
  });

  // Settings
  app.get(api.settings.get.path, async (req, res) => {
    const key = req.params.key as string;
    const setting = await storage.getSetting(key);
    if (!setting) return res.status(404).json({ message: "Setting not found" });
    res.json(setting);
  });

  app.post(api.settings.set.path, async (req, res) => {
    try {
      const input = api.settings.set.input.parse(req.body);
      const setting = await storage.setSetting(input);
      res.json(setting);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  // Role List Members
  app.get(api.roleListMembers.list.path, async (req, res) => {
    const roleId = req.query.roleId as string | undefined;
    const members = await storage.getRoleListMembers(roleId);
    res.json(members);
  });

  app.get(api.roleListMembers.history.path, async (req, res) => {
    const history = await storage.getRoleListHistory();
    res.json(history);
  });

  app.post(api.roleListMembers.add.path, async (req, res) => {
    try {
      const input = api.roleListMembers.add.input.parse(req.body);
      const member = await storage.addRoleListMember(input);
      res.status(201).json(member);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.delete(api.roleListMembers.remove.path, async (req, res) => {
    await storage.removeRoleListMember(req.params.roleId, req.params.userId);
    res.status(204).send();
  });

  // Stats
  app.get(api.stats.get.path, async (req, res) => {
    const stats = await storage.getStats();
    res.json(stats);
  });

  // Moderator Panel
  app.get("/mod", async (req, res) => {
    try {
      const { pwd } = req.query;
      const dashboardPassword = process.env.DASHBOARD_PASSWORD;

      if (!dashboardPassword || pwd !== dashboardPassword) {
        return res.status(403).send("<h1>❌ Access Denied</h1><p>Invalid or missing dashboard password.</p>");
      }

      const start = Date.now();
      const stats = await storage.getStats();
      const dbPing = Date.now() - start;
      const recentLogs = await storage.getLogs(20);

      const rows = recentLogs.map(l => `
        <tr>
          <td>${l.username || 'System'}</td>
          <td>${l.type}</td>
          <td>${l.content.substring(0, 50)}${l.content.length > 50 ? '...' : ''}</td>
          <td>${new Date(l.timestamp).toLocaleString()}</td>
        </tr>
      `).join("");

      res.send(`
        <html>
        <head>
          <title>Moderator Dashboard</title>
          <meta http-equiv="refresh" content="10">
          <style>
            body {
              background:#0f1116;
              color:#fff;
              font-family: Arial, sans-serif;
              padding:30px;
            }
            table {
              width:100%;
              border-collapse:collapse;
              margin-top: 20px;
            }
            td, th {
              border:1px solid #333;
              padding:12px;
              text-align: left;
            }
            th {
              background:#1c1f26;
              color: #5865F2;
            }
            .card {
              background:#1c1f26;
              padding:20px;
              margin-bottom:20px;
              border-radius:8px;
              border: 1px solid #333;
            }
            h1 { color: #5865F2; }
          </style>
        </head>
        <body>
          <h1>🛠 Bot Moderator Panel</h1>
          <div class="card">
            <b>Database Ping:</b> ${dbPing}ms<br>
            <b>Total Logs:</b> ${stats.totalLogs}<br>
            <b>Active Cases:</b> ${stats.totalCases}
          </div>
          <h2>Recent Activity</h2>
          <table>
            <tr>
              <th>User</th>
              <th>Type</th>
              <th>Content</th>
              <th>Time</th>
            </tr>
            ${rows}
          </table>
        </body>
        </html>
      `);
    } catch (err) {
      console.error(err);
      res.status(500).send("Dashboard error");
    }
  });

  return httpServer;
}
