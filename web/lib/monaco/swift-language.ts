/**
 * Swift language services for Monaco — completion, snippets, hover, signature help.
 *
 * This is a *static* / curated provider. It does not understand types or scope —
 * it ships keyword and stdlib suggestions plus snippet expansions for the
 * patterns the curriculum teaches.
 *
 * For full semantic IntelliSense (type-aware completions on `.`, jump-to-def,
 * diagnostics) the platform connects Monaco to a sourcekit-lsp instance over
 * WebSocket; see `lib/monaco/lsp-client.ts`.
 */

import type * as monacoNS from 'monaco-editor';

type Monaco = typeof monacoNS;
type CompletionItemKind = monacoNS.languages.CompletionItemKind;
type CompletionItem = monacoNS.languages.CompletionItem;

// ── Keyword + type lists ──────────────────────────────────────────────────────

const SWIFT_KEYWORDS = [
  'let', 'var', 'if', 'else', 'guard', 'switch', 'case', 'default', 'for', 'while',
  'repeat', 'break', 'continue', 'return', 'throw', 'throws', 'rethrows',
  'func', 'init', 'deinit', 'struct', 'class', 'enum', 'protocol', 'extension',
  'actor', 'async', 'await', 'try', 'catch', 'do', 'defer', 'in', 'where',
  'self', 'Self', 'super', 'nil', 'true', 'false', 'is', 'as',
  'public', 'internal', 'private', 'fileprivate', 'open', 'final', 'static',
  'lazy', 'weak', 'unowned', 'inout', 'mutating', 'nonmutating', 'override',
  'typealias', 'associatedtype', 'some', 'any', 'import',
];

const SWIFT_BUILTIN_TYPES = [
  'Int', 'Int8', 'Int16', 'Int32', 'Int64',
  'UInt', 'UInt8', 'UInt16', 'UInt32', 'UInt64',
  'Double', 'Float', 'Bool', 'String', 'Character', 'Substring',
  'Array', 'Dictionary', 'Set', 'Optional', 'Result',
  'Range', 'ClosedRange',
  'Data', 'Date', 'URL', 'URLRequest', 'URLSession', 'JSONDecoder', 'JSONEncoder', 'UUID',
  'Task', 'TaskGroup', 'AsyncSequence', 'AsyncStream',
  'AnyHashable', 'AnyObject', 'AnyClass', 'Error', 'Hashable', 'Equatable',
  'Comparable', 'Codable', 'Encodable', 'Decodable', 'Identifiable',
  'Sendable', 'CustomStringConvertible',
];

// SwiftUI surface — the curriculum uses these heavily from Week 3 onward.
const SWIFTUI_TYPES = [
  'View', 'Text', 'Image', 'Button', 'VStack', 'HStack', 'ZStack', 'Spacer', 'Divider',
  'List', 'ForEach', 'ScrollView', 'LazyVGrid', 'LazyHGrid', 'LazyVStack', 'LazyHStack',
  'NavigationStack', 'NavigationLink', 'NavigationPath', 'TabView', 'Form', 'Section',
  'TextField', 'SecureField', 'Toggle', 'Slider', 'Stepper', 'Picker', 'DatePicker',
  'AsyncImage', 'GeometryReader', 'Group', 'Grid', 'Color', 'Rectangle', 'RoundedRectangle',
  'Circle', 'Capsule', 'Ellipse', 'Path', 'Shape', 'GridItem',
  'State', 'Binding', 'Bindable', 'Observable', 'Environment', 'EnvironmentObject',
  'AppStorage', 'SceneStorage', 'StateObject', 'ObservedObject', 'FocusState', 'Namespace',
  'Animation', 'Transition', 'EdgeInsets', 'Alignment', 'HorizontalAlignment', 'VerticalAlignment',
  'Font', 'FontWeight',
];

