---
type: lesson
title: Protocols Deep — Associated Types & Existentials
level: intermediate
summary: Associated types, primary associated types, existentials with `any`, and opaque returns with `some`.
---

## Associated types

A protocol with an `associatedtype` is a *family* of protocols, one per concrete associated type. The constraint is: any type that conforms must commit to a concrete associated type.

```swift
protocol Cache {
    associatedtype Value
    func get(_ key: String) -> Value?
    mutating func set(_ key: String, _ value: Value)
}

struct StringCache: Cache {
    private var store: [String: String] = [:]
    func get(_ key: String) -> String? { store[key] }
    mutating func set(_ key: String, _ value: String) { store[key] = value }
}
```

Associated types differ from generic parameters: the conforming type *picks* the type once. Callers cannot supply it.

> **Coming from Java:** `associatedtype` is closer to a Java generic parameter declared on the *implementor* than on the interface. Java's `interface Cache<V>` is parametric at the call site; Swift's `associatedtype Value` is fixed by the conformer.

---

## `some` vs `any`

`some Cache` returns an opaque concrete type — the compiler knows which type, the caller does not. Zero overhead.

`any Cache` is an existential — a runtime box that can hold *any* conforming type. Has indirection cost and can only be used where the protocol's associated types are erased or constrained.

```swift
func makeCache() -> some Cache { StringCache() }     // opaque, zero cost
func loadCache() -> any Cache { StringCache() }      // existential, boxed
```

> **What's going on here**
> - `some Cache` — single concrete type, fixed at compile time, but hidden from the caller.
> - `any Cache` — runtime box; allows heterogeneous storage at the cost of dynamic dispatch.

---

## Primary associated types

A protocol can expose its main associated type as a *primary* type using angle brackets, so callers can constrain it without `where` clauses.

```swift
protocol Loader<Item> {
    associatedtype Item
    func load() async throws -> [Item]
}

func render(loader: any Loader<Movie>) { /* ... */ }
```

Use this whenever an associated type is the public surface — it's how SwiftUI's `View` body type is parameterized.

---
type: exercise
kind: multiple_choice
pointsMax: 10
---
Which return type returns a single, fixed concrete type but hides it from the caller?

- [ ] `any Cache`
- [x] `some Cache`
- [ ] `Cache`
- [ ] `Cache<Any>`

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Define a protocol `Identifiable2` with an `associatedtype ID: Hashable` and a `var id: ID { get }` requirement. Make `Movie` (with a `String` id) conform.

```swift:starter
// Define Identifiable2 here

struct Movie {
    let id: String
}
```

```swift:solution
protocol Identifiable2 {
    associatedtype ID: Hashable
    var id: ID { get }
}

struct Movie: Identifiable2 {
    let id: String
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testConformance() {
        let m = Movie(id: "tt-001")
        XCTAssertEqual(m.id, "tt-001")
    }
}
```

---
type: exercise
kind: fix_bug
pointsMax: 40
language: swift
---
Fix the function so it compiles. The protocol has an associated type — return it opaquely.

```swift:broken
protocol Producer {
    associatedtype Output
    func make() -> Output
}

struct IntProducer: Producer {
    func make() -> Int { 42 }
}

func defaultProducer() -> Producer {
    return IntProducer()
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testProducer() {
        let p = defaultProducer()
        XCTAssertEqual(p.make(), 42)
    }
}
```

---
type: exercise
kind: fill_blank
pointsMax: 20
language: swift
blanks:
  "1": ["any"]
---
Fill in the keyword that makes the parameter accept any conforming type at runtime.

```swift:starter
protocol Renderer { func render() -> String }

func print(using r: ___1___ Renderer) {
    print(r.render())
}
```

---
type: exercise
kind: predict_output
pointsMax: 15
language: swift
expectedOutput: "string"
---
What does this print?

```swift:starter
protocol Tagged {
    associatedtype Tag
    var tag: Tag { get }
}

struct Note: Tagged {
    let tag: String = "string"
}

let n = Note()
print(n.tag)
```

---
type: recap
---

## What you learned

**Concepts:** Associated types as compile-time families · `some` for opaque concrete returns · `any` for runtime existentials · primary associated types for clean generic surfaces

**Swift-specific vs other languages:** Java generics are parametric at the call site; Swift's `associatedtype` is fixed by the conforming type. `some` has no Java/C++ equivalent — it gives zero-cost protocol abstraction.

**What's next:** Lesson 02 covers generics with constraints and `where` clauses, used heavily in the networking layer.
