---
type: lesson
title: Generics
level: intermediate
summary: Generic functions and types let you write algorithms once and apply them to any type that satisfies a compile-time constraint.
---

## Generic functions

A generic function declares a type parameter — a placeholder resolved by the compiler at each call site. Write the parameter in angle brackets after the function name:

```swift
func first<T>(_ array: [T]) -> T? {
    return array.first
}

print(first([10, 20, 30]) ?? -1)   // 10
print(first(["a", "b"]) ?? "")    // a
```

`T` is a convention, not a keyword. The compiler substitutes the concrete type at each call site and verifies type safety there — no casts, no runtime checks.

> **Coming from Python:** Python functions accept any argument at runtime — if you call `first(42)`, the error appears when the function body executes. Swift's generics are checked entirely at compile time: passing a non-array type to `first<T>(_:)` is a compile error you see before the program ever runs. The tradeoff is that the compiler needs explicit constraints (e.g., `<T: Comparable>`) rather than relying on duck typing.

---

## Type constraints

Without a constraint, the compiler knows nothing about `T` except that it exists. To call operators or methods on `T` values, add a constraint:

```swift
func minOf<T: Comparable>(_ a: T, _ b: T) -> T {
    return a < b ? a : b
}

print(minOf(3, 7))         // 3
print(minOf("b", "a"))     // a
```

`<T: Comparable>` means "T must conform to `Comparable`" (from Lesson 08). Without it, `a < b` is a compile error — the compiler cannot prove `<` exists on an unknown type.

Common constraints:
- `Equatable` — `==` and `!=`
- `Comparable` — `<`, `>`, `<=`, `>=`
- `Hashable` — usable as a `Set` element or `Dictionary` key (from Lesson 05)

> **What's going on here**
> - `<T: Hashable>` is required whenever you put `T` into a `Set<T>` or use it as a dictionary key. `Set` requires its element type to be `Hashable` so it can compute bucket positions. Without this constraint the compiler rejects `Set(array)` immediately.

---

## Multiple type parameters and `where` clauses

A function can carry several type parameters:

```swift
func zip2<A, B>(_ a: [A], _ b: [B]) -> [(A, B)] {
    return Swift.zip(a, b).map { ($0.0, $0.1) }
}
```

For constraints that are more complex than a simple conformance, use a `where` clause after the parameter list:

```swift
func allEqual<T>(_ array: [T]) -> Bool where T: Equatable {
    guard let first = array.first else { return true }
    return array.allSatisfy { $0 == first }
}
```

> **What's going on here**
> - `where T: Equatable` is equivalent to `<T: Equatable>` for a single conformance, but `where` composes cleanly when you have multiple conditions — e.g., `where T: Hashable, U: Comparable`. Prefer inline `<T: Protocol>` for a single, simple constraint and `where` for anything more involved.

---

## Generic types

You already use generic types from Lesson 05: `Array<Element>`, `Dictionary<Key, Value>`, and `Set<Element>`. You can define your own:

```swift
struct Stack<Element> {
    private var storage: [Element] = []

    mutating func push(_ value: Element) {
        storage.append(value)
    }

    mutating func pop() -> Element? {
        return storage.popLast()
    }

    func peek() -> Element? {
        return storage.last
    }
}

var stack = Stack<Int>()
stack.push(1)
stack.push(2)
print(stack.peek() ?? -1)   // 2
print(stack.pop() ?? -1)    // 2
print(stack.peek() ?? -1)   // 1
```

The type parameter `Element` is declared on the struct itself and is in scope for all its methods.

---

## Associated types on protocols — full coverage

Lesson 08 previewed `associatedtype`. A protocol with an associated type is a generic contract: the conforming type declares what the placeholder resolves to.

```swift
protocol Container {
    associatedtype Element
    var first: Element? { get }
    mutating func append(_ element: Element)
}

struct Bag<T>: Container {
    typealias Element = T
    private var items: [T] = []

    var first: T? { items.first }

    mutating func append(_ element: T) {
        items.append(element)
    }
}
```

