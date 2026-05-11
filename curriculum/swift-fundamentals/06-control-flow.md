---
type: lesson
title: Control Flow & Pattern Matching
level: beginner
summary: Swift's if/else, exhaustive switch with pattern matching, for-in loops, while, guard, and labeled statements — the full control-flow toolkit.
---

## if / else if / else

Conditional branches work as in any C-family language. Parentheses around the condition are optional; the compiler accepts them but idiomatic Swift omits them.

```swift
let temp = 22

if temp > 30 {
    print("hot")
} else if temp > 15 {
    print("mild")
} else {
    print("cold")
}
// prints "mild"
```

Every branch must have braces. Swift does not support braceless single-statement branches.

---

## switch — exhaustive and non-falling-through

`switch` in Swift is checked for exhaustiveness at compile time: the compiler rejects any `switch` that fails to cover every possible value of the matched type. This is the most significant difference from most other languages.

```swift
let direction = "north"

switch direction {
case "north":
    print("heading north")
case "south":
    print("heading south")
case "east", "west":
    print("heading east or west")
default:
    print("unknown direction")
}
```

Two structural rules:
- Cases do **not** fall through. The next case is not executed unless you explicitly write `fallthrough`.
- Each case must contain at least one executable statement (an empty case is a compile error).

> **Coming from JavaScript:** In JS you must add `break` at the end of every `case` to prevent fall-through; omitting it is a silent bug. In Swift, fall-through never happens unless you write `fallthrough` explicitly. More importantly, Swift checks exhaustiveness at compile time — if your `switch` on an `enum` (Lesson 07) or a constrained type misses a case, the program will not compile.

---

## switch patterns

`switch` accepts value patterns, range patterns, tuple patterns, value binding, and `where` clauses.

**Range patterns** — match a value against a closed or half-open range:

```swift
let score = 85

switch score {
case 90...100:
    print("A")
case 80..<90:
    print("B")
case 70..<80:
    print("C")
case 60..<70:
    print("D")
default:
    print("F")
}
// prints "B"
```

> **What's going on here**
> - `90...100` — closed range: includes both endpoints. `0..<10` — half-open range: includes `0`, excludes `10`. Both are valid case patterns in a `switch`.
> - Cases are tested top to bottom; the first match wins.

**Tuple patterns** — match a composite value and destructure it inline:

```swift
let point = (0, 5)

switch point {
case (0, 0):
    print("origin")
case (let x, 0):
    print("on x-axis at \(x)")
case (0, let y):
    print("on y-axis at \(y)")
case (let x, let y):
    print("(\(x), \(y))")
}
// prints "on y-axis at 5"
```

**Value binding and `where` clauses** — bind a sub-value and filter with a boolean predicate:

```swift
let n = 14

switch n {
case let x where x % 2 == 0 && x > 0:
    print("\(x) is a positive even")
case let x where x % 2 != 0 && x > 0:
    print("\(x) is a positive odd")
default:
    print("zero or negative")
}
// prints "14 is a positive even"
```

> **What's going on here**
> - `case let x where x % 2 == 0` — `let x` binds the matched value; `where` adds a boolean guard on top. Both conditions must hold for the case to match.

---

## for-in loops

`for-in` iterates over any `Sequence` — arrays, ranges, dictionaries, sets (from Lesson 05), and more.

**Range iteration:**

```swift
for i in 0..<5 {
    print(i)      // 0 1 2 3 4
}

for i in 1...3 {
    print(i)      // 1 2 3
}
```

**Collection iteration:**

```swift
let langs = ["Swift", "Kotlin", "Python"]
for lang in langs {
    print(lang)
}
```

**`stride` for non-unit steps:**

```swift
for i in stride(from: 0, to: 10, by: 3) {
    print(i)   // 0 3 6 9
}

for i in stride(from: 10, through: 0, by: -2) {
    print(i)   // 10 8 6 4 2 0
}
```

`stride(from:to:by:)` excludes the upper bound (like `..<`). `stride(from:through:by:)` includes it (like `...`).

---

## while and repeat-while

`while` tests the condition before each iteration; `repeat-while` tests it after (guaranteeing at least one execution):

```swift
var n = 1
while n < 100 {
    n *= 2
}
print(n)   // 128

var input = 0
repeat {
    input += 1
} while input < 3
print(input)   // 3
```

