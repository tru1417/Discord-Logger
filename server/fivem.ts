/**
 * FiveM / RedM integration via txAdmin Web API + public CFX endpoints.
 *
 * Public game-server endpoints (no auth):
 *   GET  <FIVEM_SERVER_URL>/info.json
 *   GET  <FIVEM_SERVER_URL>/players.json
 *   GET  <FIVEM_SERVER_URL>/dynamic.json
 *
 * txAdmin admin endpoints (session cookie auth):
 *   POST <FIVEM_TXADMIN_URL>/auth/password   -> login, returns cookie
 *   POST <FIVEM_TXADMIN_URL>/fxserver/commands { action, parameter }
 *   POST <FIVEM_TXADMIN_URL>/player/checkJoin (etc.)
 *
 * Required env:
 *   FIVEM_SERVER_URL       e.g. http://1.2.3.4:30120
 *   FIVEM_TXADMIN_URL      e.g. http://1.2.3.4:40120
 *   FIVEM_TXADMIN_USER     txAdmin admin username
 *   FIVEM_TXADMIN_PASS     txAdmin admin password
 */

type FivemPlayer = {
  id: number;
  name: string;
  ping: number;
  identifiers: string[];
};

type FivemServerInfo = {
  online: boolean;
  hostname: string;
  players: number;
  maxPlayers: number;
  gametype: string;
  mapname: string;
  resources: string[];
  playerList: FivemPlayer[];
  error?: string;
};

type TxAdminStatus =
  | { status: "unconfigured" }
  | { status: "disconnected"; url: string; error: string }
  | { status: "connected"; url: string };

let sessionCookie: string | null = null;
let lastAuthAt = 0;
const AUTH_TTL_MS = 30 * 60 * 1000; // re-auth every 30 min

function getServerUrl(): string | null {
  const url = process.env.FIVEM_SERVER_URL?.trim();
  if (!url) return null;
  return url.replace(/\/+$/, "");
}

function getTxAdminUrl(): string | null {
  const url = process.env.FIVEM_TXADMIN_URL?.trim();
  if (!url) return null;
  return url.replace(/\/+$/, "");
}

function isTxAdminConfigured(): boolean {
  return Boolean(
    process.env.FIVEM_TXADMIN_URL &&
      process.env.FIVEM_TXADMIN_USER &&
      process.env.FIVEM_TXADMIN_PASS
  );
}

// ── Public CFX endpoints ─────────────────────────────────────────────────────

export async function getFivemServerStatus(): Promise<FivemServerInfo> {
  const base = getServerUrl();
  const empty: FivemServerInfo = {
    online: false,
    hostname: "Unknown",
    players: 0,
    maxPlayers: 0,
    gametype: "",
    mapname: "",
    resources: [],
    playerList: [],
  };

  if (!base) return { ...empty, error: "FIVEM_SERVER_URL not configured" };

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);

    const [infoRes, playersRes, dynRes] = await Promise.all([
      fetch(`${base}/info.json`, { signal: ctrl.signal }),
      fetch(`${base}/players.json`, { signal: ctrl.signal }),
      fetch(`${base}/dynamic.json`, { signal: ctrl.signal }),
    ]);
    clearTimeout(timer);

    if (!infoRes.ok || !playersRes.ok || !dynRes.ok) {
      return { ...empty, error: `HTTP ${infoRes.status}/${playersRes.status}/${dynRes.status}` };
    }

    const info: any = await infoRes.json();
    const players: any[] = await playersRes.json();
    const dyn: any = await dynRes.json();

    return {
      online: true,
      hostname: dyn.hostname || info.vars?.sv_projectName || "FiveM Server",
      players: players.length,
      maxPlayers: Number(dyn.sv_maxclients) || 32,
      gametype: dyn.gametype || "",
      mapname: dyn.mapname || "",
      resources: Array.isArray(info.resources) ? info.resources : [],
      playerList: players.map((p: any) => ({
        id: Number(p.id),
        name: String(p.name),
        ping: Number(p.ping),
        identifiers: Array.isArray(p.identifiers) ? p.identifiers : [],
      })),
    };
  } catch (err: any) {
    return { ...empty, error: err?.message || "Unreachable" };
  }
}

