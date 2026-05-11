# Week 1 Swift Fundamentals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to execute this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Author 12 lesson files (`curriculum/swift-fundamentals/01-intro.md` through `12-diagnostic.md`) plus a `STYLE_GUIDE.md` that serves as the authoring reference for subagents, resulting in a shippable Week 1 Swift Fundamentals track on the BootCamp platform.

**Architecture:** Phase 1 establishes the authoring pattern (style guide + polished reference lessons 01, 02). Phase 2 uses subagent-driven authoring with per-lesson two-stage review (Swift correctness + pedagogy) to produce lessons 03–11 in parallel. Phase 3 authors the diagnostic gate quiz last, after all concept pools are stable. Phase 4 integrates the track, compiles against the platform DB, smoke-tests end-to-end, and merges to master.

**Tech Stack:** Markdown-with-frontmatter lessons, `gray-matter` parser, Vitest tests, `tsx` CLI (`curriculum/compile.ts`), Prisma 5 against shared Postgres, Swift 5.10 docker sandbox for code exercise validation.

---

## File Structure

### Create
- `curriculum/STYLE_GUIDE.md` — authoring reference for all subagents (voice, terminology, forward-reference rule, "Coming from..." rule, tooltip budget, frontmatter template, exercise payload formats, Swift idioms, pointers to reference lessons)
- `curriculum/swift-fundamentals/03-types-value-vs-reference.md` — pool of 10
- `curriculum/swift-fundamentals/04-optionals.md` — pool of 10
- `curriculum/swift-fundamentals/05-collections.md` — pool of 10
- `curriculum/swift-fundamentals/06-control-flow.md` — pool of 10
- `curriculum/swift-fundamentals/07-closures.md` — pool of 10
- `curriculum/swift-fundamentals/08-protocols.md` — pool of 10
- `curriculum/swift-fundamentals/09-generics.md` — pool of 10
- `curriculum/swift-fundamentals/10-error-handling.md` — pool of 10
- `curriculum/swift-fundamentals/11-async-await.md` — pool of 10
- `curriculum/swift-fundamentals/12-diagnostic.md` — 15 fixed exercises, gate quiz

### Modify
- `curriculum/swift-fundamentals/01-intro.md` — expand existing stub to full 10-exercise pool matching the canonical pattern
- `curriculum/swift-fundamentals/02-functions.md` — expand existing stub to full 10-exercise pool matching the canonical pattern
- `curriculum/swift-fundamentals/track.md` — update `lessons:` list to include all 12 lessons

### Branch
- `feat/week-1-curriculum` on the curriculum repo. All commits land there; merged to `master` after Phase 4 smoke passes.

---

## Shared Artifacts (referenced by later tasks)

### Author subagent prompt template

Used in Tasks 5–14 with lesson-specific parameters filled in. The controller fills in `{lesson_number}`, `{filename}`, `{topic}`, `{concept_brief}`, `{target_source_language}`, and `{exercise_type_targets}`. Full text lives in Task 5.

### Swift correctness reviewer prompt template

Reads the committed lesson file only. Returns `APPROVED` or `ISSUES` with a list. Full text lives in Task 5.

### Pedagogy reviewer prompt template

Reads the lesson file plus `STYLE_GUIDE.md`. Returns `APPROVED` or `ISSUES`. Full text lives in Task 5.

---

## Task 1: Create branch and scaffold STYLE_GUIDE.md

**Files:**
- Create: `curriculum/STYLE_GUIDE.md`

- [ ] **Step 1: Verify we're on master and pull latest**

Run:
```bash
cd c:/Users/ricma/BootCamp/curriculum
git status
git branch --show-current
```
Expected: `master`, clean working tree (if `docs/` is not a git repo, skip pull).

- [ ] **Step 2: Create the feature branch**

Run:
```bash
cd c:/Users/ricma/BootCamp/curriculum
git checkout -b feat/week-1-curriculum
git branch --show-current
```
Expected: prints `feat/week-1-curriculum`.

- [ ] **Step 3: Write STYLE_GUIDE.md**

Create `c:/Users/ricma/BootCamp/curriculum/STYLE_GUIDE.md` with this exact content:

```markdown
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

```markdown
> **Coming from JavaScript:** `let` in Swift is a *constant*, not a block-scoped mutable. It's closer to `const`. The mutable equivalent is `var`.
```

Rotate source language across lessons:
- Lessons 01, 05, 09: Python
- Lessons 02, 06, 10: JavaScript
- Lessons 03, 07, 11: Java
- Lessons 04, 08: C++
- Lesson 12 (diagnostic): no "Coming from..." callout

## Tooltip callouts

Under non-obvious Swift code, insert 1–3 callouts per lesson. Format:

```markdown
> **What's going on here**
> - `try await` — the call is both async and throwing. `await` suspends; `try` propagates thrown errors.
> - `$0` — shorthand for the first closure argument.
```

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

Same as `code` but the starter has a deliberate bug. Tests remain correct; student fixes the starter.

### `fill_blank`

```markdown
---
type: exercise
kind: fill_blank
pointsMax: 20
---
Fill the blank so the function returns the first optional that's not nil.

```swift:starter
func firstPresent(_ values: [Int?]) -> Int? {
    return values.___(where: { $0 != nil }).flatMap { $0 }
}
```

