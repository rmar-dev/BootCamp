---
type: lesson
title: Closures
level: beginner
summary: Swift closures are first-class function values with concise expression syntax, trailing-closure sugar, and capture semantics that differ meaningfully from Java lambdas.
---

## Closure expression syntax

A closure is an anonymous function that can be stored in a variable, passed as an argument, or returned from another function (from Lesson 02). The full expression form is:

```swift
{ (params) -> ReturnType in
    body
}
```

```swift
let double = { (x: Int) -> Int in
    return x * 2
}
print(double(5))   // 10
```

The types here are written explicitly to show the structure. In practice, Swift infers them when context makes them unambiguous.

---

## Type inference — shedding annotations

When a closure is passed where the compiler already knows the expected function type, both parameter types and the return type can be omitted. The `return` keyword can also be dropped when the body is a single expression.

```swift
let nums = [3, 1, 4, 1, 5]

// Full form
let sorted1 = nums.sorted(by: { (a: Int, b: Int) -> Bool in return a < b })

// Drop parameter types and return type
let sorted2 = nums.sorted(by: { a, b in a < b })

// Use shorthand argument names
let sorted3 = nums.sorted(by: { $0 < $1 })
```

> **What's going on here**
> - `{ a, b in a < b }` — the compiler already knows `.sorted(by:)` takes `(Int, Int) -> Bool`, so both parameter types and the return type are inferred. `in` separates the parameter list from the body.

---

## Shorthand argument names — $0, $1

When parameter names are not needed in the body, replace them with positional shorthand: `$0` for the first argument, `$1` for the second, and so on. The `in` keyword is dropped along with the parameter list.

```swift
let doubled = [1, 2, 3].map { $0 * 2 }       // [2, 4, 6]
let evens   = [1, 2, 3, 4].filter { $0 % 2 == 0 }  // [2, 4]
```

> **What's going on here**
> - `$0` — shorthand for the first closure argument. No explicit parameter declaration is needed when you use shorthand names; Swift fills them in automatically based on the expected function type.

> **Coming from Java:** Java lambdas require an explicit parameter list: `(x) -> x * 2`. Swift's shorthand argument names (`$0`, `$1`) let you skip that entirely — `{ $0 * 2 }` is valid at any call site where the argument type is already known. Java also has no trailing-closure syntax, so the argument always appears inside the method's parentheses. In Swift, when a closure is the last argument to a function, it can be written outside and after the closing parenthesis — this is trailing closure syntax:
>
> ```swift
> // Without trailing syntax
> [1, 2, 3].map({ $0 * 2 })
>
> // With trailing syntax — the closure moves outside the parentheses
> [1, 2, 3].map { $0 * 2 }
> ```
>
> When the closure is the only argument, the parentheses disappear entirely. Java has no equivalent shorthand.

---

## Operator method shorthand

Binary operators like `<` and `>` are functions of type `(T, T) -> Bool` in Swift. Pass them directly wherever a two-argument predicate is expected:

```swift
let ascending  = [3, 1, 2].sorted(by: <)   // [1, 2, 3]
let descending = [3, 1, 2].sorted(by: >)   // [3, 2, 1]
```

---

## Closures capture values

A closure captures the variables in its surrounding scope. For `var` bindings, capture is by reference — the closure sees and modifies the same storage as the outer scope.

```swift
var counter = 0
let increment = { counter += 1 }

increment()
increment()
print(counter)   // 2
```

This is distinct from Java lambda capture, which requires effectively-final variables; Swift closures capture `var` freely.

---

## @escaping — when a closure outlives the call

By default, a closure parameter is **non-escaping**: the compiler guarantees it will not be called after the function returns. Non-escaping is the default because it enables compiler optimisations and makes memory management predictable.

Mark a closure `@escaping` when it may be stored and called after the function returns — for example, when it is stored in a property or handed off to an async operation.

```swift
var stored: (() -> Void)?

func register(callback: @escaping () -> Void) {
    stored = callback   // callback outlives the call — must be @escaping
}
```

Without `@escaping`, the compiler rejects any attempt to store or return the closure.

---

## Capture lists — [weak self] and [unowned self]

When a closure captures `self` (typically inside a method), it holds a strong reference by default. If `self` also holds a reference to the closure (or to something that does), a retain cycle prevents both from being deallocated.

A capture list before the parameter list controls this:

```swift
class Timer {
    var count = 0
    var tick: (() -> Void)?

    func start() {
        tick = { [weak self] in
            guard let self else { return }
            self.count += 1
        }
    }
}
```

> **What's going on here**
> - `[weak self]` — the closure captures a weak (non-owning) reference. If `self` is deallocated, the reference becomes `nil`; the `guard let self` safely exits early.
> - `[unowned self]` — like `weak`, but asserts `self` is never nil when the closure runs. Crashes if violated. Prefer `[weak self]` unless the object's lifetime is provably longer than the closure's.

---
type: exercise
kind: predict_output
pointsMax: 15
language: swift
expectedOutput: "10"
---
What does this print?

```swift:starter
let double = { (x: Int) -> Int in x * 2 }
print(double(5))
```

---
type: exercise
kind: predict_output
pointsMax: 15
language: swift
expectedOutput: "[3, 2, 1]"
---
What does this print?

```swift:starter
let result = [3, 1, 2].sorted(by: >)
print(result)
```

---
type: exercise
kind: predict_output
pointsMax: 15
language: swift
expectedOutput: "1\n2\n3"
---
What does this print?

```swift:starter
var counter = 0
let inc = { counter += 1; print(counter) }
inc()
inc()
inc()
```

---
type: exercise
kind: multiple_choice
pointsMax: 10
---
Which of the following is a correct shorthand for a closure that doubles its `Int` argument?

