---
type: lesson
title: Structured Concurrency & Actors
level: intermediate
summary: Task trees, cancellation, async let, task groups, and actors for shared mutable state.
---

## Task trees

`Task { ... }` spawns a child of the current context. Cancelling the parent propagates to all descendants. Tasks finish before their parent — that is what *structured* means.

```swift
func loadAll() async throws -> (Profile, [Movie]) {
    async let profile = loadProfile()
    async let movies = loadMovies()
    return try await (profile, movies)
}
```

`async let` runs both child tasks concurrently. The function suspends only at `await`, when both must be done.

> **Coming from JavaScript:** `async let` is closer to `Promise.all` in behavior, but the parent function actually waits for both. There is no fire-and-forget — leaving an `async let` unawaited is a compile error.

---

## Cancellation

Cancellation is cooperative. A task is *marked* cancelled, and the body must check.

```swift
for movie in movies {
    try Task.checkCancellation()      // throws CancellationError if cancelled
    await index(movie)
}
```

`URLSession`, `Task.sleep`, and most stdlib async operations honor cancellation automatically. Tight CPU loops do not — call `Task.checkCancellation()` periodically.

---

## Task groups

Use `withTaskGroup` for a dynamic number of children.

```swift
func fetchAll(ids: [String]) async throws -> [Movie] {
    try await withThrowingTaskGroup(of: Movie.self) { group in
        for id in ids {
            group.addTask { try await fetch(id: id) }
        }
        var result: [Movie] = []
        for try await movie in group { result.append(movie) }
        return result
    }
}
```

> **What's going on here**
> - `withThrowingTaskGroup(of: Movie.self)` — declares the child result type. The group throws if any child throws.
> - `for try await movie in group` — consume children as they complete, in any order.

---

## Actors

An `actor` serializes access to its mutable state. Calls from outside the actor are async; calls from inside are sync.

```swift
actor PlayHistory {
    private var watched: Set<String> = []

    func record(_ id: String) { watched.insert(id) }
    func has(_ id: String) -> Bool { watched.contains(id) }
}

let history = PlayHistory()
await history.record("tt-001")
let seen = await history.has("tt-001")
```

Actor methods cannot be called synchronously from outside — the `await` is mandatory. This is how the compiler proves no data race occurs.

---
type: exercise
kind: multiple_choice
pointsMax: 10
---
What is the relationship between a parent task and its children in structured concurrency?

- [ ] Children outlive the parent.
- [ ] Children run on a global queue independent of the parent.
- [x] Children must finish before the parent returns; cancelling the parent cancels them.
- [ ] Children must be awaited in declaration order.

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Write `loadInParallel(ids:)` that fetches each id concurrently using a task group and returns the results in any order.

```swift:starter
func fetch(id: String) async throws -> String {
    return "loaded-\(id)"
}

func loadInParallel(ids: [String]) async throws -> [String] {
    // TODO
    return []
}
```

```swift:solution
func fetch(id: String) async throws -> String {
    return "loaded-\(id)"
}

func loadInParallel(ids: [String]) async throws -> [String] {
    try await withThrowingTaskGroup(of: String.self) { group in
        for id in ids { group.addTask { try await fetch(id: id) } }
        var out: [String] = []
        for try await result in group { out.append(result) }
        return out
    }
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testLoadInParallel() async throws {
        let results = try await loadInParallel(ids: ["a", "b", "c"])
        XCTAssertEqual(Set(results), ["loaded-a", "loaded-b", "loaded-c"])
    }
}
```

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Write an actor `Counter` with `increment()` and a read-only `value` accessor. The state must be safe under concurrent calls.

```swift:starter
actor Counter {
    // TODO
}
```

```swift:solution
actor Counter {
    private(set) var value: Int = 0
    func increment() { value += 1 }
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testActorIncrement() async {
        let c = Counter()
        await withTaskGroup(of: Void.self) { group in
            for _ in 0..<100 { group.addTask { await c.increment() } }
        }
        let v = await c.value
        XCTAssertEqual(v, 100)
    }
}
```

---
type: exercise
kind: fix_bug
pointsMax: 40
language: swift
---
The function should run both fetches concurrently but is running them serially. Fix it.

```swift:broken
func fetchOne() async -> Int { 1 }
func fetchTwo() async -> Int { 2 }

func sum() async -> Int {
    let a = await fetchOne()
    let b = await fetchTwo()
    return a + b
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testSum() async {
        let total = await sum()
        XCTAssertEqual(total, 3)
    }
}
```

---
type: exercise
kind: fill_blank
pointsMax: 20
language: swift
blanks:
  "1": ["actor"]
---
Pick the keyword that defines a type whose mutable state is automatically serialized.

```swift:starter
___1___ Counter {
    var value = 0
    func bump() { value += 1 }
}
```

---
type: recap
---

## What you learned

**Concepts:** structured task trees · `async let` for fixed-fan-out · `withTaskGroup` for dynamic-fan-out · cooperative cancellation · `actor` for race-free shared state

**Swift-specific vs other languages:** JavaScript's `Promise.all` returns a single combined promise; Swift's `async let` enforces structured lifetimes — the parent cannot return while children run. Actors provide compile-time race safety without locks or mutexes.

**What's next:** Week 3 starts SwiftUI. From here on, every lesson builds toward the streaming app shell.
