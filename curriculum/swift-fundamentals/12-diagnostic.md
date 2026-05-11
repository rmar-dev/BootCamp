---
type: lesson
title: Week 1 Diagnostic
level: intermediate
summary: Gate quiz sampling Lessons 01–11. Pass with 70% to begin Week 2.
---

This is your Week 1 gate quiz. You need 70% to proceed to Week 2. Each exercise samples a concept from Lessons 01–11.

---
type: exercise
kind: predict_output
pointsMax: 20
language: swift
expectedOutput: "Hello, Swift"
---
What does this print?

```swift:starter
let language = "Swift"
print("Hello, \(language)")
```

---
type: exercise
kind: predict_output
pointsMax: 20
language: swift
expectedOutput: "0"
---
What does this print?

```swift:starter
struct Point {
    var x: Int
}

var a = Point(x: 0)
var b = a
b.x = 99
print(a.x)
```

---
type: exercise
kind: predict_output
pointsMax: 20
language: swift
expectedOutput: "B"
---
What does this print?

```swift:starter
let score = 85
switch score {
case 90...100:
    print("A")
case 80..<90:
    print("B")
case 70..<80:
    print("C")
default:
    print("F")
}
```

---
type: exercise
kind: predict_output
pointsMax: 20
language: swift
expectedOutput: "[2, 4, 6]"
---
What does this print?

```swift:starter
let nums = [1, 2, 3]
let doubled = nums.map { $0 * 2 }
print(doubled)
```

---
type: exercise
kind: predict_output
pointsMax: 20
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
kind: multiple_choice
pointsMax: 20
---
Which of the following correctly constrains a function parameter to conform to both `Named` and `Aged` protocols simultaneously?

- [ ] `func greet(_ entity: Named, Aged)`
- [ ] `func greet(_ entity: Named | Aged)`
- [x] `func greet(_ entity: Named & Aged)`
- [ ] `func greet<T: Named>(_ entity: T) where T == Aged`

---
type: exercise
kind: fill_blank
pointsMax: 20
language: swift
blanks:
  "1": ["Hashable"]
---
Fill in the constraint that allows values to be deduplicated using a `Set`.

```swift:starter
func dedupe<T: ___1___>(_ array: [T]) -> [T] {
    Array(Set(array))
}
```

---
type: exercise
kind: fix_bug
pointsMax: 20
---
Fix the `switch` so it compiles — the current version is not exhaustive.

```swift:broken
func classify(_ n: Int) -> String {
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
        XCTAssertEqual(classify(0), "zero")
    }
    func testPositive() {
        XCTAssertEqual(classify(42), "positive")
    }
    func testNegative() {
        XCTAssertEqual(classify(-5), "negative")
    }
}
```

---
type: exercise
kind: code
pointsMax: 20
---
Declare an immutable constant `maxScore` of type `Int` with value `100`.

```swift:starter
// Declare maxScore here
```

```swift:solution
let maxScore: Int = 100
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testValue() {
        XCTAssertEqual(maxScore, 100)
    }
    func testType() {
        let _: Int = maxScore
    }
}
```

---
type: exercise
kind: code
pointsMax: 20
---
Write `func multiply(by factor: Int, value: Int) -> Int` that returns `factor * value`.

```swift:starter
func multiply(by factor: Int, value: Int) -> Int {
    // TODO
}
```

```swift:solution
func multiply(by factor: Int, value: Int) -> Int {
    return factor * value
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testBasic() {
        XCTAssertEqual(multiply(by: 3, value: 7), 21)
    }
    func testZero() {
        XCTAssertEqual(multiply(by: 0, value: 5), 0)
    }
    func testNegative() {
        XCTAssertEqual(multiply(by: -2, value: 4), -8)
    }
}
```

---
type: exercise
kind: code
pointsMax: 20
---
Write `func displayName(_ name: String?) -> String` that returns the name if non-nil, or `"Guest"` otherwise. Use `guard let` for the nil check.

```swift:starter
func displayName(_ name: String?) -> String {
    // TODO
}
```

```swift:solution
func displayName(_ name: String?) -> String {
    guard let name = name else { return "Guest" }
    return name
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testNonNil() {
        XCTAssertEqual(displayName("Ada"), "Ada")
    }
    func testNil() {
        XCTAssertEqual(displayName(nil), "Guest")
    }
    func testEmptyString() {
        XCTAssertEqual(displayName(""), "")
    }
}
```

---
type: exercise
kind: code
pointsMax: 20
---
Write `func streetName(for user: User) -> String` that uses optional chaining to return the street from the user's optional address, or `"unknown"` if any step is nil.

```swift:starter
struct Address {
    let street: String
}

struct User {
    let address: Address?
}

func streetName(for user: User) -> String {
    // TODO
}
```