---

## break, continue, and labeled statements

`break` exits the nearest enclosing loop or `switch`. `continue` skips to the next iteration.

```swift
for i in 0..<10 {
    if i % 2 == 0 { continue }   // skip evens
    if i == 7 { break }           // stop at 7
    print(i)                      // prints 1 3 5
}
```

When loops are nested, **labeled statements** let `break` and `continue` target an outer loop directly:

```swift
outer: for i in 0..<3 {
    for j in 0..<3 {
        if i == j { continue outer }   // skip to the next i
        print("(\(i), \(j))")
    }
}
// (1, 0)
// (2, 0)
// (2, 1)
```

---

## guard — general early exit

`guard` is an early-exit mechanism. The condition in a `guard` must be `true` for execution to continue; if it is `false`, the `else` branch must transfer control out of the current scope (`return`, `break`, `continue`, or `throw`).

`guard` is not limited to unwrapping optionals (that's `guard let`, covered in Lesson 04). Use bare `guard` to enforce any precondition:

```swift
func printPositive(_ n: Int) {
    guard n > 0 else {
        print("not positive")
        return
    }
    print(n)
}

printPositive(5)    // prints "5"
printPositive(-1)   // prints "not positive"
```

Using `guard` at the top of a function keeps the happy path at the left margin, making the flow easier to read than deeply nested `if` chains.

---
type: exercise
kind: predict_output
pointsMax: 15
language: swift
expectedOutput: "big"
---
What does this print?

```swift:starter
let x = 7
if x > 5 {
    print("big")
} else {
    print("small")
}
```

---
type: exercise
kind: multiple_choice
pointsMax: 10
---
Which statement about Swift's `switch` is true?

- [ ] Every case must end with `break` to prevent fall-through.
- [x] The compiler rejects a `switch` that does not cover all possible values.
- [ ] Cases fall through to the next case by default.
- [ ] `switch` can only match against constant values.

---
type: exercise
kind: fill_blank
pointsMax: 20
language: swift
blanks:
  "1": ["..<"]
---
Fill in the range operator so the loop prints `0` through `9` (inclusive).

```swift:starter
for i in 0___1___10 {
    print(i)
}
```

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Write `gradeLetter(_ score: Int) -> String` returning `"A"` for ≥ 90, `"B"` for ≥ 80, `"C"` for ≥ 70, `"D"` for ≥ 60, and `"F"` otherwise. Use a `switch` with range patterns.

```swift:starter
func gradeLetter(_ score: Int) -> String {
    // TODO
}
```

```swift:solution
func gradeLetter(_ score: Int) -> String {
    switch score {
    case 90...100:
        return "A"
    case 80..<90:
        return "B"
    case 70..<80:
        return "C"
    case 60..<70:
        return "D"
    default:
        return "F"
    }
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testA() {
        XCTAssertEqual(gradeLetter(95), "A")
        XCTAssertEqual(gradeLetter(90), "A")
    }
    func testB() {
        XCTAssertEqual(gradeLetter(85), "B")
        XCTAssertEqual(gradeLetter(80), "B")
    }
    func testC() {
        XCTAssertEqual(gradeLetter(75), "C")
        XCTAssertEqual(gradeLetter(70), "C")
    }
    func testD() {
        XCTAssertEqual(gradeLetter(65), "D")
        XCTAssertEqual(gradeLetter(60), "D")
    }
    func testF() {
        XCTAssertEqual(gradeLetter(59), "F")
        XCTAssertEqual(gradeLetter(0), "F")
    }
}
```

---
type: exercise
kind: predict_output
pointsMax: 15
language: swift
expectedOutput: "0\n3\n6\n9"
---
What does this print?

```swift:starter
for i in stride(from: 0, to: 10, by: 3) {
    print(i)
}
```

---
type: exercise
kind: fix_bug
pointsMax: 40
language: swift
---
Fix the `switch` so it compiles — the current version is not exhaustive.

```swift:broken
func describe(_ n: Int) -> String {
    switch n {
    case 0:
        return "zero"
    case 1...Int.max:
        return "positive"
    }
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testZero() {
        XCTAssertEqual(describe(0), "zero")
    }
    func testPositive() {
        XCTAssertEqual(describe(42), "positive")
    }
    func testNegative() {
        XCTAssertEqual(describe(-3), "negative")
    }
}
```

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Write `classify(_ x: Int) -> String` using a `switch` on a tuple and `where` clauses. Return `"zero"` for `0`, `"positive even"`, `"positive odd"`, `"negative even"`, or `"negative odd"` for all other values.

```swift:starter
func classify(_ x: Int) -> String {
    // TODO
}
```

```swift:solution
func classify(_ x: Int) -> String {
    switch (x == 0, x % 2 == 0, x > 0) {
    case (true, _, _):
        return "zero"
    case (_, true, true):
        return "positive even"
    case (_, false, true):
        return "positive odd"
    case (_, true, false):
        return "negative even"
    default:
        return "negative odd"
    }
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testZero() {
        XCTAssertEqual(classify(0), "zero")
    }
    func testPositiveEven() {
        XCTAssertEqual(classify(4), "positive even")
    }
    func testPositiveOdd() {
        XCTAssertEqual(classify(7), "positive odd")
    }
    func testNegativeEven() {
        XCTAssertEqual(classify(-6), "negative even")
    }
    func testNegativeOdd() {
        XCTAssertEqual(classify(-3), "negative odd")
    }
}
```

---
type: exercise
kind: predict_output
pointsMax: 15
language: swift
expectedOutput: "1\n3\n5"
---
What does this print?

```swift:starter
for i in 0..<8 {
    if i % 2 == 0 { continue }
    if i == 7 { break }
    print(i)
}
```

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Write `countDown(from n: Int) -> [Int]` using `while`, returning `[n, n-1, ..., 0]`.

```swift:starter
func countDown(from n: Int) -> [Int] {
    // TODO
}
```

```swift:solution
func countDown(from n: Int) -> [Int] {
    var result: [Int] = []
    var current = n
    while current >= 0 {
        result.append(current)
        current -= 1
    }
    return result
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testThree() {
        XCTAssertEqual(countDown(from: 3), [3, 2, 1, 0])
    }
    func testZero() {
        XCTAssertEqual(countDown(from: 0), [0])
    }
    func testOne() {
        XCTAssertEqual(countDown(from: 1), [1, 0])
    }
}
```

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Write `firstNonNegative(_ ints: [Int]) -> Int?` using `for-in` and `guard`. Return the first element that is ≥ 0, or `nil` if none exists.

```swift:starter
func firstNonNegative(_ ints: [Int]) -> Int? {
    // TODO
}
```

```swift:solution
func firstNonNegative(_ ints: [Int]) -> Int? {
    for n in ints {
        guard n >= 0 else { continue }
        return n
    }
    return nil
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testEmpty() {
        XCTAssertNil(firstNonNegative([]))
    }
    func testAllNegative() {
        XCTAssertNil(firstNonNegative([-3, -1, -7]))
    }
    func testMixed() {
        XCTAssertEqual(firstNonNegative([-2, -1, 0, 4]), 0)
    }
    func testFirstIsNonNegative() {
        XCTAssertEqual(firstNonNegative([5, -1, 3]), 5)
    }
    func testAllPositive() {
        XCTAssertEqual(firstNonNegative([1, 2, 3]), 1)
    }
}
```

---
type: recap
---

## What you learned

**Concepts:** `if`/`else if`/`else` for conditional branching · `switch` with exhaustiveness checking · Range patterns (`0...9`, `0..<10`), tuple patterns, value binding (`case let x`), and `where` clauses · `for-in` over collections and ranges · `stride(from:to:by:)` and `stride(from:through:by:)` for non-unit steps · `while` and `repeat-while` · `break`, `continue`, and labeled statements for outer-loop control · `guard` for general early-exit preconditions

**Swift-specific vs other languages:** JavaScript's `switch` falls through by default and requires an explicit `break` to stop; Swift's `switch` never falls through and the compiler rejects any `switch` that fails to cover all possible values. The `guard` statement has no direct equivalent in JavaScript — it enforces preconditions at the top of a scope and keeps the success path at the left margin.

**What's next:** Lesson 07 introduces enumerations — where Swift's exhaustive `switch` truly shines, matching against associated values and raw types.