- [ ] `{ $0 * 2 }`
- [ ] `{ x in x * 2 }`
- [ ] `{ (x: Int) -> Int in return x * 2 }`
- [x] All of the above.

---
type: exercise
kind: fill_blank
pointsMax: 20
language: swift
blanks:
  "1":
    - "$0 % 2 == 0"
    - "$0.isMultiple(of: 2)"
---
Fill in the closure body to keep only even numbers.

```swift:starter
let evens = [1, 2, 3, 4].filter { ___1___ }
```

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Write a function `apply(_ x: Int, _ transform: (Int) -> Int) -> Int` that returns `transform(x)`, then verify it returns `105` when called as `apply(5) { $0 + 100 }`.

```swift:starter
func apply(_ x: Int, _ transform: (Int) -> Int) -> Int {
    // TODO
}
```

```swift:solution
func apply(_ x: Int, _ transform: (Int) -> Int) -> Int {
    return transform(x)
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testTrailingClosure() {
        XCTAssertEqual(apply(5) { $0 + 100 }, 105)
    }
    func testDoubling() {
        XCTAssertEqual(apply(4) { $0 * 2 }, 8)
    }
    func testIdentity() {
        XCTAssertEqual(apply(7) { $0 }, 7)
    }
}
```

---
type: exercise
kind: fix_bug
pointsMax: 40
language: swift
---
Fix the stored closure so the compiler can infer the correct type.

```swift:broken
let fn = { $0 * 3 }
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testTriplesPositive() {
        XCTAssertEqual(fn(4), 12)
    }
    func testTriplesZero() {
        XCTAssertEqual(fn(0), 0)
    }
    func testTriplesNegative() {
        XCTAssertEqual(fn(-2), -6)
    }
}
```

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Write a function `makeAdder(_ n: Int) -> (Int) -> Int` that returns a closure adding `n` to its argument.

```swift:starter
func makeAdder(_ n: Int) -> (Int) -> Int {
    // TODO
}
```

```swift:solution
func makeAdder(_ n: Int) -> (Int) -> Int {
    return { x in x + n }
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testAddThree() {
        XCTAssertEqual(makeAdder(3)(7), 10)
    }
    func testAddZero() {
        XCTAssertEqual(makeAdder(0)(5), 5)
    }
    func testAddNegative() {
        XCTAssertEqual(makeAdder(-4)(10), 6)
    }
}
```

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Write `mapTwiceInt(_ array: [Int], _ transform: (Int) -> Int) -> [Int]` that applies `transform` twice to each element.

```swift:starter
func mapTwiceInt(_ array: [Int], _ transform: (Int) -> Int) -> [Int] {
    // TODO
}
```

```swift:solution
func mapTwiceInt(_ array: [Int], _ transform: (Int) -> Int) -> [Int] {
    return array.map { transform(transform($0)) }
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testAddTen() {
        XCTAssertEqual(mapTwiceInt([1, 2], { $0 + 10 }), [21, 22])
    }
    func testDouble() {
        XCTAssertEqual(mapTwiceInt([3], { $0 * 2 }), [12])
    }
    func testEmpty() {
        XCTAssertEqual(mapTwiceInt([], { $0 + 1 }), [])
    }
    func testIdentity() {
        XCTAssertEqual(mapTwiceInt([5, 6], { $0 }), [5, 6])
    }
}
```

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Define a `struct Person` with `name: String` and `age: Int`, then write `sortedByAgeThenName(_ people: [Person]) -> [String]` that returns names sorted by age ascending, breaking ties alphabetically.

```swift:starter
struct Person {
    let name: String
    let age: Int
}

func sortedByAgeThenName(_ people: [Person]) -> [String] {
    // TODO
}
```

```swift:solution
struct Person {
    let name: String
    let age: Int
}

func sortedByAgeThenName(_ people: [Person]) -> [String] {
    return people.sorted {
        if $0.age != $1.age { return $0.age < $1.age }
        return $0.name < $1.name
    }.map { $0.name }
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testSortsByAge() {
        let people = [
            Person(name: "Grace", age: 30),
            Person(name: "Ada", age: 25),
            Person(name: "Alan", age: 40),
        ]
        XCTAssertEqual(sortedByAgeThenName(people), ["Ada", "Grace", "Alan"])
    }
    func testTieBreakerAlphabetical() {
        let people = [
            Person(name: "Zara", age: 30),
            Person(name: "Ada", age: 30),
        ]
        XCTAssertEqual(sortedByAgeThenName(people), ["Ada", "Zara"])
    }
    func testEmpty() {
        XCTAssertEqual(sortedByAgeThenName([]), [])
    }
    func testSinglePerson() {
        let people = [Person(name: "Ada", age: 25)]
        XCTAssertEqual(sortedByAgeThenName(people), ["Ada"])
    }
}
```

---
type: recap
---

## What you learned

**Concepts:** Closure expression syntax `{ (params) -> ReturnType in body }` · Type inference — shedding parameter and return-type annotations when context is known · Shorthand argument names `$0`, `$1` · Trailing closure syntax · Operator method shorthand (`.sorted(by: >)`) · Closure capture by reference for `var` bindings · `@escaping` for closures that outlive the function call · Capture lists `[weak self]` and `[unowned self]` to break retain cycles

**Swift-specific vs other languages:** Java lambdas always require an explicit parameter list and cannot use positional shorthand like `$0`. Java also has no trailing-closure syntax — the lambda always sits inside the method's argument parentheses. Swift's non-escaping default is stricter than Java: the compiler rejects storage of a closure parameter unless it is explicitly marked `@escaping`.

**What's next:** Lesson 08 introduces protocols — the mechanism that makes Swift's `sorted(by:)`, `map`, and `filter` work across any conforming type.
