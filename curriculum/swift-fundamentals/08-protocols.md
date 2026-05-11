---
type: lesson
title: Protocols & Extensions
level: beginner
summary: Protocols define requirements that any conforming type must satisfy; extensions add methods to existing types and supply default implementations to protocols.
---

## Declaring a protocol

A protocol lists property and method requirements without providing any implementation. Any type that declares conformance must satisfy all of them.

```swift
protocol Greet {
    func hello() -> String
}

struct Hi: Greet {
    func hello() -> String { "hi" }
}

print(Hi().hello())   // hi
```

Conformance is declared with a colon after the type name — the same syntax as struct/class definitions (from Lesson 03). The compiler verifies every requirement is satisfied; a missing method is a compile error.

> **Coming from C++:** A C++ abstract class (`class Drawable { virtual void draw() = 0; }`) carries the class overhead: heap allocation, a vtable per instance, and single-root inheritance. Swift protocols have none of that. A `struct` — a value type on the stack — can conform to a protocol. Multiple protocols compose with `&` instead of virtual inheritance. Protocol conformance does not require a shared base class, and adding a protocol to an existing type you do not own (retroactive conformance) requires no modification to that type's source.

---

## Default implementations via protocol extensions

Extend a protocol to supply a default implementation for any requirement (or any additional method). Conforming types inherit the default; they can override it by defining their own version.

```swift
protocol Counter {
    var count: Int { get }
}

extension Counter {
    func describe() -> String {
        return "count: \(count)"
    }
}

struct Tally: Counter {
    let count: Int
}

print(Tally(count: 7).describe())   // count: 7
```

> **What's going on here**
> - `extension Counter { ... }` — this adds `describe()` to every type that already conforms to `Counter`. `Tally` does not define `describe()`, so it inherits the default.
> - `{ get }` in the property requirement means the conforming type may use either `let` or a computed `var` — it only promises the value is readable.

---

## Extending existing types

`extension` also adds methods (and computed properties) to types you did not write — including Swift's own types. This is called **retroactive conformance** when it adds protocol conformance, or a plain extension when it adds utility methods.

```swift
extension Int {
    var doubled: Int { self * 2 }
}

print(5.doubled)   // 10
```

> **What's going on here**
> - `self` inside an extension on a value type refers to the current instance. For `Int`, `self` is the integer the method is called on. The extension cannot store new state — only computed properties and methods are allowed.

---

## Protocol composition with &

A function parameter or variable can require conformance to multiple protocols simultaneously using `&`:

```swift
protocol Named {
    var name: String { get }
}

protocol Aged {
    var age: Int { get }
}

func introduce(_ entity: Named & Aged) -> String {
    return "\(entity.name), \(entity.age)"
}

struct Person: Named, Aged {
    let name: String
    let age: Int
}

print(introduce(Person(name: "Ada", age: 36)))   // Ada, 36
```

`Named & Aged` is a composition type — not a new protocol, not a base class. Any type satisfying both protocols qualifies, regardless of where or how it was defined.

---

## Protocol-oriented design

Prefer protocols + value types over inheritance hierarchies. A protocol describes *what a type can do*, not *what it is*. This yields narrow, composable contracts instead of wide, rigid class trees.

```swift
protocol Drawable {
    func draw()
}

protocol Resizable {
    func resize(by factor: Double)
}

struct Square: Drawable, Resizable {
    var side: Double

    func draw() {
        print("Square(\(side))")
    }

    func resize(by factor: Double) {
        // mutating omitted for brevity
    }
}
```

A type can conform to as many protocols as needed. Conformance is structural — there is no common ancestor required.

---

## Associated types — a preview

A protocol can declare a placeholder type using `associatedtype`. The conforming type supplies the concrete type. Full coverage is in Lesson 09 (Generics); the syntax looks like this:

```swift
protocol Container {
    associatedtype Element
    var first: Element? { get }
}
```

You will see `associatedtype` in Swift's standard library (`Collection`, `Sequence`, `IteratorProtocol`). For now, knowing it exists is enough — Lesson 09 builds on it.

---
type: exercise
kind: predict_output
pointsMax: 15
language: swift
expectedOutput: "hi"
---
What does this print?

```swift:starter
protocol Greet {
    func hello() -> String
}

struct Hi: Greet {
    func hello() -> String { "hi" }
}

print(Hi().hello())
```

---
type: exercise
kind: predict_output
pointsMax: 15
language: swift
expectedOutput: "count: 7"
---
What does this print?

```swift:starter
protocol Counter {
    var count: Int { get }
}

extension Counter {
    func describe() -> String {
        return "count: \(count)"
    }
}

struct Tally: Counter {
    let count: Int
}

print(Tally(count: 7).describe())
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
extension Int {
    var doubled: Int { self * 2 }
}

print(5.doubled)
```

---
type: exercise
kind: multiple_choice
pointsMax: 10
---
Which statement about Swift protocols is true?

- [ ] Protocols can include stored properties.
- [x] Protocols define requirements that conforming types must satisfy.
- [ ] A type can conform to at most one protocol.
- [ ] Protocols can be instantiated with `Protocol()`.

---
type: exercise
kind: fill_blank
pointsMax: 20
language: swift
blanks:
  "1": ["protocol"]
---
Fill in the keyword to declare a protocol named `Drawable`.

```swift:starter
___1___ Drawable {
    func draw()
}
```

---
type: exercise
kind: fix_bug
pointsMax: 40
language: swift
---
Fix the struct so it fully satisfies the `Labeled` protocol; `describe()` must return `"label: \(label)"` where `\(label)` is the stored label value.

