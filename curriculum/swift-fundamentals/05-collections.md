---
type: lesson
title: Collections
level: beginner
summary: Swift's Array, Dictionary, and Set — literal syntax, subscript access, mutation, and the functional trio map/filter/reduce.
---

## Array

`Array<Element>` (shorthand `[Element]`) is an ordered, homogeneous collection. Every element must be the same type — the compiler enforces this at the declaration site.

```swift
let primes: [Int] = [2, 3, 5, 7, 11]
var names = ["Ada", "Grace", "Alan"]   // inferred as [String]
```

Subscript access is zero-indexed. Out-of-bounds access crashes at runtime; there is no automatic bounds check that returns nil.

```swift
let first = primes[0]   // 2
let third = primes[2]   // 5
```

Common operations on a `var` array:

```swift
var scores = [10, 20, 30]
scores.append(40)          // [10, 20, 30, 40]
scores.remove(at: 1)       // [10, 30, 40]
print(scores.count)        // 3
print(scores.isEmpty)      // false
print(scores.contains(30)) // true
```

> **Coming from Python:** Python lists accept mixed types (`[1, "two", 3.0]`) and grow dynamically. Swift arrays are homogeneous — the element type is fixed at declaration and the compiler rejects any element that doesn't conform. You gain static guarantees; you lose the convenience of heterogeneous buckets. When you genuinely need a bag of mixed types, reach for a protocol (Lesson 08) or an enum with associated values (Lesson 06).

---

## Dictionary

`Dictionary<Key, Value>` (shorthand `[Key: Value]`) is an unordered mapping from unique keys to values. Both `Key` and `Value` must be concrete types; `Key` must be `Hashable`.

```swift
var scores: [String: Int] = ["Alice": 95, "Bob": 82]
var empty: [String: Int] = [:]   // empty dictionary literal
```

Subscript access returns `Value?` — an optional — because the key may not exist. This is the same `Optional<T>` from Lesson 04; all unwrapping patterns apply.

```swift
let aliceScore = scores["Alice"]   // Optional(95) — type is Int?
let carolScore = scores["Carol"]   // nil — key absent

let display = scores["Bob"] ?? -1  // 82  — nil-coalescing from Lesson 04
```

> **What's going on here**
> - `[String: Int]` — literal type annotation. `String` is the key type, `Int` is the value type. You can also write `Dictionary<String, Int>()` — both name the same type.
> - `scores["Alice"]` returns `Int?`, not `Int`. The subscript returns an optional because there is no guarantee the key is present.
> - Combine with `?? ` or `guard let` (Lesson 04) to get a concrete value.

Mutation and queries:

```swift
var freq: [String: Int] = [:]
freq["swift"] = 1       // insert
freq["swift"] = 2       // overwrite
freq.removeValue(forKey: "swift")
print(freq.count)       // 0
print(freq.isEmpty)     // true
```

---

## Set

`Set<Element>` is an unordered collection of unique values. `Element` must be `Hashable`. Useful for membership tests and set arithmetic.

```swift
var languages: Set<String> = ["Swift", "Kotlin", "Python"]
languages.insert("Go")
languages.remove("Python")
print(languages.contains("Swift"))  // true
print(languages.count)              // 3
```

Set literals look identical to array literals — the type annotation (or explicit `Set<T>`) disambiguates:

```swift
let a: Set<Int> = [1, 2, 3]
let b: Set<Int> = [2, 3, 4]
let shared = a.intersection(b)  // {2, 3}
```

---

## The functional trio — map, filter, reduce

Swift arrays support `map`, `filter`, and `reduce` as first-class methods. Their closures use trailing-closure syntax and `$0` shorthand (the first argument).

**`map`** — transform each element, returning a new array of the same length:

```swift
let nums = [1, 2, 3, 4]
let doubled = nums.map { $0 * 2 }        // [2, 4, 6, 8]
let strings = nums.map { String($0) }    // ["1", "2", "3", "4"]
```

**`filter`** — keep only elements that satisfy a predicate:

```swift
let evens = nums.filter { $0 % 2 == 0 }  // [2, 4]
```

**`reduce`** — fold the array into a single value:

