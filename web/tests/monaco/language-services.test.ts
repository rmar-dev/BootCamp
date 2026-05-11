/**
 * Tests the static Monaco completion / hover / signature providers.
 *
 * Uses a minimal Monaco surface stub: we record the providers each register
 * call hands us, then drive them with synthetic models / positions to verify
 * they suggest the right things.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { registerSwiftLanguageServices } from '@/lib/monaco/swift-language';
import { registerKotlinLanguageServices } from '@/lib/monaco/kotlin-language';

// ── Minimal Monaco surface ────────────────────────────────────────────────────

type Provider = {
  triggerCharacters?: string[];
  provideCompletionItems?: (model: any, position: any) => { suggestions: any[] };
  provideHover?: (model: any, position: any) => any;
  provideSignatureHelp?: (model: any, position: any) => any;
  signatureHelpTriggerCharacters?: string[];
};

function makeMonacoStub() {
  const completion: Record<string, Provider[]> = {};
  const hover: Record<string, Provider[]> = {};
  const signature: Record<string, Provider[]> = {};
  const registered: string[] = [];

  const monaco: any = {
    languages: {
      CompletionItemKind: {
        Method: 1, Function: 2, Field: 3, Variable: 4, Class: 5, Keyword: 6, Snippet: 7,
      },
      CompletionItemInsertTextRule: { InsertAsSnippet: 4 },
      register({ id }: { id: string }) { registered.push(id); },
      getLanguages() { return registered.map((id) => ({ id })); },
      registerCompletionItemProvider(lang: string, p: Provider) {
        (completion[lang] ||= []).push(p);
      },
      registerHoverProvider(lang: string, p: Provider) {
        (hover[lang] ||= []).push(p);
      },
      registerSignatureHelpProvider(lang: string, p: Provider) {
        (signature[lang] ||= []).push(p);
      },
    },
  };

  return { monaco, completion, hover, signature };
}

function makeModel(text: string) {
  // Single-line model — enough for our heuristics.
  const lines = text.split('\n');
  return {
    getValueInRange(r: any) {
      // Slice range out of the joined text.
      const startLine = lines[r.startLineNumber - 1] ?? '';
      if (r.startLineNumber === r.endLineNumber) {
        return startLine.slice(r.startColumn - 1, r.endColumn - 1);
      }
      // Multi-line — concat. Used by SignatureHelp's full-prefix grab.
      const head = startLine.slice(r.startColumn - 1);
      const middle = lines.slice(r.startLineNumber, r.endLineNumber - 1);
      const tail = (lines[r.endLineNumber - 1] ?? '').slice(0, r.endColumn - 1);
      return [head, ...middle, tail].join('\n');
    },
    getWordUntilPosition(pos: any) {
      const line = lines[pos.lineNumber - 1] ?? '';
      const upTo = line.slice(0, pos.column - 1);
      const m = upTo.match(/[A-Za-z_][A-Za-z0-9_]*$/);
      const start = m ? upTo.length - m[0].length : upTo.length;
      return { word: m?.[0] ?? '', startColumn: start + 1, endColumn: pos.column };
    },
    getWordAtPosition(pos: any) {
      const line = lines[pos.lineNumber - 1] ?? '';
      const before = line.slice(0, pos.column - 1).match(/[A-Za-z_][A-Za-z0-9_]*$/);
      const after = line.slice(pos.column - 1).match(/^[A-Za-z0-9_]*/);
      if (!before && !after) return null;
      const word = (before?.[0] ?? '') + (after?.[0] ?? '');
      if (!word) return null;
      const startCol = pos.column - (before?.[0]?.length ?? 0);
      return { word, startColumn: startCol, endColumn: startCol + word.length };
    },
  };
}

// ── Swift suite ───────────────────────────────────────────────────────────────

