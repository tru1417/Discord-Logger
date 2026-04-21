/**
 * BattleEye RCON — UDP-based protocol used by DayZ, Arma, etc.
 * Packet format: BE (2 bytes) + CRC32 (4 bytes LE) + FF + type + data
 * Types: 0x00 = login, 0x01 = command, 0x02 = server-message ack
 */
import dgram from "dgram";
import CRC32 from "crc-32";
import { EventEmitter } from "events";

// ── Parse DAYZ_RCON_HOST which may be "ip" or "ip:port" ───────────────────
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

// ── CRC32 helper ──────────────────────────────────────────────────────────
function computeCrc32(payload: Buffer): Buffer {
  const signed = CRC32.buf(payload);
  const unsigned = signed >>> 0; // convert to unsigned 32-bit
  const buf = Buffer.alloc(4);
  buf.writeUInt32LE(unsigned, 0);
  return buf;
}

// ── Build a BattleEye packet ───────────────────────────────────────────────
function buildPacket(type: number, data: Buffer = Buffer.alloc(0)): Buffer {
  const payload = Buffer.concat([Buffer.from([0xff, type]), data]);
  const crc = computeCrc32(payload);
  return Buffer.concat([Buffer.from([0x42, 0x45]), crc, payload]);
}

// ── BattleEye RCON client ─────────────────────────────────────────────────
class BattlEyeRcon extends EventEmitter {
  private socket: dgram.Socket | null = null;
  private seq = 0;
  private loggedIn = false;
  private keepAliveTimer: NodeJS.Timeout | null = null;
  private pendingCommands = new Map<
    number,
    { resolve: (v: string) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }
  >();
  private multiParts = new Map<number, Map<number, string>>();

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = dgram.createSocket("udp4");
      let settled = false;

      const done = (err?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(loginTimeout);
        if (err) reject(err);
        else resolve();
      };

      const loginTimeout = setTimeout(() => {
        done(new Error("RCON login timeout — verify host, port, and password"));
        this.destroy();
      }, 10_000);

      this.socket.on("error", (err) => {
        lastError = err.message;
        currentStatus = "error";
        done(err);
        this.destroy();
      });

      this.socket.on("message", (msg) => {
        this.handleMessage(msg, () => done());
      });

      this.socket.bind(() => {
        const pwBuf = Buffer.from(RCON_PASSWORD, "utf8");
        const loginPkt = buildPacket(0x00, pwBuf);
        this.socket!.send(loginPkt, RCON_PORT, RCON_HOST);
      });
    });
  }

  private handleMessage(msg: Buffer, onLogin?: () => void) {
    // Packet layout: BE(2) + CRC32(4) + 0xFF(1) + type(1) + data(n) = min 8 bytes
    if (msg.length < 8 || msg[0] !== 0x42 || msg[1] !== 0x45 || msg[6] !== 0xff) return;

    const type = msg[7]; // type byte is after BE(2) + CRC32(4) + 0xFF(1) = index 7
    const data = msg.slice(8); // data starts after the type byte

    if (type === 0x00) {
      // Login response: 0x01 = success, 0x00 = failure
      if (data[0] === 0x01) {
        this.loggedIn = true;
        currentStatus = "connected";
        lastError = null;
        console.log(`[RCON] Logged in to ${RCON_HOST}:${RCON_PORT}`);
        this.startKeepAlive();
        onLogin?.();
      } else {
        const err = new Error("RCON login failed — wrong password");
        currentStatus = "error";
        lastError = err.message;
        this.emit("error", err);
        onLogin?.(); // still resolve so the error surfaces nicely
      }
    } else if (type === 0x01) {
      // Command response
      const seqNum = data[0];

      // Check for multi-packet (data[1] === 0x00)
      if (data[1] === 0x00) {
        const partNum = data[2];
        const totalParts = data[3];
        const partData = data.slice(4).toString("utf8");

        if (!this.multiParts.has(seqNum)) {
          this.multiParts.set(seqNum, new Map());
        }
        this.multiParts.get(seqNum)!.set(partNum, partData);

        if (this.multiParts.get(seqNum)!.size === totalParts) {
          const parts = this.multiParts.get(seqNum)!;
          let full = "";
          for (let i = 0; i < totalParts; i++) {
            full += parts.get(i) ?? "";
          }
          this.multiParts.delete(seqNum);
          this.resolveCommand(seqNum, full);
        }
      } else {
        // Single-packet response
        const response = data.slice(1).toString("utf8");
        this.resolveCommand(seqNum, response);
      }
    } else if (type === 0x02) {
      // Server message — acknowledge it
      const seqNum = data[0];
      const ackPkt = buildPacket(0x02, Buffer.from([seqNum]));
      this.socket?.send(ackPkt, RCON_PORT, RCON_HOST);
    }
  }

  private resolveCommand(seqNum: number, response: string) {
    const pending = this.pendingCommands.get(seqNum);
    if (pending) {
      clearTimeout(pending.timer);
      this.pendingCommands.delete(seqNum);
      pending.resolve(response);
    }
  }

  send(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.loggedIn) {
        return reject(new Error("RCON not connected"));
      }

      const seq = this.seq++ & 0xff;
      const cmdBuf = Buffer.concat([Buffer.from([seq]), Buffer.from(command, "utf8")]);
      const pkt = buildPacket(0x01, cmdBuf);

      const timer = setTimeout(() => {
        this.pendingCommands.delete(seq);
        reject(new Error(`RCON command timeout: ${command}`));
      }, 8000);

      this.pendingCommands.set(seq, { resolve, reject, timer });
      this.socket.send(pkt, RCON_PORT, RCON_HOST);
    });
  }

  private startKeepAlive() {
    this.keepAliveTimer = setInterval(() => {
      if (!this.socket || !this.loggedIn) return;
      const seq = this.seq++ & 0xff;
      const pkt = buildPacket(0x01, Buffer.from([seq]));
      this.socket.send(pkt, RCON_PORT, RCON_HOST);
    }, 30_000);
  }

  destroy() {
    this.loggedIn = false;
    if (this.keepAliveTimer) clearInterval(this.keepAliveTimer);
    try { this.socket?.close(); } catch {}
    this.socket = null;
    for (const [, p] of this.pendingCommands) {
      clearTimeout(p.timer);
      p.reject(new Error("RCON disconnected"));
    }
    this.pendingCommands.clear();
  }
}