// AVKit / AVFoundation surface — used in Weeks 8–11.
const AVKIT_TYPES = [
  'AVPlayer', 'AVPlayerItem', 'AVAsset', 'AVURLAsset', 'AVPlayerLayer',
  'AVPictureInPictureController', 'AVRoutePickerView',
  'AVAudioSession', 'AVAssetDownloadURLSession', 'AVAssetDownloadDelegate',
  'CMTime', 'CMTimeRange', 'VideoPlayer',
];

// ── Stdlib method dictionary ──────────────────────────────────────────────────
//
// Keyed by *receiver concept* — the provider returns the method list when the
// editor's preceding text suggests a value of that kind. This is heuristic, not
// type-aware: typing `.` after an `[...]` literal triggers the array set.

type Method = {
  label: string;
  insert: string;        // snippet body (Monaco snippet syntax)
  detail: string;        // shown in the completion popup
  doc: string;           // markdown docstring
};

const ARRAY_METHODS: Method[] = [
  { label: 'append', insert: 'append(${1:element})', detail: '(_: Element)', doc: 'Appends a new element to the end of the array.' },
  { label: 'insert', insert: 'insert(${1:element}, at: ${2:index})', detail: '(_: Element, at: Int)', doc: 'Inserts an element at the given position.' },
  { label: 'remove', insert: 'remove(at: ${1:index})', detail: '(at: Int) -> Element', doc: 'Removes and returns the element at the given position.' },
  { label: 'removeFirst', insert: 'removeFirst()', detail: '() -> Element', doc: 'Removes and returns the first element.' },
  { label: 'removeLast', insert: 'removeLast()', detail: '() -> Element', doc: 'Removes and returns the last element.' },
  { label: 'removeAll', insert: 'removeAll()', detail: '()', doc: 'Removes all elements.' },
  { label: 'first', insert: 'first', detail: ': Element?', doc: 'The first element, or nil if the array is empty.' },
  { label: 'last', insert: 'last', detail: ': Element?', doc: 'The last element, or nil if the array is empty.' },
  { label: 'count', insert: 'count', detail: ': Int', doc: 'The number of elements.' },
  { label: 'isEmpty', insert: 'isEmpty', detail: ': Bool', doc: 'A Boolean value indicating whether the collection is empty.' },
  { label: 'contains', insert: 'contains(${1:element})', detail: '(_: Element) -> Bool', doc: 'Returns true if the sequence contains the given element.' },
  { label: 'map', insert: 'map { $1 }', detail: '<T>(_ transform: (Element) -> T) -> [T]', doc: 'Returns a new array with the results of mapping `transform` over each element.' },
  { label: 'compactMap', insert: 'compactMap { $1 }', detail: '<T>(_ transform: (Element) -> T?) -> [T]', doc: 'Maps and drops nils.' },
  { label: 'flatMap', insert: 'flatMap { $1 }', detail: '<T>(_ transform: (Element) -> [T]) -> [T]', doc: 'Maps each element to a sequence and concatenates.' },
  { label: 'filter', insert: 'filter { $1 }', detail: '(_ isIncluded: (Element) -> Bool) -> [Element]', doc: 'Returns the elements matching the predicate.' },
  { label: 'reduce', insert: 'reduce(${1:initial}) { ${2:acc}, ${3:item} in $4 }', detail: '<T>(_ initial: T, _ next: (T, Element) -> T) -> T', doc: 'Combines elements using `next`, starting from `initial`.' },
  { label: 'forEach', insert: 'forEach { $1 }', detail: '(_ body: (Element) -> Void)', doc: 'Calls `body` on each element in the same order as a for-in loop.' },
  { label: 'sorted', insert: 'sorted()', detail: '() -> [Element]', doc: 'Returns the elements sorted in ascending order (Comparable).' },
  { label: 'sorted(by:)', insert: 'sorted { $1 }', detail: '(by areInIncreasingOrder: (Element, Element) -> Bool) -> [Element]', doc: 'Returns the elements sorted by the given predicate.' },
  { label: 'reversed', insert: 'reversed()', detail: '() -> ReversedCollection<[Element]>', doc: 'Returns a view presenting the elements in reverse order.' },
  { label: 'enumerated', insert: 'enumerated()', detail: '() -> EnumeratedSequence', doc: 'Returns a sequence of (index, element) pairs.' },
  { label: 'prefix', insert: 'prefix(${1:k})', detail: '(_ k: Int) -> ArraySlice<Element>', doc: 'Returns a slice containing the initial `k` elements.' },
  { label: 'suffix', insert: 'suffix(${1:k})', detail: '(_ k: Int) -> ArraySlice<Element>', doc: 'Returns a slice containing the final `k` elements.' },
  { label: 'dropFirst', insert: 'dropFirst()', detail: '() -> ArraySlice<Element>', doc: 'Returns a slice with the first element removed.' },
  { label: 'dropLast', insert: 'dropLast()', detail: '() -> ArraySlice<Element>', doc: 'Returns a slice with the last element removed.' },
  { label: 'joined', insert: 'joined(separator: ${1:""})', detail: '(separator: String) -> String', doc: 'Returns the elements joined by `separator` (Sequence of String).' },
  { label: 'min', insert: 'min()', detail: '() -> Element?', doc: 'Returns the minimum element (Comparable).' },
  { label: 'max', insert: 'max()', detail: '() -> Element?', doc: 'Returns the maximum element (Comparable).' },
  { label: 'firstIndex(of:)', insert: 'firstIndex(of: ${1:element})', detail: '(of: Element) -> Int? where Element: Equatable', doc: 'The first index where the given element is found.' },
];

