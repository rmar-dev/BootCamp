# Content & Curriculum Model — Design

**Date:** 2026-04-08
**Status:** Approved (pending written-spec review)
**Spec #** 1 of ~10 for the BootCamp learning platform
**Parent project:** Codecademy-style web platform teaching Swift and Kotlin fundamentals, bridging to a Mini Peacock streaming-app capstone

## Purpose

Define the data shape — entities, relationships, and the rules that bind them — for all learning content and student progress on the BootCamp platform. Every other subsystem (lesson runtime, code execution, gamification, code review, capstone bridge) reads from or writes to the model defined here. The model must be expressive enough for a Codecademy-grade learning experience and rigid enough that downstream systems can rely on it.

This spec covers **storage shape only**. It does not define:

- The lesson runtime UI (spec #2)
- The code execution backend (spec #3)
- Auth, accounts, and cohort management beyond stub references (spec #4)
- The grading and submission pipeline beyond the data it produces (spec #5)
- Gamification mechanics beyond the points field this model exposes (spec #6)
- AI / human code review pipelines (specs #7 / #8)
- Curriculum authoring tooling (spec #9)
- The Mini Peacock capstone bridge (spec #10)

## Decisions Locked In During Brainstorming

These five decisions shape the model. Each was chosen from explicit alternatives and is recorded here so later changes have to argue against the original reasoning.

1. **Lesson granularity (Q1 → C):** Lessons are an ordered list of typed *blocks*, each block being either an explanation or an exercise. Hybrid of "one lesson = one exercise" and "one lesson = many exercises." Matches modern Codecademy / Boot.dev / freeCodeCamp shape.
2. **Exercise types (Q2 → B):** Five types in V1: `code`, `fix_bug`, `fill_blank`, `predict_output`, `multiple_choice`. Excludes drag-to-order, free-form mini-projects, and pure code-explanation exercises (those depend on review pipelines and belong in later specs).
3. **Adaptivity (Q3 → A + D):** Placement quiz at the start of each track assigns a difficulty level (`beginner` / `intermediate` / `advanced`) that determines which lesson the student starts on. Within each exercise, hints are revealed progressively as the student fails attempts. No per-exercise difficulty variants, no branching prerequisite paths.
4. **Scoring (Q4 → B):** Pass/fail with attempt-aware points. Full points on a clean first try; penalties for hints used and failed prior attempts; floored at 20% of max. Exact formula in *Scoring* below.
5. **Track structure (Q5 → A):** Independent parallel tracks per language. Swift and Kotlin tracks are separate but mirrored in outline so a cohort can progress in lockstep. The Mini Peacock capstone is a separate track per language. No shared "common fundamentals" track, no per-language exercise variants on a single unified track.

## Entities

The model has ten entities, organized into two halves: **content** (what authors create) and **state** (what students generate by using the platform).

### Content half

#### Track
A self-contained learning path. The unit a student enrolls in.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `version` | int | Bumped on publish; older versions retained (see *Versioning*) |
| `title` | string | |
| `language` | enum | `swift` \| `kotlin` |
| `kind` | enum | `placement` \| `fundamentals` \| `capstone` |
| `description` | text | |
| `lesson_ids` | uuid[] | Ordered |
| `published_at` | timestamp | Null while in draft |

V1 ships six tracks: `Swift Placement`, `Kotlin Placement`, `Swift Fundamentals`, `Kotlin Fundamentals`, `Swift Mini Peacock Capstone`, `Kotlin Mini Peacock Capstone`.

#### Lesson
A unit within a track. A student is "on" exactly one lesson at a time per enrolled track.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `version` | int | |
| `track_id` | uuid | |
| `position` | int | Order within the track |
| `title` | string | |
| `level` | enum | `beginner` \| `intermediate` \| `advanced`. Drives placement routing. |
| `summary` | text | One-paragraph overview |
| `block_ids` | uuid[] | Ordered |
| `published_at` | timestamp | |

#### Block
The pieces inside a lesson, in order. A discriminated union: every block is either explanation or exercise.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `lesson_id` | uuid | |
| `position` | int | Order within the lesson |
| `kind` | enum | `explanation` \| `exercise` |
| `explanation_markdown` | text | Required when `kind = explanation`, null otherwise |
| `exercise_id` | uuid | Required when `kind = exercise`, null otherwise |
| `exercise_version` | int | Required when `kind = exercise`. Pins the specific Exercise version this lesson version references. |

The discriminator-and-nullable-fields shape is chosen over per-kind subtables for V1 simplicity. A future migration to subtables is possible if either kind grows additional fields.

#### Exercise
The graded unit. Referenced by exactly one Block via `block.exercise_id`.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `version` | int | |
| `lesson_id` | uuid | Back-reference for queries |
| `prompt_markdown` | text | What the student is asked to do |
| `type` | enum | `code` \| `fix_bug` \| `fill_blank` \| `predict_output` \| `multiple_choice` |
| `payload` | json | Type-specific shape, see below |
| `points_max` | int | Full points if passed first try with no hints |
| `hints` | string[] | Ordered, revealed sequentially. Empty list = no hints. |
| `concepts` | string[] | Flat tag list (e.g., `["optionals", "control-flow"]`) |
| `published_at` | timestamp | |

##### Exercise `payload` shape per type

Stored as JSON. Schema enforced at the application layer, not the database.

**`code`**
```
{
  "language": "swift" | "kotlin",
  "starter_code": "<string>",
  "test_code": "<string>",        // hidden from student; runner appends this to submission
  "test_entry_point": "<string>"  // function name to invoke for grading, e.g., "runTests"
}
```

**`fix_bug`**
```
{
  "language": "swift" | "kotlin",
  "broken_code": "<string>",
  "test_code": "<string>",
  "test_entry_point": "<string>"
}
```

**`fill_blank`**
```
{
  "language": "swift" | "kotlin",
  "template": "<string with ___ markers>",
  "blanks": [
    { "id": "blank_1", "expected": ["foo", "Foo"] },  // accepted answers
    ...
  ]
}
```

Grading: each blank's submission must match one of its `expected` strings (case-sensitive). Whole exercise passes only if all blanks pass.

**`predict_output`**
```
{
  "displayed_code": "<string>",   // shown to student, not run
  "displayed_language": "swift" | "kotlin",
  "expected_output": "<string>"   // exact match against student's answer (trimmed)
}
```

**`multiple_choice`**
```
{
  "question_markdown": "<string>",
  "options": [
    { "id": "opt_a", "text": "..." },
    { "id": "opt_b", "text": "..." },
    ...
  ],
  "correct_option_ids": ["opt_a"],  // length > 1 means multi-select
  "multi_select": false             // UI hint
}
```

#### Hint
Not a separate entity. Hints are an ordered `string[]` on each Exercise. The runtime owns escalation logic (when to reveal the next hint); the model just stores the text.

### State half

#### Student
A user account.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `name` | string | |
| `email` | string | Unique |
| `cohort_id` | uuid | Nullable |
| `created_at` | timestamp | |

Auth tokens, passwords, instructor flags, and profile fields belong in spec #4 and are intentionally omitted here.

#### Cohort
A group of students moving through tracks together. Owned by spec #4; this model holds only the id and a stub.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `name` | string | |
| `instructor_id` | uuid | Stub — Instructor entity defined in spec #4 |
| `start_date` | date | |

#### Enrollment
Joins a Student to a Track. One per (student, track).

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `student_id` | uuid | |
| `track_id` | uuid | |
| `track_version` | int | The version of the track this student is progressing through |
| `enrolled_at` | timestamp | |
| `assigned_level` | enum | `beginner` \| `intermediate` \| `advanced`. Set by placement quiz. |
| `current_lesson_id` | uuid | Nullable until first lesson begins |
| `current_lesson_version` | int | Pinned at enrollment time |
| `status` | enum | `active` \| `completed` \| `paused` |

A student's placement quiz result writes the `assigned_level` and points `current_lesson_id` at the first lesson in the target track whose `level` matches.

#### Attempt
A single submission to a single exercise. Append-only.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `student_id` | uuid | |
| `exercise_id` | uuid | |
| `exercise_version` | int | The version the student was working against |
| `submitted_at` | timestamp | |
| `submission_payload` | json | Student's actual code/answer; shape depends on exercise type |
| `passed` | bool | |
| `hints_used_count` | int | How many hints were revealed at submission time |
| `failed_attempts_before` | int | Count of prior failed attempts on this exercise by this student |
| `points_awarded` | int | Per scoring formula; 0 if `passed = false` |

Append-only: every submission writes a new row, nothing is updated. This gives full per-student per-exercise history for review pipelines and instructor dashboards.

##### `submission_payload` shape per exercise type

| Exercise type | Submission payload |
|---|---|
| `code` | `{ "code": "<string>" }` |
| `fix_bug` | `{ "code": "<string>" }` |
| `fill_blank` | `{ "blanks": { "blank_1": "<string>", ... } }` |
| `predict_output` | `{ "answer": "<string>" }` |
| `multiple_choice` | `{ "selected_option_ids": ["opt_a", ...] }` |

#### ExerciseResult
The "best result so far" rollup for one (student, exercise). One row per (student, exercise). Updated whenever a new Attempt is recorded.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | |
| `student_id` | uuid | |
| `exercise_id` | uuid | |
| `best_attempt_id` | uuid | FK to Attempt |
| `passed` | bool | Has any attempt passed? |
| `points_earned` | int | Highest `points_awarded` across passing attempts |
| `attempts_count` | int | Total attempts to date |
| `first_passed_at` | timestamp | Nullable |

ExerciseResult exists because Attempt is append-only — without a rollup, computing "did this student finish lesson 12?" requires scanning every Attempt row. Rollup makes lesson/track progress queries cheap.

## Derived State

Some questions the model intentionally does *not* store. They are computed on demand because storing them would create staleness bugs.

- **"Has student S completed lesson L?"** → True iff every Exercise in L has an ExerciseResult for S where `passed = true`. No `LessonCompletion` entity.
- **"What lesson is student S on in track T?"** → `Enrollment.current_lesson_id` for that (student, track). No separate progress entity.
- **"Has student S completed track T?"** → True iff every Lesson in T has been completed by S. The runtime updates `Enrollment.status = completed` when this becomes true; the value is a cache, not a source of truth.

## Scoring Formula

When an Attempt is recorded for a passing submission:

```
raw = points_max
    - (hints_used_count       * 0.10 * points_max)
    - (failed_attempts_before * 0.05 * points_max)

points_awarded = max(raw, 0.20 * points_max)
```

For a failing submission, `points_awarded = 0` regardless.

The ExerciseResult rollup records `points_earned = max(points_awarded across all passing attempts)`. A student's first passing attempt is usually their highest, but the formula is written to allow a later attempt with fewer hints to improve the score in edge cases.

## Versioning

Tracks, Lessons, and Exercises are immutable once published. Each entity uses a **stable id with an incrementing version column**: editing a published row creates a new row with the *same* `id` and `version = old.version + 1`. The composite key `(id, version)` is unique. The old row is never modified or deleted.

- New enrollments always get the latest published version of their target track and its lessons/exercises.
- Existing enrollments stay pinned via `Enrollment.track_version` and `Enrollment.current_lesson_version`. Each Attempt records `exercise_version`, and each Block at a given lesson version pins `exercise_version` so a lesson snapshot fully determines the exercises a student sees.
- A Track's version is bumped when its `lesson_ids` list changes (lesson added, removed, or reordered) or when one of its referenced lesson versions changes. A Lesson's version is bumped on edits to its blocks or its metadata. An Exercise's version is bumped on any edit to prompt, payload, hints, or concepts.

The cost is one extra integer column on three entities, an extra `exercise_version` on Block, and `(id, version)` lookup patterns in any query that needs a specific historical version. The benefit is that authors can fix typos and improve content without breaking in-progress students.

**Publish flow:** authors edit content in a draft state (this spec does not define how — see spec #9). When ready, they call a publish action that mints a new version row and sets `published_at`. The old version is not deleted.

## Concept Tags

Each Exercise carries a flat `concepts: string[]`. There is no Concept entity, no parent/child taxonomy.

- Lessons inherit the union of their exercises' concepts (computed on demand, not stored).
- The placement quiz uses these tags to identify the student's strengths and weaknesses, then maps the result to a `level` enum value (the actual mapping logic belongs to the placement-quiz feature, which is a special Track of `kind = placement`).
- Authors are expected to follow a documented concept vocabulary (defined in spec #9). Consistency is enforced by convention, not by database constraint.

If concept tags become unwieldy in practice, a future spec can introduce a Concept entity with hierarchy. The migration is straightforward: add the entity, link Exercises to it, deprecate the string field.

## Capstone Track Shape

Capstone tracks reuse the Track / Lesson / Block / Exercise structure with no new entities. Spec #10 (Capstone Bridge) will introduce one additional value to the Exercise `type` enum: `local_build_milestone`. Its payload will be roughly `{ starter_repo_url, milestone_checklist, submission_method }` and its grading runs through a separate pipeline (local code submitted via Git, processed by CI, optionally reviewed by AI/instructor).

This spec deliberately does *not* define `local_build_milestone`'s payload or grading. It only commits to the principle: capstone tracks are "regular tracks with one extra exercise type added later." All cross-cutting features — student state, points, progress, gamification, code review — work on capstones for free because the shape is reused.

## Authoring Format

Out of scope for this spec. Spec #9 (Curriculum Authoring Tooling) will design the format authors actually write in (likely markdown with frontmatter, compiled into the storage model defined here, but not committed to). The storage model must be richer than any one authoring format so that switching authoring tools later does not force a model migration.

## Success Criteria

The model is correct if it can answer all of the following queries without changes:

1. Render lesson 5 of the Swift Fundamentals track for a student enrolled at intermediate level, showing the right version of every block.
2. Submit a `code` exercise solution and record the attempt with correct point calculation given prior hints used and prior failed attempts.
3. Determine which lesson a student should advance to after completing all exercises in their current lesson.
4. Compute a cohort leaderboard ranking by total points earned across all enrolled tracks (gamification spec #6 will own the query; the model must support it).
5. Show an instructor every Attempt a student has made on a specific exercise, in order, with their full submission code (instructor review spec #8 will own the UI; the model must support it).
6. Edit a typo in a published lesson and have new enrollments see the fix while in-progress students continue against the version they started on.
7. Run a Swift Placement quiz, derive the student's level from their answers' concept tags, create their Swift Fundamentals enrollment with the correct `assigned_level`, and point `current_lesson_id` at the right starting lesson.

## Out of Scope

- Lesson runtime rendering and editor UI (spec #2)
- Code execution backend (spec #3)
- Auth, sessions, password management, instructor flags (spec #4)
- Submission grading pipeline implementation — only the Attempt and ExerciseResult shapes it must produce (spec #5)
- Gamification rules beyond `points_earned` exposed by ExerciseResult (spec #6)
- AI / instructor code review pipelines (specs #7 / #8)
- Authoring format and tooling (spec #9)
- Capstone milestone exercise definition and local-build submission flow (spec #10)
- Indexes, partitioning, choice of database engine — all implementation concerns for the plan, not the model

## Open Questions

None at this time. All Q1–Q5 brainstorming questions resolved; all four "decisions on your behalf" in Section 3 explicitly confirmed before this document was written.