```yaml:answers
- first
```
```

The `answers` YAML block is a list of acceptable answers for the blank. Case-sensitive.

### `predict_output`

```markdown
---
type: exercise
kind: predict_output
pointsMax: 15
---
What does this print?

```swift
let names = ["Alice", "Bob"]
let joined = names.joined(separator: " & ")
print(joined)
```

```yaml:expected
"Alice & Bob"
```
```

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

Every lesson MUST end with this section, exactly this structure:

```markdown
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
```

- [ ] **Step 4: Verify style guide file exists and has content**

Run:
```bash
wc -l c:/Users/ricma/BootCamp/curriculum/STYLE_GUIDE.md
```
Expected: 150+ lines.

- [ ] **Step 5: Commit**

```bash
cd c:/Users/ricma/BootCamp/curriculum
git add STYLE_GUIDE.md
git commit -m "docs(curriculum): add subagent authoring style guide"
```

---

## Task 2: Polish lesson 01 (Intro & Toolchain) to reference pattern

**Files:**
- Modify: `curriculum/swift-fundamentals/01-intro.md`

The existing `01-intro.md` is a 3-exercise stub. Expand it to a full 10-exercise pool matching every requirement in `STYLE_GUIDE.md`. This lesson becomes the canonical example that all other subagents reference.

- [ ] **Step 1: Read the current stub**

Run:
```bash
cat c:/Users/ricma/BootCamp/curriculum/swift-fundamentals/01-intro.md
```

Preserve the existing `type: lesson` frontmatter and any exercises that already match the style guide. Expand everything else.

- [ ] **Step 2: Rewrite 01-intro.md to the canonical pattern**

The lesson must contain:

1. Frontmatter:
   ```yaml
   ---
   type: lesson
   title: Intro & Toolchain
   level: beginner
   summary: Swift's let/var, type inference, and the playground model for experimenting with code.
   ---
   ```
2. Explanation blocks teaching:
   - What `let` and `var` mean (mutable vs immutable). Include the `"Coming from Python:"` callout here ("In Python, everything is mutable by default; Swift flips that.").
   - Type inference — how Swift picks types from literals, and when you'd annotate explicitly.
   - The playground model — Swift REPL and online playgrounds as fast feedback.
3. One tooltip callout on a non-trivial code snippet (e.g., type inference edge case like `let x = 1` vs `let x: Double = 1`).
4. Ten exercises in the pool, ordered easy → hard:
   1. `predict_output` — what does `let x = 5; print(x)` print?
   2. `multiple_choice` — which of these is immutable in Swift? (`let a = 1`, `var b = 1`, `const c = 1`, `final d = 1`)
   3. `code` — declare a constant named `pi` equal to 3.14. (test: XCTAssertEqual(pi, 3.14))
   4. `fix_bug` — starter has `let count = 0; count = count + 1`. Fix to compile (change to `var`).
   5. `fill_blank` — fill in the type annotation: `let age: ___ = 42` (answer: `Int`).
   6. `predict_output` — `let name = "World"; print("Hello, \(name)!")` (answer: `"Hello, World!"`).
   7. `code` — write a program that declares a mutable counter starting at 0, increments it 3 times, and prints the final value.
   8. `predict_output` — trace `var x = 1; let y = x; x = 2; print(y)` (answer: `1` — value types copy).
   9. `fix_bug` — starter has `let x: Int = "hello"`. Fix the type mismatch.
   10. `multiple_choice` — when to use `let` over `var`? (`let` is the default, `var` only when you need mutation, both work the same, never use `let`).
5. Required recap:
   ```markdown
   ## What you learned

   **Concepts:** `let` for immutable bindings · `var` for mutable bindings · Swift's type inference · Explicit type annotations when inference isn't enough · The playground/REPL model for fast feedback

   **Swift-specific vs other languages:** In Python, everything is mutable by default; in Swift, the default (`let`) is immutable, and you only reach for `var` when you genuinely need mutation.

   **What's next:** Lesson 02 covers functions — including how `let`/`var` interact with parameters.
   ```

- [ ] **Step 3: Dry-run compile to verify the lesson parses and validates**

Run:
```bash
cd c:/Users/ricma/BootCamp/curriculum
npx tsx compile.ts --dry-run swift-fundamentals/01-intro.md
```
Expected: no errors. The compiler should report pool size = 10, no cohortGate, recap present.

If the compiler doesn't accept `--dry-run`, check `compile.ts` for the actual dry-run flag name; adapt. The compiler validates pool size ≥ 4 (except capstone_submission) and cohortGate enum when present (Spec #11 additions).

- [ ] **Step 4: Run the full curriculum test suite**

Run:
```bash
cd c:/Users/ricma/BootCamp/curriculum
npm test
```
Expected: 80+ tests pass.

- [ ] **Step 5: Commit**

```bash
cd c:/Users/ricma/BootCamp/curriculum
git add swift-fundamentals/01-intro.md
git commit -m "docs(curriculum): polish 01-intro to full 10-exercise reference pattern"
```

---

## Task 3: Polish lesson 02 (Functions) to reference pattern

**Files:**
- Modify: `curriculum/swift-fundamentals/02-functions.md`

Same expand-to-reference pattern as Task 2, but for functions. This will be the SECOND reference lesson every other subagent reads.

- [ ] **Step 1: Read the current stub**

Run:
```bash
cat c:/Users/ricma/BootCamp/curriculum/swift-fundamentals/02-functions.md
```

- [ ] **Step 2: Rewrite 02-functions.md to the canonical pattern**

Contents:

1. Frontmatter:
   ```yaml
   ---
   type: lesson
   title: Functions
   level: beginner
   summary: Declaring functions, parameters with labels, return types, and multiple returns via tuples.
   ---
   ```
2. Explanation blocks teaching:
   - Function declaration syntax — `func name(arg: Type) -> ReturnType`.
   - Parameter labels — external vs internal names, when to use `_`.
   - Multiple returns — tuples vs throwing vs optionals.
   - Include the `"Coming from JavaScript:"` callout on parameter labels ("In JS you call `fn(1, 2)`; in Swift you call `fn(x: 1, y: 2)` unless you suppress labels.").
3. 1–2 tooltip callouts (parameter-label external-vs-internal is a prime candidate).
4. Ten exercises ordered easy → hard:
   1. `predict_output` — what does `func greet() -> String { return "hi" }; print(greet())` print?
   2. `code` — write a function `square(_ x: Int) -> Int` that returns x*x.
   3. `fill_blank` — fill the return type: `func count(items: [Int]) -> ___ { items.count }` (answer: `Int`).
   4. `fix_bug` — starter has `func add(x: Int, y: Int) { return x + y }`. Fix the missing return type.
   5. `code` — write a function `divmod(_ a: Int, _ b: Int) -> (Int, Int)` that returns quotient and remainder as a tuple.
   6. `multiple_choice` — which call site is correct for `func greet(name: String)`? (`greet("Alice")`, `greet(name: "Alice")`, `greet.name("Alice")`, `name: "Alice".greet()`).
   7. `predict_output` — trace a function that mutates a parameter with `inout`.
   8. `code` — write `firstAndLast<T>(_ array: [T]) -> (T, T)?` returning `nil` for empty or single-element arrays.
   9. `fix_bug` — subtle bug in a recursive factorial (off-by-one or wrong base case).
   10. `predict_output` — closure passed as a function argument with trailing-syntax call site.
5. Required `## What you learned` recap, matching the style-guide structure.