const STRING_METHODS: Method[] = [
  { label: 'count', insert: 'count', detail: ': Int', doc: 'The number of characters.' },
  { label: 'isEmpty', insert: 'isEmpty', detail: ': Bool', doc: 'True if the string has no characters.' },
  { label: 'lowercased', insert: 'lowercased()', detail: '() -> String', doc: 'Returns a lowercase version of the string.' },
  { label: 'uppercased', insert: 'uppercased()', detail: '() -> String', doc: 'Returns an uppercase version of the string.' },
  { label: 'hasPrefix', insert: 'hasPrefix(${1:""})', detail: '(_: String) -> Bool', doc: 'Returns true if the string starts with the given prefix.' },
  { label: 'hasSuffix', insert: 'hasSuffix(${1:""})', detail: '(_: String) -> Bool', doc: 'Returns true if the string ends with the given suffix.' },
  { label: 'contains', insert: 'contains(${1:""})', detail: '(_: String) -> Bool', doc: 'Returns true if the string contains the given substring.' },
  { label: 'split', insert: 'split(separator: ${1:""})', detail: '(separator: Character) -> [Substring]', doc: 'Splits the string at each occurrence of `separator`.' },
  { label: 'replacingOccurrences', insert: 'replacingOccurrences(of: ${1:""}, with: ${2:""})', detail: '(of: String, with: String) -> String', doc: 'Returns a new string with all occurrences of `of` replaced.' },
  { label: 'trimmingCharacters', insert: 'trimmingCharacters(in: .whitespacesAndNewlines)', detail: '(in: CharacterSet) -> String', doc: 'Returns a new string with leading/trailing characters from the set removed.' },
  { label: 'components', insert: 'components(separatedBy: ${1:""})', detail: '(separatedBy: String) -> [String]', doc: 'Returns an array of substrings separated by the given string.' },
  { label: 'data(using:)', insert: 'data(using: .utf8)', detail: '(using: String.Encoding) -> Data?', doc: 'Returns a representation of the string encoded using the given encoding.' },
];

