/**
 * Kotlin language services for Monaco — completion, snippets, hover, signature help.
 *
 * Mirrors `swift-language.ts` but for Kotlin's stdlib and conventions.
 */

import type * as monacoNS from 'monaco-editor';

type Monaco = typeof monacoNS;
type CompletionItemKind = monacoNS.languages.CompletionItemKind;
type CompletionItem = monacoNS.languages.CompletionItem;

// ── Keyword + type lists ──────────────────────────────────────────────────────

const KOTLIN_KEYWORDS = [
  'val', 'var', 'if', 'else', 'when', 'for', 'while', 'do', 'break', 'continue', 'return',
  'fun', 'class', 'interface', 'object', 'enum', 'sealed', 'data', 'inline', 'noinline', 'crossinline',
  'open', 'abstract', 'final', 'override', 'private', 'protected', 'public', 'internal',
  'companion', 'init', 'constructor', 'this', 'super',
  'package', 'import', 'as', 'is', 'in', 'out', 'where',
  'try', 'catch', 'finally', 'throw',
  'true', 'false', 'null',
  'suspend', 'lateinit', 'by', 'reified',
  'typealias', 'annotation',
];

const KOTLIN_BUILTIN_TYPES = [
  'Int', 'Long', 'Short', 'Byte', 'Float', 'Double', 'Boolean', 'Char', 'String',
  'Any', 'Unit', 'Nothing',
  'List', 'MutableList', 'Set', 'MutableSet', 'Map', 'MutableMap', 'Array',
  'IntArray', 'LongArray', 'BooleanArray', 'CharArray',
  'Pair', 'Triple', 'Result',
  'Sequence', 'Iterable', 'Collection',
  'Throwable', 'Exception', 'RuntimeException',
  'Comparable', 'Comparator',
];

// Coroutines + Flow surface — Kotlin's idiomatic concurrency layer.
const COROUTINES_TYPES = [
  'CoroutineScope', 'Job', 'Deferred', 'CoroutineContext',
  'Flow', 'StateFlow', 'SharedFlow', 'MutableStateFlow', 'MutableSharedFlow',
  'Channel', 'Dispatchers',
];

// ── Stdlib method dictionary ──────────────────────────────────────────────────

type Method = {
  label: string;
  insert: string;
  detail: string;
  doc: string;
};