- [ ] **Step 3: Dry-run compile**

Run:
```bash
cd c:/Users/ricma/BootCamp/curriculum
npx tsx compile.ts --dry-run swift-fundamentals/02-functions.md
```
Expected: no errors.

- [ ] **Step 4: Run curriculum tests**

Run:
```bash
cd c:/Users/ricma/BootCamp/curriculum
npm test
```
Expected: 80+ tests pass.

- [ ] **Step 5: Commit**

```bash
cd c:/Users/ricma/BootCamp/curriculum
git add swift-fundamentals/02-functions.md
git commit -m "docs(curriculum): polish 02-functions to full 10-exercise reference pattern"
```

---

## Task 4: Controller checkpoint — user review of Phase 1

**Files:** none (review only)

- [ ] **Step 1: Show the user the style guide + both reference lessons**

Explicitly announce to the user that Phase 1 (STYLE_GUIDE + reference lessons 01 and 02) is complete. Share the three files' paths. Pause for user to review and approve.

- [ ] **Step 2: Wait for explicit user approval**

Do NOT dispatch Phase 2 author subagents until the user signs off. If the user requests changes, apply them to Tasks 1–3 artifacts and re-loop this checkpoint.

- [ ] **Step 3: Update memory if the user surfaces new conventions**

If the user offers voice/idiom feedback that clarifies STYLE_GUIDE.md, append or edit the guide in place and commit:
```bash
cd c:/Users/ricma/BootCamp/curriculum
git add STYLE_GUIDE.md
git commit -m "docs(curriculum): refine style guide per Phase 1 review"
```

---

## Task 5: Author lesson 03 — Types, value vs reference

**Files:**
- Create: `curriculum/swift-fundamentals/03-types-value-vs-reference.md`

This is the FIRST bulk-authored lesson. It establishes the subagent prompts used for Tasks 6–14. Tasks 6–13 reuse these same prompt templates, parameterized per lesson.

### Step 1: Dispatch author subagent

Controller invokes an author subagent with the full prompt below. Fill in the parameters for THIS lesson:

- `{lesson_number}`: `03`
- `{filename}`: `03-types-value-vs-reference.md`
- `{topic}`: `Types & value vs reference`
- `{concept_brief}`: Swift's primitive types (Int, Double, String, Bool). Tuples. struct vs class — the value/reference divide. Identity vs equality (`===` vs `==`). When to pick a struct vs a class.
- `{target_source_language}`: Java (callout focuses on how Swift's struct-by-default differs from Java's class-by-default).
- `{exercise_type_targets}`: 4 `code`, 3 `predict_output`, 1 `fill_blank`, 1 `fix_bug`, 1 `multiple_choice`.

Author subagent prompt (full text — reuse for Tasks 6–14):