const DICT_METHODS: Method[] = [
  { label: 'count', insert: 'count', detail: ': Int', doc: 'Number of key-value pairs.' },
  { label: 'isEmpty', insert: 'isEmpty', detail: ': Bool', doc: 'True if there are no entries.' },
  { label: 'keys', insert: 'keys', detail: ': Keys', doc: 'A collection of the dictionary\'s keys.' },
  { label: 'values', insert: 'values', detail: ': Values', doc: 'A collection of the dictionary\'s values.' },
  { label: 'updateValue', insert: 'updateValue(${1:value}, forKey: ${2:key})', detail: '(_: Value, forKey: Key) -> Value?', doc: 'Sets the value for the key and returns the old value, if any.' },
  { label: 'removeValue', insert: 'removeValue(forKey: ${1:key})', detail: '(forKey: Key) -> Value?', doc: 'Removes the value for the key and returns the removed value, if any.' },
  { label: 'merging', insert: 'merging(${1:other}) { current, _ in current }', detail: '<S>(_: S, uniquingKeysWith: (Value, Value) -> Value) -> [Key: Value]', doc: 'Returns a new dictionary by merging key-value pairs from another dictionary.' },
  { label: 'mapValues', insert: 'mapValues { $1 }', detail: '<T>(_ transform: (Value) -> T) -> [Key: T]', doc: 'Returns a new dictionary with the same keys and transformed values.' },
];

const OPTIONAL_METHODS: Method[] = [
  { label: 'map', insert: 'map { $1 }', detail: '<U>(_ transform: (Wrapped) -> U) -> U?', doc: 'Maps the wrapped value, or returns nil.' },
  { label: 'flatMap', insert: 'flatMap { $1 }', detail: '<U>(_ transform: (Wrapped) -> U?) -> U?', doc: 'Maps then unwraps one level of optional.' },
];

// ── Snippet patterns ──────────────────────────────────────────────────────────

type Snippet = { label: string; body: string; detail: string; doc: string };

const SWIFT_SNIPPETS: Snippet[] = [
  {
    label: 'guard let',
    body: 'guard let ${1:value} = ${2:optional} else { ${3:return} }\n$0',
    detail: 'guard let ... = ... else { ... }',
    doc: 'Early-exit unwrap of an optional. Idiomatic in Swift.',
  },
  {
    label: 'if let',
    body: 'if let ${1:value} = ${2:optional} {\n\t$0\n}',
    detail: 'if let ... = ... { ... }',
    doc: 'Conditional unwrap of an optional.',
  },
  {
    label: 'if case',
    body: 'if case .${1:case}(let ${2:value}) = ${3:expr} {\n\t$0\n}',
    detail: 'if case .X(let v) = expr { ... }',
    doc: 'Pattern match a single enum case in an if-statement.',
  },
  {
    label: 'func',
    body: 'func ${1:name}(${2:arg}: ${3:Type}) -> ${4:Type} {\n\t$0\n}',
    detail: 'func name(arg: Type) -> Type { ... }',
    doc: 'Function declaration.',
  },
  {
    label: 'struct',
    body: 'struct ${1:Name} {\n\t$0\n}',
    detail: 'struct Name { ... }',
    doc: 'Value-type struct declaration.',
  },
  {
    label: 'class',
    body: 'final class ${1:Name} {\n\t$0\n}',
    detail: 'final class Name { ... }',
    doc: 'Reference-type class declaration. Defaulted to `final` per Swift convention.',
  },
  {
    label: 'enum',
    body: 'enum ${1:Name} {\n\tcase ${2:caseA}\n\tcase ${3:caseB}\n\t$0\n}',
    detail: 'enum Name { case ...; case ... }',
    doc: 'Enum declaration.',
  },
  {
    label: 'protocol',
    body: 'protocol ${1:Name} {\n\t$0\n}',
    detail: 'protocol Name { ... }',
    doc: 'Protocol declaration.',
  },
  {
    label: 'actor',
    body: 'actor ${1:Name} {\n\t$0\n}',
    detail: 'actor Name { ... }',
    doc: 'Actor declaration — serializes access to mutable state.',
  },
  {
    label: 'init',
    body: 'init(${1:arg}: ${2:Type}) {\n\tself.${1:arg} = ${1:arg}\n\t$0\n}',
    detail: 'init(arg: Type) { ... }',
    doc: 'Initializer.',
  },
  {
    label: 'do catch',
    body: 'do {\n\ttry ${1:expr}\n} catch {\n\tprint("error: \\(error)")\n\t$0\n}',
    detail: 'do { try ... } catch { ... }',
    doc: 'Throwing call wrapped in a do-catch.',
  },
  {
    label: 'for in',
    body: 'for ${1:item} in ${2:collection} {\n\t$0\n}',
    detail: 'for item in collection { ... }',
    doc: 'For-in loop.',
  },
  {
    label: 'while',
    body: 'while ${1:condition} {\n\t$0\n}',
    detail: 'while condition { ... }',
    doc: 'While loop.',
  },
  {
    label: 'switch',
    body: 'switch ${1:value} {\ncase ${2:.someCase}:\n\t$0\ndefault:\n\tbreak\n}',
    detail: 'switch v { case ... }',
    doc: 'Switch statement with default.',
  },
  {
    label: 'async func',
    body: 'func ${1:name}(${2:arg}: ${3:Type}) async throws -> ${4:Type} {\n\t$0\n}',
    detail: 'func name(...) async throws -> ...',
    doc: 'Async + throwing function declaration.',
  },
  {
    label: 'task group',
    body: 'try await withThrowingTaskGroup(of: ${1:T}.self) { group in\n\tfor ${2:item} in ${3:items} {\n\t\tgroup.addTask { try await ${4:work}(${2:item}) }\n\t}\n\tvar results: [${1:T}] = []\n\tfor try await result in group { results.append(result) }\n\treturn results\n}',
    detail: 'withThrowingTaskGroup { ... }',
    doc: 'Dynamic-fan-out concurrent task group.',
  },
  {
    label: '@Observable',
    body: '@Observable\nfinal class ${1:Model} {\n\tvar ${2:value}: ${3:Type} = ${4:default}\n\t$0\n}',
    detail: '@Observable final class Model { ... }',
    doc: 'Observable model class for SwiftUI state.',
  },
  {
    label: 'View',
    body: 'struct ${1:Name}: View {\n\tvar body: some View {\n\t\t$0\n\t}\n}',
    detail: 'struct Name: View { var body: some View { ... } }',
    doc: 'SwiftUI View declaration.',
  },
  {
    label: 'print',
    body: 'print(${1:value})',
    detail: '(_ items: Any..., separator: String, terminator: String)',
    doc: 'Writes the textual representations of the items to standard output.',
  },
];

