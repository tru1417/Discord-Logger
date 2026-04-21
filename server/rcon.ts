import { Rcon } from "rcon-client";

let rconClient: Rcon | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let isConnecting = false;

// Support DAYZ_RCON_HOST as either "ip" or "ip:port"
const rawHost = process.env.DAYZ_RCON_HOST || "";
const hostHasPort = rawHost.includes(":");
const RCON_HOST = hostHasPort ? rawHost.split(":")[0] : rawHost;
const RCON_PORT = hostHasPort
  ? parseInt(rawHost.split(":")[1], 10)
  : parseInt(process.env.DAYZ_RCON_PORT || "2302", 10);
const RCON_PASSWORD = process.env.DAYZ_RCON_PASSWORD || "";

export type RconStatus = "connected" | "disconnected" | "error" | "unconfigured";

let currentStatus: RconStatus = "disconnected";
let lastError: string | null = null;

export function getRconStatus(): { status: RconStatus; error: string | null; host: string; port: number } {
  if (!RCON_HOST || !RCON_PASSWORD) {
    return { status: "unconfigured", error: "DAYZ_RCON_HOST or DAYZ_RCON_PASSWORD not set", host: RCON_HOST, port: RCON_PORT };
  }
  return { status: currentStatus, error: lastError, host: RCON_HOST, port: RCON_PORT };
}

async function connectRcon(): Promise<void> {
  if (!RCON_HOST || !RCON_PASSWORD) {
    console.log("[RCON] Not configured — skipping connection.");
    currentStatus = "unconfigured";
    return;
  }

  if (isConnecting) return;
  isConnecting = true;

  try {
    if (rconClient) {
      try { rconClient.disconnect(); } catch {}
      rconClient = null;
    }

    rconClient = new Rcon({
      host: RCON_HOST,
      port: RCON_PORT,
      password: RCON_PASSWORD,
      timeout: 5000,
    });

    rconClient.on("error", (err) => {
      console.error("[RCON] Connection error:", err.message);
      lastError = err.message;
      currentStatus = "error";
      scheduleReconnect();
    });

    rconClient.on("end", () => {
      console.warn("[RCON] Connection closed — will reconnect.");
      currentStatus = "disconnected";
      scheduleReconnect();
    });

    await rconClient.connect();
    currentStatus = "connected";
    lastError = null;
    console.log(`[RCON] Connected to ${RCON_HOST}:${RCON_PORT}`);
  } catch (err: any) {
    console.error("[RCON] Failed to connect:", err.message);
    lastError = err.message;
    currentStatus = "error";
    scheduleReconnect();
  } finally {
    isConnecting = false;
  }
}

function scheduleReconnect(delayMs = 30_000) {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    await connectRcon();
  }, delayMs);
}

export async function sendRconCommand(command: string): Promise<string> {
  if (!rconClient || currentStatus !== "connected") {
    throw new Error(`RCON not connected (status: ${currentStatus})`);
  }
  try {
    const response = await rconClient.send(command);
    return response;
  } catch (err: any) {
    lastError = err.message;
    currentStatus = "error";
    scheduleReconnect();
    throw err;
  }
}

export async function getServerStatus(): Promise<{
  online: boolean;
  players: number;
  maxPlayers: number;
  playerList: string[];
  raw?: string;
}> {
  try {
    const raw = await sendRconCommand("players");
    const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);

    const playerList: string[] = [];
    let maxPlayers = 60;

    for (const line of lines) {
      const headerMatch = line.match(/Players on server:\s*\[(\d+)\s*used\//);
      if (headerMatch) {
        maxPlayers = parseInt(headerMatch[1], 10);
        continue;
      }
      const playerMatch = line.match(/^\d+\s+\d+\.\d+\.\d+\.\d+:\d+\s+\d+\s+(.+)$/);
      if (playerMatch) {
        playerList.push(playerMatch[1].trim());
      }
    }

    return {
      online: true,
      players: playerList.length,
      maxPlayers,
      playerList,
      raw,
    };
  } catch {
    return { online: false, players: 0, maxPlayers: 60, playerList: [] };
  }
}

export async function kickPlayer(playerNumber: number, reason = "You have been kicked."): Promise<string> {
  return sendRconCommand(`kick ${playerNumber} ${reason}`);
}

export async function banPlayer(playerNumber: number, reason = "You have been banned."): Promise<string> {
  return sendRconCommand(`ban ${playerNumber}`);
}

export async function sayGlobal(message: string): Promise<string> {
  return sendRconCommand(`say -1 ${message}`);
}

export function initializeRcon(): void {
  connectRcon().catch((err) => console.error("[RCON] Init error:", err));
}
