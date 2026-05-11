/**
 * Smoke test for the bridge's MAX_SESSIONS cap.
 *
 * Starts bridge.js with MAX_SESSIONS=2 (no real sourcekit-lsp so the spawn
 * will fail and the slot will free quickly — but we just want to verify the
 * accept/reject logic, which runs BEFORE the spawn).
 *
 * Plan:
 *   1. Stub `sourcekit-lsp` by overriding spawn? — too invasive.
 *      Instead, point WORKSPACE at an empty dir and let spawn fail with ENOENT.
 *      The bridge will start the session, register it in the Set, then exit
 *      cleans up on the child 'error' event. To avoid the cleanup race we
 *      keep the sockets open and just count "accepted vs rejected".
 *
 *   2. Open 4 connections with MAX_SESSIONS=2. Expect 2 accepted (peer logs)
 *      and 2 rejected (close code 1013).
 */

'use strict';

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const WebSocket = require('ws');

const BRIDGE = path.join(__dirname, 'bridge.js');

// To verify the cap we need an "LSP" that stays alive after spawn. Use a
// node-resolvable stub that just blocks on stdin forever, and point the
// bridge at it via SOURCEKIT_LSP_BIN so we sidestep platform PATH/.exe
// resolution differences entirely.
const stubDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lsp-smoke-'));
const stubScript = path.join(stubDir, 'stub.js');
fs.writeFileSync(
  stubScript,
  "process.stdin.on('data', () => {});\nsetInterval(() => {}, 1000);\n",
);

const proc = spawn(process.execPath, [BRIDGE], {
  env: {
    ...process.env,
    PORT: '4501',
    MAX_SESSIONS: '2',
    IDLE_TIMEOUT_MS: '60000',
    HEARTBEAT_MS: '60000',
    SOURCEKIT_LSP_BIN: process.execPath, // run node
    SOURCEKIT_LSP_ARGS: stubScript,      // ...with our stay-alive stub
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let bridgeReady = false;
proc.stdout.on('data', (chunk) => {
  process.stdout.write(`[bridge-out] ${chunk}`);
  if (!bridgeReady && /listening on/.test(String(chunk))) {
    bridgeReady = true;
    runTest();
  }
});
proc.stderr.on('data', (chunk) => process.stderr.write(`[bridge-err] ${chunk}`));

function open(label) {
  return new Promise((resolve) => {
    const ws = new WebSocket('ws://127.0.0.1:4501');
    let outcome = 'unknown';
    let gotRejectMessage = false;
    ws.on('message', (d) => {
      const text = String(d);
      if (/capacity/i.test(text)) gotRejectMessage = true;
    });
    ws.on('close', (code) => {
      // Code 1013 = at capacity. Anything else = accepted (then closed for other reasons).
      outcome = code === 1013 ? `rejected(1013,msg=${gotRejectMessage})` : `accepted_then_closed(${code})`;
      resolve({ label, outcome });
    });
    ws.on('error', () => {});
  });
}

async function runTest() {
  await new Promise((r) => setTimeout(r, 200));
  // Fire all 4 in parallel.
  const results = await Promise.all([open('A'), open('B'), open('C'), open('D')]);
  console.log('\n=== smoke result ===');
  for (const r of results) console.log(`  ${r.label}: ${r.outcome}`);
  const rejected = results.filter((r) => r.outcome.startsWith('rejected')).length;
  const expected = 2; // MAX_SESSIONS=2 → 2 should be rejected
  if (rejected === expected) {
    console.log(`\n PASS — ${rejected} rejected as expected.`);
    proc.kill('SIGTERM');
    setTimeout(() => process.exit(0), 200);
  } else {
    console.error(`\n FAIL — expected ${expected} rejections, got ${rejected}.`);
    proc.kill('SIGTERM');
    setTimeout(() => process.exit(1), 200);
  }
}

setTimeout(() => {
  if (!bridgeReady) {
    console.error('bridge did not start in time');
    proc.kill('SIGTERM');
    process.exit(2);
  }
}, 5000);
