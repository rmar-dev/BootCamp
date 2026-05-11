/**
 * WebSocket → sourcekit-lsp bridge with bounded concurrency.
 *
 * Each WebSocket connection gets a private sourcekit-lsp child process.
 * To keep memory bounded under load the bridge enforces three safeguards:
 *
 *   1. MAX_SESSIONS hard cap — overflow connections receive a single LSP
 *      error response and are closed with a 1013 ("try again later") code.
 *   2. Idle eviction — if a session goes IDLE_TIMEOUT_MS without any LSP
 *      traffic (in or out), the child is killed and the socket closed.
 *      Activity = bytes flowing in either direction.
 *   3. WS heartbeat — server pings each connection every HEARTBEAT_MS;
 *      a client that misses one pong is terminated, freeing the slot.
 *
 * Environment knobs (all optional):
 *   PORT             — listen port (default 4500)
 *   WORKSPACE        — cwd for the LSP child (default /workspace)
 *   MAX_SESSIONS     — concurrent LSP child cap (default 8)
 *   IDLE_TIMEOUT_MS  — kill sessions idle for this long (default 300000 = 5 min)
 *   HEARTBEAT_MS     — server-side ping cadence (default 30000)
 *
 * Security note: the bridge does not authenticate. The container is bound to
 * 127.0.0.1:4500 in docker-compose. If you expose it publicly, validate a
 * signed token on the upgrade request before accepting it.
 */

'use strict';

const { spawn } = require('child_process');
const { WebSocketServer } = require('ws');

const PORT = Number(process.env.PORT || 4500);
const WORKSPACE = process.env.WORKSPACE || '/workspace';
const MAX_SESSIONS = Number(process.env.MAX_SESSIONS || 8);
const IDLE_TIMEOUT_MS = Number(process.env.IDLE_TIMEOUT_MS || 5 * 60 * 1000);
const HEARTBEAT_MS = Number(process.env.HEARTBEAT_MS || 30 * 1000);
// Override for testing or for hosts where the Swift toolchain is installed
// at a non-default path. Defaults to PATH lookup of `sourcekit-lsp`.
const LSP_BIN = process.env.SOURCEKIT_LSP_BIN || 'sourcekit-lsp';
const LSP_ARGS = process.env.SOURCEKIT_LSP_ARGS
  ? process.env.SOURCEKIT_LSP_ARGS.split(' ').filter(Boolean)
  : [];

const wss = new WebSocketServer({ port: PORT, host: '0.0.0.0' });

// Active sessions (one entry per live connection).
const sessions = new Set();
let nextId = 1;

console.log(
  `[lsp-bridge] listening on :${PORT} ` +
  `workspace=${WORKSPACE} maxSessions=${MAX_SESSIONS} ` +
  `idleMs=${IDLE_TIMEOUT_MS} heartbeatMs=${HEARTBEAT_MS}`,
);

// ── Capacity rejection helper ───────────────────────────────────────────────
// Sends a single, well-formed LSP error frame the client can surface, then
// closes the socket with code 1013 (server busy / try again later).
function rejectAtCapacity(ws, peer) {
  console.warn(`[lsp-bridge] at capacity (${MAX_SESSIONS}), rejecting ${peer}`);
  try {
    ws.send(JSON.stringify({
      jsonrpc: '2.0',
      method: 'window/showMessage',
      params: {
        type: 1, // Error
        message: 'IntelliSense server is at capacity. Static completion still works; semantic features will reconnect when a slot frees up.',
      },
    }));
  } catch {}
  try { ws.close(1013, 'lsp-at-capacity'); } catch {}
}