> You are authoring lesson `{lesson_number}` of Week 1 of the BootCamp Swift Fundamentals curriculum. Your ONLY job is to write the file `curriculum/swift-fundamentals/{filename}`.
>
> **Required reading before you write:**
> 1. `curriculum/STYLE_GUIDE.md` — voice, terminology, forward-reference rule, exercise payload formats, Swift idioms. Read this in full.
> 2. `curriculum/swift-fundamentals/01-intro.md` — canonical reference lesson. Match its structure.
> 3. `curriculum/swift-fundamentals/02-functions.md` — canonical reference lesson. Match its structure.
>
> **Lesson brief:**
> - Topic: `{topic}`
> - Concept brief: `{concept_brief}`
> - Pool size: 10 exercises, ordered easy → hard
> - Exercise type targets: `{exercise_type_targets}` (approximate; adjust by ±1 if a type doesn't fit the concept)
> - "Coming from..." source language: `{target_source_language}` — exactly ONE callout, placed on the most-novel concept for developers of that language
> - Tooltip callouts: 1–3, on Swift idioms (not on obvious code)
> - Frontmatter: `type: lesson`, `title`, `level: beginner`, `summary`. NO `cohortGate`.
> - Recap: ends with `## What you learned` containing `**Concepts:**`, `**Swift-specific vs other languages:**`, `**What's next:**` exactly as shown in the style guide.
>
> **Constraints:**
> - Do NOT re-teach concepts from lessons 01–{previous lesson number}. Reference them by number if needed.
> - Do NOT introduce concepts that will be covered in later lessons (no protocols before lesson 08, no generics before lesson 09, no async before lesson 11).
> - All Swift code targets Swift 5.10. No completion handlers. No `ObservableObject`. No force-unwrapping in teaching code unless the lesson IS about optionals.
> - Exercises must be solvable with only the concepts introduced in lessons 01–{lesson_number}.
>
> **Output:**
> 1. Write the file at `curriculum/swift-fundamentals/{filename}` using the Write tool.
> 2. Run `cd c:/Users/ricma/BootCamp/curriculum && npx tsx compile.ts --dry-run swift-fundamentals/{filename}` and confirm it passes.
> 3. If the dry-run fails, read the error, fix the file, and re-run.
> 4. Once the dry-run passes, report back the filename and the dry-run result. Do NOT commit.
>
> Report status: DONE / BLOCKED (with specifics) / NEEDS_CONTEXT.

### Step 2: Verify author output

Controller runs:
```bash
cd c:/Users/ricma/BootCamp/curriculum
cat swift-fundamentals/03-types-value-vs-reference.md | head -20
npx tsx compile.ts --dry-run swift-fundamentals/03-types-value-vs-reference.md
```
Expected: file exists with proper frontmatter; dry-run succeeds.

If the author subagent reported BLOCKED, read its message, provide missing context, and re-dispatch.

### Step 3: Dispatch Swift correctness reviewer

Swift correctness reviewer prompt (reuse for Tasks 6–14):

> You are the Swift correctness reviewer for lesson `{filename}` of the BootCamp Swift Fundamentals curriculum.
>
> **Read:**
> - `curriculum/swift-fundamentals/{filename}`
>
> **Check each of these:**
> 1. All Swift code compiles under Swift 5.10 (syntax, standard library usage).
> 2. Code is idiomatic — no force-unwrapping in teaching code (unless the lesson IS about optionals), no `NSArray`/`NSDictionary`/`NSString`, no completion handlers, no `ObservableObject`.
> 3. Exercise `:test` blocks actually test what the `:starter`/prompt asks. For example, if the prompt says "return `nil` for an empty array", there must be a test with an empty array input that asserts nil.
> 4. Code fences tagged correctly: `swift:starter`, `swift:solution`, `swift:test` for code/fix_bug exercises; `swift:starter` + `yaml:answers` for fill_blank; `swift` + `yaml:expected` for predict_output.
> 5. No references to concepts not yet introduced (no protocols before lesson 08; no generics before lesson 09; no async before lesson 11). Cross-references to earlier lessons are fine.
> 6. Exercise pool is ordered from easier to harder.
>
> **Output:**
> - `APPROVED` — every check passes. Include a one-sentence summary.
> - `ISSUES` — list each issue with the exercise number and the specific problem. Be concrete.
>
> Do NOT comment on voice, pedagogy, tooltip budgets, or style guide items — those belong to the pedagogy reviewer.

### Step 4: Dispatch pedagogy reviewer

Pedagogy reviewer prompt (reuse for Tasks 6–14):

> You are the pedagogy reviewer for lesson `{filename}` of the BootCamp Swift Fundamentals curriculum.
>
> **Read:**
> - `curriculum/STYLE_GUIDE.md`
> - `curriculum/swift-fundamentals/{filename}`
>
> **Check each of these:**
> 1. Voice matches the style guide — terse, no "let's"/"we'll", no emojis, assumes programming fluency.
> 2. Terminology canon is used consistently.
> 3. Exactly ONE `**Coming from X:**` callout is present, placed on the most-novel concept for that source language.
> 4. Tooltip count is 1–3 `**What's going on here**` callouts.
> 5. Forward-reference rule — concepts from earlier lessons are referenced by number, not re-taught.
> 6. Exercise prompts are terse single declarative sentences with no preamble.
> 7. `## What you learned` section is present at the end, with all three subheadings (`**Concepts:**`, `**Swift-specific vs other languages:**`, `**What's next:**`) in order, non-empty.
> 8. Frontmatter has required fields: `type: lesson`, `title`, `level`, `summary`. No `cohortGate` on Week 1 lessons.
>
> **Output:**
> - `APPROVED` — every check passes.
> - `ISSUES` — list each issue with a pointer to the offending line/section.
>
> Do NOT comment on Swift syntax or code correctness — those belong to the correctness reviewer.

### Step 5: Handle reviewer feedback

- If both reviewers return APPROVED, proceed to Step 6.
- If either reviewer returns ISSUES, dispatch the author subagent again with a fix prompt:

> Fix the following issues in `curriculum/swift-fundamentals/{filename}`:
>
> Swift correctness issues: `{list}`
> Pedagogy issues: `{list}`
>
> After fixing, run the dry-run again and report DONE or BLOCKED.

After the author returns, re-dispatch both reviewers. If issues persist after 2 fix cycles, escalate to the controller.

### Step 6: Commit

Run:
```bash
cd c:/Users/ricma/BootCamp/curriculum
git add swift-fundamentals/03-types-value-vs-reference.md
git commit -m "docs(curriculum): week 1 lesson 03 — types & value vs reference"
```

---

## Task 6: Author lesson 04 — Optionals

Use the exact same 6-step flow as Task 5 (dispatch author → verify → Swift reviewer → pedagogy reviewer → handle feedback → commit). Reuse the prompt templates verbatim, filling in lesson-specific parameters:

- `{lesson_number}`: `04`
- `{filename}`: `04-optionals.md`
- `{topic}`: `Optionals`
- `{concept_brief}`: Optional types as first-class. `?` and `!` suffixes. `if let`, `guard let`, `while let`. Nil-coalescing `??`. Optional chaining `?.`. Force-unwrapping `!` and why it's dangerous. This is the ONE lesson where `!` in teaching code is acceptable because the lesson is about it.
- `{target_source_language}`: C++ (callout on how Swift's type system forces nil handling at compile time versus C++'s `nullptr` that can be missed).
- `{exercise_type_targets}`: 4 `code`, 3 `predict_output`, 1 `fill_blank`, 1 `fix_bug`, 1 `multiple_choice`.

Commit message: `docs(curriculum): week 1 lesson 04 — optionals`.

---

## Task 7: Author lesson 05 — Collections

Same flow, parameters:
- `{lesson_number}`: `05`
- `{filename}`: `05-collections.md`
- `{topic}`: `Collections`
- `{concept_brief}`: `Array<Element>`, `Dictionary<Key, Value>`, `Set<Element>`. Literal syntax. Subscript access. Common operations: `append`, `removeAll`, `contains`, `first(where:)`. Functional operations: `map`, `filter`, `reduce`, `compactMap`.
- `{target_source_language}`: Python (callout on how Swift collections are homogeneous and typed, unlike Python's untyped lists/dicts).
- `{exercise_type_targets}`: 5 `code`, 2 `predict_output`, 1 `fill_blank`, 1 `fix_bug`, 1 `multiple_choice`.

Commit message: `docs(curriculum): week 1 lesson 05 — collections`.

---

## Task 8: Author lesson 06 — Control flow & pattern matching

Same flow, parameters:
- `{lesson_number}`: `06`
- `{filename}`: `06-control-flow.md`
- `{topic}`: `Control flow & pattern matching`
- `{concept_brief}`: `if`/`else`, `switch` with exhaustiveness checking, pattern matching with `where` clauses, tuple patterns, value binding in cases. `for-in` loops, ranges (`0..<10`, `0...10`), `stride`. `break`, `continue`, labeled breaks.
- `{target_source_language}`: JavaScript (callout on how Swift's `switch` is exhaustive and doesn't fall through).
- `{exercise_type_targets}`: 4 `code`, 3 `predict_output`, 1 `fill_blank`, 1 `fix_bug`, 1 `multiple_choice`.

Commit message: `docs(curriculum): week 1 lesson 06 — control flow & pattern matching`.

---

## Task 9: Author lesson 07 — Closures

Same flow, parameters:
- `{lesson_number}`: `07`
- `{filename}`: `07-closures.md`
- `{topic}`: `Closures`
- `{concept_brief}`: Closure expression syntax. Shorthand argument names `$0`, `$1`. Trailing closure syntax. Capture lists `[weak self]`, `[unowned self]`. `@escaping` vs non-escaping closures.
- `{target_source_language}`: Java (callout on how Swift closures differ from Java lambdas — trailing syntax + capture lists).
- `{exercise_type_targets}`: 4 `code`, 3 `predict_output`, 1 `fill_blank`, 1 `fix_bug`, 1 `multiple_choice`.

Commit message: `docs(curriculum): week 1 lesson 07 — closures`.

---

## Task 10: Author lesson 08 — Protocols & extensions

Same flow, parameters:
- `{lesson_number}`: `08`
- `{filename}`: `08-protocols.md`
- `{topic}`: `Protocols & extensions`
- `{concept_brief}`: Protocol declaration, conformance. Protocol with associated types. Default implementations via extensions. Extending existing types (structs, classes, enums, protocols). Protocol-oriented mindset — prefer protocols to inheritance.
- `{target_source_language}`: C++ (callout on how Swift protocols differ from C++ abstract classes — no multiple inheritance, composition-first).
- `{exercise_type_targets}`: 3 `code`, 3 `predict_output`, 1 `fill_blank`, 2 `fix_bug`, 1 `multiple_choice`.

Commit message: `docs(curriculum): week 1 lesson 08 — protocols & extensions`.

---

## Task 11: Author lesson 09 — Generics

Same flow, parameters:
- `{lesson_number}`: `09`
- `{filename}`: `09-generics.md`
- `{topic}`: `Generics`
- `{concept_brief}`: Generic functions. Type parameters with constraints (`<T: Comparable>`). `where` clauses for advanced constraints. Generic types (`Array<Element>` etc.). Associated types on protocols (skim — deeper coverage is a future depth lesson).
- `{target_source_language}`: Python (callout on how Swift generics are type-checked at compile time versus Python's duck typing).
- `{exercise_type_targets}`: 4 `code`, 3 `predict_output`, 1 `fill_blank`, 1 `fix_bug`, 1 `multiple_choice`.

Commit message: `docs(curriculum): week 1 lesson 09 — generics`.

---

## Task 12: Author lesson 10 — Error handling

Same flow, parameters:
- `{lesson_number}`: `10`
- `{filename}`: `10-error-handling.md`
- `{topic}`: `Error handling`
- `{concept_brief}`: `Error` protocol. Throwing functions with `throws`. `try`, `try?`, `try!` — semantics of each. `do`/`catch` blocks. Pattern matching in `catch`. `Result<Success, Failure>` type.
- `{target_source_language}`: JavaScript (callout on how Swift's `try`/`catch` is declared at the function signature, versus JS's unchecked throws).
- `{exercise_type_targets}`: 4 `code`, 2 `predict_output`, 1 `fill_blank`, 2 `fix_bug`, 1 `multiple_choice`.

Commit message: `docs(curriculum): week 1 lesson 10 — error handling`.

---

## Task 13: Author lesson 11 — Async/await

Same flow, parameters:
- `{lesson_number}`: `11`
- `{filename}`: `11-async-await.md`
- `{topic}`: `Async/await`
- `{concept_brief}`: `async` functions. `await` expressions. `Task { }` for launching asynchronous work. Structured concurrency basics: `async let`, `TaskGroup`. Thread-safety concepts (surface-level only — actors are out of scope for Week 1). Combining async with throws (`try await`).
- `{target_source_language}`: Java (callout on how Swift's structured concurrency differs from Java's CompletableFuture/Future-based model).
- `{exercise_type_targets}`: 3 `code`, 4 `predict_output`, 1 `fill_blank`, 1 `fix_bug`, 1 `multiple_choice`.

Commit message: `docs(curriculum): week 1 lesson 11 — async/await`.

---

## Task 14: Author lesson 12 — Week 1 diagnostic

**Files:**
- Create: `curriculum/swift-fundamentals/12-diagnostic.md`

The diagnostic is different from concept lessons: 15 fixed exercises, no pool rotation, samples from lessons 01–11, weighted toward `code` (50%) and `predict_output` (30%). Author AFTER lessons 01–11 are committed and stable.

### Step 1: Dispatch diagnostic author subagent

Use this specialized prompt (different from Task 5's template):

> You are authoring lesson 12 of Week 1 of the BootCamp Swift Fundamentals curriculum — the diagnostic gate quiz.
>
> **Read first:**
> - `curriculum/STYLE_GUIDE.md`
> - All 11 prior lessons: `curriculum/swift-fundamentals/01-intro.md` through `11-async-await.md`.
>
> **Diagnostic characteristics (different from concept lessons):**
> - 15 exercises total (not 10) — fixed, no pool rotation.
> - Samples across all 11 prior concepts. Rough distribution:
>   - 2 from `intro/toolchain` (lesson 01)
>   - 1 from `functions` (lesson 02)
>   - 1 from `types & value vs reference` (lesson 03)
>   - 2 from `optionals` (lesson 04)
>   - 1 from `collections` (lesson 05)
>   - 2 from `control flow & pattern matching` (lesson 06)
>   - 2 from `closures` (lesson 07)
>   - 1 from `protocols & extensions` (lesson 08)
>   - 1 from `generics` (lesson 09)
>   - 1 from `error handling` (lesson 10)
>   - 1 from `async/await` (lesson 11)
> - Exercise type distribution: 50% `code`, 30% `predict_output`, 10% `fill_blank`, 5% `fix_bug`, 5% `multiple_choice`. (Rough: 7 code, 5 predict_output, 2 fill_blank, 1 fix_bug or 1 multiple_choice.)
> - Each exercise has `pointsMax: 20` (standardized for grading).
> - NO "Coming from..." callout (diagnostic is evaluation, not instruction).
> - NO tooltip callouts.
> - Minimal explanation text — just a short framing paragraph explaining "this is your Week 1 gate quiz; you need 70% to proceed".
> - Still ends with `## What you learned` — but it summarizes what was ASSESSED, not what was introduced.
>
> **Frontmatter:**
> ```yaml
> ---
> type: lesson
> title: Week 1 Diagnostic
> level: intermediate
> summary: Gate quiz sampling Lessons 01–11. Pass with 70% to begin Week 2.
> ---
> ```
>
> **Output:**
> 1. Write `curriculum/swift-fundamentals/12-diagnostic.md`.
> 2. Run `cd c:/Users/ricma/BootCamp/curriculum && npx tsx compile.ts --dry-run swift-fundamentals/12-diagnostic.md` and confirm it passes.
> 3. Report DONE / BLOCKED.

### Step 2: Verify author output

Same as Task 5 Step 2, but for the diagnostic file.

### Step 3: Dispatch Swift correctness reviewer

Same prompt as Task 5's reviewer, pointed at `12-diagnostic.md`.

### Step 4: Dispatch pedagogy reviewer with diagnostic-specific checks

Pedagogy reviewer prompt additions for the diagnostic:

> This is a DIAGNOSTIC lesson with different rules than concept lessons:
> - `**Coming from X:**` callouts: 0 (diagnostic is evaluation, not instruction).
> - Tooltip callouts: 0.
> - Pool size: 15 (not 10).
> - `level: intermediate`.
> - All 11 prior topics should be represented.
>
> Return APPROVED/ISSUES as before.

### Step 5: Handle feedback

Same as Task 5 Step 5.

### Step 6: Commit

```bash
cd c:/Users/ricma/BootCamp/curriculum
git add swift-fundamentals/12-diagnostic.md
git commit -m "docs(curriculum): week 1 lesson 12 — diagnostic gate quiz"
```

---

## Task 15: Update track.md to list all 12 lessons

**Files:**
- Modify: `curriculum/swift-fundamentals/track.md`

- [ ] **Step 1: Read current track.md**

Run:
```bash
cat c:/Users/ricma/BootCamp/curriculum/swift-fundamentals/track.md
```

Expected current content:
```yaml
---
id: swift-fundamentals
title: Swift Fundamentals
language: swift
kind: fundamentals
description: A complete introduction to Swift for experienced programmers.
lessons:
  - 01-intro
  - 02-functions
---
```

- [ ] **Step 2: Update the `lessons:` list**

Replace the `lessons:` section with:

```yaml
lessons:
  - 01-intro
  - 02-functions
  - 03-types-value-vs-reference
  - 04-optionals
  - 05-collections
  - 06-control-flow
  - 07-closures
  - 08-protocols
  - 09-generics
  - 10-error-handling
  - 11-async-await
  - 12-diagnostic
```

- [ ] **Step 3: Verify track compiles**

Run:
```bash
cd c:/Users/ricma/BootCamp/curriculum
npx tsx compile.ts --dry-run swift-fundamentals/track.md
```
Expected: no errors — all 12 lesson ids resolve to existing files that were validated in Tasks 2–14.

- [ ] **Step 4: Run full curriculum test suite**

Run:
```bash
cd c:/Users/ricma/BootCamp/curriculum
npm test
```
Expected: 80+ tests pass.

- [ ] **Step 5: Commit**

```bash
cd c:/Users/ricma/BootCamp/curriculum
git add swift-fundamentals/track.md
git commit -m "feat(curriculum): register week 1 lessons 03-12 in track"
```

---

## Task 16: Compile and publish to the platform DB

**Files:** none modified — this task writes rows to the Postgres DB.

- [ ] **Step 1: Confirm Postgres is reachable**

Run:
```bash
cd c:/Users/ricma/BootCamp/curriculum
cat .env | grep DATABASE_URL
```
Expected: a `DATABASE_URL=postgresql://...` line pointing at the platform's DB on port 5433.

If .env is missing or the URL is wrong, update `.env` to point at the same DB the platform uses (check `c:/Users/ricma/BootCamp/platform/.env`).

- [ ] **Step 2: Publish the track**

Run:
```bash
cd c:/Users/ricma/BootCamp/curriculum
npx tsx compile.ts --publish swift-fundamentals
```
Expected: the compiler writes 12 Lesson rows (plus their Blocks and Exercises) and 1 Track row to the DB. It reports the count of lessons, blocks, exercises compiled.

If publish fails on the pool-size check, it means one of the lessons has < 4 exercises — look at the error, fix the lesson, re-run. If publish fails on cohortGate, check for typos in Lesson 12's frontmatter.

- [ ] **Step 3: Verify via Prisma**

Run:
```bash
cd c:/Users/ricma/BootCamp/platform
npx prisma studio
```
Then open the Track/Lesson/Exercise tables in the browser and confirm the 12 lessons appear with the expected exercise counts. Close studio when done.

If prisma studio is inconvenient, this SQL confirms the row counts:
```bash
cd c:/Users/ricma/BootCamp/platform
psql $DATABASE_URL -c 'SELECT COUNT(*) FROM "Lesson" WHERE "trackId" IN (SELECT id FROM "Track" WHERE title = '"'"'Swift Fundamentals'"'"')'
```
Expected: `12`.

- [ ] **Step 4: No commit**

This task writes to the DB, not git. Nothing to commit.

---

## Task 17: End-to-end smoke test in the web app

**Files:** none modified.

- [ ] **Step 1: Start the platform backend**

Run in one terminal:
```bash
cd c:/Users/ricma/BootCamp/platform
npm run start:dev
```
Wait for "Nest application successfully started".

- [ ] **Step 2: Start the web frontend**

Run in another terminal:
```bash
cd c:/Users/ricma/BootCamp/web
npm run dev
```
Wait for "ready - started server on 0.0.0.0:3001".

- [ ] **Step 3: Register a test student and complete one exercise per type**

1. Open http://localhost:3001 in a browser.
2. Register as a new student (or log in as an existing one).
3. Navigate to the Swift Fundamentals track.
4. Open Lesson 01 (`01-intro`).
5. Verify that:
   - The lesson renders with explanation blocks, a "Coming from..." callout, and exercises.
   - Pool-status chip shows "0 of 10 seen" (four_week cohort default).
   - 4 exercises are visible (cohort target).
6. Complete one `code` exercise — click Run, submit. Verify grading.
7. Complete one `predict_output` exercise — enter the expected output, submit.
8. Complete one `fill_blank` exercise — enter the answer, submit.
9. Complete one `multiple_choice` exercise — select an answer, submit.
10. Verify AI review fires on the code exercise (check the platform logs for "ReviewService").

- [ ] **Step 4: Revisit test**

1. After completing all 4 visible exercises, click "Fresh exercises".
2. Verify 4 NEW exercises from the pool are shown.
3. Repeat until the pool is exhausted — confirm PoolCompleteView shows all 10 with pass/fail badges.

- [ ] **Step 5: Diagnostic test**

1. Navigate to Lesson 12 (diagnostic).
2. Verify it shows 15 exercises (diagnostic clamps the pool to its full size).
3. No need to complete — just verify it renders correctly.

- [ ] **Step 6: Stop servers and document any issues**

- If any step fails, open a new issue (mentally or in a tracking file) and fix the root cause before merging.
- If all steps pass, proceed to Task 18.

---

## Task 18: Merge feat/week-1-curriculum to master

**Files:** none — git operation only.

- [ ] **Step 1: Confirm branch is clean and committed**

Run:
```bash
cd c:/Users/ricma/BootCamp/curriculum
git status
git log --oneline -5
```
Expected: clean working tree; the last 5 commits are Phase 2–4 work on `feat/week-1-curriculum`.

- [ ] **Step 2: Merge to master (non-fast-forward to preserve history)**

Run:
```bash
cd c:/Users/ricma/BootCamp/curriculum
git checkout master
git merge --no-ff feat/week-1-curriculum -m "merge: Week 1 Swift Fundamentals curriculum (Spec #12)"
```
Expected: merge succeeds with no conflicts. If there ARE conflicts (someone modified curriculum/ on master while we worked), resolve manually — prefer the feature branch for lesson files, inspect any STYLE_GUIDE.md or track.md conflicts carefully.

- [ ] **Step 3: Run the full test suite on master**

Run:
```bash
cd c:/Users/ricma/BootCamp/curriculum
npm test
```
Expected: all tests pass (80+ pre-existing + any added during Phase 2 polish).

- [ ] **Step 4: Delete the feature branch**

```bash
cd c:/Users/ricma/BootCamp/curriculum
git branch -d feat/week-1-curriculum
```
Expected: "Deleted branch feat/week-1-curriculum".

- [ ] **Step 5: Update project memory**

Append to `c:/Users/ricma/.claude/projects/c--Users-ricma-BootCamp/memory/bootcamp_platform_project.md`:

```markdown
12. ✅ **Week 1 Swift Fundamentals curriculum** — DONE 2026-04-23. 12 lessons (~125 exercises) authored via subagent pipeline with STYLE_GUIDE + per-lesson Swift/pedagogy review. Diagnostic gate quiz at lesson 12 (70% threshold). Track `swift-fundamentals` is shippable on the platform.
```

This doesn't need a git commit (memory is outside git).

---

## Final verification

- [ ] All 12 lessons exist in `curriculum/swift-fundamentals/` and pass `npx tsx compile.ts --dry-run` individually.
- [ ] `track.md` lists all 12 lessons in order.
- [ ] `curriculum/STYLE_GUIDE.md` exists and is referenced in every author subagent prompt.
- [ ] `npm test` in curriculum repo is green.
- [ ] The track renders correctly in the web app for a registered student.
- [ ] Pool-status chip, fresh-exercises button, and pool-complete view all function correctly on Lesson 01.
- [ ] Diagnostic lesson 12 renders with 15 exercises.
- [ ] `feat/week-1-curriculum` merged to master and branch deleted.

## Spec coverage checklist

- [§Audience & framing] — encoded in STYLE_GUIDE.md ✓
- [§Inventory] — Tasks 1–14 cover all 12 lessons ✓
- [§Pedagogical patterns] — encoded in STYLE_GUIDE.md, enforced by compiler + pedagogy reviewer ✓
- [§Subagent style guide] — Task 1 ✓
- [§Authoring execution model] — Tasks 5–14 (per-lesson flow) ✓
- [§Publication sequence] — Phase 1 = Tasks 1–4, Phase 2 = Tasks 5–13, Phase 3 = Task 14, Phase 4 = Tasks 15–18 ✓
- [§Deliverables] — all 13 artifacts (STYLE_GUIDE.md + 12 lessons) created ✓
- [§Testing & verification] — Tasks 16 (compile/publish), 17 (end-to-end smoke) ✓
- [§Known risks] — mitigated by reviewer prompts (Swift idiom drift, cross-lesson redundancy, exercise test quality) ✓