describe('Swift language services', () => {
  let stub: ReturnType<typeof makeMonacoStub>;

  beforeEach(() => {
    stub = makeMonacoStub();
    registerSwiftLanguageServices(stub.monaco);
  });

  it('registers a completion provider for Swift', () => {
    expect(stub.completion.swift).toBeDefined();
    expect(stub.completion.swift.length).toBeGreaterThan(0);
  });

  it('suggests keywords like `let`, `guard`, `func` at an empty position', () => {
    const provider = stub.completion.swift[0];
    const text = 'let x = ';
    const model = makeModel(text);
    const result = provider.provideCompletionItems!(
      model,
      { lineNumber: 1, column: text.length + 1 },
    );
    const labels = result.suggestions.map((s: any) => s.label);
    for (const kw of ['let', 'guard', 'func', 'struct', 'protocol', 'actor']) {
      expect(labels).toContain(kw);
    }
  });

  it('suggests Array methods after a `].`', () => {
    const provider = stub.completion.swift[0];
    const text = '[1, 2, 3].';
    const model = makeModel(text);
    const result = provider.provideCompletionItems!(
      model,
      { lineNumber: 1, column: text.length + 1 },
    );
    const labels = result.suggestions.map((s: any) => s.label);
    for (const m of ['map', 'filter', 'reduce', 'forEach', 'first', 'last', 'count']) {
      expect(labels).toContain(m);
    }
  });

  it('suggests String methods after a `".`', () => {
    const provider = stub.completion.swift[0];
    const text = '"hello".';
    const model = makeModel(text);
    const result = provider.provideCompletionItems!(
      model,
      { lineNumber: 1, column: text.length + 1 },
    );
    const labels = result.suggestions.map((s: any) => s.label);
    for (const m of ['lowercased', 'uppercased', 'hasPrefix', 'count']) {
      expect(labels).toContain(m);
    }
  });

  it('suggests snippets for `guard let`, `func`, `View`', () => {
    const provider = stub.completion.swift[0];
    const text = '';
    const model = makeModel(text);
    const result = provider.provideCompletionItems!(
      model,
      { lineNumber: 1, column: 1 },
    );
    const labels = result.suggestions.map((s: any) => s.label);
    for (const snippet of ['guard let', 'if let', 'func', 'View', '@Observable']) {
      expect(labels).toContain(snippet);
    }
  });

  it('returns hover documentation for `let`', () => {
    const provider = stub.hover.swift[0];
    const text = 'let x = 1';
    const model = makeModel(text);
    const hover = provider.provideHover!(model, { lineNumber: 1, column: 2 });
    expect(hover).toBeTruthy();
    expect(hover.contents[0].value).toMatch(/immutable/i);
  });

  it('returns signature help inside print(', () => {
    const provider = stub.signature.swift[0];
    const text = 'print(';
    const model = makeModel(text);
    const help = provider.provideSignatureHelp!(model, { lineNumber: 1, column: text.length + 1 });
    expect(help).toBeTruthy();
    expect(help.value.signatures[0].label).toMatch(/print/);
  });

  it('does not double-register on a second call', () => {
    registerSwiftLanguageServices(stub.monaco);
    expect(stub.completion.swift.length).toBe(1); // still 1
  });
});

// ── Kotlin suite ──────────────────────────────────────────────────────────────

describe('Kotlin language services', () => {
  let stub: ReturnType<typeof makeMonacoStub>;

  beforeEach(() => {
    stub = makeMonacoStub();
    registerKotlinLanguageServices(stub.monaco);
  });

  it('suggests Kotlin keywords like `val`, `fun`, `data` at an empty position', () => {
    const provider = stub.completion.kotlin[0];
    const text = '';
    const model = makeModel(text);
    const result = provider.provideCompletionItems!(model, { lineNumber: 1, column: 1 });
    const labels = result.suggestions.map((s: any) => s.label);
    for (const kw of ['val', 'var', 'fun', 'data', 'sealed', 'when', 'suspend']) {
      expect(labels).toContain(kw);
    }
  });

  it('suggests collection methods after `listOf(...).`', () => {
    const provider = stub.completion.kotlin[0];
    const text = 'listOf(1, 2, 3).';
    const model = makeModel(text);
    const result = provider.provideCompletionItems!(
      model,
      { lineNumber: 1, column: text.length + 1 },
    );
    const labels = result.suggestions.map((s: any) => s.label);
    for (const m of ['map', 'filter', 'fold', 'forEach', 'first', 'size']) {
      expect(labels).toContain(m);
    }
  });

  it('returns hover documentation for `val`', () => {
    const provider = stub.hover.kotlin[0];
    const text = 'val x = 1';
    const model = makeModel(text);
    const hover = provider.provideHover!(model, { lineNumber: 1, column: 2 });
    expect(hover).toBeTruthy();
    expect(hover.contents[0].value).toMatch(/read-only/i);
  });

  it('returns signature help inside println(', () => {
    const provider = stub.signature.kotlin[0];
    const text = 'println(';
    const model = makeModel(text);
    const help = provider.provideSignatureHelp!(model, { lineNumber: 1, column: text.length + 1 });
    expect(help).toBeTruthy();
    expect(help.value.signatures[0].label).toMatch(/println/);
  });
});