```swift:solution
struct Address {
    let street: String
}

struct User {
    let address: Address?
}

func streetName(for user: User) -> String {
    return user.address?.street ?? "unknown"
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testWithAddress() {
        let u = User(address: Address(street: "Main St"))
        XCTAssertEqual(streetName(for: u), "Main St")
    }
    func testNilAddress() {
        let u = User(address: nil)
        XCTAssertEqual(streetName(for: u), "unknown")
    }
}
```

---
type: exercise
kind: code
pointsMax: 20
---
Write `func squaredEvens(_ nums: [Int]) -> [Int]` that returns the squares of even numbers in the input, using `.filter` and `.map`.

```swift:starter
func squaredEvens(_ nums: [Int]) -> [Int] {
    // TODO
}
```

```swift:solution
func squaredEvens(_ nums: [Int]) -> [Int] {
    return nums.filter { $0 % 2 == 0 }.map { $0 * $0 }
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testBasic() {
        XCTAssertEqual(squaredEvens([1, 2, 3, 4, 5]), [4, 16])
    }
    func testAllOdd() {
        XCTAssertEqual(squaredEvens([1, 3, 5]), [])
    }
    func testEmpty() {
        XCTAssertEqual(squaredEvens([]), [])
    }
    func testNegatives() {
        XCTAssertEqual(squaredEvens([-4, -3, -2]), [16, 4])
    }
}
```

---
type: exercise
kind: code
pointsMax: 20
---
Define `enum ConversionError: Error { case overflow }` and `func toUInt8(_ n: Int) throws -> UInt8` that throws `ConversionError.overflow` when `n` is outside `0...255`, otherwise returns `UInt8(n)`.

```swift:starter
enum ConversionError: Error {
    // TODO
}

func toUInt8(_ n: Int) throws -> UInt8 {
    // TODO
}
```

```swift:solution
enum ConversionError: Error {
    case overflow
}

func toUInt8(_ n: Int) throws -> UInt8 {
    guard n >= 0 && n <= 255 else { throw ConversionError.overflow }
    return UInt8(n)
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testValidLow() {
        XCTAssertEqual(try? toUInt8(0), 0)
    }
    func testValidHigh() {
        XCTAssertEqual(try? toUInt8(255), 255)
    }
    func testUnderflow() {
        XCTAssertNil(try? toUInt8(-1))
    }
    func testOverflow() {
        XCTAssertNil(try? toUInt8(256))
    }
    func testThrowsOverflow() {
        var caught = false
        do {
            _ = try toUInt8(300)
        } catch ConversionError.overflow {
            caught = true
        } catch {}
        XCTAssertTrue(caught)
    }
}
```

---
type: exercise
kind: code
pointsMax: 20
---
Write `func clamp<T: Comparable>(_ value: T, low: T, high: T) -> T` that returns `low` if `value < low`, `high` if `value > high`, and `value` otherwise.

```swift:starter
func clamp<T: Comparable>(_ value: T, low: T, high: T) -> T {
    // TODO
}
```

```swift:solution
func clamp<T: Comparable>(_ value: T, low: T, high: T) -> T {
    if value < low { return low }
    if value > high { return high }
    return value
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testBelowLow() {
        XCTAssertEqual(clamp(-5, low: 0, high: 10), 0)
    }
    func testAboveHigh() {
        XCTAssertEqual(clamp(15, low: 0, high: 10), 10)
    }
    func testInRange() {
        XCTAssertEqual(clamp(5, low: 0, high: 10), 5)
    }
    func testAtLow() {
        XCTAssertEqual(clamp(0, low: 0, high: 10), 0)
    }
    func testAtHigh() {
        XCTAssertEqual(clamp(10, low: 0, high: 10), 10)
    }
    func testStrings() {
        XCTAssertEqual(clamp("m", low: "a", high: "f"), "f")
    }
}
```

---
type: recap
---

## What you learned

**Concepts:**
- `let` immutability and type inference (Lesson 01)
- Struct value-copy semantics and the struct/class divide (Lessons 01, 03)
- Function parameter labels and return types (Lesson 02)
- Optional unwrapping with `guard let` and optional chaining `?.` with `??` (Lesson 04)
- Collection transforms: `.filter` and `.map` (Lesson 05)
- Exhaustive `switch` with range patterns (Lesson 06)
- Closure shorthand `$0` and trailing-closure syntax (Lesson 07)
- Protocol composition with `&` (Lesson 08)
- Generic type constraints `<T: Comparable>`, `<T: Hashable>` (Lesson 09)
- `throws`, `try`, and error propagation (Lesson 10)
- `async let` for concurrent child tasks (Lesson 11)

**Swift-specific vs other languages:** The diagnostic surfaced the Swift idioms most divergent from Python/JS/Java/C++: immutable-by-default bindings, value-copy struct semantics, compile-enforced optional unwrapping, exhaustive switch without fallthrough, non-escaping closures with `$0` shorthand, and a type system that makes `throws` and `async` part of the function signature.

**What's next:** Week 2 begins SwiftUI fundamentals and the Mini Peacock capstone.
