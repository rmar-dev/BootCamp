'use client';

/**
 * Self-hosted Monaco editor.
 *
 * `@monaco-editor/react` defaults to loading Monaco itself from a third-party
 * CDN (cdn.jsdelivr.net) at runtime. That works on localhost but is a single
 * point of failure in production — an ad-blocker, a locked-down network, a
 * regional CDN block, or any future Content-Security-Policy silently breaks the
 * editor and its autocomplete while dev keeps working. (Observed: code
 * completion "not working in the live version".)
 *
 * Pinning the loader to the bundled `monaco-editor` makes Monaco a same-origin
 * asset emitted into `/_next/static` — served by the exact path the rest of the
 * app's JS already uses. No CDN dependency at runtime.
 *
 * This module is loaded **client-only** (via `next/dynamic({ ssr: false })` from
 * CodeExercise). That matters: `monaco-editor/esm` touches `window`/`document`
 * at import time, so it must never be evaluated in the server/RSC bundle. The
 * `loader.config` call runs at module-eval — i.e. before the inner <Editor>
 * mounts — so there is no race with the loader's default CDN config.
 */

// Import the package main entry (the same full distribution the jsdelivr CDN
// loader served), so Swift/Kotlin Monarch highlighting and all editor features
// are preserved — just sourced from the bundle instead of the network.
import * as monaco from 'monaco-editor';
import Editor, { loader, type EditorProps } from '@monaco-editor/react';

// We register Swift/Kotlin completion ourselves and use no built-in language
// workers, so a single base editor worker covers Monaco's needs (word-based
// suggestions, link detection). Without it, self-hosted Monaco throws
// "You must define a function MonacoEnvironment.getWorker".
(self as unknown as { MonacoEnvironment?: monaco.Environment }).MonacoEnvironment = {
  getWorker() {
    return new Worker(
      new URL('monaco-editor/esm/vs/editor/editor.worker.js', import.meta.url),
      { type: 'module' },
    );
  },
};

loader.config({ monaco });

export default function CodeMonacoEditor(props: EditorProps) {
  return <Editor {...props} />;
}