// ── Hover database ────────────────────────────────────────────────────────────

const HOVERS: Record<string, string> = {
  'let': '**`let`** — declares an *immutable* binding. The compiler enforces this; reassignment is a compile error.',
  'var': '**`var`** — declares a *mutable* binding.',
  'guard': '**`guard`** — early-exit conditional. The `else` branch must transfer control out of the current scope (return / throw / break / continue).',
  'some': '**`some`** — opaque return type. The concrete type is fixed at compile time but hidden from the caller. Zero overhead.',
  'any': '**`any`** — existential type box. Holds any conforming type at runtime. Has indirection cost.',
  'async': '**`async`** — marks a function that may suspend. Callers must `await`.',
  'await': '**`await`** — suspends the current task until the async expression resolves.',
  'try': '**`try`** — propagates a thrown error from a throwing call.',
  'throws': '**`throws`** — declares a function as able to throw an error.',
  'actor': '**`actor`** — reference type whose mutable state is automatically serialized. External calls are `async`.',
  'mutating': '**`mutating`** — required prefix for a method on a value type that mutates `self`.',
  'weak': '**`weak`** — non-retaining reference. Becomes nil when the referent deallocates.',
  'unowned': '**`unowned`** — non-retaining reference; non-optional. Crashes if accessed after deallocation.',
  'lazy': '**`lazy`** — stored property whose initial value is computed on first access.',
  'inout': '**`inout`** — pass-by-reference parameter; caller passes `&value`.',
  'Self': '**`Self`** — the conforming type. Useful in protocols where the implementor\'s type is needed.',
  'self': '**`self`** — the current instance.',
  '@Observable': '**`@Observable`** macro — generates per-property change tracking. Replaces `ObservableObject` + `@Published`.',
  '@State': '**`@State`** — view-owned mutable storage. Survives view rebuilds.',
  '@Binding': '**`@Binding`** — two-way reference to a value owned by a parent view.',
  '@Bindable': '**`@Bindable`** — exposes `$model.field` two-way bindings on an `@Observable` instance.',
  '@Environment': '**`@Environment(\\.key)`** — reads a value injected by an ancestor.',
  '@AppStorage': '**`@AppStorage("key")`** — reactive binding to a `UserDefaults` value.',
  'Int': '**`Int`** — platform-sized signed integer.',
  'Double': '**`Double`** — 64-bit floating-point number.',
  'String': '**`String`** — Unicode-correct text. Indexed by `String.Index`, not `Int`.',
  'Bool': '**`Bool`** — `true` or `false`.',
  'Array': '**`Array<Element>`** — ordered, random-access collection. Value type with copy-on-write.',
  'Dictionary': '**`Dictionary<Key, Value>`** — unordered hash map. `Key` must be `Hashable`.',
  'Set': '**`Set<Element>`** — unordered collection of unique elements. `Element` must be `Hashable`.',
  'Optional': '**`Optional<Wrapped>`** — `.some(value)` or `.none`. Sugar: `T?`.',
  'Result': '**`Result<Success, Failure>`** — `.success(value)` or `.failure(error)` for non-throwing error propagation.',
};