const COLLECTION_METHODS: Method[] = [
  { label: 'add', insert: 'add(${1:element})', detail: '(element: E): Boolean', doc: 'Adds the element. Mutating; only on `MutableList`.' },
  { label: 'remove', insert: 'remove(${1:element})', detail: '(element: E): Boolean', doc: 'Removes a single instance of the element if present.' },
  { label: 'removeAt', insert: 'removeAt(${1:index})', detail: '(index: Int): E', doc: 'Removes and returns the element at the given index.' },
  { label: 'first', insert: 'first()', detail: '(): T', doc: 'Returns the first element; throws if empty.' },
  { label: 'firstOrNull', insert: 'firstOrNull()', detail: '(): T?', doc: 'Returns the first element, or null if empty.' },
  { label: 'last', insert: 'last()', detail: '(): T', doc: 'Returns the last element; throws if empty.' },
  { label: 'lastOrNull', insert: 'lastOrNull()', detail: '(): T?', doc: 'Returns the last element, or null if empty.' },
  { label: 'size', insert: 'size', detail: ': Int', doc: 'Number of elements.' },
  { label: 'isEmpty', insert: 'isEmpty()', detail: '(): Boolean', doc: 'True if there are no elements.' },
  { label: 'isNotEmpty', insert: 'isNotEmpty()', detail: '(): Boolean', doc: 'True if there are any elements.' },
  { label: 'contains', insert: 'contains(${1:element})', detail: '(element: T): Boolean', doc: 'True if the element is present.' },
  { label: 'map', insert: 'map { $1 }', detail: '<R>(transform: (T) -> R): List<R>', doc: 'Returns a list with the results of applying `transform` to each element.' },
  { label: 'mapNotNull', insert: 'mapNotNull { $1 }', detail: '<R>(transform: (T) -> R?): List<R>', doc: 'Maps and drops nulls.' },
  { label: 'flatMap', insert: 'flatMap { $1 }', detail: '<R>(transform: (T) -> Iterable<R>): List<R>', doc: 'Maps each element to an iterable and concatenates.' },
  { label: 'filter', insert: 'filter { $1 }', detail: '(predicate: (T) -> Boolean): List<T>', doc: 'Returns elements matching the predicate.' },
  { label: 'filterNot', insert: 'filterNot { $1 }', detail: '(predicate: (T) -> Boolean): List<T>', doc: 'Returns elements NOT matching the predicate.' },
  { label: 'filterNotNull', insert: 'filterNotNull()', detail: '(): List<T>', doc: 'Returns non-null elements.' },
  { label: 'fold', insert: 'fold(${1:initial}) { ${2:acc}, ${3:item} -> $4 }', detail: '<R>(initial: R, op: (R, T) -> R): R', doc: 'Combines elements using `op`, starting from `initial`.' },
  { label: 'reduce', insert: 'reduce { ${1:acc}, ${2:item} -> $3 }', detail: '(op: (T, T) -> T): T', doc: 'Combines elements using `op`. Throws if empty.' },
  { label: 'forEach', insert: 'forEach { $1 }', detail: '(action: (T) -> Unit)', doc: 'Performs `action` on each element.' },
  { label: 'sortedBy', insert: 'sortedBy { $1 }', detail: '<R: Comparable<R>>(selector: (T) -> R): List<T>', doc: 'Returns a list sorted by the selector.' },
  { label: 'sortedDescending', insert: 'sortedDescending()', detail: '(): List<T>', doc: 'Returns a list sorted in descending natural order.' },
  { label: 'reversed', insert: 'reversed()', detail: '(): List<T>', doc: 'Returns a list with the elements reversed.' },
  { label: 'distinct', insert: 'distinct()', detail: '(): List<T>', doc: 'Returns a list containing only distinct elements.' },
  { label: 'groupBy', insert: 'groupBy { $1 }', detail: '<K>(keySelector: (T) -> K): Map<K, List<T>>', doc: 'Groups elements by the key returned by `keySelector`.' },
  { label: 'count', insert: 'count()', detail: '(): Int', doc: 'Returns the number of elements.' },
  { label: 'sum', insert: 'sum()', detail: '(): Int / Double', doc: 'Returns the sum of all elements (numeric).' },
  { label: 'sumOf', insert: 'sumOf { $1 }', detail: '<R>(selector: (T) -> R): R', doc: 'Returns the sum of values produced by the selector.' },
  { label: 'any', insert: 'any { $1 }', detail: '(predicate: (T) -> Boolean): Boolean', doc: 'True if any element matches the predicate.' },
  { label: 'all', insert: 'all { $1 }', detail: '(predicate: (T) -> Boolean): Boolean', doc: 'True if all elements match the predicate.' },
  { label: 'none', insert: 'none { $1 }', detail: '(predicate: (T) -> Boolean): Boolean', doc: 'True if no element matches the predicate.' },
  { label: 'take', insert: 'take(${1:n})', detail: '(n: Int): List<T>', doc: 'Returns the first n elements.' },
  { label: 'drop', insert: 'drop(${1:n})', detail: '(n: Int): List<T>', doc: 'Returns elements after dropping the first n.' },
  { label: 'joinToString', insert: 'joinToString(separator = "${1:, }")', detail: '(separator: CharSequence, prefix, postfix, ...): String', doc: 'Joins to string with separator.' },
];

const STRING_METHODS: Method[] = [
  { label: 'length', insert: 'length', detail: ': Int', doc: 'Number of characters in the string.' },
  { label: 'isEmpty', insert: 'isEmpty()', detail: '(): Boolean', doc: 'True if length is 0.' },
  { label: 'isNotEmpty', insert: 'isNotEmpty()', detail: '(): Boolean', doc: 'True if length is greater than 0.' },
  { label: 'isBlank', insert: 'isBlank()', detail: '(): Boolean', doc: 'True if string is empty or contains only whitespace.' },
  { label: 'lowercase', insert: 'lowercase()', detail: '(): String', doc: 'Returns the lowercase variant.' },
  { label: 'uppercase', insert: 'uppercase()', detail: '(): String', doc: 'Returns the uppercase variant.' },
  { label: 'trim', insert: 'trim()', detail: '(): String', doc: 'Returns a copy with leading/trailing whitespace removed.' },
  { label: 'startsWith', insert: 'startsWith(${1:""})', detail: '(prefix: CharSequence): Boolean', doc: 'True if string begins with prefix.' },
  { label: 'endsWith', insert: 'endsWith(${1:""})', detail: '(suffix: CharSequence): Boolean', doc: 'True if string ends with suffix.' },
  { label: 'contains', insert: 'contains(${1:""})', detail: '(other: CharSequence): Boolean', doc: 'True if string contains other.' },
  { label: 'split', insert: 'split(${1:""})', detail: '(vararg delimiters: String): List<String>', doc: 'Splits string by the given delimiters.' },
  { label: 'replace', insert: 'replace(${1:""}, ${2:""})', detail: '(oldValue: String, newValue: String): String', doc: 'Returns a new string with all occurrences replaced.' },
  { label: 'substring', insert: 'substring(${1:start})', detail: '(startIndex: Int): String', doc: 'Returns the substring from startIndex.' },
  { label: 'toInt', insert: 'toInt()', detail: '(): Int', doc: 'Parses to Int. Throws if invalid.' },
  { label: 'toIntOrNull', insert: 'toIntOrNull()', detail: '(): Int?', doc: 'Parses to Int, or null if invalid.' },
];

