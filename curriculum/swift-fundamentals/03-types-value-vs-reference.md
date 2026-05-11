---
type: lesson
title: Types & Value vs Reference
level: beginner
summary: Swift's primitive types, tuples, and the struct/class divide — where value semantics end and reference semantics begin.
---

## Primitive types

Swift's four everyday primitives: `Int`, `Double`, `String`, `Bool`. You declared these with `let`/`var` in Lesson 01; here the focus is on what they are.

```swift
let count: Int = 10
let ratio: Double = 0.75
let label: String = "Swift"
let enabled: Bool = true
```

Type inference (Lesson 01) handles the annotation for you when the literal makes the type unambiguous — `let count = 10` infers `Int`. Annotate when the default is wrong for your use: `let ratio: Double = 1` forces the integer literal `1` to become `Double`.

`Int` size is platform-native: 64-bit on all modern Apple hardware. Use `Int` unless you have a concrete reason for a sized variant (`Int32`, `Int64`).

## Tuples

Tuples bundle values without defining a named type. Elements are positional by default; you can name them for readability. Named member access was introduced in Lesson 02 as a return strategy — here the focus is on tuples as standalone values.

```swift
let point = (3, 4)           // positional: point.0 == 3, point.1 == 4
let named = (x: 3, y: 4)    // named: named.x == 3, named.y == 4
```

> **What's going on here**
> - `point.0` / `point.1` — positional access by zero-based index.
> - `named.x` / `named.y` — named access; no integer subscripting needed.

Tuples are not suitable as persistent data models. Use them for lightweight, short-lived groupings — return values, local decomposition, and nothing more.

## struct vs class — the value/reference divide

This is the central type decision in Swift.

**`struct`** is a value type. Every assignment or function call copies the value. Changes to the copy do not affect the original.

**`class`** is a reference type. Assignment copies the reference, not the data. Two variables can point to the same object; a mutation through one is visible through the other.

```swift
struct Point {
    var x: Int
    var y: Int
}

var a = Point(x: 0, y: 0)
var b = a        // b is a full copy
b.x = 99
print(a.x)       // 0 — a is unchanged
print(b.x)       // 99 — b is its own copy

class Counter {
    var value: Int = 0
}

let c1 = Counter()
let c2 = c1      // c2 holds the same object
c2.value = 42
print(c1.value)  // 42 — same object, mutation visible through c1
```

> **Coming from Java:** Java classes are always reference types; there is no built-in value type for user-defined data. Swift structs give you the semantics Java reserves for primitives (`int`, `double`) but for any user-defined type. Defaulting to `struct` — the opposite of Java's default — is the idiomatic Swift choice.

## Identity vs equality — `===` vs `==`

`==` tests whether two values are equal in content (requires `Equatable` conformance).

`===` tests whether two reference-type variables point to the exact same object in memory. It is only valid for `class` instances.

```swift
class Box {
    var value: Int
    init(_ v: Int) { value = v }
}

let x = Box(5)
let y = Box(5)
let z = x

print(x === y)   // false — different objects, same content
print(x === z)   // true  — same object
```

> **What's going on here**
> - `===` is the identity operator. Structs do not support it — they have no identity, only value.
> - `==` on a `class` must be explicitly implemented via `Equatable`. Without it, the compiler won't accept `==` on your class.

`struct` types that conform to `Equatable` use `==` for content comparison. There is no `===` for structs.

## When to use struct vs class

Default to `struct`. Use `class` only when one of the following is true:

- The type models shared mutable state (e.g., a network session, a cache, a view controller).
- The type needs to participate in an inheritance hierarchy.
- You are bridging to Objective-C API that requires `NSObject` subclassing.

Swift's standard library is built almost entirely on value types: `String`, `Int`, `Array`, `Dictionary` are all structs.
---
type: exercise
kind: predict_output
pointsMax: 15
language: swift
expectedOutput: "0"
---
What does this print?

```swift:starter
struct Score {
    var points: Int
}

var s1 = Score(points: 0)
var s2 = s1
s2.points = 100
print(s1.points)
```
---
type: exercise
kind: multiple_choice
pointsMax: 10
---
Which statement about Swift structs is correct?

- [x] Assigning a struct to a new variable produces an independent copy.
- [ ] Two struct variables can share the same underlying data.
- [ ] `===` can be used to compare any two struct values.
- [ ] Struct instances are always allocated on the heap.
---
type: exercise
kind: fill_blank
pointsMax: 20
language: swift
blanks:
  "1": ["struct"]
---
Fill in the keyword so `Rectangle` is a value type.

```swift:starter
___1___ Rectangle {
    var width: Double
    var height: Double
}
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
class Node {
    var value: Int
    init(_ v: Int) { value = v }
}

let n1 = Node(7)
let n2 = n1
print(n1 === n2)
```
---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Define a `struct Temperature` with stored `celsius: Double` and a computed `fahrenheit` property returning `celsius * 9 / 5 + 32`.