// ── Provider registration ─────────────────────────────────────────────────────

/** True if the cursor sits immediately after a `.` — heuristic member-access trigger. */
function isAfterDot(textBefore: string): boolean {
  return /\.\s*$/.test(textBefore) || /\.[A-Za-z_]\w*$/.test(textBefore);
}

/** Heuristically guesses which receiver kind the user is dotting into. */
function guessReceiverKind(textBefore: string): 'array' | 'string' | 'dict' | 'optional' | 'unknown' {
  // Strip any partial member identifier so we look at the receiver.
  const trimmed = textBefore.replace(/\.[A-Za-z_]\w*$/, '.').replace(/\.\s*$/, '');
  // Look at the last meaningful token / literal.
  if (/\]\s*$/.test(trimmed)) return 'array'; // [1, 2, 3].
  if (/"\s*$/.test(trimmed) || /\.lowercased\(\)$|\.uppercased\(\)$|String\(\s*\)\s*$/.test(trimmed)) return 'string';
  if (/\}\s*$/.test(trimmed)) return 'dict';
  // Identifier ending in s often arrays — weak heuristic, only used when stronger hints absent.
  const idMatch = trimmed.match(/([A-Za-z_]\w*)\s*$/);
  if (idMatch) {
    const name = idMatch[1];
    if (/(s|List|Array|Items|All)$/.test(name)) return 'array';
    if (/Map|Dict|Dictionary|ById|ByName$/.test(name)) return 'dict';
    if (/Text|Title|Name|Label|Description|Message$/.test(name)) return 'string';
    if (/\?$/.test(textBefore.split('.')[0] || '')) return 'optional';
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

function methodItem(
  monaco: Monaco,
  m: Method,
  range: monacoNS.IRange,
): CompletionItem {
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

const registeredFor: Set<Monaco> = new Set();

/**
 * Idempotently install Swift language services into the given Monaco instance.
 * Safe to call multiple times — internal guard prevents duplicate registration.
 */
export function registerSwiftLanguageServices(monaco: Monaco): void {
  if (registeredFor.has(monaco)) return;
  registeredFor.add(monaco);

  // Make sure the language is registered (Monaco ships a Swift tokenizer when
  // the language was declared on a model, but registering explicitly is safe).
  const known = monaco.languages.getLanguages().some((l) => l.id === 'swift');
  if (!known) {
    monaco.languages.register({ id: 'swift', extensions: ['.swift'] });
  }

  // ── Completion provider ────────────────────────────────────────────────────
  monaco.languages.registerCompletionItemProvider('swift', {
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

      // Member access — narrow to the relevant method dictionary.
      if (isAfterDot(lineUntilCursor)) {
        const kind = guessReceiverKind(lineUntilCursor);
        const sets: Record<typeof kind, Method[]> = {
          array: ARRAY_METHODS,
          string: STRING_METHODS,
          dict: DICT_METHODS,
          optional: OPTIONAL_METHODS,
          unknown: [...ARRAY_METHODS, ...STRING_METHODS, ...DICT_METHODS, ...OPTIONAL_METHODS],
        };
        const methods = sets[kind];
        return {
          suggestions: methods.map((m) => methodItem(monaco, m, range)),
        };
      }

      // Default identifier completion.
      const suggestions: CompletionItem[] = [];

      for (const kw of SWIFT_KEYWORDS) {
        suggestions.push({
          label: kw,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: kw,
          documentation: HOVERS[kw] ? { value: HOVERS[kw] } : undefined,
          range,
        });
      }

      for (const t of [...SWIFT_BUILTIN_TYPES, ...SWIFTUI_TYPES, ...AVKIT_TYPES]) {
        suggestions.push({
          label: t,
          kind: monaco.languages.CompletionItemKind.Class,
          insertText: t,
          documentation: HOVERS[t] ? { value: HOVERS[t] } : undefined,
          range,
        });
      }

      for (const s of SWIFT_SNIPPETS) {
        suggestions.push(
          snippetItem(monaco, s, range, monaco.languages.CompletionItemKind.Snippet),
        );
      }

      return { suggestions };
    },
  });

  // ── Hover provider ─────────────────────────────────────────────────────────
  monaco.languages.registerHoverProvider('swift', {
    provideHover(model, position) {
      const word = model.getWordAtPosition(position);
      if (!word) return null;
      const text = word.word;
      // Detect property-wrapper-style hovers: word preceded by `@`.
      const lineUntilCursor = model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: word.startColumn,
      });
      const key = /\@\s*$/.test(lineUntilCursor) ? `@${text}` : text;

      const doc = HOVERS[key] ?? HOVERS[text];
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

  // ── Signature help (very small surface; covers print + common stdlib) ──────
  const SIGNATURES: Record<string, monacoNS.languages.SignatureHelp['signatures'][number]> = {
    print: {
      label: 'print(_ items: Any..., separator: String = " ", terminator: String = "\\n")',
      documentation: 'Writes the textual representation of `items` to standard output.',
      parameters: [
        { label: '_ items: Any...', documentation: 'Zero or more values to print.' },
        { label: 'separator: String = " "', documentation: 'A string to print between each item.' },
        { label: 'terminator: String = "\\n"', documentation: 'A string to print after all items.' },
      ],
    },
    map: {
      label: 'map<T>(_ transform: (Element) -> T) -> [T]',
      documentation: 'Returns an array containing the results of mapping `transform` over each element.',
      parameters: [{ label: '_ transform: (Element) -> T', documentation: 'A closure mapping one element to a new value.' }],
    },
    filter: {
      label: 'filter(_ isIncluded: (Element) -> Bool) -> [Element]',
      documentation: 'Returns the elements of the sequence that satisfy `isIncluded`.',
      parameters: [{ label: '_ isIncluded: (Element) -> Bool', documentation: 'A predicate that returns true for elements to keep.' }],
    },
    reduce: {
      label: 'reduce<T>(_ initial: T, _ next: (T, Element) -> T) -> T',
      documentation: 'Returns the result of combining elements of the sequence using `next`.',
      parameters: [
        { label: '_ initial: T', documentation: 'The starting value.' },
        { label: '_ next: (T, Element) -> T', documentation: 'A combining closure.' },
      ],
    },
  };

  monaco.languages.registerSignatureHelpProvider('swift', {
    signatureHelpTriggerCharacters: ['(', ','],
    provideSignatureHelp(model, position) {
      // Walk back to the opening paren and grab the identifier preceding it.
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
