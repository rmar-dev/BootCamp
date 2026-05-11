---
type: lesson
title: Error Handling
level: intermediate
summary: Swift's error handling model uses typed, visible throws at the function signature, enforcing error propagation at compile time via try, do/catch, and Result.
---

## The Error protocol

Any type that conforms to `Error` can be thrown. The canonical pattern is an enum:

```swift
enum NetworkError: Error {
    case timeout
    case notFound(url: String)
    case unauthorized
}
```

Enum cases give you structured, pattern-matchable error values — far more useful than stringly-typed errors. Conformance to `Error` adds no required members; the protocol is a marker that opts the type into Swift's throwing machinery.

---

## Declaring and calling throwing functions

A function that may throw is declared with `throws` between the parameter list and the return arrow. The compiler treats `throws` as part of the function's type — a non-throwing function and a throwing one with otherwise identical signatures are distinct types.

```swift
func divide(_ a: Int, by b: Int) throws -> Int {
    if b == 0 { throw NetworkError.timeout }  // just reusing an existing enum for demo
    return a / b
}
```

Calling a throwing function requires one of four forms:

| Form | Behavior |
|---|---|
| `try expr` | propagates any thrown error to the caller (caller must also throw or sit in a `do/catch`) |
| `try? expr` | converts a throw into `nil`; success becomes `Optional(value)` |
| `try! expr` | crashes the process if the call throws; use only when you have external proof it cannot fail |
| `try await expr` | for async throwing calls — covered in Lesson 11 |

> **Coming from JavaScript:** In JavaScript any function can `throw` without advertising it in its signature — callers have no way to know without reading source or docs. In Swift, `throws` is part of the function's type. The compiler enforces that every throwing call is either wrapped in a `do/catch`, propagated with a matching `throws` on the caller, or explicitly silenced with `try?`/`try!`. Errors are visible in the type system, not discovered at runtime.

---

## do / catch

Wrap a throwing call in `do { ... }` and handle errors in `catch` clauses:

```swift
do {
    let result = try divide(10, by: 2)
    print(result)
} catch NetworkError.timeout {
    print("timed out")
} catch let e as NetworkError {
    print("network error: \(e)")
} catch {
    // 'error' is the implicit binding for any unmatched error
    print("unknown error: \(error)")
}
```

Catch clauses are pattern-matched top to bottom, exactly like `switch` from Lesson 06. The final bare `catch` is the exhaustive fallback; the compiler requires all thrown errors to be handled.

> **What's going on here**
> - `catch NetworkError.timeout` — matches one specific enum case.
> - `catch let e as NetworkError` — matches any `NetworkError` and binds it to `e` for inspection.
> - `catch { ... }` — the bare catch binds an implicit `error: any Error` constant. It must come last.

---

## try? and try!

`try?` is the right choice when an error means "no result" and you don't need the reason:

```swift
let parsed: Int? = try? Int("abc", radix: 10)   // nil — Int(_:radix:) doesn't throw, but custom parsers do
```

> **What's going on here**
> - `try?` — turns a throw into `nil` and a success into `Optional(value)`. Combine with `??` to supply a default: `(try? riskyCall()) ?? fallback`.
> - `try!` — asserts at compile time that you believe the call cannot throw. If it does, the process crashes immediately with an uncatchable error. Reserve for cases where an error is genuinely impossible by construction (e.g., loading a bundled resource that is always present).

---

## Result<Success, Failure>

`Result<Success, Failure: Error>` is Swift's explicit alternative to throwing. Use it when you want to defer error handling, pass errors across async boundaries, or store an outcome in a collection.

```swift
enum ParseError: Error { case invalid }

func parseInt(_ s: String) -> Result<Int, ParseError> {
    guard let n = Int(s) else { return .failure(.invalid) }
    return .success(n)
}

switch parseInt("42") {
case .success(let n): print(n)       // 42
case .failure(let e): print(e)       // never reached
}
```

Pattern-match on `.success`/`.failure`, or use `get()` which re-throws the failure:

```swift
let value = try parseInt("99").get()   // throws ParseError.invalid if it was a failure
```

**When to use which:**

