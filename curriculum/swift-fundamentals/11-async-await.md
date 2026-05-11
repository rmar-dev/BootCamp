---
type: lesson
title: Async/Await
level: intermediate
summary: Swift's async/await model makes asynchronous code read like synchronous code, with structured concurrency ensuring cancellation propagates automatically through the call tree.
---

## async functions and await expressions

Mark a function `async` to signal it may suspend. The caller must prefix the call with `await`, which is a visible suspension point — the current task is suspended until the called function produces its result.

```swift
func fetchScore(for userID: Int) async -> Int {
    // Simulates a database or network call — no actual I/O needed here.
    return userID * 10
}

// Call from an async context:
let score = await fetchScore(for: 42)   // 420
```

`await` is only permitted inside an `async` context — an `async` function, a `Task { }` body, or an `async` test method. Writing `await` in a synchronous function is a compile error.

> **What's going on here**
> - `await` — suspends the current task until `fetchScore` returns. The thread is not blocked; the runtime can run other tasks while waiting. This is why `await` is only legal inside an async context: there must be a task to suspend.
> - There is no callback, no `Future`, no completion handler. The result arrives at the `await` site exactly as if the call were synchronous.

---

## Task { } — launching async work from sync context

A synchronous context (e.g., a `@main` entry point, a SwiftUI event handler, or a standard test setUp body) cannot `await` directly. `Task { }` creates a new unstructured task that runs its closure in an async context:

```swift
func double(_ x: Int) async -> Int { x * 2 }

Task {
    let result = await double(5)
    print(result)   // 10
}
```

`Task` is fire-and-forget by default — the creating scope does not wait for it to complete. Use a structured approach (`async let`, `withTaskGroup`) when you need the results back in the same scope.

---

## async let — concurrent fetches

`async let` starts a child task immediately and binds a placeholder for its future result. The actual suspension happens at the `await` on the placeholder, not at the `async let` line. Two `async let` bindings execute concurrently:

```swift
func slow(_ x: Int) async -> Int { x }

async let a = slow(1)   // child task starts immediately
async let b = slow(2)   // second child task starts immediately

let sum = await a + await b   // suspends until both complete; result: 3
```

> **What's going on here**
> - `async let a = slow(1)` — the child task starts running at this line. Execution continues to the next `async let` without waiting.
> - `await a + await b` — actual suspension occurs here. If `slow(2)` finishes first, the runtime waits only for `slow(1)`. Both tasks run in parallel.

> **Coming from Java:** Java's `CompletableFuture.allOf(f1, f2).thenApply(...)` achieves parallel composition, but cancellation is manual — you must explicitly call `cancel()` on each future and propagate it through the chain. Swift's structured concurrency (`async let`, `withTaskGroup`) automatically propagates cancellation: cancelling the parent task cancels all child tasks, with no additional orchestration code. Java requires opt-in cancellation contracts per-API; Swift makes it the default.

---

## try await — combining throws and async

A function can be both `async` and `throws`. Call it with `try await` — `try` propagates any thrown error, `await` suspends until the result is ready. Both are part of the call expression; the compiler requires both keywords:

```swift
enum FetchError: Error { case notFound }

func fetchData(id: Int) async throws -> String {
    if id < 0 { throw FetchError.notFound }
    return "item-\(id)"
}

// In an async context:
do {
    let data = try await fetchData(id: 7)
    print(data)   // "item-7"
} catch {
    print("failed: \(error)")
}
```

This is a direct extension of the `throws`/`try`/`do-catch` machinery from Lesson 10 — the async layer is layered on top without changing the error-handling rules.

---

## Cancellation — Task.isCancelled

Every task carries a cancellation flag. Check it with `Task.isCancelled` before expensive operations to bail early:

```swift
func processItems(_ items: [Int]) async -> [Int] {
    var results: [Int] = []
    for item in items {
        if Task.isCancelled { break }
        results.append(item * 2)
    }
    return results
}
```

Cancellation in Swift is cooperative — the runtime sets the flag, but the task decides when to check it. Child tasks started with `async let` or `withTaskGroup` are cancelled automatically when their parent is cancelled.

---

## withTaskGroup — parallel fan-out (overview)

For a dynamic number of concurrent child tasks, use `withTaskGroup(of:)`. It is the structured alternative to spawning many `Task { }` instances. This lesson does not include a `withTaskGroup` exercise — it is a natural next step after mastering `async let`.

---

## Actors — a preview

Actors are Swift's built-in mechanism for protecting mutable state from concurrent access. They are the next concept to learn after `async/await` for thread-safe code, but are out of scope for this lesson.

---
type: exercise
kind: predict_output
pointsMax: 15
language: swift
expectedOutput: "10"
---
What does this print?

```swift:starter
func double(_ x: Int) async -> Int { x * 2 }

Task {
    print(await double(5))
}
```

---
type: exercise
kind: predict_output
pointsMax: 15
language: swift
expectedOutput: "3"
---
What does this print?

```swift:starter
func slow(_ x: Int) async -> Int { x }

Task {
    async let a = slow(1)
    async let b = slow(2)
    print(await a + await b)
}
```

---
type: exercise
kind: predict_output
pointsMax: 15
language: swift
expectedOutput: "err"
---
What does this print?

```swift:starter
enum E: Error { case oops }

func mightFail() async throws -> Int {
    throw E.oops
}

Task {
    do {
        let v = try await mightFail()
        print(v)
    } catch {
        print("err")
    }
}
```

---
type: exercise
kind: predict_output
pointsMax: 15
language: swift
expectedOutput: "ok"
---
What does this print?