```swift:broken
protocol Labeled {
    var label: String { get }
    func describe() -> String
}

struct Tag: Labeled {
    let label: String
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testDescribe() {
        let t = Tag(label: "swift")
        XCTAssertEqual(t.describe(), "label: swift")
    }
    func testLabel() {
        let t = Tag(label: "protocols")
        XCTAssertEqual(t.label, "protocols")
    }
}
```

---
type: exercise
kind: fix_bug
pointsMax: 40
language: swift
---
Fix the struct method so the default implementation from the protocol extension is not accidentally shadowed by a wrong return type.

```swift:broken
protocol Summarizable {
    var title: String { get }
}

extension Summarizable {
    func summary() -> String {
        return "Title: \(title)"
    }
}

struct Article: Summarizable {
    let title: String
    func summary() -> Int {
        return 0
    }
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testSummaryIsString() {
        let a = Article(title: "Protocols in Swift")
        XCTAssertEqual(a.summary(), "Title: Protocols in Swift")
    }
    func testAnotherTitle() {
        let a = Article(title: "Extensions")
        XCTAssertEqual(a.summary(), "Title: Extensions")
    }
}
```

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Define a protocol `Equilateral` with `sides: Int` and `sideLength: Double` requirements, a `struct Triangle: Equilateral` with `sides` fixed at `3`, and a protocol extension that adds `perimeter() -> Double` returning `Double(sides) * sideLength`.

```swift:starter
protocol Equilateral {
    var sides: Int { get }
    var sideLength: Double { get }
}

// Add Triangle here

// Add protocol extension with perimeter() here
```

```swift:solution
protocol Equilateral {
    var sides: Int { get }
    var sideLength: Double { get }
}

extension Equilateral {
    func perimeter() -> Double {
        return Double(sides) * sideLength
    }
}

struct Triangle: Equilateral {
    let sides: Int = 3
    let sideLength: Double
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testPerimeter() {
        let t = Triangle(sideLength: 4)
        XCTAssertEqual(t.perimeter(), 12.0, accuracy: 0.001)
    }
    func testSides() {
        let t = Triangle(sideLength: 1)
        XCTAssertEqual(t.sides, 3)
    }
    func testZeroSideLength() {
        let t = Triangle(sideLength: 0)
        XCTAssertEqual(t.perimeter(), 0.0, accuracy: 0.001)
    }
}
```

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Define a protocol `Tagged` with a `tag: String` property requirement. Define `struct Item: Tagged` and `struct Folder: Tagged`, each storing `tag: String`. Write `tagsOf(_ items: [any Tagged]) -> [String]` returning the `tag` of each element. Test with a mixed array of `Item` and `Folder` values.

```swift:starter
protocol Tagged {
    var tag: String { get }
}

struct Item: Tagged {
    // TODO
}

struct Folder: Tagged {
    // TODO
}

func tagsOf(_ items: [any Tagged]) -> [String] {
    // TODO
}
```

```swift:solution
protocol Tagged {
    var tag: String { get }
}

struct Item: Tagged {
    let tag: String
}

struct Folder: Tagged {
    let tag: String
}

func tagsOf(_ items: [any Tagged]) -> [String] {
    return items.map { $0.tag }
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testMixedArray() {
        let items: [any Tagged] = [
            Item(tag: "swift"),
            Folder(tag: "projects"),
            Item(tag: "protocols"),
        ]
        XCTAssertEqual(tagsOf(items), ["swift", "projects", "protocols"])
    }
    func testEmpty() {
        XCTAssertEqual(tagsOf([]), [])
    }
    func testSingleFolder() {
        let items: [any Tagged] = [Folder(tag: "inbox")]
        XCTAssertEqual(tagsOf(items), ["inbox"])
    }
}
```

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Define a protocol `Named` requiring `name: String` and a protocol `Scored` requiring `score: Int`. Write a function `leaderboard(_ entries: [any Named & Scored]) -> [String]` that returns names sorted by `score` descending.

```swift:starter
protocol Named {
    var name: String { get }
}

protocol Scored {
    var score: Int { get }
}

func leaderboard(_ entries: [any Named & Scored]) -> [String] {
    // TODO
}
```

```swift:solution
protocol Named {
    var name: String { get }
}

protocol Scored {
    var score: Int { get }
}

func leaderboard(_ entries: [any Named & Scored]) -> [String] {
    return entries.sorted { $0.score > $1.score }.map { $0.name }
}
```

```swift:test
import XCTest

struct Player: Named, Scored {
    let name: String
    let score: Int
}

final class Tests: XCTestCase {
    func testSortedDescending() {
        let players: [any Named & Scored] = [
            Player(name: "Ada", score: 80),
            Player(name: "Grace", score: 95),
            Player(name: "Alan", score: 70),
        ]
        XCTAssertEqual(leaderboard(players), ["Grace", "Ada", "Alan"])
    }
    func testSingleEntry() {
        let players: [any Named & Scored] = [Player(name: "Solo", score: 42)]
        XCTAssertEqual(leaderboard(players), ["Solo"])
    }
    func testEmpty() {
        XCTAssertEqual(leaderboard([]), [])
    }
}
```

---
type: recap
---

## What you learned

**Concepts:** Protocol declaration with method and property requirements · Conforming a struct or class to a protocol · Default implementations via `extension` on the protocol · Extending existing types retroactively · Protocol composition with `&` and multiple conformance · Protocol-oriented design — protocols + value types over inheritance hierarchies

**Swift-specific vs other languages:** C++ abstract classes are tied to the class hierarchy, require virtual dispatch, and live on the heap. Swift protocols work with value types (structs), support retroactive conformance on types you do not own, and compose cleanly with `&` rather than multiple inheritance. There is no shared base class requirement.

**What's next:** Lesson 09 introduces generics — type parameters, generic functions, and the full story of associated types that protocols teased here.
