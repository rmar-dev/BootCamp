# BootCamp Curriculum Authoring Style Guide

This guide is required reading for every authoring subagent. Follow it exactly. The reference lessons (`swift-fundamentals/01-intro.md` and `02-functions.md`) are the canonical pattern — read them too before writing.

## Audience

Computing-engineering graduates hired as iOS engineers. Fluent in at least one of Python / JavaScript / Java / C++. No prior Swift. No prior iOS.

## Voice

- Terse. Declarative. No "let's", "we'll", "don't worry", "it's actually quite simple".
- Assume programming fluency. Don't define "variable", "function", "loop", "class".
- Lead with how Swift differs from the languages the learner already knows.
- No emojis. No exclamation marks.

## Terminology canon

- **value type** (not "struct type" or "copy type")
- **reference type** (not "class type")
- **unwrap** an optional (not "extract" or "get")
- **conform to** a protocol (not "implement")
- **immutable** for `let` semantics (not "constant" — Swift has compile-time constants too)
- **async context** (not "async scope" or "async block")
- **trailing closure** (not "last-arg closure")

## Forward-reference rule

A lesson may reference concepts from earlier lessons by number ("Optionals from Lesson 04"). It MAY NOT re-teach them. A single-sentence refresher is OK; a paragraph is not.

## "Coming from..." rule

Exactly ONE callout per lesson, placed on the concept most novel to that source language's developers. Format:

> **Coming from JavaScript:** `let` in Swift is a *constant*, not a block-scoped mutable. It's closer to `const`. The mutable equivalent is `var`.

Rotate source language across lessons:
- Lessons 01, 05, 09: Python
- Lessons 02, 06, 10: JavaScript
- Lessons 03, 07, 11: Java
- Lessons 04, 08: C++
- Lesson 12 (diagnostic): no "Coming from..." callout

## Tooltip callouts

Under non-obvious Swift code, insert 1–3 callouts per lesson. Format:

> **What's going on here**
> - `try await` — the call is both async and throwing. `await` suspends; `try` propagates thrown errors.
> - `$0` — shorthand for the first closure argument.

Flag Swift idioms that trip experienced developers (trailing closures, `$0`, `try await`, property wrappers, result builders). Do NOT add tooltips under every code fence. If a snippet needs more than 3 tooltips, break it into smaller snippets.

## Exercise prompt conventions

Prompts are single declarative sentences. No setup preamble.

- Good: "Write a function that returns the first duplicate in the array."
- Bad: "In this exercise, we'll practice using arrays. First, let's think about what a duplicate means..."

## Frontmatter template

Every lesson file MUST start with:

```yaml
---
type: lesson
title: <Human-readable title>
level: beginner | intermediate | advanced
summary: <One-sentence summary, shown in the track sidebar>
---
```

