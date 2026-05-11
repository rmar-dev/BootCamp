# Monaco Language Services

Three-layer IntelliSense in BootCamp's code exercises:

| Layer | Source | Always on? |
|-------|--------|------------|
| L1 — keywords + types | `swift-language.ts`, `kotlin-language.ts` | Yes |
| L2 — snippets + hover + signature help | Same files | Yes |
| L3 — semantic LSP (real type-aware completion) | `lsp-client.ts` + `bootcamp-swift-lsp` container | Opt-in |

## How it composes

`lib/monaco/index.ts → installLanguageServices(monaco)` is called from
`CodeExercise`'s `beforeMount`. It always installs the static providers (L1+L2).
Then, if `NEXT_PUBLIC_LSP_URL` is set, it dynamic-imports `lsp-client.ts` and
attaches a WebSocket connection to a sourcekit-lsp bridge for L3.

When both layers are active, Monaco merges their suggestions — the LSP's
type-aware completions appear first, and the static provider fills in for
SwiftUI / AVKit / unresolved imports the Linux LSP can't see.

## Enabling L3 (semantic IntelliSense)

### 1. Install the browser peer deps

```sh
cd web
npm i monaco-languageclient vscode-ws-jsonrpc vscode-languageclient
```

These add ~1–2 MB to the bundle. The dynamic-import gate keeps the bundle
unaffected when L3 is disabled.

### 2. Build and start the LSP container

```sh
cd platform
docker compose --profile lsp build swift-lsp
docker compose --profile lsp up -d swift-lsp
```

The container exposes `ws://localhost:4500`. It is omitted from the default
`docker compose up` (gated behind the `lsp` profile) so existing dev workflows
are unaffected.

### 3. Point the web app at the bridge

In `web/.env.local`:

```
NEXT_PUBLIC_LSP_URL=ws://localhost:4500
```

Restart `next dev`. The first time you open a code exercise the editor will
connect; you'll see `[lsp-bridge] connection from ...` in the container logs.

## Limits of L3

- **Linux toolchain only.** SwiftUI / UIKit / AVKit are iOS SDKs and not
  present on Linux. Files importing them will surface "module not found"
  diagnostics from the LSP. The static layer (L1+L2) keeps suggesting SwiftUI
  symbols regardless, so the learner experience does not regress.
- **One subprocess per connection (bounded).** The bridge enforces three
  safeguards: a hard cap on concurrent sessions (`MAX_SESSIONS`), idle eviction
  (`IDLE_TIMEOUT_MS`), and WS heartbeat liveness probing (`HEARTBEAT_MS`).
  When the cap is hit, new connections receive a `window/showMessage` error
  ("server at capacity") and are closed with WS code 1013; the editor falls
  back to the static layer silently. Tune via the env block in
  `platform/docker-compose.yml`. Rough sizing: `MAX_SESSIONS * 200MB` is the
  steady-state memory footprint of the container.
- **For larger cohorts (~50+ concurrent), upgrade to a shared multiplexer.**
  The current bridge spawns one sourcekit-lsp per connection. The next step is
  one shared sourcekit-lsp process serving many sessions via unique virtual
  document URIs (same model Xcode uses for multi-file projects) — memory
  becomes constant regardless of concurrent learners. Track in `bridge.js`
  TODOs; not yet implemented.
- **No auth in front of the bridge.** The compose file binds it to localhost.
  If you publish the port, put a token check at the top of `bridge.js`.

## Disabling

Unset `NEXT_PUBLIC_LSP_URL` and stop the container. Static completion remains.