```swift
let sum = nums.reduce(0, +)               // 10
let product = nums.reduce(1, *)           // 24
```

> **What's going on here**
> - `{ $0 * 2 }` — trailing closure syntax. The closure is passed after the method name rather than inside the parentheses. `$0` is shorthand for the first (and here, only) closure argument.
> - `reduce(0, +)` — the initial accumulator is `0`; the combining function is the `+` operator, which Swift accepts wherever a `(Int, Int) -> Int` is expected.

**`compactMap`** — like `map`, but the transform returns an optional; nil results are dropped:

```swift
let raw = ["1", "two", "3", "four"]
let parsed: [Int] = raw.compactMap { Int($0) }  // [1, 3]
```

`compactMap` on `[T?]` is a common idiom for stripping nils from a collection of optionals (Lesson 04):

```swift
let maybes: [Int?] = [1, nil, 3, nil, 5]
let values: [Int] = maybes.compactMap { $0 }   // [1, 3, 5]
```

---
type: exercise
kind: predict_output
pointsMax: 15
language: swift
expectedOutput: "3"
---
What does this print?

```swift:starter
let nums = [1, 2, 3]
print(nums.count)
```

---
type: exercise
kind: multiple_choice
pointsMax: 10
---
Which of the following correctly declares an empty `[String: Int]` dictionary?

- [ ] `let d: [String: Int] = [:]`
- [ ] `[String:Int]()`
- [ ] `Dictionary<String, Int>()`
- [x] All of the above are valid.

---
type: exercise
kind: fill_blank
pointsMax: 20
language: swift
blanks:
  "1": ["append"]
---
Fill in the method name that adds an element to the end of an array.

```swift:starter
var arr = [1, 2, 3]
arr.___1___(99)
```

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Write `evens(_ array: [Int]) -> [Int]` returning only the even elements of the input.

```swift:starter
func evens(_ array: [Int]) -> [Int] {
    // TODO
}
```

```swift:solution
func evens(_ array: [Int]) -> [Int] {
    return array.filter { $0 % 2 == 0 }
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testEmpty() {
        XCTAssertEqual(evens([]), [])
    }
    func testAllEven() {
        XCTAssertEqual(evens([2, 4, 6]), [2, 4, 6])
    }
    func testAllOdd() {
        XCTAssertEqual(evens([1, 3, 5]), [])
    }
    func testMixed() {
        XCTAssertEqual(evens([1, 2, 3, 4, 5, 6]), [2, 4, 6])
    }
}
```

---
type: exercise
kind: predict_output
pointsMax: 15
language: swift
expectedOutput: "-1"
---
What does this print?

```swift:starter
let dict: [String: Int] = ["a": 1, "b": 2]
let v = dict["c"]
print(v ?? -1)
```

---
type: exercise
kind: fix_bug
pointsMax: 40
language: swift
---
Fix the function so it compiles and returns the correct count for each word.

```swift:broken
func wordCount(_ words: [String]) -> [String: Int] {
    var freq: [String: Int] = [:]
    for word in words {
        freq[word] = freq[word] + 1
    }
    return freq
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testBasic() {
        XCTAssertEqual(wordCount(["a", "b", "a"]), ["a": 2, "b": 1])
    }
    func testEmpty() {
        XCTAssertEqual(wordCount([]), [:])
    }
    func testAllSame() {
        XCTAssertEqual(wordCount(["x", "x", "x"]), ["x": 3])
    }
}
```

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Write `wordFrequency(_ words: [String]) -> [String: Int]` returning a dictionary mapping each unique word to its frequency.

```swift:starter
func wordFrequency(_ words: [String]) -> [String: Int] {
    // TODO
}
```

```swift:solution
func wordFrequency(_ words: [String]) -> [String: Int] {
    var freq: [String: Int] = [:]
    for word in words {
        freq[word] = (freq[word] ?? 0) + 1
    }
    return freq
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testSingleWord() {
        XCTAssertEqual(wordFrequency(["swift"]), ["swift": 1])
    }
    func testMultipleWords() {
        XCTAssertEqual(wordFrequency(["a", "b", "a"]), ["a": 2, "b": 1])
    }
    func testEmpty() {
        XCTAssertEqual(wordFrequency([]), [:])
    }
    func testAllSame() {
        XCTAssertEqual(wordFrequency(["x", "x", "x"]), ["x": 3])
    }
}
```

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Write `sumOfSquares(_ nums: [Int]) -> Int` using `.map` and `.reduce(0, +)`.