`associatedtype` is how `Sequence`, `Collection`, and `IteratorProtocol` in the Swift standard library are generic — they describe a contract without fixing the element type.

---

## Opaque types — `some Type`

Swift 5.7 added opaque return types: `some Protocol`. A function returning `some Equatable` promises the caller it returns a single concrete type that conforms to `Equatable`, without revealing which type. This is the primary mechanism behind SwiftUI's `some View`. Exercises in this lesson do not cover opaque types — the full story belongs in a SwiftUI-oriented lesson.

---
type: exercise
kind: predict_output
pointsMax: 15
language: swift
expectedOutput: "1"
---
What does this print?

```swift:starter
func first<T>(_ array: [T]) -> T? { array.first }
print(first([1, 2, 3]) ?? -1)
```

---
type: exercise
kind: predict_output
pointsMax: 15
language: swift
expectedOutput: "true"
---
What does this print?

```swift:starter
func areEqual<T: Equatable>(_ a: T, _ b: T) -> Bool { a == b }
print(areEqual("a", "a"))
```

---
type: exercise
kind: predict_output
pointsMax: 15
language: swift
expectedOutput: "[42]"
---
What does this print?

```swift:starter
func wrap<T>(_ x: T) -> [T] { [x] }
print(wrap(42))
```

---
type: exercise
kind: multiple_choice
pointsMax: 10
---
Why does this function fail to compile?

```swift
func contains<T>(_ array: [T], _ value: T) -> Bool {
    array.contains(value)
}
```

- [ ] `T` must be a class type.
- [x] `T` needs an `Equatable` constraint — `contains(_:)` requires elements to be `Equatable`.
- [ ] Swift arrays do not have a `contains` method.
- [ ] Every generic function requires a `where` clause.

---
type: exercise
kind: fill_blank
pointsMax: 20
language: swift
blanks:
  "1": ["Hashable"]
---
Fill in the constraint that allows the array to be deduplicated via a `Set`.

```swift:starter
func dedupe<T: ___1___>(_ array: [T]) -> [T] {
    Array(Set(array))
}
```

---
type: exercise
kind: fix_bug
pointsMax: 40
---
Fix the function so it compiles — the comparison requires a type constraint.

```swift:broken
func same<T>(_ a: T, _ b: T) -> Bool {
    a == b
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testInts() {
        XCTAssertTrue(same(3, 3))
        XCTAssertFalse(same(3, 4))
    }
    func testStrings() {
        XCTAssertTrue(same("swift", "swift"))
        XCTAssertFalse(same("swift", "kotlin"))
    }
}
```

---
type: exercise
kind: code
pointsMax: 50
---
Write `func minOf<T: Comparable>(_ a: T, _ b: T) -> T` returning the smaller of two values.

```swift:starter
func minOf<T: Comparable>(_ a: T, _ b: T) -> T {
    // TODO
}
```

```swift:solution
func minOf<T: Comparable>(_ a: T, _ b: T) -> T {
    return a < b ? a : b
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testInts() {
        XCTAssertEqual(minOf(3, 7), 3)
        XCTAssertEqual(minOf(7, 3), 3)
    }
    func testStrings() {
        XCTAssertEqual(minOf("b", "a"), "a")
        XCTAssertEqual(minOf("a", "b"), "a")
    }
    func testDoubles() {
        XCTAssertEqual(minOf(2.5, 1.5), 1.5, accuracy: 0.001)
    }
    func testEqual() {
        XCTAssertEqual(minOf(5, 5), 5)
    }
}
```

---
type: exercise
kind: code
pointsMax: 50
---
Write `func indexOf<T: Equatable>(_ value: T, in array: [T]) -> Int?` returning the first index where `array[i] == value`, or `nil` if absent.

```swift:starter
func indexOf<T: Equatable>(_ value: T, in array: [T]) -> Int? {
    // TODO
}
```

