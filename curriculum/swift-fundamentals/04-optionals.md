---
type: lesson
title: Optionals
level: beginner
summary: Swift's Optional type enforces nil safety at compile time — if let, guard let, ??, and optional chaining are the canonical unwrapping patterns.
---

## What is an Optional?

An `Optional<T>` is a type that holds either a value of type `T` or nothing at all (`nil`). Swift expresses this with a `?` suffix on the type:

```swift
var name: String? = "Ada"   // holds a String value
var age: Int? = nil         // holds nothing
```

`name` and `"Ada"` are **not** the same type. `name` is `Optional<String>`; `"Ada"` is `String`. The compiler treats them as distinct and rejects code that confuses them without an explicit unwrap.

> **Coming from C++:** C++ has `nullptr`, which can be implicitly assigned to any pointer type — the compiler does not distinguish `T*` holding a valid address from one holding `nullptr`. In Swift, `Optional<T>` and `T` are separate types in the type system. You cannot pass a `String?` where a `String` is expected; the compiler forces you to handle the nil case first.

`print`ing an Optional shows the wrapper:

```swift
var name: String? = "Ada"
print(name)   // Optional("Ada")
print(name!)  // Ada  — force-unwrap (dangerous — covered below)
```

## Safe unwrapping — if let and guard let

The two canonical patterns for safe unwrapping are `if let` and `guard let`.

**`if let`** binds the unwrapped value inside its body only:

```swift
var maybeScore: Int? = 42

if let score = maybeScore {
    print(score)   // score is Int here, not Int?
} else {
    print("no score")
}
```

> **What's going on here**
> - `if let score = maybeScore` — the right-hand side is `Int?`; `score` inside the block is `Int`. The name `score` shadows `maybeScore` only within the if-body.
> - Swift 5.5+ allows shorthand: `if let maybeScore { ... }` — the unwrapped binding reuses the same name. Both forms are valid.

**`guard let`** is the early-exit pattern. Use it at the top of a function to bail out when the value is absent, keeping the rest of the function body in the happy path:

```swift
func display(name: String?) {
    guard let name = name else {
        print("no name")
        return
    }
    print(name)   // name is String for the rest of the function
}
```

Prefer `guard let` when nil means "skip this function entirely". Prefer `if let` when both branches do meaningful work.

## Nil-coalescing — ??

`??` provides a default when the left side is nil:

```swift
let maybeName: String? = nil
let displayName = maybeName ?? "Anonymous"   // "Anonymous"
```

`??` chains: `a ?? b ?? c` returns the first non-nil value, or `c` if both are nil.

## Optional chaining — ?.

`?.` propagates nil through a chain of property accesses or method calls. If any step is nil, the whole expression short-circuits to nil:

```swift
struct Address {
    let street: String
}

struct User {
    let address: Address?
}

let u = User(address: nil)
let street = u.address?.street   // String? — nil, not a crash
```

The result type of an optional-chaining expression is always optional, even if `street` itself is `String`.

> **What's going on here**
> - `u.address?.street` — if `u.address` is nil, Swift returns nil immediately; `street` is never accessed.
> - The result is `String?`, not `String`. Combine with `??` to get a concrete value: `u.address?.street ?? "unknown"`.

## Force-unwrap — ! — and why to avoid it

`!` forces the unwrap of an optional at runtime. If the optional is nil, the program crashes immediately:

```swift
var name: String? = nil
print(name!)   // Fatal error: Unexpectedly found nil while unwrapping an Optional value
```

Force-unwrap is almost never correct in production code. The crash message is clear, but it surfaces at runtime rather than at compile time — exactly the null-pointer bug Swift's type system is designed to prevent. Use `if let`, `guard let`, or `??` instead.

The one legitimate use of `!` is in tests or one-off scripts where you control all inputs and a crash is an acceptable signal. Even then, prefer `XCTUnwrap` in tests.

**Implicitly unwrapped optionals** (`String!`) declare a value that is accessed as if it were non-optional but can be nil. You will see this in older Swift and UIKit-era code (`@IBOutlet var label: UILabel!`). Do not use it in new code.

---
type: exercise
kind: predict_output
pointsMax: 15
language: swift
expectedOutput: "Optional(\"Ada\")"
---
What does this print?

```swift:starter
var name: String? = "Ada"
print(name)
```

---
type: exercise
kind: multiple_choice
pointsMax: 10
---
Which is the safest way to use an optional value?

- [x] `if let` — unwraps and provides a non-optional binding inside the block.
- [ ] Force-unwrap with `!` — crashes if the value is nil.
- [ ] Optional chaining `?.` — never returns nil; it crashes if any step is absent.
- [ ] All of the above are equally safe.

---
type: exercise
kind: fill_blank
pointsMax: 20
language: swift
blanks:
  "1": ["if"]
---
Fill in the keyword to safely unwrap `optional` into a new constant.