```swift:starter
struct Temperature {
    var celsius: Double
    // Add computed property here
}
```

```swift:solution
struct Temperature {
    var celsius: Double
    var fahrenheit: Double {
        return celsius * 9 / 5 + 32
    }
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testBoiling() {
        let t = Temperature(celsius: 100)
        XCTAssertEqual(t.fahrenheit, 212.0, accuracy: 0.001)
    }
    func testFreezing() {
        let t = Temperature(celsius: 0)
        XCTAssertEqual(t.fahrenheit, 32.0, accuracy: 0.001)
    }
}
```
---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Define a `class BankAccount` with stored `balance: Int = 0` and a `deposit(amount: Int)` method that increases `balance` by `amount`.

```swift:starter
class BankAccount {
    var balance: Int = 0
    // Add deposit method here
}
```

```swift:solution
class BankAccount {
    var balance: Int = 0
    func deposit(amount: Int) {
        balance += amount
    }
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testDeposit() {
        let account = BankAccount()
        account.deposit(amount: 100)
        XCTAssertEqual(account.balance, 100)
    }
    func testSharedReference() {
        let a = BankAccount()
        let b = a
        b.deposit(amount: 50)
        XCTAssertEqual(a.balance, 50)
    }
}
```
---
type: exercise
kind: fix_bug
pointsMax: 40
language: swift
---
Fix the struct so `increment()` can mutate `count` while `Counter` remains a `struct`.

```swift:broken
struct Counter {
    var count: Int = 0
    func increment() {
        count += 1
    }
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testIncrementsCorrectly() {
        var c = Counter()
        c.increment()
        c.increment()
        XCTAssertEqual(c.count, 2)
    }
    func testStartsAtZero() {
        let c = Counter()
        XCTAssertEqual(c.count, 0)
    }
}
```
---
type: exercise
kind: predict_output
pointsMax: 15
language: swift
expectedOutput: "false"
---
What does this print?

```swift:starter
class Label {
    var text: String
    init(_ t: String) { text = t }
}

let p = Label("hello")
let q = Label("hello")
print(p === q)
```
---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Define a `struct Interval` with `start: Int`, `end: Int`, and an `overlaps(_ other: Interval) -> Bool` method that returns `true` when the two intervals share at least one point.

```swift:starter
struct Interval {
    let start: Int
    let end: Int
    func overlaps(_ other: Interval) -> Bool {
        // TODO
    }
}
```

```swift:solution
struct Interval {
    let start: Int
    let end: Int
    func overlaps(_ other: Interval) -> Bool {
        return start <= other.end && other.start <= end
    }
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testOverlap() {
        let a = Interval(start: 1, end: 5)
        let b = Interval(start: 3, end: 7)
        XCTAssertTrue(a.overlaps(b))
    }
    func testNoOverlap() {
        let a = Interval(start: 1, end: 3)
        let b = Interval(start: 5, end: 8)
        XCTAssertFalse(a.overlaps(b))
    }
    func testTouching() {
        let a = Interval(start: 1, end: 4)
        let b = Interval(start: 4, end: 6)
        XCTAssertTrue(a.overlaps(b))
    }
}
```
---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Write a function `swapFields(point: inout (x: Int, y: Int))` that exchanges the `x` and `y` fields of the named tuple in place.

```swift:starter
func swapFields(point: inout (x: Int, y: Int)) {
    // TODO
}
```

```swift:solution
func swapFields(point: inout (x: Int, y: Int)) {
    let tmp = point.x
    point.x = point.y
    point.y = tmp
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testSwap() {
        var p = (x: 3, y: 7)
        swapFields(point: &p)
        XCTAssertEqual(p.x, 7)
        XCTAssertEqual(p.y, 3)
    }
    func testSymmetric() {
        var p = (x: 0, y: 0)
        swapFields(point: &p)
        XCTAssertEqual(p.x, 0)
        XCTAssertEqual(p.y, 0)
    }
}
```
---
type: recap
---

## What you learned

**Concepts:** `Int`, `Double`, `String`, `Bool` as Swift's core primitives · Positional and named tuples · `struct` as a value type — copy on assignment · `class` as a reference type — shared identity · `==` for content equality vs `===` for reference identity · `mutating` for struct methods that modify stored properties · When to reach for `struct` vs `class`

**Swift-specific vs other languages:** Java defaults every user-defined type to a reference type; Swift inverts that default — `struct` (value type) is the idiomatic choice and covers most use cases. The `===` identity operator has no Java equivalent because Java uses `==` for both primitive equality and object identity — Swift separates them cleanly with distinct operators.

**What's next:** Lesson 04 introduces optionals — Swift's compile-enforced mechanism for representing the absence of a value, replacing null-pointer patterns from Java and C++.