```swift:solution
func indexOf<T: Equatable>(_ value: T, in array: [T]) -> Int? {
    for (i, element) in array.enumerated() {
        if element == value { return i }
    }
    return nil
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testFound() {
        XCTAssertEqual(indexOf(3, in: [1, 2, 3, 4]), 2)
    }
    func testFirstOccurrence() {
        XCTAssertEqual(indexOf("a", in: ["b", "a", "a"]), 1)
    }
    func testAbsent() {
        XCTAssertNil(indexOf(9, in: [1, 2, 3]))
    }
    func testEmpty() {
        XCTAssertNil(indexOf(1, in: []))
    }
}
```

---
type: exercise
kind: code
pointsMax: 50
---
Write a generic `Stack<Element>` struct with `mutating func push(_ value: Element)`, `mutating func pop() -> Element?`, and `func peek() -> Element?`.

```swift:starter
struct Stack<Element> {
    // TODO
}
```

```swift:solution
struct Stack<Element> {
    private var storage: [Element] = []

    mutating func push(_ value: Element) {
        storage.append(value)
    }

    mutating func pop() -> Element? {
        return storage.popLast()
    }

    func peek() -> Element? {
        return storage.last
    }
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testPushAndPeek() {
        var s = Stack<Int>()
        s.push(10)
        s.push(20)
        XCTAssertEqual(s.peek(), 20)
    }
    func testPop() {
        var s = Stack<String>()
        s.push("a")
        s.push("b")
        XCTAssertEqual(s.pop(), "b")
        XCTAssertEqual(s.pop(), "a")
        XCTAssertNil(s.pop())
    }
    func testEmptyPeek() {
        let s = Stack<Int>()
        XCTAssertNil(s.peek())
    }
    func testLIFOOrder() {
        var s = Stack<Int>()
        for i in 1...4 { s.push(i) }
        var result: [Int] = []
        while let v = s.pop() { result.append(v) }
        XCTAssertEqual(result, [4, 3, 2, 1])
    }
}
```

---
type: exercise
kind: code
pointsMax: 50
---
Write `func mostFrequent<T: Hashable>(_ array: [T]) -> T?` returning the value that appears most often, or `nil` for an empty array.

```swift:starter
func mostFrequent<T: Hashable>(_ array: [T]) -> T? {
    // TODO
}
```

```swift:solution
func mostFrequent<T: Hashable>(_ array: [T]) -> T? {
    guard !array.isEmpty else { return nil }
    var freq: [T: Int] = [:]
    for item in array {
        freq[item] = (freq[item] ?? 0) + 1
    }
    return freq.max(by: { $0.value < $1.value })?.key
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testInts() {
        XCTAssertEqual(mostFrequent([1, 2, 2, 3]), 2)
    }
    func testStrings() {
        XCTAssertEqual(mostFrequent(["a", "b", "b", "b", "a"]), "b")
    }
    func testEmpty() {
        XCTAssertNil(mostFrequent([Int]()))
    }
    func testSingleElement() {
        XCTAssertEqual(mostFrequent([42]), 42)
    }
}
```

---
type: recap
---

## What you learned

**Concepts:**
- Generic functions with type parameters (`<T>`)
- Type constraints (`<T: Comparable>`, `<T: Equatable>`, `<T: Hashable>`)
- `where` clauses for compound constraints
- Generic types (`struct Stack<Element>`)
- Associated types on protocols (`associatedtype Element`)

**Swift-specific vs other languages:** Python's duck typing accepts any argument at runtime and surfaces errors during execution. Swift's generics are resolved entirely at compile time — the constraint system (`<T: Equatable>`, `<T: Hashable>`) makes missing capabilities a compile error, eliminating a whole class of runtime type failures before the program runs.

**What's next:** Lesson 10 covers error handling — `throws`, `try`, and `catch` — including how generic functions interact with throwing code.