```swift:starter
func sumOfSquares(_ nums: [Int]) -> Int {
    // TODO
}
```

```swift:solution
func sumOfSquares(_ nums: [Int]) -> Int {
    return nums.map { $0 * $0 }.reduce(0, +)
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testBasic() {
        XCTAssertEqual(sumOfSquares([1, 2, 3]), 14)
    }
    func testEmpty() {
        XCTAssertEqual(sumOfSquares([]), 0)
    }
    func testSingle() {
        XCTAssertEqual(sumOfSquares([5]), 25)
    }
    func testNegatives() {
        XCTAssertEqual(sumOfSquares([-3, 4]), 25)
    }
}
```

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Write `firstNonNil(_ optionals: [Int?]) -> Int?` that returns the first non-nil value in the array using `.compactMap` and `.first`.

```swift:starter
func firstNonNil(_ optionals: [Int?]) -> Int? {
    // TODO
}
```

```swift:solution
func firstNonNil(_ optionals: [Int?]) -> Int? {
    return optionals.compactMap { $0 }.first
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testFindsFirst() {
        XCTAssertEqual(firstNonNil([nil, nil, 3, 7]), 3)
    }
    func testAllNil() {
        XCTAssertNil(firstNonNil([nil, nil]))
    }
    func testEmpty() {
        XCTAssertNil(firstNonNil([]))
    }
    func testNoNils() {
        XCTAssertEqual(firstNonNil([1, 2, 3]), 1)
    }
}
```

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Write `intersect(_ a: [Int], _ b: [Int]) -> [Int]` returning elements present in both arrays in `a`'s order with no duplicates, using a `Set` for the membership test.

> **What's going on here**
> - `Set.insert(_:)` returns `(inserted: Bool, memberAfterInsert: Element)` — `.inserted` is `true` when the element wasn't already present, making this a one-liner dedup primitive.

```swift:starter
func intersect(_ a: [Int], _ b: [Int]) -> [Int] {
    // TODO
}
```

```swift:solution
func intersect(_ a: [Int], _ b: [Int]) -> [Int] {
    let setB = Set(b)
    var seen = Set<Int>()
    return a.filter { element in
        setB.contains(element) && seen.insert(element).inserted
    }
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testBasicIntersection() {
        XCTAssertEqual(intersect([1, 2, 3, 4], [2, 4, 6]), [2, 4])
    }
    func testNoOverlap() {
        XCTAssertEqual(intersect([1, 3], [2, 4]), [])
    }
    func testDuplicatesInA() {
        XCTAssertEqual(intersect([1, 2, 2, 3], [2, 3]), [2, 3])
    }
    func testEmptyA() {
        XCTAssertEqual(intersect([], [1, 2]), [])
    }
    func testEmptyB() {
        XCTAssertEqual(intersect([1, 2], []), [])
    }
}
```

---
type: recap
---

## What you learned

**Concepts:** `Array<Element>` / `[Element]` — ordered, homogeneous sequences · `Dictionary<Key, Value>` / `[Key: Value]` — unordered key-value mappings · `Set<Element>` — unordered unique-value collections · Literal syntax for all three · Subscript access and the fact that `dict[key]` returns `Value?` · `append`, `remove`, `contains`, `count`, `isEmpty` · `map`, `filter`, `reduce` for transforming collections · `compactMap` for stripping nils

**Swift-specific vs other languages:** Python lists are heterogeneous and dynamically typed — you can mix `int`, `str`, and `None` freely. Swift arrays are statically typed and homogeneous; the compiler rejects any element that doesn't match the declared element type. Dictionary subscript access (`dict["key"]`) returns an optional in Swift, making the absence of a key explicit rather than raising a `KeyError` at runtime.

**What's next:** Lesson 06 covers control flow — `for-in` loops over collections, `while`, and `guard` for early exit — building directly on the collection types from this lesson.
