---
type: lesson
title: Generics with Constraints
level: intermediate
summary: Generic functions, constrained type parameters, conditional conformance, and where clauses.
---

## Constrained type parameters

A generic parameter is unconstrained by default — the body can do nothing with the value beyond passing it around. Add constraints to enable operations.

```swift
func max2<T: Comparable>(_ a: T, _ b: T) -> T {
    a > b ? a : b
}
```

The `T: Comparable` constraint lets the body use `>`. Without it, the function does not compile.

> **Coming from C++:** Swift generics are *not* templates. They are typechecked once against the declared constraints, not re-instantiated per call site. If `T: Comparable` is missing, the function fails to compile — there is no SFINAE-style fallback.

---

## `where` clauses

Use `where` to constrain associated types of a generic parameter.

```swift
func firstID<C: Collection>(_ items: C) -> String?
where C.Element: Identifiable, C.Element.ID == String {
    items.first?.id
}
```

`where` clauses can also constrain method-level conformance — the method exists only when the constraint holds.

---

## Conditional conformance

A generic type can conform to a protocol *only when its parameters do*.

```swift
extension Array: Loadable where Element: Decodable {
    static func load(from data: Data) throws -> [Element] {
        try JSONDecoder().decode([Element].self, from: data)
    }
}
```

`[Movie]` is `Loadable` because `Movie: Decodable`. `[() -> Void]` is not. The compiler proves this at the call site.

> **What's going on here**
> - `extension Array: Loadable where Element: Decodable` — the conformance applies only to arrays whose element is `Decodable`.

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Write a generic function `firstNonNil` that returns the first non-nil element of an array of optionals.

```swift:starter
func firstNonNil<T>(_ items: [T?]) -> T? {
    // TODO
    return nil
}
```

```swift:solution
func firstNonNil<T>(_ items: [T?]) -> T? {
    for item in items {
        if let item = item { return item }
    }
    return nil
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testFirstNonNil() {
        XCTAssertEqual(firstNonNil([nil, nil, 3, 4]), 3)
        XCTAssertNil(firstNonNil([Int?]([nil, nil, nil])))
    }
}
```

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Write `unique` that returns the unique elements of a sequence, preserving order. Constrain the element type to `Hashable`.

```swift:starter
func unique<S: Sequence>(_ items: S) -> [S.Element] where S.Element: Hashable {
    // TODO
    return []
}
```

```swift:solution
func unique<S: Sequence>(_ items: S) -> [S.Element] where S.Element: Hashable {
    var seen = Set<S.Element>()
    var result: [S.Element] = []
    for item in items {
        if seen.insert(item).inserted { result.append(item) }
    }
    return result
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testUnique() {
        XCTAssertEqual(unique([1, 2, 2, 3, 1, 4]), [1, 2, 3, 4])
        XCTAssertEqual(unique(["a", "b", "a"]), ["a", "b"])
    }
}
```

---
type: exercise
kind: fix_bug
pointsMax: 40
language: swift
---
Add the constraint that lets the function compile.

```swift:broken
func sum<T>(_ values: [T]) -> T {
    var total = values[0]
    for v in values.dropFirst() { total = total + v }
    return total
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testSumInts() {
        XCTAssertEqual(sum([1, 2, 3, 4]), 10)
    }
    func testSumDoubles() {
        XCTAssertEqual(sum([1.5, 2.5]), 4.0)
    }
}
```

---
type: exercise
kind: multiple_choice
pointsMax: 10
---
What does conditional conformance let you express?

- [ ] A type that conforms to all protocols at once.
- [x] A generic type that conforms to a protocol only when its type parameters meet a constraint.
- [ ] A protocol with no associated types.
- [ ] A way to skip type checking for a generic parameter.

---
type: exercise
kind: fill_blank
pointsMax: 20
language: swift
blanks:
  "1": ["where"]
---
Fill in the keyword that constrains a generic method to a specific element type.

```swift:starter
extension Array ___1___ Element == String {
    func joined() -> String { self.joined(separator: ",") }
}
```

---
type: recap
---

## What you learned

**Concepts:** Constrained generics with `: Protocol` · `where` clauses on associated types · Conditional conformance via `extension ... where`

**Swift-specific vs other languages:** C++ templates duck-type the body at instantiation; Swift checks the body once against declared constraints, so missing constraints fail at definition, not at call site.

**What's next:** Lesson 03 covers ARC, weak/unowned references, and capture lists — required reading for any closure that holds `self`.