// ── txAdmin auth + commands ──────────────────────────────────────────────────

async function txAdminLogin(): Promise<void> {
  const base = getTxAdminUrl();
  const user = process.env.FIVEM_TXADMIN_USER;
  const pass = process.env.FIVEM_TXADMIN_PASS;
  if (!base || !user || !pass) throw new Error("txAdmin not configured");

  const res = await fetch(`${base}/auth/password?uiVersion=v2`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: user, password: pass }),
  });

  if (!res.ok) {
    throw new Error(`txAdmin login HTTP ${res.status}`);
  }

  const body: any = await res.json().catch(() => ({}));
  if (body && body.error) {
    throw new Error(`txAdmin login: ${body.error}`);
  }

  // txAdmin returns a session cookie in Set-Cookie; collect them all
  const setCookies = res.headers.getSetCookie?.() || [];
  if (setCookies.length === 0) {
    // Fallback for older Node: parse the single header
    const single = res.headers.get("set-cookie");
    if (single) sessionCookie = single.split(";")[0];
  } else {
    sessionCookie = setCookies.map((c) => c.split(";")[0]).join("; ");
  }

  if (!sessionCookie) {
    throw new Error("txAdmin login: no session cookie returned");
  }

  lastAuthAt = Date.now();
  console.log("[FiveM] txAdmin authenticated successfully");
}

async function ensureAuthed(): Promise<void> {
  if (!sessionCookie || Date.now() - lastAuthAt > AUTH_TTL_MS) {
    await txAdminLogin();
  }
}

async function txAdminPost(path: string, body: any): Promise<any> {
  const base = getTxAdminUrl();
  if (!base) throw new Error("txAdmin not configured");

  await ensureAuthed();

  const doRequest = () =>
    fetch(`${base}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookie || "",
        "X-Requested-With": "XMLHttpRequest",
      },
      body: JSON.stringify(body),
    });

  let res = await doRequest();

  // If session expired, re-auth once and retry
  if (res.status === 401 || res.status === 403) {
    sessionCookie = null;
    await txAdminLogin();
    res = await doRequest();
  }

  if (!res.ok) {
    throw new Error(`txAdmin ${path} → HTTP ${res.status}`);
  }
  return res.json().catch(() => ({}));
}

export async function getTxAdminStatus(): Promise<TxAdminStatus> {
  if (!isTxAdminConfigured()) return { status: "unconfigured" };
  const url = getTxAdminUrl()!;
  try {
    await ensureAuthed();
    return { status: "connected", url };
  } catch (err: any) {
    return { status: "disconnected", url, error: err?.message || "Unknown error" };
  }
}

/** Run any raw FXServer console command. */
export async function runFivemConsoleCommand(command: string): Promise<void> {
  await txAdminPost("/fxserver/commands", { action: "command", parameter: command });
}

/** Broadcast a chat message to every player in the server. */
export async function fivemSay(message: string): Promise<void> {
  // FXServer's `say` console command takes a single argument (auto-quoted)
  const safe = message.replace(/"/g, '\\"');
  await runFivemConsoleCommand(`say "${safe}"`);
}

/** Kick a player by their server ID (the small numeric id from /players.json). */
export async function fivemKick(playerId: number, reason: string): Promise<void> {
  const safe = reason.replace(/"/g, '\\"');
  // txAdmin exposes a dedicated playerlist action endpoint:
  // POST /player/kick { id, reason }   (newer txAdmin uses /player/checkJoin etc.)
  // Use the safe console fallback that works on every txAdmin/FXServer version.
  await runFivemConsoleCommand(`clientkick ${playerId} "${safe}"`);
}

/** Ban a player by server ID via txAdmin's banlist resource. */
export async function fivemBan(playerId: number, reason: string, durationSec?: number): Promise<void> {
  const safe = reason.replace(/"/g, '\\"');
  // FXServer/txAdmin "txaBan" command: txaBan <id> <duration|perm> <reason>
  const dur = durationSec && durationSec > 0 ? String(durationSec) : "perm";
  await runFivemConsoleCommand(`txaBan ${playerId} ${dur} "${safe}"`);
}