const MAP_METHODS: Method[] = [
  { label: 'size', insert: 'size', detail: ': Int', doc: 'Number of key-value pairs.' },
  { label: 'isEmpty', insert: 'isEmpty()', detail: '(): Boolean', doc: 'True if there are no entries.' },
  { label: 'keys', insert: 'keys', detail: ': Set<K>', doc: 'A set of the map\'s keys.' },
  { label: 'values', insert: 'values', detail: ': Collection<V>', doc: 'A collection of the map\'s values.' },
  { label: 'entries', insert: 'entries', detail: ': Set<Map.Entry<K, V>>', doc: 'The set of entries.' },
  { label: 'getOrDefault', insert: 'getOrDefault(${1:key}, ${2:default})', detail: '(key: K, defaultValue: V): V', doc: 'Returns the value or the default.' },
  { label: 'getOrElse', insert: 'getOrElse(${1:key}) { ${2:default} }', detail: '(key: K, defaultValue: () -> V): V', doc: 'Returns the value or invokes defaultValue.' },
  { label: 'mapValues', insert: 'mapValues { $1 }', detail: '<R>(transform: (Map.Entry<K, V>) -> R): Map<K, R>', doc: 'Returns a map with the same keys and transformed values.' },
];

// ── Snippets ──────────────────────────────────────────────────────────────────

type Snippet = { label: string; body: string; detail: string; doc: string };

const KOTLIN_SNIPPETS: Snippet[] = [
  {
    label: 'fun',
    body: 'fun ${1:name}(${2:arg}: ${3:Type}): ${4:Type} {\n\t$0\n}',
    detail: 'fun name(arg: Type): Type { ... }',
    doc: 'Function declaration.',
  },
  {
    label: 'data class',
    body: 'data class ${1:Name}(val ${2:field}: ${3:Type})',
    detail: 'data class Name(val field: Type)',
    doc: 'Value-class equivalent — auto-generates equals/hashCode/copy/componentN.',
  },
  {
    label: 'class',
    body: 'class ${1:Name} {\n\t$0\n}',
    detail: 'class Name { ... }',
    doc: 'Class declaration.',
  },
  {
    label: 'object',
    body: 'object ${1:Name} {\n\t$0\n}',
    detail: 'object Name { ... }',
    doc: 'Singleton declaration.',
  },
  {
    label: 'enum class',
    body: 'enum class ${1:Name} {\n\t${2:CASE_A},\n\t${3:CASE_B}\n}',
    detail: 'enum class Name { ... }',
    doc: 'Enum class.',
  },
  {
    label: 'sealed class',
    body: 'sealed class ${1:Name} {\n\tdata class ${2:CaseA}(val ${3:x}: ${4:Type}) : ${1:Name}()\n\tdata object ${5:CaseB} : ${1:Name}()\n}',
    detail: 'sealed class Name { ... }',
    doc: 'Sealed class hierarchy — closed set of subtypes.',
  },
  {
    label: 'when',
    body: 'when (${1:value}) {\n\t${2:case} -> $0\n\telse -> {}\n}',
    detail: 'when (v) { case -> ... ; else -> ... }',
    doc: 'Pattern-matching expression.',
  },
  {
    label: 'if let (?.let)',
    body: '${1:value}?.let {\n\t$0\n}',
    detail: 'value?.let { ... }',
    doc: 'Run a block if the value is non-null.',
  },
  {
    label: 'try catch',
    body: 'try {\n\t${1:expr}\n} catch (e: ${2:Exception}) {\n\t$0\n}',
    detail: 'try { ... } catch (e) { ... }',
    doc: 'Try/catch.',
  },
  {
    label: 'for in',
    body: 'for (${1:item} in ${2:collection}) {\n\t$0\n}',
    detail: 'for (item in collection) { ... }',
    doc: 'For-in loop.',
  },
  {
    label: 'suspend fun',
    body: 'suspend fun ${1:name}(${2:arg}: ${3:Type}): ${4:Type} {\n\t$0\n}',
    detail: 'suspend fun name(...): ...',
    doc: 'Suspending function.',
  },
  {
    label: 'coroutine scope',
    body: 'coroutineScope {\n\t$0\n}',
    detail: 'coroutineScope { ... }',
    doc: 'Structured concurrency scope.',
  },
  {
    label: 'launch',
    body: 'launch {\n\t$0\n}',
    detail: 'launch { ... }',
    doc: 'Launches a fire-and-forget coroutine in the current scope.',
  },
  {
    label: 'println',
    body: 'println(${1:value})',
    detail: '(message: Any?)',
    doc: 'Prints the message and a newline to standard output.',
  },
];

