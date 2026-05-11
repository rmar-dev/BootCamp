---
type: lesson
title: Functions
level: beginner
summary: Declaring functions with parameter labels, return types, and multiple returns via tuples.
---

## Function declaration syntax

`func name(label arg: Type) -> ReturnType { body }`. A function with no return value omits the arrow, or declares `-> Void` — both compile identically.

```swift
func greet(name: String) -> String {
    return "Hello, \(name)!"
}

func logEvent(_ message: String) {  // -> Void omitted
    print(message)
}
```

The compiler enforces both parameter types and the return type. Passing the wrong type or omitting a `return` where one is required is a compile error.

---

## Parameter labels — external vs internal names

The first name in a parameter pair is the external label (what callers write); the second is the internal name (what the function body uses). Use `_` to suppress the label at the call site entirely.

```swift
func move(from start: Int, to end: Int) -> Int {
    return end - start  // body uses 'start' and 'end'
}
move(from: 0, to: 5)   // caller writes 'from' and 'to'

func square(_ x: Int) -> Int {
    return x * x        // body uses 'x'
}
square(5)               // no label at call site
```

> **What's going on here**
> - `_ x: Int` — the underscore means callers omit the label: `square(5)` instead of `square(of: 5)`.
> - The internal name `x` is what the function body uses.

> **Coming from JavaScript:** In JS, you call `fn(1, 2)` with positional args. In Swift, the call site must include the parameter labels (`fn(x: 1, y: 2)`) unless the function suppresses them with `_`.

---

## Multiple returns via tuples

Swift functions return exactly one value, but tuples let one value carry many fields. Tuple elements can be anonymous (accessed by index) or named (accessed by field name).

```swift
func divmod(_ a: Int, _ b: Int) -> (Int, Int) {
    return (a / b, a % b)
}
let result = divmod(10, 3)
print(result.0)  // 3
print(result.1)  // 1

func parse(_ s: String) -> (quotient: Int, remainder: Int) {
    return (quotient: 17 / 5, remainder: 17 % 5)
}
```

Compact and readable. No need for out-parameters or wrapper structs for simple multi-value returns.

---
type: exercise
kind: predict_output
pointsMax: 15
language: swift
expectedOutput: "hi"
---
What does this print?

```swift:starter
func greet() -> String {
    return "hi"
}

print(greet())
```

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Write a function `square(_ x: Int) -> Int` that returns `x * x`.

```swift:starter
func square(_ x: Int) -> Int {
    // TODO
}
```

```swift:solution
func square(_ x: Int) -> Int {
    return x * x
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testPositive() {
        XCTAssertEqual(square(5), 25)
    }
    func testZero() {
        XCTAssertEqual(square(0), 0)
    }
    func testNegative() {
        XCTAssertEqual(square(-3), 9)
    }
}
```

---
type: exercise
kind: fill_blank
pointsMax: 20
language: swift
blanks:
  "1": ["Int"]
---
Fill the return type so the function compiles and returns the array's element count.

```swift:starter
func count(items: [Int]) -> ___1___ {
    return items.count
}
```

---
type: exercise
kind: fix_bug
pointsMax: 40
language: swift
---
Fix the missing return type so the function compiles.

```swift:broken
func add(x: Int, y: Int) {
    return x + y
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testAdd() {
        XCTAssertEqual(add(x: 2, y: 3), 5)
    }
}
```

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Write a function `divmod(_ a: Int, _ b: Int) -> (Int, Int)` that returns `(a / b, a % b)`.

```swift:starter
func divmod(_ a: Int, _ b: Int) -> (Int, Int) {
    // TODO
}
```

```swift:solution
func divmod(_ a: Int, _ b: Int) -> (Int, Int) {
    return (a / b, a % b)
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testQuotient() {
        XCTAssertEqual(divmod(10, 3).0, 3)
    }
    func testRemainder() {
        XCTAssertEqual(divmod(10, 3).1, 1)
    }
}
```

---
type: exercise
kind: multiple_choice
pointsMax: 10
---
Which call site is correct for `func greet(name: String)`?

- [ ] `greet("Alice")`
- [x] `greet(name: "Alice")`
- [ ] `greet.name("Alice")`
- [ ] `name: "Alice".greet()`

---
type: exercise
kind: predict_output
pointsMax: 20
language: swift
expectedOutput: "Ada Lovelace"
---
What does this print?

```swift:starter
func combine(first: String, last: String) -> String {
    return first + " " + last
}
print(combine(first: "Ada", last: "Lovelace"))
```

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Write a function `safeDivide(_ a: Int, by b: Int) -> Int` that returns `a / b` if `b` is nonzero, otherwise `0`.

```swift:starter
func safeDivide(_ a: Int, by b: Int) -> Int {
    // TODO
}
```

```swift:solution
func safeDivide(_ a: Int, by b: Int) -> Int {
    if b == 0 { return 0 }
    return a / b
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testNonZeroDivisor() {
        XCTAssertEqual(safeDivide(10, by: 2), 5)
    }
    func testZeroDivisor() {
        XCTAssertEqual(safeDivide(10, by: 0), 0)
    }
}
```

---
type: exercise
kind: fix_bug
pointsMax: 40
language: swift
---
Fix the base case so `factorial(0)` returns `1`, not `0`.

```swift:broken
func factorial(_ n: Int) -> Int {
    if n <= 0 { return 0 }
    if n == 1 { return 1 }
    return n * factorial(n - 1)
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testZero() {
        XCTAssertEqual(factorial(0), 1)
    }
    func testOne() {
        XCTAssertEqual(factorial(1), 1)
    }
    func testFive() {
        XCTAssertEqual(factorial(5), 120)
    }
}
```

---
type: exercise
kind: predict_output
pointsMax: 20
language: swift
expectedOutput: "42 true"
---
What does this print?

```swift:starter
func parse(_ s: String) -> (Int, Bool) {
    return (Int(s) ?? 0, Int(s) != nil)
}
let r = parse("42")
print("\(r.0) \(r.1)")
```

---
type: recap
---

## What you learned

**Concepts:** Function declaration with `func` · Parameter labels (external vs internal) · The `_` underscore to suppress labels · Return types with `->` · Tuples for multiple returns · Recursion (light intro)

**Swift-specific vs other languages:** Swift function call sites carry parameter labels by default — `combine(first: "Ada", last: "Lovelace")` — unlike JavaScript's positional `fn(1, 2)`. Suppress labels with `_` when readability of the call site is better without them.

**What's next:** Lesson 03 covers types in depth — value vs reference semantics, structs vs classes, identity vs equality.