| Mechanism | Reach for it when… |
|---|---|
| `throws` | errors are exceptional, the caller handles them immediately |
| `Result` | passing outcomes across async boundaries, storing in arrays, chaining transforms |
| `Optional` | absence is the only failure mode and the reason doesn't matter |

---

type: exercise
kind: predict_output
pointsMax: 15
language: swift
expectedOutput: "10"
---
What does this print?

```swift:starter
enum E: Error { case bad }

func mightFail(_ x: Int) throws -> Int {
    if x < 0 { throw E.bad }
    return x * 2
}

do {
    print(try mightFail(5))
} catch {
    print("err")
}
```

---
type: exercise
kind: predict_output
pointsMax: 15
language: swift
expectedOutput: "-1"
---
What does this print?

```swift:starter
enum E: Error { case bad }

func mightFail(_ x: Int) throws -> Int {
    if x < 0 { throw E.bad }
    return x * 2
}

print((try? mightFail(-1)) ?? -1)
```

---
type: exercise
kind: multiple_choice
pointsMax: 10
---
Which statement about `try!` is true?

- [ ] It behaves the same as `try` — both propagate thrown errors.
- [x] It crashes the process if the call throws.
- [ ] It returns `nil` when the call throws.
- [ ] It silently swallows errors without crashing.

---
type: exercise
kind: fill_blank
pointsMax: 20
language: swift
blanks:
  "1": ["throws"]
---
Fill in the keyword that declares the function may throw an error.

```swift:starter
enum ParseError: Error { case invalid }

func parse(_ s: String) ___1___ -> Int {
    guard let n = Int(s) else { throw ParseError.invalid }
    return n
}
```

---
type: exercise
kind: fix_bug
pointsMax: 40
---
Fix the function so it compiles — the call to `riskyDouble` must be marked with `try`.

```swift:broken
enum MathError: Error { case overflow }

func riskyDouble(_ x: Int) throws -> Int {
    guard x < Int.max / 2 else { throw MathError.overflow }
    return x * 2
}

func computeDouble(_ x: Int) throws -> Int {
    return riskyDouble(x)
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testHappyPath() {
        XCTAssertEqual(try? computeDouble(5), 10)
    }
    func testOverflow() {
        XCTAssertNil(try? computeDouble(Int.max))
    }
}
```

---
type: exercise
kind: fix_bug
pointsMax: 40
---
Fix the function so it compiles — `parseInt` does not throw, so the `do/catch` block should be removed and the call should not use `try`.

```swift:broken
func parseInt(_ s: String) -> Int? {
    return Int(s)
}

func doubled(_ s: String) -> Int? {
    do {
        let n = try parseInt(s)
        return n.map { $0 * 2 }
    } catch {
        return nil
    }
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testValid() {
        XCTAssertEqual(doubled("21"), 42)
    }
    func testInvalid() {
        XCTAssertNil(doubled("abc"))
    }
    func testNegative() {
        XCTAssertEqual(doubled("-5"), -10)
    }
}
```

---
type: exercise
kind: code
pointsMax: 50
---
Define `enum DivideError: Error { case divisionByZero }` and `func safeDivide(_ a: Int, by b: Int) throws -> Int` that throws `DivideError.divisionByZero` when `b == 0`.

```swift:starter
enum DivideError: Error {
    // TODO
}

func safeDivide(_ a: Int, by b: Int) throws -> Int {
    // TODO
}
```

```swift:solution
enum DivideError: Error {
    case divisionByZero
}

func safeDivide(_ a: Int, by b: Int) throws -> Int {
    if b == 0 { throw DivideError.divisionByZero }
    return a / b
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testHappyPath() {
        XCTAssertEqual(try? safeDivide(10, by: 2), 5)
    }
    func testDivisionByZero() {
        var caught = false
        do {
            _ = try safeDivide(10, by: 0)
        } catch DivideError.divisionByZero {
            caught = true
        } catch {
            // unexpected error type
        }
        XCTAssertTrue(caught)
    }
    func testNegativeDivisor() {
        XCTAssertEqual(try? safeDivide(-20, by: 4), -5)
    }
}
```