// ── Hovers ────────────────────────────────────────────────────────────────────

const HOVERS: Record<string, string> = {
  'val': '**`val`** — read-only property/local. Closer to Java\'s `final`.',
  'var': '**`var`** — mutable property/local.',
  'fun': '**`fun`** — function declaration keyword.',
  'object': '**`object`** — singleton instance with class-like body.',
  'data': '**`data class`** — auto-generates equals/hashCode/copy/componentN.',
  'sealed': '**`sealed`** — closed type hierarchy; the compiler enforces exhaustive `when` over its subtypes.',
  'companion': '**`companion`** — declares an object that is the static-equivalent of its enclosing class.',
  'suspend': '**`suspend`** — function may suspend; can only be called from another suspend function or a coroutine builder.',
  'lateinit': '**`lateinit var`** — non-null variable initialized later. Throws if accessed before initialization.',
  'reified': '**`reified`** — preserves the type parameter at runtime; only valid on `inline` functions.',
  'inline': '**`inline`** — function body is inlined at each call site. Required to use `reified`.',
  'crossinline': '**`crossinline`** — disallows non-local returns from the lambda passed in.',
  'internal': '**`internal`** — visibility limited to the enclosing module.',
  'open': '**`open`** — class/method may be subclassed/overridden (Kotlin classes are final by default).',
  'when': '**`when`** — pattern-matching expression. With a sealed type, the compiler enforces exhaustiveness.',
  'Int': '**`Int`** — 32-bit signed integer.',
  'Long': '**`Long`** — 64-bit signed integer.',
  'Double': '**`Double`** — 64-bit floating-point.',
  'String': '**`String`** — immutable sequence of characters.',
  'List': '**`List<T>`** — read-only ordered collection.',
  'Map': '**`Map<K, V>`** — read-only association of keys to values.',
  'MutableList': '**`MutableList<T>`** — mutable ordered collection.',
  'MutableMap': '**`MutableMap<K, V>`** — mutable association.',
  'Pair': '**`Pair<A, B>`** — two-element tuple. `.first` and `.second`.',
  'Triple': '**`Triple<A, B, C>`** — three-element tuple.',
  'Result': '**`Result<T>`** — value or failure container.',
  'Flow': '**`Flow<T>`** — cold asynchronous stream of values.',
  'StateFlow': '**`StateFlow<T>`** — hot, conflated state stream with a current value.',
  'CoroutineScope': '**`CoroutineScope`** — defines the lifetime for coroutines launched within it.',
};

// ── Helpers (mirror swift-language.ts) ────────────────────────────────────────

function isAfterDot(textBefore: string): boolean {
  return /\.\s*$/.test(textBefore) || /\.[A-Za-z_]\w*$/.test(textBefore);
}

function guessReceiverKind(textBefore: string): 'collection' | 'string' | 'map' | 'unknown' {
  const trimmed = textBefore.replace(/\.[A-Za-z_]\w*$/, '.').replace(/\.\s*$/, '');
  if (/\)\s*$/.test(trimmed) && /listOf|mutableListOf|setOf|arrayOf/.test(trimmed)) return 'collection';
  if (/\)\s*$/.test(trimmed) && /mapOf|mutableMapOf|hashMapOf/.test(trimmed)) return 'map';
  if (/"\s*$/.test(trimmed)) return 'string';
  const idMatch = trimmed.match(/([A-Za-z_]\w*)\s*$/);
  if (idMatch) {
    const name = idMatch[1];
    if (/(s|List|Items|All|Collection)$/.test(name)) return 'collection';
    if (/Map|ById|ByName$/.test(name)) return 'map';
    if (/Text|Title|Name|Label|Description|Message$/.test(name)) return 'string';
  }
  return 'unknown';
}

function snippetItem(
  monaco: Monaco,
  s: Snippet,
  range: monacoNS.IRange,
  kind: CompletionItemKind,
): CompletionItem {
  return {
    label: s.label,
    kind,
    insertText: s.body,
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    detail: s.detail,
    documentation: { value: s.doc },
    range,
  };
}

