# Spec #12 — Week 1 Swift Fundamentals Curriculum

**Date:** 2026-04-23
**Status:** Design approved
**Depends on:** Specs #1 (content model), #2 (lesson runtime), #3 (code execution), #5 (submission/grading), #9 (curriculum authoring), #11 (adaptive content engine)
**Out of scope / deferred:** Weeks 2–4 + Mini Peacock capstone (Spec #13), 3-month depth extensions (Spec #14), Kotlin port (separate later spec)

## Summary

Author the 11 lessons that make up Week 1 of the BootCamp — a full Swift language fundamentals arc for experienced programmers, culminating in a diagnostic gate quiz. Every lesson runs in the platform's browser IDE (no Xcode), using the existing Docker-based Swift sandbox (Spec #3). All 11 lessons target the pool-based model from Spec #11.

End state: `curriculum/swift-fundamentals/` track is shippable. A student can register, enroll in Swift Fundamentals, complete all 10 concept lessons across their cohort's exercise target, pass the diagnostic, and be ready for Week 2.

## Audience & framing (unchanged from prior drafts)

- **Who:** Computing-engineering grads hired as iOS engineers. Fluent in at least one of Python / JS / Java / C++. No prior Swift.
- **Content density:** terse, comparative, assumes programming fluency. Lessons lead with how Swift differs from the languages the learner already knows.
- **Platform surface:** Monaco editor, Run button (Swift 5.10 Docker sandbox), auto-grade + AI review pipeline. No Xcode, no UIKit, no UI code in Week 1.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Scope (this spec) | Week 1 only (11 lessons) | Smaller deliverable, shippable before Weeks 2–4 depend on it. First cohort runs this arc while Spec #13 is authored. |
| Language scope | Swift only | Kotlin mirrors later in a separate spec. |
| Pool size per concept lesson | 10 exercises | Tuned for Week 1's language concepts where many exercise variants are natural (optionals, generics, closures all have many angles). |
| Pool size for diagnostic | 15 fixed exercises, no rotation | Diagnostic is a gate quiz, not practice. Same 15 every attempt. |
| Exercise type mix | code 40% / predict_output 25% / fill_blank 15% / fix_bug 15% / multiple_choice 5% | Favors `code` and `predict_output` — the skills that matter going into Week 2. Targets, not hard rules — individual lessons shift based on concept. |
| `cohortGate` on Week 1 lessons | null (unset) | Foundational — both 4-week and 12-week cohorts see all Week 1 lessons. |
| Diagnostic passing threshold | 70% | Proposed gate; validated against first cohort. |
| Pedagogical patterns | Recap + tooltip + "Coming from..." (carried from prior draft) | Enforced by compiler (recap) and style guide (tooltip, "Coming from..."). |
| Authoring execution | Subagent-driven, one subagent per lesson | Week 1 content is high-volume and mechanical — well-suited to LLMs. Shared style guide + per-lesson review loop mitigates consistency risk. |
| Style guide | Single `curriculum/STYLE_GUIDE.md` | Every authoring subagent reads this + polished reference lessons (01, 02) before writing. |
| Review model | Two reviewers per lesson — Swift correctness + pedagogy | Run after each author subagent. Fix loop up to 2 cycles before controller escalation. |
| Parallelism | Up to 3 author subagents in parallel | Lessons are independent after 01 and 02 are stable. Drops to sequential if quality drifts. |
| Publication | Incremental — lessons ship as they pass review | No big-bang release. Controller samples lessons as they land and can halt the pipeline. |

## Lesson inventory

Track `swift-fundamentals` at `curriculum/swift-fundamentals/`. 11 lesson files.

| # | File | Topic | Pool |
|---|------|-------|------|
| 01 | `01-intro.md` | Intro & toolchain — `let`/`var`, type inference, the playground model | 10 |
| 02 | `02-functions.md` | Functions — declaration, params, return types, multiple returns via tuples | 10 |
| 03 | `03-types-value-vs-reference.md` | Types & value vs reference — primitives, tuples, `struct` vs `class`, identity vs equality | 10 |
| 04 | `04-optionals.md` | Optionals — `?`/`!`, `if let`, `guard let`, `??`, optional chaining | 10 |
| 05 | `05-collections.md` | Collections — `Array`, `Dictionary`, `Set`, `map`/`filter`/`reduce` in Swift flavor | 10 |
| 06 | `06-control-flow.md` | Control flow & pattern matching — `switch` exhaustiveness, `where`, ranges, `for-in` | 10 |
| 07 | `07-closures.md` | Closures — trailing closure syntax, capture lists, `@escaping` | 10 |
| 08 | `08-protocols.md` | Protocols & extensions — conformance, default implementations, protocol-oriented mindset | 10 |
| 09 | `09-generics.md` | Generics — generic functions, `where` constraints, associated types (skim only) | 10 |
| 10 | `10-error-handling.md` | Error handling — `throws`, `try`/`try?`/`try!`, `do/catch`, `Result` | 10 |
| 11 | `11-async-await.md` | Async/await — `async` functions, `await`, `Task`, structured concurrency basics | 10 |
| 12 | `12-diagnostic.md` | Week-1 diagnostic — 15 fixed exercises sampling lessons 01–11. Gate to Week 2. | 15 fixed |

**Totals:** 11 concept lessons × 10 exercises + 15 diagnostic exercises = **125 exercises**. Counting reflects the existing stub split (`01-intro.md` and `02-functions.md` are separate files); they stay separate.

## Pedagogical patterns

Every lesson file MUST contain:

1. **Frontmatter** with `type: lesson`, `title`, `level: beginner|intermediate|advanced`, `summary`. `cohortGate` is unset for Week 1.
2. **Explanation blocks** in markdown teaching the concept, terse and comparative.
3. **Exactly one `"Coming from..."` callout** per lesson, targeted at Python, JavaScript, Java, or C++. Rotates across lessons so students with any of these backgrounds get hit at least once.
4. **1–3 `**What's going on here**` tooltip callouts** under non-obvious code snippets. Swift idioms only (trailing closures, `$0`, `try await`, property wrappers). Not under every code fence.
5. **8–10 exercises** (or 15 for the diagnostic), ordered by intended progression — simpler/more-introductory first, harder/edge-cases later. Type distribution targets the values in §Decisions.
6. **`## What you learned` section** at the end with three subheadings:
   - `**Concepts:**` — 3–6 bullet points of what was covered
   - `**Swift-specific vs other languages:**` — 1–2 sentences comparing to Python/JS/Java/C++
   - `**What's next:**` — 1 sentence pointing forward to where the concept shows up next

The curriculum compiler (Spec #9) fails publish if `## What you learned` is missing or any subheading is absent.

## Subagent style guide (new deliverable: `curriculum/STYLE_GUIDE.md`)

**Purpose:** every authoring subagent reads this before writing a lesson. Prevents voice drift and terminology inconsistency across 11 independently-dispatched agents.

Contents:

1. **Voice** — terse, comparative, grad-appropriate. No "let's", "we'll", "don't worry". Assume programming fluency.
2. **Terminology canon** — preferred terms: "value type" not "struct type", "unwrap" not "extract", "conform to" not "implement" (for protocols), "immutable" not "constant" for Swift `let` semantics.
3. **Forward-reference rule** — reference earlier lessons by number when a concept is revisited (e.g., "Optionals from Lesson 04"). Do NOT re-teach. One-sentence refreshers OK; paragraphs are not.
4. **Exercise prompt conventions** — single declarative sentences. "Write a function that returns the first duplicate in an array." No setup preamble.
5. **"Coming from..." rule** — exactly one per lesson, placed on the most-novel concept for the target language group. Each lesson targets ONE source language; track distribution so all four (Python/JS/Java/C++) appear across the 11 lessons.
6. **Tooltip budget** — 1–3 per lesson. If a snippet needs more than 3 explanatory tooltips, break the snippet into smaller pieces.
7. **Markdown frontmatter template** — exact required fields, example shown.
8. **Exercise payload formats** — exact format for each of the 5 exercise types (`code`, `fix_bug`, `fill_blank`, `predict_output`, `multiple_choice`), matching `curriculum/src/validator.ts` schemas.
9. **Swift version & idioms** — target Swift 5.10. Do-use: `@Observable`, `async`/`await`, `Result`, `guard let`, `if case`, trailing closure syntax. Don't-use: `ObservableObject` (legacy in SwiftUI pipeline but not here), completion handlers, force unwrap in instructional code.
10. **Reference lessons** — `01-intro.md` and `02-functions.md`, polished in Phase 1, are the canonical pattern. Every subagent is told to read them.

## Authoring execution model

### Per-lesson flow

1. **Author subagent** invoked with:
   - Full `STYLE_GUIDE.md` contents
   - Full text of reference lessons 01 and 02
   - Short brief: lesson number, topic, pool size, type distribution target, target "Coming from..." source language
2. Author subagent writes the lesson file in full (frontmatter + explanation blocks + exercises + recap).
3. Author subagent runs `npx tsx curriculum/compile.ts --dry-run <path>` to confirm the file parses and passes all compiler validations (pool size ≥ 4, cohortGate enum if set, exercise payload schemas).
4. **Swift correctness review subagent** reads the lesson file:
   - Swift 5.10 syntax is valid
   - Idiomatic Swift (no force-unwraps in teaching code, appropriate use of optionals/guards)
   - Exercise tests actually test what the prompt asks
   - Code fences tagged correctly (`:starter`, `:solution`, `:test` as applicable)
   - No references to concepts not yet introduced (forward-reference violations)
   - Returns APPROVED or ISSUES (with specifics)
5. **Pedagogy review subagent** reads the lesson file + STYLE_GUIDE:
   - Voice matches the canon
   - Exactly one "Coming from..." callout, present and well-placed
   - Tooltip count in range (1–3)
   - Recap section structurally correct (all three subheadings, in order)
   - Exercise prompts terse (no preamble)
   - Returns APPROVED or ISSUES (with specifics)
6. **Fix loop** — if either reviewer returns ISSUES, author subagent applies fixes. Max 2 cycles; if still failing, escalate to controller.
7. **Commit** — lesson file committed to `feat/week-1-curriculum` branch in the curriculum repo with message `feat(curriculum): week 1 lesson <N> — <topic>`.

### Parallelism

- Lessons 03–11 can author in parallel after Phase 1 (style guide + reference lessons) lands.
- Conservative: 3 author subagents in parallel at any time.
- Per-lesson reviewers run sequentially after each author finishes (cheap, fast).
- If conflicts or quality drift surface, drop to sequential.
- Lesson 12 (diagnostic) is authored LAST, single subagent, draws content from finalized pools of 01–11.

### Controller escalation triggers

- Any lesson fails 2 fix cycles
- Swift 5.10 compiler or platform compile fails
- Reviewers disagree in a fix cycle (author flips back and forth)
- Style guide gaps surface (multiple lessons hit the same ambiguity)

Controller (me) reads the reviewer reports, updates STYLE_GUIDE if needed, and re-dispatches.

## Publication sequence

**Phase 1 — Reference pattern (non-parallel).**
- Write `curriculum/STYLE_GUIDE.md`
- Polish existing stub `01-intro.md` — expand to full 10-exercise pool, apply all pedagogical patterns
- Polish existing stub `02-functions.md` — same treatment
- Commit Phase 1 artifacts on `feat/week-1-curriculum`
- User reviews and approves the reference pattern before Phase 2 launches

**Phase 2 — Bulk authoring (parallel, up to 3 at a time).**
- Dispatch author + reviewer subagents for lessons 03–11 (9 lessons)
- Each lesson lands on `feat/week-1-curriculum` as it passes review
- Rolling commits; no big-bang release

**Phase 3 — Diagnostic (single subagent).**
- Author lesson 12 diagnostic with 15 fixed exercises drawn from 01–11 content
- Reviewers run as normal

**Phase 4 — Integration smoke.**
- Update `curriculum/swift-fundamentals/track.md` to list all 12 lesson ids in `lessons:` array
- Run `npx tsx curriculum/compile.ts --publish` to write lessons to the platform DB
- Run `npm test` in the curriculum repo (expect all tests green)
- Manual smoke in web app: log in as a test student, open the Swift Fundamentals track, complete one exercise per type, confirm grading/review pipeline works end-to-end
- Merge `feat/week-1-curriculum` to `master` on the curriculum repo

## Deliverables

1. `curriculum/STYLE_GUIDE.md` — authoring reference for all subagents
2. `curriculum/swift-fundamentals/01-intro.md` — polished reference lesson (10-exercise pool)
3. `curriculum/swift-fundamentals/02-functions.md` — polished reference lesson (10-exercise pool)
4. `curriculum/swift-fundamentals/03-types-value-vs-reference.md` through `11-async-await.md` — 9 subagent-authored lessons
5. `curriculum/swift-fundamentals/12-diagnostic.md` — gate quiz, 15 fixed exercises
6. `curriculum/swift-fundamentals/track.md` — updated `lessons:` list

## Testing & verification

- **Compiler** — each lesson passes `npx tsx curriculum/compile.ts --dry-run <path>` before commit. Compiler validates pool size, frontmatter, exercise payload schemas, recap section structure (Spec #11 compiler additions).
- **Curriculum repo tests** — existing `tests/compile.test.ts`, `compiler.test.ts`, `parser.test.ts`, `validator.test.ts`, `hasher.test.ts` (80 tests total) stay green throughout.
- **Platform integration** — after Phase 4 publish, the web app's lesson-runtime (Spec #2) renders each lesson correctly; auto-grader (Spec #5) runs against sample student submissions; AI review (Spec #7) fires on code exercises.
- **Diagnostic** — pass threshold 70%; enforced at runtime by the Enrollment state machine (existing) once the track is published.

## Known risks

- **LLM Swift idiom drift** — subagents may default to non-idiomatic Swift (e.g., ObjC-style camel case, force unwraps in teaching code). Mitigation: STYLE_GUIDE + Swift-correctness reviewer, plus reference lessons as pattern.
- **Cross-lesson redundancy** — multiple subagents independently re-explaining optionals. Mitigation: pedagogy reviewer enforces forward-reference rule + numbered cross-references.
- **Exercise test quality** — auto-graded tests that accept bad solutions. Mitigation: Swift-correctness reviewer checks tests match the stated prompt; diagnostic exercises get controller review before ship.
- **Diagnostic difficulty calibration** — 70% threshold may be too lenient or strict. Mitigation: treat the first cohort as the calibration run; adjust threshold after.

## Out of scope

- Weeks 2–4 SwiftUI/UIKit/Xcode content (Spec #13)
- Mini Peacock starter repo, hosted catalog endpoint, asset sourcing (Spec #13)
- 3-month depth extensions on Week 1 topics (Spec #14 — would add 5–8 deeper lessons like memory management, macros, SPM, testing, tagged `cohortGate: twelve_week`)
- Kotlin fundamentals track (separate spec)
- Authoring tooling improvements beyond Spec #9 already ships
- Any UI changes to the platform or web app