---
type: exercise
kind: code
pointsMax: 50
---
Define `enum ParseError: Error { case invalid }` and `func parseInt(_ s: String) -> Result<Int, ParseError>` returning `.success(n)` if `Int(s)` succeeds, `.failure(.invalid)` otherwise.

```swift:starter
enum ParseError: Error {
    // TODO
}

func parseInt(_ s: String) -> Result<Int, ParseError> {
    // TODO
}
```

```swift:solution
enum ParseError: Error {
    case invalid
}

func parseInt(_ s: String) -> Result<Int, ParseError> {
    guard let n = Int(s) else { return .failure(.invalid) }
    return .success(n)
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testSuccessPath() {
        if case .success(let n) = parseInt("42") {
            XCTAssertEqual(n, 42)
        } else {
            XCTFail("expected success")
        }
    }
    func testFailurePath() {
        if case .failure(let e) = parseInt("abc") {
            if case ParseError.invalid = e { /* correct */ } else { XCTFail("wrong error case") }
        } else {
            XCTFail("expected failure")
        }
    }
    func testNegativeNumber() {
        if case .success(let n) = parseInt("-7") {
            XCTAssertEqual(n, -7)
        } else {
            XCTFail("expected success")
        }
    }
}
```

---
type: exercise
kind: code
pointsMax: 50
---
Write `func parseAll(_ strings: [String]) -> [Int]` that uses `compactMap` to return all successfully-parsed integers, dropping inputs that cannot be converted.

```swift:starter
func parseAll(_ strings: [String]) -> [Int] {
    // TODO
}
```

```swift:solution
func parseAll(_ strings: [String]) -> [Int] {
    return strings.compactMap { Int($0) }
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testMixed() {
        XCTAssertEqual(parseAll(["1", "two", "3", "four", "5"]), [1, 3, 5])
    }
    func testAllValid() {
        XCTAssertEqual(parseAll(["10", "20", "30"]), [10, 20, 30])
    }
    func testAllInvalid() {
        XCTAssertEqual(parseAll(["a", "b", "c"]), [])
    }
    func testEmpty() {
        XCTAssertEqual(parseAll([]), [])
    }
}
```

---
type: exercise
kind: code
pointsMax: 50
---
Write `func dividedDoubled(_ a: Int, by b: Int) throws -> Int` that calls `safeDivide(_:by:)` from the earlier exercise and doubles the result, propagating any thrown error.

```swift:starter
enum DivideError: Error {
    case divisionByZero
}

func safeDivide(_ a: Int, by b: Int) throws -> Int {
    if b == 0 { throw DivideError.divisionByZero }
    return a / b
}

func dividedDoubled(_ a: Int, by b: Int) throws -> Int {
    // TODO
}
```

```swift:solution
enum DivideError: Error {
    case divisionByZero
}

func safeDivide(_ a: Int, by b: Int) throws -> Int {
    if b == 0 { throw DivideError.divisionByZero }
    return a / b
}

func dividedDoubled(_ a: Int, by b: Int) throws -> Int {
    let quotient = try safeDivide(a, by: b)
    return quotient * 2
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testHappyPath() {
        XCTAssertEqual(try? dividedDoubled(10, by: 2), 10)
    }
    func testDivisionByZero() {
        XCTAssertNil(try? dividedDoubled(10, by: 0))
    }
    func testNegativeResult() {
        XCTAssertEqual(try? dividedDoubled(-6, by: 3), -4)
    }
}
```

---
type: recap
---

## What you learned

**Concepts:**
- The `Error` protocol and enum-based error types
- `throws` in function signatures as a compile-time contract
- `do { try ... } catch` for handling errors at the call site
- Pattern matching in `catch` — specific cases, type casting, and the bare fallback
- `try?` for converting throws to `Optional` and `try!` for the crash-on-error assertion
- `Result<Success, Failure>` as an explicit alternative to throwing for stored or deferred outcomes

**Swift-specific vs other languages:** JavaScript allows any function to throw silently — callers discover errors only at runtime. Swift enforces `throws` in the type system: every call to a throwing function must be annotated with `try`, and every error must be either caught or propagated. This shifts a class of runtime surprises into compile-time verification.

**What's next:** Lesson 11 introduces `async`/`await` — and the combined `try await` form for calls that are both asynchronous and throwing.
