/**
 * Monaco language services — central wiring point.
 *
 * Exposes `installLanguageServices(monaco)` which idempotently registers Swift
 * and Kotlin static completion / hover / signature providers. Also lazily wires
 * the LSP client (level 3) when both `lsp-client.ts` and a configured endpoint
 * are present; absent that, only the static providers run.
 */

import type * as monacoNS from 'monaco-editor';
import { registerSwiftLanguageServices } from './swift-language';
import { registerKotlinLanguageServices } from './kotlin-language';

type Monaco = typeof monacoNS;

export function installLanguageServices(monaco: Monaco): void {
  // Wrap each registration so a throw in one language doesn't silently kill
  // the other — that previously surfaced as "Swift autocomplete doesn't work
  // but Kotlin does" depending on which file loaded first.
  try {
    registerSwiftLanguageServices(monaco);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[bootcamp] Swift language services failed to register.', err);
  }
  try {
    registerKotlinLanguageServices(monaco);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[bootcamp] Kotlin language services failed to register.', err);
  }

  if (typeof window !== 'undefined') {
    const swiftKnown = monaco.languages.getLanguages().some((l) => l.id === 'swift');
    const kotlinKnown = monaco.languages.getLanguages().some((l) => l.id === 'kotlin');
    // eslint-disable-next-line no-console
    console.info(
      `[bootcamp] Monaco language services installed (swift=${swiftKnown}, kotlin=${kotlinKnown}).`,
    );
  }

  // Best-effort LSP wiring. Level 3 — when `NEXT_PUBLIC_LSP_URL` is set, attempt
  // to connect to a sourcekit-lsp / kotlin-language-server bridge for real
  // semantic IntelliSense layered on top of the static providers. Failures
  // (no env, server down, browser refuses websocket) are swallowed; the static
  // layer still works.
  if (typeof window !== 'undefined') {
    const url = process.env.NEXT_PUBLIC_LSP_URL;
    if (url) {
      // Dynamic import keeps `monaco-languageclient` (heavy) out of the bundle
      // when the env var is absent.
      import('./lsp-client')
        .then((m) => m.attachLspClient(monaco, url))
        .catch((err) => {
          // eslint-disable-next-line no-console
          console.warn('[bootcamp] LSP client failed to attach; static completion only.', err);
        });
    }
  }
}
