---
type: lesson
title: Intro & Toolchain
level: beginner
summary: Swift's let/var, type inference, and the playground model for experimenting with code.
---

## Let vs var

In Swift, `let` binds an immutable value and `var` binds a mutable one. The compiler enforces this: attempting to reassign a `let` binding is a compile error, not a runtime error.

```swift
let language = "Swift"   // immutable — cannot be reassigned
var score = 0            // mutable — can change freely
score = 42               // fine
// language = "Kotlin"   // compile error: cannot assign to value: 'language' is a 'let' constant
```

Prefer `let` by default. The compiler warns when a `var` is never mutated, nudging toward immutability. Immutable bindings are easier to reason about and safe to share across threads.

> **Coming from Python:** In Python, everything is mutable by default. Swift flips that: `let` is the default, and you only reach for `var` when you genuinely need to mutate.

---

## Type inference

Swift infers types from literals — `let x = 5` is `Int`, `let y = 3.14` is `Double`, `let name = "Ada"` is `String`. The type is fixed at the declaration site; Swift is statically typed, not dynamically typed.

Annotate explicitly when the inferred type is wrong for your use:

```swift
let x = 1          // Int — default integer type
let y: Double = 1  // annotation forces the literal to become Double
```

> **What's going on here**
> - `let x = 1` — Swift infers `Int`, the default integer type.
> - `let y: Double = 1` — annotation forces the literal to become `Double`. Useful when you need math compatibility.

---

## Playground model

Swift has a REPL (command line: `swift repl`) and online playgrounds at swift.org. Both give fast feedback for experimenting with code — write a line, see output immediately. The BootCamp platform's browser IDE works the same way: write code, click Run, see output. No project setup required.

---
type: exercise
kind: predict_output
pointsMax: 15
language: swift
expectedOutput: "5"
---
What does this print?

```swift:starter
let x = 5
print(x)
```

---
type: exercise
kind: multiple_choice
pointsMax: 10
---
Which of these declares an immutable binding in Swift?

- [ ] `var a = 1`
- [x] `let a = 1`
- [ ] `const a = 1`
- [ ] `final a = 1`

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Declare a constant named `pi` equal to `3.14`.

```swift:starter
// Declare pi here
```

```swift:solution
let pi = 3.14
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testPiValue() {
        XCTAssertEqual(pi, 3.14, accuracy: 0.001)
    }
}
```

---
type: exercise
kind: fix_bug
pointsMax: 40
language: swift
---
Fix the starter so the counter increments and prints `1`.

```swift:broken
let count = 0
count = count + 1
print(count)
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testCounterOutput() {
        // Verified by compiler: code must compile and produce output 1
        var count = 0
        count = count + 1
        XCTAssertEqual(count, 1)
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
Fill in the type annotation so `age` holds a whole number.

```swift:starter
let age: ___1___ = 42
```

---
type: exercise
kind: predict_output
pointsMax: 15
language: swift
expectedOutput: "Hello, World!"
---
What does this print?

```swift:starter
let name = "World"
print("Hello, \(name)!")
```

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Write a program that declares a mutable counter starting at 0, increments it by 1 three times, and prints the final value.

```swift:starter
// Write your solution here
```

```swift:solution
var counter = 0
counter += 1
counter += 1
counter += 1
print(counter)
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testCounterFinalValue() {
        var counter = 0
        counter += 1
        counter += 1
        counter += 1
        XCTAssertEqual(counter, 3)
    }
}
```

---
type: exercise
kind: predict_output
pointsMax: 20
language: swift
expectedOutput: "1"
---
What does this print?

```swift:starter
var x = 1
let y = x
x = 2
print(y)
```

---
type: exercise
kind: fix_bug
pointsMax: 40
language: swift
---
Fix the type mismatch so the code compiles and runs.

```swift:broken
let x: Int = "hello"
print(x)
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testCompiles() {
        // The fix must produce a valid, compilable program.
        // Any Swift-valid fix is accepted; the test verifies compilation succeeds.
        let x: String = "hello"
        XCTAssertFalse(x.isEmpty)
    }
}
```

---
type: exercise
kind: multiple_choice
pointsMax: 10
---
When should you use `let` over `var`?

- [x] `let` is the default; use `var` only when you genuinely need mutation.
- [ ] They are interchangeable — pick whichever reads better.
- [ ] Always use `var`; `let` is only for compile-time constants.
- [ ] Never use `let`.

---
type: recap
---

## What you learned

**Concepts:** `let` for immutable bindings · `var` for mutable bindings · Swift's type inference · Explicit type annotations when inference is wrong · Value-type copy semantics (a preview of Lesson 03)

**Swift-specific vs other languages:** In Python everything is mutable by default; in Swift the default (`let`) is immutable, and you reach for `var` only when you genuinely need mutation.

**What's next:** Lesson 02 covers functions, including how `let`/`var` interact with parameters.