function methodItem(monaco: Monaco, m: Method, range: monacoNS.IRange): CompletionItem {
  return {
    label: m.label,
    kind: monaco.languages.CompletionItemKind.Method,
    insertText: m.insert,
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    detail: m.detail,
    documentation: { value: m.doc },
    range,
  };
}

let registeredFor: Set<Monaco> = new Set();

export function registerKotlinLanguageServices(monaco: Monaco): void {
  if (registeredFor.has(monaco)) return;
  registeredFor.add(monaco);

  const known = monaco.languages.getLanguages().some((l) => l.id === 'kotlin');
  if (!known) {
    monaco.languages.register({ id: 'kotlin', extensions: ['.kt'] });
  }

  monaco.languages.registerCompletionItemProvider('kotlin', {
    triggerCharacters: ['.', ':', '@'],
    provideCompletionItems(model, position) {
      const word = model.getWordUntilPosition(position);
      const range: monacoNS.IRange = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const lineUntilCursor = model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      });

      if (isAfterDot(lineUntilCursor)) {
        const kind = guessReceiverKind(lineUntilCursor);
        const sets: Record<typeof kind, Method[]> = {
          collection: COLLECTION_METHODS,
          string: STRING_METHODS,
          map: MAP_METHODS,
          unknown: [...COLLECTION_METHODS, ...STRING_METHODS, ...MAP_METHODS],
        };
        return { suggestions: sets[kind].map((m) => methodItem(monaco, m, range)) };
      }

      const suggestions: CompletionItem[] = [];

      for (const kw of KOTLIN_KEYWORDS) {
        suggestions.push({
          label: kw,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: kw,
          documentation: HOVERS[kw] ? { value: HOVERS[kw] } : undefined,
          range,
        });
      }

      for (const t of [...KOTLIN_BUILTIN_TYPES, ...COROUTINES_TYPES]) {
        suggestions.push({
          label: t,
          kind: monaco.languages.CompletionItemKind.Class,
          insertText: t,
          documentation: HOVERS[t] ? { value: HOVERS[t] } : undefined,
          range,
        });
      }

      for (const s of KOTLIN_SNIPPETS) {
        suggestions.push(snippetItem(monaco, s, range, monaco.languages.CompletionItemKind.Snippet));
      }

      return { suggestions };
    },
  });

  monaco.languages.registerHoverProvider('kotlin', {
    provideHover(model, position) {
      const word = model.getWordAtPosition(position);
      if (!word) return null;
      const doc = HOVERS[word.word];
      if (!doc) return null;
      return {
        range: {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        },
        contents: [{ value: doc }],
      };
    },
  });

  const SIGNATURES: Record<string, monacoNS.languages.SignatureHelp['signatures'][number]> = {
    println: {
      label: 'println(message: Any?)',
      documentation: 'Prints the message followed by a newline to standard output.',
      parameters: [{ label: 'message: Any?', documentation: 'A value to print.' }],
    },
    map: {
      label: 'fun <T, R> Iterable<T>.map(transform: (T) -> R): List<R>',
      documentation: 'Returns a list with the results of applying `transform` to each element.',
      parameters: [{ label: 'transform: (T) -> R', documentation: 'Mapping closure.' }],
    },
    filter: {
      label: 'fun <T> Iterable<T>.filter(predicate: (T) -> Boolean): List<T>',
      documentation: 'Returns the elements matching the predicate.',
      parameters: [{ label: 'predicate: (T) -> Boolean', documentation: 'Returns true for elements to keep.' }],
    },
    fold: {
      label: 'fun <T, R> Iterable<T>.fold(initial: R, op: (R, T) -> R): R',
      documentation: 'Combines elements using `op`, starting from `initial`.',
      parameters: [
        { label: 'initial: R', documentation: 'Starting value.' },
        { label: 'op: (R, T) -> R', documentation: 'Combining closure.' },
      ],
    },
  };

  monaco.languages.registerSignatureHelpProvider('kotlin', {
    signatureHelpTriggerCharacters: ['(', ','],
    provideSignatureHelp(model, position) {
      const before = model.getValueInRange({
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      });
      const match = before.match(/([A-Za-z_]\w*)\s*\(([^()]*)$/);
      if (!match) return null;
      const [, name, argsSoFar] = match;
      const sig = SIGNATURES[name];
      if (!sig) return null;
      const activeParameter = Math.min(argsSoFar.split(',').length - 1, sig.parameters.length - 1);
      return {
        value: {
          activeSignature: 0,
          activeParameter: activeParameter < 0 ? 0 : activeParameter,
          signatures: [sig],
        },
        dispose: () => {},
      };
    },
  });
}