```swift:starter
let optional: Int? = 42
___1___ let x = optional { print(x) }
```

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Write a function `firstChar(_ s: String?) -> Character?` that returns the first character of the string if it is non-nil and non-empty, otherwise returns nil.

```swift:starter
func firstChar(_ s: String?) -> Character? {
    // TODO
}
```

```swift:solution
func firstChar(_ s: String?) -> Character? {
    guard let s = s, !s.isEmpty else { return nil }
    return s.first
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testNilInput() {
        XCTAssertNil(firstChar(nil))
    }
    func testEmptyString() {
        XCTAssertNil(firstChar(""))
    }
    func testNormalString() {
        XCTAssertEqual(firstChar("Ada"), Character("A"))
    }
}
```

---
type: exercise
kind: predict_output
pointsMax: 15
language: swift
expectedOutput: "10"
---
What does this print?

```swift:starter
let value: Int? = 5
let doubled = value.map { $0 * 2 }
print(doubled ?? -1)
```

---
type: exercise
kind: fix_bug
pointsMax: 40
language: swift
---
Fix the function so it returns `"Unknown"` when `name` is nil instead of crashing.

```swift:broken
func greet(name: String?) -> String {
    return "Hello, \(name!)"
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testNilReturnsUnknown() {
        XCTAssertEqual(greet(name: nil), "Hello, Unknown")
    }
    func testNonNilReturnsName() {
        XCTAssertEqual(greet(name: "Ada"), "Hello, Ada")
    }
}
```

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Write a function `nameOrDefault(_ name: String?) -> String` that returns the name if non-nil, or `"Anonymous"` otherwise.

```swift:starter
func nameOrDefault(_ name: String?) -> String {
    // TODO
}
```

```swift:solution
func nameOrDefault(_ name: String?) -> String {
    return name ?? "Anonymous"
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testNonNil() {
        XCTAssertEqual(nameOrDefault("Ada"), "Ada")
    }
    func testNil() {
        XCTAssertEqual(nameOrDefault(nil), "Anonymous")
    }
}
```

---
type: exercise
kind: predict_output
pointsMax: 15
language: swift
expectedOutput: "n/a"
---
What does this print?

```swift:starter
struct Address {
    let street: String
}
struct User {
    let address: Address?
}
let u = User(address: nil)
print(u.address?.street ?? "n/a")
```

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Write a function `safeIndex(_ array: [Int], at index: Int) -> Int?` that returns the element at `index` if the index is valid, otherwise returns nil.

```swift:starter
func safeIndex(_ array: [Int], at index: Int) -> Int? {
    // TODO
}
```

```swift:solution
func safeIndex(_ array: [Int], at index: Int) -> Int? {
    guard index >= 0 && index < array.count else { return nil }
    return array[index]
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testValidIndex() {
        XCTAssertEqual(safeIndex([10, 20, 30], at: 1), 20)
    }
    func testIndexTooLarge() {
        XCTAssertNil(safeIndex([10, 20, 30], at: 5))
    }
    func testNegativeIndex() {
        XCTAssertNil(safeIndex([10, 20, 30], at: -1))
    }
    func testEmptyArray() {
        XCTAssertNil(safeIndex([], at: 0))
    }
}
```

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Write a function `parseAndDouble(_ s: String) -> Int` that converts `s` to an `Int` using `Int(s)` (which returns `Int?`) and returns double the parsed value, or `0` if the string is not a valid integer.

```swift:starter
func parseAndDouble(_ s: String) -> Int {
    // TODO
}
```

```swift:solution
func parseAndDouble(_ s: String) -> Int {
    guard let n = Int(s) else { return 0 }
    return n * 2
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testValidInteger() {
        XCTAssertEqual(parseAndDouble("7"), 14)
    }
    func testZero() {
        XCTAssertEqual(parseAndDouble("0"), 0)
    }
    func testInvalidString() {
        XCTAssertEqual(parseAndDouble("abc"), 0)
    }
    func testNegativeInteger() {
        XCTAssertEqual(parseAndDouble("-3"), -6)
    }
}
```

---
type: recap
---

## What you learned

**Concepts:** `Optional<T>` as a distinct type from `T` · `?` suffix for optional declarations · `if let` for conditional unwrapping · `guard let` for early-exit unwrapping · `??` as the nil-coalescing default operator · Optional chaining `?.` for nil-propagating property access · Force-unwrap `!` and why it causes runtime crashes · Implicitly-unwrapped optionals as a legacy pattern to avoid

**Swift-specific vs other languages:** C++ allows passing `nullptr` wherever a pointer is expected, deferring the error to runtime. Swift's `Optional<T>` is a separate type — the compiler refuses to treat `String?` as `String`, eliminating an entire class of null-dereference bugs before the code ever runs.

**What's next:** Lesson 05 covers collections — `Array` and `Dictionary` — including how optional return types (like `dictionary[key]`) compose with the unwrapping patterns from this lesson.