```swift:starter
enum FetchError: Error { case missing }

func load(id: Int) async throws -> String {
    if id == 0 { throw FetchError.missing }
    return "ok"
}

Task {
    let result = try? await load(id: 1)
    print(result ?? "nil")
}
```

---
type: exercise
kind: multiple_choice
pointsMax: 10
---
Why does this code fail to compile?

```swift
func fetchName() async -> String { "Ada" }

func greet() -> String {
    let name = await fetchName()
    return "Hello, \(name)!"
}
```

- [ ] `fetchName` is not marked `async`.
- [x] `greet` is not marked `async`, so `await` is not permitted inside it.
- [ ] `await` is only legal inside a `Task { }` closure.
- [ ] `fetchName` must also be marked `throws` to use `await`.

---
type: exercise
kind: fill_blank
pointsMax: 20
language: swift
blanks:
  "1": ["async"]
---
Fill in the keyword that marks the function as asynchronous.

```swift:starter
func load() ___1___ -> Int { 42 }
```

---
type: exercise
kind: fix_bug
pointsMax: 40
---
Fix `compute` so it awaits `fetchValue` and is marked `async`.

```swift:broken
func fetchValue() async -> Int { 99 }

func compute() -> Int {
    return fetchValue()
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testComputeReturnsValue() async throws {
        let result = await compute()
        XCTAssertEqual(result, 99)
    }
}
```

---
type: exercise
kind: code
pointsMax: 50
---
Write `func sumAsync(_ ints: [Int]) async -> Int` that returns the sum of all elements.

```swift:starter
func sumAsync(_ ints: [Int]) async -> Int {
    // TODO
}
```

```swift:solution
func sumAsync(_ ints: [Int]) async -> Int {
    return ints.reduce(0, +)
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testBasicSum() async throws {
        let result = await sumAsync([1, 2, 3])
        XCTAssertEqual(result, 6)
    }
    func testEmptyArray() async throws {
        let result = await sumAsync([])
        XCTAssertEqual(result, 0)
    }
    func testSingleElement() async throws {
        let result = await sumAsync([42])
        XCTAssertEqual(result, 42)
    }
    func testNegativeValues() async throws {
        let result = await sumAsync([-1, -2, 3])
        XCTAssertEqual(result, 0)
    }
}
```

---
type: exercise
kind: code
pointsMax: 50
---
Write `func runConcurrent(_ a: Int, _ b: Int) async -> Int` that fetches two values concurrently using `async let` and returns their sum. Use the helper `func value(_ x: Int) async -> Int { x }` defined in the starter.

```swift:starter
func value(_ x: Int) async -> Int { x }

func runConcurrent(_ a: Int, _ b: Int) async -> Int {
    // TODO: use async let to fetch both values concurrently
}
```

```swift:solution
func value(_ x: Int) async -> Int { x }

func runConcurrent(_ a: Int, _ b: Int) async -> Int {
    async let first = value(a)
    async let second = value(b)
    return await first + await second
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testSumOfTwo() async throws {
        let result = await runConcurrent(3, 7)
        XCTAssertEqual(result, 10)
    }
    func testZeroAndValue() async throws {
        let result = await runConcurrent(0, 5)
        XCTAssertEqual(result, 5)
    }
    func testSymmetry() async throws {
        let ab = await runConcurrent(4, 6)
        let ba = await runConcurrent(6, 4)
        XCTAssertEqual(ab, ba)
    }
}
```

---
type: exercise
kind: code
pointsMax: 50
---
Write `func tryFetch(id: Int) async throws -> String` that calls `remoteLoad(id:)` from the starter with `try await` and propagates its error.

```swift:starter
enum LoadError: Error { case missing }

func remoteLoad(id: Int) async throws -> String {
    if id < 0 { throw LoadError.missing }
    return "item-\(id)"
}

func tryFetch(id: Int) async throws -> String {
    // TODO: call remoteLoad using try await
}
```

```swift:solution
enum LoadError: Error { case missing }

func remoteLoad(id: Int) async throws -> String {
    if id < 0 { throw LoadError.missing }
    return "item-\(id)"
}

func tryFetch(id: Int) async throws -> String {
    return try await remoteLoad(id: id)
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testSuccessPath() async throws {
        let result = try await tryFetch(id: 5)
        XCTAssertEqual(result, "item-5")
    }
    func testZeroId() async throws {
        let result = try await tryFetch(id: 0)
        XCTAssertEqual(result, "item-0")
    }
    func testThrowsOnNegativeId() async throws {
        do {
            _ = try await tryFetch(id: -1)
            XCTFail("expected LoadError.missing")
        } catch LoadError.missing {
            // correct
        }
    }
    func testTryOptional() async throws {
        let result = try? await tryFetch(id: -99)
        XCTAssertNil(result)
    }
}
```

---
type: recap
---

## What you learned

**Concepts:**
- `async` marks a function as suspendable; `await` is the suspension point at each async call
- `Task { }` launches async work from a synchronous context
- `async let` starts concurrent child tasks; suspension occurs at `await` on the placeholder
- `try await` combines Lesson 10's error propagation with async suspension in one expression
- `Task.isCancelled` for cooperative cancellation checks
- Actors (Lesson 12) are the next step for protecting shared mutable state across tasks

**Swift-specific vs other languages:** Java's `CompletableFuture` requires manual cancellation wiring on every future in the chain. Swift's structured concurrency (`async let`, `withTaskGroup`) propagates cancellation automatically through the task tree — cancelling a parent cancels all its children without additional code.

**What's next:** Week 2 begins with actors and data-race safety — the natural follow-on to async/await for code that shares mutable state across concurrent tasks.
