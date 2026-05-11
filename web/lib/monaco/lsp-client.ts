/**
 * Level-3 semantic IntelliSense — connects Monaco to a sourcekit-lsp instance
 * over WebSocket via `monaco-languageclient` + `vscode-ws-jsonrpc`.
 *
 * Activation: this module is dynamically imported by `lib/monaco/index.ts`
 * only when `NEXT_PUBLIC_LSP_URL` is set. If the heavy peer dependencies are
 * absent at runtime, we log a warning and bail — the static layer continues
 * to provide completion.
 *
 * Required peer deps (install when enabling L3):
 *   npm i monaco-languageclient vscode-ws-jsonrpc vscode-languageclient
 *
 * SwiftUI / AVKit caveat:
 *   The Linux toolchain in the LSP container has Foundation but not iOS SDKs.
 *   For SwiftUI imports the LSP returns "module not found" — but the static
 *   provider continues to suggest SwiftUI types/methods. Both layers compose.
 *
 * NOTE: the dynamic imports below are typed as `any` because the peer deps
 * are intentionally optional — the bundle compiles when they are missing.
 * The runtime contract is checked by the surrounding try/catch.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type * as monacoNS from 'monaco-editor';

type Monaco = typeof monacoNS;

export async function attachLspClient(monaco: Monaco, url: string): Promise<void> {
  // Resolve the heavy deps lazily so the bundle does not pay for them when
  // L3 is disabled, and so a missing dep is non-fatal. In v10 of
  // `monaco-languageclient`, the action enums live in `vscode-languageclient`.
  let MonacoLanguageClient: any;
  let toSocket: any;
  let WebSocketMessageReader: any;
  let WebSocketMessageWriter: any;
  let CloseAction: any;
  let ErrorAction: any;

  try {
    const lc: any = await import('monaco-languageclient');
    MonacoLanguageClient = lc.MonacoLanguageClient;
    const vlc: any = await import('vscode-languageclient');
    CloseAction = vlc.CloseAction;
    ErrorAction = vlc.ErrorAction;
    const ws: any = await import('vscode-ws-jsonrpc');
    toSocket = ws.toSocket;
    WebSocketMessageReader = ws.WebSocketMessageReader;
    WebSocketMessageWriter = ws.WebSocketMessageWriter;
  } catch (err) {
    console.warn(
      '[bootcamp:lsp] missing peer deps. Install monaco-languageclient + vscode-ws-jsonrpc + vscode-languageclient to enable Level 3.',
      err,
    );
    return;
  }

  const socket = new WebSocket(url);
  socket.onerror = (e) => console.warn('[bootcamp:lsp] websocket error', e);
  socket.onopen = () => {
    const ws = toSocket(socket as any);
    const reader = new WebSocketMessageReader(ws);
    const writer = new WebSocketMessageWriter(ws);

    const client = new MonacoLanguageClient({
      name: 'BootCamp Swift LSP',
      clientOptions: {
        documentSelector: [{ language: 'swift' }],
        errorHandler: {
          error: () => ({ action: ErrorAction.Continue }),
          closed: () => ({ action: CloseAction.DoNotRestart }),
        },
      },
      messageTransports: { reader, writer },
    });

    client.start();
    reader.onClose(() => client.stop());
  };
}