For depth lessons (future Spec #14), add `cohortGate: twelve_week`. For Week 1 lessons in this spec, DO NOT add `cohortGate`.

## Exercise payload formats

Each exercise block starts with frontmatter and follows a type-specific format. Refer to `curriculum/src/validator.ts` for exact Zod schemas; these are the normative shapes:

### `code` (Swift execution in Docker sandbox)

```markdown
---
type: exercise
kind: code
pointsMax: 50
---
<Prompt as a single declarative sentence.>

```swift:starter
// Code the student sees
func firstDuplicate<T: Hashable>(_ array: [T]) -> T? {
    // TODO
    return nil
}
```

```swift:solution
// The reference solution — hidden from students
func firstDuplicate<T: Hashable>(_ array: [T]) -> T? {
    var seen = Set<T>()
    for item in array {
        if seen.contains(item) { return item }
        seen.insert(item)
    }
    return nil
}
```

```swift:test
// Automated checks
import XCTest

final class Tests: XCTestCase {
    func testBasic() {
        XCTAssertEqual(firstDuplicate([1, 2, 3, 2, 4]), 2)
    }
    func testNoDupes() {
        XCTAssertNil(firstDuplicate([1, 2, 3]))
    }
}
```
```

### `fix_bug`

Same idea as `code`, but the starter has a deliberate bug. Use `swift:broken` (NOT `swift:starter`) for the buggy code, and `swift:test` for the failing test. Do NOT add a `swift:solution` fence — the test alone defines correctness.

```markdown
---
type: exercise
kind: fix_bug
pointsMax: 40
---
Fix the function so it returns the correct factorial of 0.

```swift:broken
func factorial(_ n: Int) -> Int {
    if n <= 0 { return 0 }
    return n * factorial(n - 1)
}
```

```swift:test
import XCTest
final class Tests: XCTestCase {
    func testFactorialZero() { XCTAssertEqual(factorial(0), 1) }
    func testFactorialFive() { XCTAssertEqual(factorial(5), 120) }
}
```
```

### `fill_blank`

```markdown
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
```

Acceptable answers for each blank are stored in frontmatter under `blanks:` as a mapping from blank ID (string key) to a list of accepted values. The blank placeholder in the starter code is `___<id>___`. Case-sensitive.

### `predict_output`

```markdown
---
type: exercise
kind: predict_output
pointsMax: 15
language: swift
expectedOutput: "Alice & Bob"
---
What does this print?

```swift:starter
let names = ["Alice", "Bob"]
let joined = names.joined(separator: " & ")
print(joined)
```
```

The expected answer is stored in frontmatter as `expectedOutput:`. The code the student sees must be in a `swift:starter` fenced block (not a plain ` ```swift ` fence).

### `multiple_choice`

```markdown
---
type: exercise
kind: multiple_choice
pointsMax: 10
---
Which statement about Swift protocols is correct?

- [ ] Protocols can include stored properties.
- [x] Protocols define requirements that conforming types must implement.
- [ ] A type can conform to at most one protocol.
- [ ] Protocols can be instantiated directly.
```

## Swift version and idioms

Target Swift 5.10.

**Do use:**
- `@Observable` (not `ObservableObject`)
- `async`/`await` (not completion handlers)
- `Result<Success, Failure>` for non-throwing error propagation
- `guard let x = optional else { return }` for early-exit unwrapping
- Trailing closure syntax when the closure is the last argument
- `if case` for pattern matching in conditionals

**Don't use:**
- `force-unwrap (!)` in teaching code — even if it would "work", it encourages bad habits. Exceptions: when explicitly teaching about `!` in the optionals lesson.
- `NSArray`, `NSDictionary`, `NSString` — use Swift natives.
- `typealias T = (input) -> output` closure signatures in introductory lessons — defer to the closures lesson.
- Callback-based completion handlers — always use async/await.

## Pool ordering

Exercises in a lesson's pool should flow from easier/introductory to harder/edge-case. Early exercises test the core concept; later exercises combine it with concepts from earlier lessons or introduce edge cases (nil inputs, generic constraints, empty collections).

## What you learned section

Every lesson MUST end with a `type: recap` section whose body contains `## What you learned`. The recap section requires its own frontmatter — it cannot be bare markdown at the end of the file. The parser's `looksLikeFrontmatter` check drops any chunk that does not start with a `key: value` line, so an unguarded `## What you learned` heading would be silently discarded.

Exact structure:

```markdown
---
type: recap
---

## What you learned

**Concepts:** Bulleted list of 3–6 concepts covered.

**Swift-specific vs other languages:** 1–2 sentences comparing to Python/JS/Java/C++.

**What's next:** 1 sentence pointing forward to the next lesson or Week 2.
```

The compiler (Spec #11 additions) fails the build if any subheading is missing.

## Do NOT

- Do NOT re-teach concepts introduced in earlier lessons.
- Do NOT use "we", "let's", "our".
- Do NOT add emojis to lesson content.
- Do NOT write exercises that test a concept the student hasn't been taught yet.
- Do NOT omit the `## What you learned` section.
- Do NOT use more than 3 tooltip callouts per lesson.
- Do NOT skip the "Coming from..." callout.