// ── Session lifecycle ────────────────────────────────────────────────────────
function startSession(ws, peer) {
  const id = nextId++;
  const child = spawn(LSP_BIN, LSP_ARGS, {
    cwd: WORKSPACE,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, SOURCEKIT_LOGGING: '0' },
  });

  // `isAlive` tracks heartbeat liveness — see HEARTBEAT_MS below.
  ws.isAlive = true;

  let idleTimer = null;
  function resetIdleTimer() {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      console.warn(`[lsp-bridge] session #${id} idle ${IDLE_TIMEOUT_MS}ms, killing`);
      try { ws.close(1000, 'idle-timeout'); } catch {}
    }, IDLE_TIMEOUT_MS);
  }
  resetIdleTimer();

  const session = { id, ws, child, idleTimer };
  sessions.add(session);
  console.log(`[lsp-bridge] session #${id} opened (peer=${peer}, active=${sessions.size}/${MAX_SESSIONS})`);

  // ── stdout → WebSocket ────────────────────────────────────────────────────
  let buf = Buffer.alloc(0);
  child.stdout.on('data', (chunk) => {
    resetIdleTimer();
    buf = Buffer.concat([buf, chunk]);
    while (true) {
      const headerEnd = buf.indexOf('\r\n\r\n');
      if (headerEnd === -1) return;
      const header = buf.slice(0, headerEnd).toString('ascii');
      const m = /Content-Length:\s*(\d+)/i.exec(header);
      if (!m) {
        console.error(`[lsp-bridge] session #${id} bad LSP header, dropping buffer`);
        buf = Buffer.alloc(0);
        return;
      }
      const len = Number(m[1]);
      const total = headerEnd + 4 + len;
      if (buf.length < total) return;
      const json = buf.slice(headerEnd + 4, total).toString('utf-8');
      buf = buf.slice(total);
      try { ws.send(json); } catch (err) {
        console.error(`[lsp-bridge] session #${id} ws send failed`, err);
      }
    }
  });

  child.stderr.on('data', (chunk) => {
    process.stderr.write(`[lsp-stderr #${id}] ${chunk}`);
  });

  child.on('exit', (code, signal) => {
    console.log(`[lsp-bridge] session #${id} child exited code=${code} signal=${signal}`);
    cleanup(session);
  });

  // The ChildProcess emits `error` (NOT `exit`) when spawn itself fails —
  // e.g. binary missing, EACCES, ENOMEM. Without a handler this would
  // propagate as an uncaught exception and tear the bridge down, killing
  // every other live session. Surface a friendly LSP error then clean up
  // this session only.
  child.on('error', (err) => {
    console.error(`[lsp-bridge] session #${id} spawn error:`, err.message);
    try {
      ws.send(JSON.stringify({
        jsonrpc: '2.0',
        method: 'window/showMessage',
        params: { type: 1, message: `IntelliSense unavailable: ${err.code || err.message}` },
      }));
    } catch {}
    cleanup(session);
  });

  // ── WebSocket → stdin ────────────────────────────────────────────────────
  ws.on('message', (data) => {
    resetIdleTimer();
    const text = typeof data === 'string' ? data : data.toString('utf-8');
    const body = Buffer.from(text, 'utf-8');
    const header = `Content-Length: ${body.length}\r\n\r\n`;
    if (!child.stdin.writable) return;
    child.stdin.write(header);
    child.stdin.write(body);
  });

  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('close', () => {
    console.log(`[lsp-bridge] session #${id} ws closed`);
    cleanup(session);
  });

  ws.on('error', (err) => {
    console.error(`[lsp-bridge] session #${id} ws error`, err);
    cleanup(session);
  });
}

function cleanup(session) {
  if (!sessions.has(session)) return;
  sessions.delete(session);
  if (session.idleTimer) clearTimeout(session.idleTimer);
  try { session.child.kill('SIGTERM'); } catch {}
  try { session.ws.terminate(); } catch {}
  console.log(`[lsp-bridge] session #${session.id} cleaned up (active=${sessions.size}/${MAX_SESSIONS})`);
}

// ── Heartbeat sweep ──────────────────────────────────────────────────────────
// Marks every active socket as not-alive, then pings them. A socket that
// answers with `pong` resets isAlive=true (see ws.on('pong') above). A socket
// that does not is terminated on the next sweep.
const heartbeat = setInterval(() => {
  for (const session of sessions) {
    if (session.ws.isAlive === false) {
      console.warn(`[lsp-bridge] session #${session.id} missed heartbeat, terminating`);
      cleanup(session);
      continue;
    }
    session.ws.isAlive = false;
    try { session.ws.ping(); } catch {}
  }
}, HEARTBEAT_MS);

// ── Accept ───────────────────────────────────────────────────────────────────
wss.on('connection', (ws, req) => {
  const peer = req.socket.remoteAddress;
  if (sessions.size >= MAX_SESSIONS) {
    rejectAtCapacity(ws, peer);
    return;
  }
  startSession(ws, peer);
});

// ── Shutdown ─────────────────────────────────────────────────────────────────
function shutdown() {
  console.log('[lsp-bridge] shutting down');
  clearInterval(heartbeat);
  for (const session of sessions) cleanup(session);
  wss.close(() => process.exit(0));
  // Hard fallback so a stuck connection cannot block shutdown.
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