// ── Connection management ─────────────────────────────────────────────────
let rcon: BattlEyeRcon | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let isConnecting = false;

export function getRconStatus(): { status: RconStatus; error: string | null; host: string; port: number } {
  if (!RCON_HOST || !RCON_PASSWORD) {
    return { status: "unconfigured", error: "DAYZ_RCON_HOST or DAYZ_RCON_PASSWORD not set", host: RCON_HOST, port: RCON_PORT };
  }
  return { status: currentStatus, error: lastError, host: RCON_HOST, port: RCON_PORT };
}

async function connectRcon(): Promise<void> {
  if (!RCON_HOST || !RCON_PASSWORD) {
    currentStatus = "unconfigured";
    return;
  }
  if (isConnecting) return;
  isConnecting = true;

  try {
    if (rcon) { rcon.destroy(); rcon = null; }
    currentStatus = "disconnected";

    const client = new BattlEyeRcon();
    client.on("error", (err: Error) => {
      console.error("[RCON] Error:", err.message);
      lastError = err.message;
      currentStatus = "error";
      scheduleReconnect();
    });

    await client.connect();
    rcon = client;
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
  if (!rcon || currentStatus !== "connected") {
    throw new Error(`RCON not connected (status: ${currentStatus}${lastError ? ` — ${lastError}` : ""})`);
  }
  try {
    return await rcon.send(command);
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
}> {
  try {
    const raw = await sendRconCommand("players");
    const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);

    const playerList: string[] = [];
    let maxPlayers = 60;

    for (const line of lines) {
      // "Players on server: [X used/Y slots]" or similar
      const headerMatch = line.match(/(\d+)\s*used\s*\/\s*(\d+)\s*slots/i);
      if (headerMatch) {
        maxPlayers = parseInt(headerMatch[2], 10);
        continue;
      }
      // "0   1.2.3.4:27016  60  PlayerName"
      const playerMatch = line.match(/^\d+\s+[\d.]+:\d+\s+\d+\s+(.+)$/);
      if (playerMatch) {
        playerList.push(playerMatch[1].trim());
      }
    }

    return { online: true, players: playerList.length, maxPlayers, playerList };
  } catch {
    return { online: false, players: 0, maxPlayers: 60, playerList: [] };
  }
}

export async function kickPlayer(playerNumber: number, reason = "You have been kicked."): Promise<string> {
  return sendRconCommand(`kick ${playerNumber} ${reason}`);
}

export async function banPlayer(playerNumber: number): Promise<string> {
  return sendRconCommand(`ban ${playerNumber}`);
}

export async function sayGlobal(message: string): Promise<string> {
  return sendRconCommand(`say -1 ${message}`);
}

export function initializeRcon(): void {
  connectRcon().catch((err) => console.error("[RCON] Init error:", err));
}
