# Instructor pages — Sub-project G design

**Date:** 2026-05-09
**Sub-project:** G (Instructor pages) — seventh in the multi-PR UI refactor
**Web base:** `master @ f439401`
**Platform base:** `master @ ac9d56c`
**Repo scope:** two-repo, platform-first then web
**Predecessors:** A (UI Foundation), B (App Shell), C (Dashboard), D (Tracks / Skill Tree), E (Lesson Player), F (Profile + Leaderboard)

## Summary

Expands the Instructor concept from "code reviewer + capstone approver" to a first-class human-in-the-loop role with five new capabilities, plus the originally-scoped UI refactor of the existing instructor pages.

The five new capabilities, derived from the 2026-05-09 product decisions:

1. **Per-student instructor assignment (1:N)** — every student has one assigned instructor independent of cohort membership; an instructor has many assigned students.
2. **Per-student difficulty tuning** — coarse dial (Easy / Standard / Challenging) plus per-exam overrides (extend time, optional blocks, swap exercises).
3. **Instructor-authored custom exercises with visibility scope** — `private-to-student` | `cohort` | `track` | `public`. Reuses the existing versioned-content model and the existing builder UI (which is currently localStorage-only); G ships its first backend persistence path.
4. **Help requests** — students raise contextual help requests anchored to a lesson, exercise, or attempt; instructors triage them in a unified inbox.
5. **Multi-rater public project ratings** — any instructor (not only the assigned one) can rate a project / capstone submission; ratings are public and stored as multiple rows per submission.

The UI refactor (the original scope of G) is folded into the same sub-project: queue table, review form, review thread, and the lesson builder shell are restyled with the design-system primitives at the same time the new pages land.

Two-repo: platform ships schema + endpoints first; web consumes second.

## Goals

- Add five Prisma models / fields enabling the new capabilities, with a single migration.
- Expose ten new instructor-scoped endpoints under `/api/instructor/*`, all guarded by `JwtAuthGuard + RolesGuard('instructor')` except where noted (students post help requests and project ratings are public-readable).
- Wire the existing lesson-builder UI to a real `POST /api/instructor/exercises` (replacing the localStorage-only `mockSave`).
- Ship four new authenticated routes under `app/(authed)/(shell)/instructor/`: `students/`, `students/[id]/`, `help/`, `ratings/`.
- Refactor the three existing instructor pages (queue, review, builder index) onto the design-system primitives.
- Preserve the existing `instructor-review` module's contracts (the queue / review / approve endpoints stay backward-compatible).

## Non-goals

- **No removal of `Cohort.instructorId`** — the cohort-lead concept stays for cohort-wide operations (cohort leaderboard scope, cohort gating). The new `Student.instructorId` is per-student and additive.
- **No instructor-of-instructor / supervisor hierarchy.**
- **No instructor messaging outside help-request threads** — there is no general DM inbox. All async student↔instructor comms ride either help requests (new) or review threads (existing per-attempt).
- **No re-authoring of the existing block / exercise types** — instructor-authored exercises use the same `Exercise` schema and the same six (now seven, with `visual_playground`) `ExerciseType`s.
- **No cron / batch promotion of help requests** — instructors triage manually.
- **No persistence of difficulty change history** — current difficulty only; auditing change history is out of scope.
- **No automatic re-rating when a project submission is updated** — each rating is tied to the submission as-of-rating-time; if the student resubmits, prior ratings stand and new ones get added.
- **No retirement of `Attempt.approvedByInstructorId`** — capstone single-approver path stays for backward compatibility; multi-rater ratings layer on top for "additional" project feedback. Approval gates the pass/fail outcome; ratings are advisory feedback for the student.
- **No `darkMode: 'class'` Tailwind cleanup** — that's H's job.

## Design decisions

### Q1 — Student↔Instructor assignment model

**`Student.instructorId String? @db.Uuid` — single nullable FK on the student.**

Rationale: matches the resolved 1:N decision. Nullable because (a) legacy students predating G have no assignment and (b) admins can intentionally leave a student unassigned (e.g., during enrollment). Unassigned students are surfaced in an "Unassigned" queue on the `/instructor/students` page for any instructor to claim.

Cohort lead (`Cohort.instructorId`) and assigned instructor (`Student.instructorId`) are independent. Default at student creation: if the student joins a cohort with a lead, `Student.instructorId` is set to the cohort lead. If the cohort changes leads, existing assignments are NOT cascaded — explicit reassignment is required. This keeps assignment stable through admin churn.

### Q2 — Difficulty model

**Two-table approach:**

```prisma
model StudentDifficulty {
  studentId    String             @id @db.Uuid
  baseline     DifficultyBaseline @default(standard)
  updatedAt    DateTime           @updatedAt
  updatedBy    String             @db.Uuid          // userId of the instructor
}

model ExamDifficultyOverride {
  id              String   @id @default(uuid()) @db.Uuid
  studentId       String   @db.Uuid
  exerciseId      String   @db.Uuid
  exerciseVersion Int
  extendTimeMs    Int?                              // null = no time override
  optional        Boolean  @default(false)          // skip-without-penalty
  swapToExerciseId      String?  @db.Uuid          // replace this exercise
  swapToExerciseVersion Int?
  updatedAt       DateTime @updatedAt
  updatedBy       String   @db.Uuid
  @@unique([studentId, exerciseId])
}

enum DifficultyBaseline { easy standard challenging }
```

The baseline dial is a single row keyed by student. Per-exam overrides are individual rows; a student can have zero or many. Override fields are all nullable so an instructor can layer (e.g., extend time without swapping).

**Effect on lesson assembly:** `LessonAssemblerService` consults `StudentDifficulty.baseline` to bias exercise selection (Easy → fewer exercises, more hints visible, lower-pointsMax bias; Challenging → opposite). For each exercise the assembler emits, it consults `ExamDifficultyOverride` and applies swaps / time / optional flags.

**Why not store difficulty deltas as JSON on `Student`:** typed schema enables a future analytics path ("how often do instructors lower difficulty in week 2?") without re-shaping JSON.

### Q3 — Exercise authorship + visibility

Existing `Exercise` is `(id, version)` with `publishedAt`, `contentHash`, `payload`, etc. Author and visibility live in two new fields:

```prisma
model Exercise {
  // ... existing fields
  authorId    String?           @db.Uuid           // null = curriculum-authored (legacy)
  visibility  ExerciseVisibility @default(public)
  scopeId     String?           @db.Uuid           // FK target depends on visibility
  // composite scope: when visibility = private_to_student, scopeId = studentId
  //                  when visibility = cohort,             scopeId = cohortId
  //                  when visibility = track,              scopeId = trackId
  //                  when visibility = public,             scopeId = null
}

enum ExerciseVisibility { private_to_student cohort track public }
```

Scope is a single discriminated FK (`scopeId` interpreted by `visibility`). This avoids three separate nullable FKs and keeps cardinality clear: one scope per exercise.

**Visibility resolution at lesson-assembly time:**

```
filter: exercise belongs to lesson AND (
  visibility = public OR
  (visibility = track AND scopeId = lesson.trackId) OR
  (visibility = cohort AND scopeId = student.cohortId) OR
  (visibility = private_to_student AND scopeId = student.id)
)
```

Curriculum-compiled exercises continue to write `authorId = null, visibility = public`. The compiler does not need to know about authorship.

**Why discriminated `scopeId` over `studentId/cohortId/trackId` columns:** keeps `Exercise` schema small; the discriminator pattern is well-understood; lookup queries are still indexable on `(visibility, scopeId)`.

### Q4 — Help request model + UX

```prisma
model HelpRequest {
  id              String           @id @default(uuid()) @db.Uuid
  studentId       String           @db.Uuid
  instructorId    String           @db.Uuid          // assigned instructor at time of creation
  anchorKind      HelpAnchorKind
  anchorId        String           @db.Uuid          // lessonId | exerciseId | attemptId
  title           String                              // student-supplied, max 200
  status          HelpRequestStatus @default(open)
  createdAt       DateTime         @default(now())
  resolvedAt      DateTime?
  messages        HelpMessage[]
  @@index([instructorId, status])
  @@index([studentId, status])
}

model HelpMessage {
  id            String   @id @default(uuid()) @db.Uuid
  helpRequestId String   @db.Uuid
  authorId      String   @db.Uuid
  body          String
  createdAt     DateTime @default(now())
  helpRequest   HelpRequest @relation(fields: [helpRequestId], references: [id])
  @@index([helpRequestId])
}

enum HelpAnchorKind     { lesson exercise attempt }
enum HelpRequestStatus  { open answered resolved }
```

`instructorId` is captured at creation and does NOT change if the student is later reassigned — the request stays with whoever was supposed to handle it. The `/instructor/help` inbox query is `WHERE instructorId = me AND status != 'resolved' ORDER BY createdAt DESC`.

**Status transitions:**
- `open` → `answered` when the assigned instructor posts the first reply.
- `answered` → `resolved` when the student or instructor closes it.
- `answered` → `open` if the student replies after instructor (re-opened, awaiting instructor again).

The design rule "best UX" yields: contextual creation (a "Need help?" button on the lesson page, exercise renderers, and the attempt detail), threaded conversation, and a single inbox grouped by student with the originating context one click away.

### Q5 — Project rating model

```prisma
model ProjectRating {
  id              String   @id @default(uuid()) @db.Uuid
  attemptId       String   @db.Uuid                   // not unique — multi-rater
  raterUserId     String   @db.Uuid                   // any instructor
  score           Int                                  // 1..5
  comment         String                               // markdown, max 4000
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  @@unique([attemptId, raterUserId])                  // one rating per (rater, submission)
  @@index([attemptId])
}
```

Multi-rater: zero-or-many rows per `Attempt`. Unique on `(attemptId, raterUserId)` so a rater updates rather than duplicates. Public read (any authenticated user including the student); write restricted to `Roles('instructor')`.

The student sees:
- The assigned instructor's rating displayed first as primary.
- All other instructor ratings listed below with rater name + avatar + score + comment.
- An aggregate average if there are ≥ 2 ratings.

`Attempt.approvedByInstructorId` continues to gate capstone pass/fail. A `ProjectRating` does NOT mark the attempt approved or change `passed` / `pointsAwarded`. They are orthogonal: approval = "this counts toward the capstone outcome"; rating = "here is feedback on the work".

### Q6 — Endpoint surface

All under `/api/instructor/*` unless noted. Existing endpoints (queue, review, approve) are preserved.

**Roster / assignment**
- `GET /api/instructor/students` — instructor's assigned students with KPIs (last activity, current streak, current lesson, open help-request count).
- `GET /api/instructor/students/unassigned` — students with `instructorId IS NULL`, paginated.
- `PUT /api/instructor/students/:studentId/assign` — claim or reassign a student. Body: `{ instructorUserId }`. Admin can reassign; instructors can claim unassigned or release their own.
- `GET /api/instructor/student/:studentId` — full student detail: roster KPIs + difficulty + recent attempts + open help requests + custom exercises authored for them.

**Difficulty**
- `PUT /api/instructor/student/:studentId/difficulty` — set `baseline`. Body: `{ baseline: 'easy'|'standard'|'challenging' }`.
- `PUT /api/instructor/student/:studentId/exam-override` — upsert per-exam override. Body: `{ exerciseId, exerciseVersion, extendTimeMs?, optional?, swapToExerciseId?, swapToExerciseVersion? }`.
- `DELETE /api/instructor/student/:studentId/exam-override/:exerciseId` — remove override.

**Custom exercises**
- `POST /api/instructor/exercises` — create draft custom exercise. Body mirrors the existing `Exercise` shape plus `{ visibility, scopeId? }`. Replaces the builder's `mockSave`.
- `PUT /api/instructor/exercises/:id/publish` — flip `publishedAt`. Validates visibility/scope coherence.
- `GET /api/instructor/exercises/mine` — list exercises authored by the calling instructor, with visibility + assignment count.

**Help requests**
- `POST /api/help-requests` (NOT `/api/instructor/*` — students post these) — body: `{ anchorKind, anchorId, title, body }`. Server resolves `instructorId` from `Student.instructorId`.
- `GET /api/instructor/help-requests` — instructor's inbox. Optional `?status=open|answered|resolved`.
- `GET /api/help-requests/:id` — single request + thread (auth: assigned instructor OR the student).
- `POST /api/help-requests/:id/messages` — append to thread.
- `PUT /api/help-requests/:id/status` — transition status.

**Project ratings**
- `POST /api/instructor/ratings` — body: `{ attemptId, score, comment }`. Upsert keyed by `(attemptId, raterUserId)`.
- `GET /api/attempts/:attemptId/ratings` — public-read (any authenticated user). Returns all ratings for the attempt.
- `DELETE /api/instructor/ratings/:id` — only the rater (or admin) can delete.

### A1 — Two-repo, platform-first

Same shape as C, E, F. Platform branch `feat/instructor-expansion` ships first off `ac9d56c`. Web branch `feat/instructor-pages` consumes second off `f439401`. Local-only merges, no remote, no PRs.

### A2 — Layer agent dispatch

| Concern | Owner |
|---|---|
| Schema migration + new module wiring | `agents/layer/auth.md` (User/Student) + `agents/layer/content.md` (Exercise visibility) + new module owned ad-hoc |
| Difficulty integration with assembler | `agents/layer/content.md` (LessonAssemblerService) |
| Help request module | New `instructor` module under `platform/src/instructor/` (shared by all five capabilities) — owned by Auth + Grading agents jointly |
| Rating model + endpoints | `agents/layer/grading.md` (sits next to InstructorReview) |
| Custom exercise persistence | `agents/layer/content.md` (Exercise repo + publish service) |
| Web pages, routing, components | `agents/shared/frontend.md` |
| Migration + DB indexes | `agents/shared/database.md` |
| Security gateway | `agents/security/code-scanner.md`, `architecture-reviewer.md`, `audit-logger.md` |

A new `platform/src/instructor/` module aggregates the new endpoints. The pre-existing `platform/src/instructor-review/` is left in place; G adds `instructor/` for roster, difficulty, custom exercise, help requests, ratings.

### A3 — Backward compatibility

- **Existing `/api/instructor/queue|approve|review|attempt` endpoints unchanged.** The new module mounts at the same `/api/instructor/*` prefix without colliding (different sub-paths).
- **Cohort scoping in `instructor-review.controller.ts` is preserved.** Code-review queue still uses `isStudentInInstructorCohort`. Once `Student.instructorId` is established, the cohort check broadens to "assigned-to OR in-cohort-of" the instructor — additive widening, not breaking.
- **Existing builder UI** keeps its localStorage path during migration; the "Publish" button gains a "Save to server" affordance gated on a new `useFlag('builder.serverPersistence')` toggle (default ON in dev, ON in prod after merge). LocalStorage drafts can still be created, but Publish requires server save.

### A4 — Frontend route shape

```
app/(authed)/(shell)/instructor/
  page.tsx                         (existing — review queue; refactored)
  students/page.tsx                (NEW — roster)
  students/[id]/page.tsx           (NEW — student detail + difficulty controls + custom exercises + help)
  help/page.tsx                    (NEW — unified help-request inbox)
  ratings/page.tsx                 (NEW — multi-rater rating queue, browseable across all students)
  review/[attemptId]/page.tsx      (existing — refactored)
  builder/page.tsx                 (existing — refactored, server-persisted)
app/(authed)/(immersive)/instructor/
  builder/[lessonId]/page.tsx      (existing — refactored, wires to POST /api/instructor/exercises)
```

Sidebar (instructor role) gains four items: Queue (existing), Students (new), Help (new with unread badge), Ratings (new).

### A5 — Permission matrix

| Action | Student | Instructor (assigned) | Instructor (any) | Admin |
|---|---|---|---|---|
| View own student page | view (read-only stripped) | full | none | full |
| Set student difficulty baseline | — | yes | no | yes |
| Set per-exam override | — | yes | no | yes |
| Author custom exercise (any visibility) | — | yes | yes | yes |
| Publish custom exercise to scope wider than `private_to_student` | — | yes | yes | yes |
| Open help request | yes (own) | — | — | — |
| Reply to help request | own thread | own students' threads | no | any |
| Resolve help request | own | own students' | no | any |
| Submit project rating | — | yes | yes | yes |
| Read project ratings | yes (any) | yes | yes | yes |
| Approve capstone (existing) | — | yes (cohort lead) | yes (cohort lead) | yes |
| View instructor queue | — | yes | yes | yes |

"Stripped" student page: a student visiting `/instructor/students/[id]` for their own id sees a read-only summary of difficulty + custom exercises assigned. Visiting another student's id 404s.

## Architecture

### Repo layout (after G merges)

```
platform/                                  (branch: master ← feat/instructor-expansion)
  prisma/
    schema.prisma                          — +5 models / fields, +3 enums
    migrations/
      20260509_<n>_instructor_expansion/   — single migration
  src/
    instructor/                            — NEW module
      instructor.module.ts
      students.controller.ts
      students.service.ts
      difficulty.controller.ts
      difficulty.service.ts
      custom-exercise.controller.ts
      custom-exercise.service.ts
      help-request.controller.ts           — instructor-side endpoints
      help-request.service.ts
      project-rating.controller.ts
      project-rating.service.ts
      repositories/
        student-difficulty.repository.ts
        exam-override.repository.ts
        help-request.repository.ts
        project-rating.repository.ts
    help-requests/                         — student-facing endpoints (POST /api/help-requests)
      help-requests.controller.ts          — student posts new requests + reads own
      help-requests.module.ts
    content/
      services/
        lesson-assembler.service.ts        — extended: visibility filter + difficulty baseline + per-exam override
      validators/
        custom-exercise-payload.validator.ts — NEW: re-uses exercise-payload.validator with visibility checks
    instructor-review/                     — UNCHANGED
  test/
    instructor/                            — controller specs + service unit tests + migration sanity

web/                                       (branch: master ← feat/instructor-pages)
  app/(authed)/(shell)/instructor/
    page.tsx                               — existing, refactored on primitives
    students/page.tsx                      — NEW
    students/[id]/page.tsx                 — NEW
    help/page.tsx                          — NEW
    ratings/page.tsx                       — NEW
    review/[attemptId]/page.tsx            — existing, refactored
    builder/page.tsx                       — existing, refactored, server-save wired
  app/(authed)/(immersive)/instructor/
    builder/[lessonId]/page.tsx            — existing, refactored, server-save wired
  components/instructor/
    QueueTable.tsx                         — refactored to use design-system primitives
    ReviewForm.tsx                         — refactored
    ReviewThread.tsx                       — refactored
    StudentRoster.tsx                      — NEW
    StudentCard.tsx                        — NEW
    StudentDetailPanel.tsx                 — NEW
    DifficultyDial.tsx                     — NEW (segmented Easy/Standard/Challenging)
    ExamOverrideTable.tsx                  — NEW
    HelpInbox.tsx                          — NEW (grouped by student)
    HelpRequestThread.tsx                  — NEW
    NeedHelpButton.tsx                     — NEW (mounted on lesson page + exercise renderers + attempt page)
    RatingQueue.tsx                        — NEW
    RatingCard.tsx                         — NEW (display) + RatingForm.tsx (write)
    builder/                               — existing, refactored + server-save calls
  lib/
    instructor.ts                          — extended with new fetchers
    help-requests.ts                       — NEW
    ratings.ts                             — NEW
    student-difficulty.ts                  — NEW
  styles/app.css                           — appended .roster-*, .difficulty-dial, .help-*, .rating-*
```

### Lesson assembler — difficulty + visibility integration

```ts
// content/services/lesson-assembler.service.ts (modified)
async assembleLessonForStudent(studentId: string, lessonId: string) {
  const student = await this.students.findById(studentId);
  const lesson  = await this.lessons.findPublished(lessonId);

  // 1. Visibility-filtered exercise pool for this lesson
  const exercises = await this.exercises.findVisibleForStudent({
    lessonId,
    studentId: student.id,
    cohortId:  student.cohortId,
    trackId:   lesson.trackId,
  });

  // 2. Difficulty baseline biases pool selection
  const difficulty = await this.difficulty.getOrDefault(studentId);
  const targetCount = computeTargetCount(student.cohortLength, difficulty.baseline);
  const selected    = pickByDifficulty(exercises, difficulty.baseline, targetCount);

  // 3. Per-exam overrides applied after selection
  const overrides = await this.examOverrides.findForStudent(studentId);
  const final     = selected.map((ex) => applyOverride(ex, overrides));

  return { lesson, blocks: lesson.blocks, exercises: final };
}
```

`pickByDifficulty` biases on `Exercise.pointsMax` (proxy for difficulty) — Easy weights toward lower-pointsMax, Challenging toward higher. `applyOverride` swaps exercises, marks optional, attaches `extendTimeMs`.

### Web — student detail page composition

```tsx
// app/(authed)/(shell)/instructor/students/[id]/page.tsx
export default async function StudentDetailPage({ params }: { params: { id: string } }) {
  const [detail, helpRequests, customExercises] = await Promise.all([
    fetchStudentDetail(params.id),
    fetchHelpRequestsForStudent(params.id),
    fetchCustomExercisesForStudent(params.id),
  ]);
  return (
    <div className="main">
      <StudentHeader student={detail.student} kpis={detail.kpis} />
      <div className="grid grid-2">
        <DifficultyDial
          studentId={params.id}
          baseline={detail.difficulty.baseline}
          overrides={detail.examOverrides}
        />
        <HelpRequestList items={helpRequests} compact />
      </div>
      <CustomExerciseSection studentId={params.id} items={customExercises} />
      <RecentAttemptsTable attempts={detail.recentAttempts} />
    </div>
  );
}
```

### Web — help inbox composition

```tsx
// app/(authed)/(shell)/instructor/help/page.tsx
export default async function HelpInboxPage() {
  const inbox = await fetchInstructorInbox(); // grouped by student
  return (
    <div className="main">
      <PageHead title="Help requests" eyebrow={`${inbox.openCount} open • ${inbox.answeredCount} awaiting student`} />
      <HelpInbox groups={inbox.byStudent} />
    </div>
  );
}
```

`HelpInbox` renders one collapsible card per student, each containing the open help requests anchored to lesson/exercise/attempt with a one-click jump to the originating context.

### Help-request anchor resolution

For each anchor kind, the web client renders a context-pill linking back:

| Anchor | Pill copy | Link |
|---|---|---|
| `lesson` | `Lesson: <title>` | `/lesson/<id>` |
| `exercise` | `Exercise: <prompt first 60 chars>` | `/lesson/<lessonId>?exercise=<exerciseId>` |
| `attempt` | `Attempt: <date>` | `/instructor/review/<attemptId>` (instructor view) |

Resolution joins are done server-side in the inbox endpoint to keep the client thin.

## Build sequence

### Platform — `feat/instructor-expansion`

| Step | Description |
|---|---|
| P0 | Create worktree at `c:/tmp/bootcamp-platform-instructor` off `ac9d56c`. |
| P1 | Schema migration: `Student.instructorId` (nullable FK), `StudentDifficulty`, `ExamDifficultyOverride`, `Exercise.authorId` + `Exercise.visibility` + `Exercise.scopeId`, `HelpRequest`, `HelpMessage`, `ProjectRating`. Three new enums: `DifficultyBaseline`, `ExerciseVisibility`, `HelpAnchorKind`, `HelpRequestStatus`. Migration sanity test: round-trip migrate up/down on a fresh DB. |
| P2 | `StudentRepository.assignInstructor(studentId, instructorUserId)` + `findByInstructor(instructorUserId)` + `findUnassigned()`. Tests. |
| P3 | `StudentDifficultyRepository` + `ExamOverrideRepository` + service. Tests. |
| P4 | Extend `LessonAssemblerService.assembleLessonForStudent` to consult difficulty + overrides. Existing tests stay green; add tests for: easy biases low-pointsMax, challenging biases high-pointsMax, swap override replaces selected exercise, optional override attaches flag, time override attaches `extendTimeMs`. |
| P5 | Extend `ExerciseRepository.findVisibleForStudent({lessonId, studentId, cohortId, trackId})`. Tests cover all four visibility combinations. |
| P6 | `CustomExerciseService` (create + publish + list mine) + controller. Validator `custom-exercise-payload.validator.ts` enforces `visibility/scopeId` coherence (e.g., `visibility=cohort` requires `scopeId IS NOT NULL`). Tests. |
| P7 | `HelpRequestService` + student-facing controller (`POST /api/help-requests`, `GET /api/help-requests/:id`, `POST /api/help-requests/:id/messages`, `PUT /api/help-requests/:id/status`) + instructor-facing inbox endpoint. Anchor resolution joins (lesson/exercise/attempt → display strings) implemented in service. Tests. |
| P8 | `ProjectRatingService` + controller (write under `/api/instructor/ratings`, public read under `/api/attempts/:attemptId/ratings`). Upsert on `(attemptId, raterUserId)`. Tests. |
| P9 | `StudentsController` (roster + unassigned + assign + detail) + service composing KPIs + difficulty + recent attempts + open help count. Tests. |
| P10 | Wire `InstructorModule` into `AppModule`. Run full jest suite. tsc clean. |
| P11 | Merge platform → master. |

### Web — `feat/instructor-pages`

| Step | Description |
|---|---|
| W0 | Create worktree at `c:/tmp/bootcamp-web-instructor` off `f439401`. |
| W1 | Append CSS slice (`.roster-card`, `.difficulty-dial`, `.help-thread`, `.rating-card`, etc.) to `styles/app.css`. |
| W2 | Extend `lib/instructor.ts` with `fetchStudents`, `fetchStudentDetail`, `assignStudent`, `setDifficulty`, `upsertExamOverride`, `removeExamOverride`. New file `lib/help-requests.ts`. New file `lib/ratings.ts`. New file `lib/student-difficulty.ts`. Zod schemas for each response. |
| W3 | Refactor `QueueTable.tsx`, `ReviewForm.tsx`, `ReviewThread.tsx` onto design-system primitives (`Card`, `Table`, `Button`, `Textarea`, `Avatar`). No behavior change. |
| W4 | `DifficultyDial.tsx` + `ExamOverrideTable.tsx` + tests. |
| W5 | `StudentRoster.tsx` + `StudentCard.tsx` + `app/(authed)/(shell)/instructor/students/page.tsx` + tests. Includes "Unassigned" tab. |
| W6 | `StudentDetailPanel.tsx` + `app/(authed)/(shell)/instructor/students/[id]/page.tsx` (composes header + difficulty + help + custom exercises + recent attempts). E2E smoke. |
| W7 | `HelpInbox.tsx` + `HelpRequestThread.tsx` + `app/(authed)/(shell)/instructor/help/page.tsx` + tests. |
| W8 | `NeedHelpButton.tsx` mounted on lesson page, exercise renderers, and attempt detail. Modal posts to `POST /api/help-requests`. Tests. |
| W9 | `RatingQueue.tsx` + `RatingCard.tsx` + `RatingForm.tsx` + `app/(authed)/(shell)/instructor/ratings/page.tsx` + tests. Display ratings on the student-facing review page (multi-rater list + assigned primary). |
| W10 | Refactor `builder/page.tsx` and `BuilderShell.tsx` to call `POST /api/instructor/exercises` on save and `PUT /api/instructor/exercises/:id/publish` on publish. Replace `mockSave` with real persistence. localStorage stays as offline draft cache. Tests. |
| W11 | Sidebar additions: `Students`, `Help` (with unread badge), `Ratings`. Active-route highlighting. |
| W12 | Final tsc + vitest + lint sweep. Merge web → master. |

Estimated 11-13 platform commits, 12-15 web commits.

## Testing strategy

### Platform unit / integration

- Migration: round-trip up/down on a clean DB; assert FK cascade behavior on `Student → User` deletion is `SET NULL`, not `CASCADE`, for `Student.instructorId` (an instructor leaving the platform should not orphan student records).
- `StudentDifficultyService.getOrDefault`: returns `standard` if no row.
- `ExamOverrideService.upsert`: idempotent; conflicting columns overwrite.
- `LessonAssemblerService` x difficulty matrix: 6 tests (3 baselines × {with overrides, without overrides}).
- `ExerciseRepository.findVisibleForStudent`: each visibility scope returns only the in-scope exercises.
- `CustomExerciseService.create`: rejects `visibility=cohort` with null scopeId (400).
- `HelpRequestService.create`: stamps `instructorId` from `Student.instructorId`; rejects student with no assigned instructor (400).
- `HelpRequestService.transition`: state machine enforced (`open → answered → resolved`, no skipping).
- `ProjectRatingService.upsert`: same rater on same attempt updates rather than duplicates; different rater on same attempt creates new row.
- Permission tests on every controller: student / wrong-instructor / unassigned-instructor / admin / unauth.

### Web unit (Vitest)

- `DifficultyDial`: clicking a segment triggers PUT and optimistic-updates UI.
- `ExamOverrideTable`: add row → form → submit → row appears; delete → row disappears.
- `StudentRoster`: filters tab (`assigned` vs `unassigned`); claim button on unassigned tab.
- `HelpInbox`: groups by student; unread count badge; click-through to thread.
- `NeedHelpButton`: opens modal; submits with correct anchor for each context (lesson / exercise / attempt).
- `RatingForm`: validates 1-5; submit triggers POST; existing rating populates form for edit.
- `BuilderShell` post-refactor: Save calls real fetch (mock fetch in test); Publish disabled if validation issues.

### Web E2E (Playwright)

- Instructor logs in → `/instructor/students` → claims an unassigned student → student appears in assigned list.
- Instructor visits `/instructor/students/[id]` → changes baseline to Easy → reload reflects.
- Instructor adds an exam override → student loads same lesson → optional flag visible (or swapped exercise visible, depending on override).
- Student raises help request from lesson page → instructor sees it in inbox → instructor replies → student sees reply → student resolves.
- Instructor rates a project submission → student attempt page shows the rating; second instructor rates same submission → both ratings visible, average shown.

### Verification gate

`npx tsc --noEmit` clean across both repos. `npm run lint` clean. All vitest + jest green. Migration applies cleanly on a fresh `docker compose up -d postgres`.

## Migration & rollback

- Schema migration is single-direction in practice (down would lose authored exercises, ratings, help requests). For local rollback, restore from a pre-migration `pg_dump` snapshot.
- Endpoint additions are non-breaking. Existing instructor-review queue / approve / review continue working.
- Web refactor on existing pages preserves URLs and behavior; only chrome / styling changes.

## Risks

- **Lesson assembler complexity creep.** Adding visibility filter + difficulty bias + per-exam overrides triples the assembler's responsibilities. Mitigation: each is a separate pure function (`filterVisible`, `pickByDifficulty`, `applyOverride`); assembler composes them; each is unit-testable in isolation. If the assembler grows past ~250 lines, extract.
- **Student.instructorId default-on-cohort-join surprise.** If admins move a student between cohorts, the assigned instructor doesn't follow — by design, but UX needs to make this clear (the student-detail header shows both "Cohort lead: X" and "Assigned instructor: Y", flagged when they differ).
- **Help-request inbox scale.** `WHERE instructorId = me AND status != 'resolved'` is fine for tens of requests; needs covering index `(instructorId, status, createdAt DESC)` if instructor caseloads grow into hundreds. Index is added by the schema's `@@index([instructorId, status])`.
- **Multi-rater rating UX confusion.** Students seeing 3 different scores from 3 instructors might be jarring. Mitigation: assigned instructor's rating is visually primary (larger card, "Your instructor" label); others are listed under a "Other instructor reviews" section.
- **Builder server-persistence migration.** Drafts currently in localStorage survive but are NOT auto-uploaded. UX: builder index shows "Local draft (not on server)" badge for legacy drafts; instructor can click "Save to server" to migrate.
- **Capstone single-approver vs multi-rater confusion.** Approval (binary) and ratings (graded feedback) coexist; keep the wording strict in the UI: "Approve & pass" is the gate; "Rate this submission" is feedback.

## Open follow-ups (out of scope for G)

- Student-detail change-history audit log (who changed what difficulty, when).
- Bulk operations (assign 10 students at once, set baseline for a whole cohort).
- Help-request analytics (median time-to-first-reply per instructor).
- Promote-to-curriculum action: turn a recurring custom exercise into a public published `Exercise` after N reuses.
- Notification surface for instructors (right now help/ratings show only on visit; no email/web-push).
- Rating disagreement / moderation flow if two instructors give very divergent scores.
- Exercise visibility "share with another instructor's students" — currently the four scopes don't cover instructor-to-instructor sharing.

## Predecessor patterns this design reuses

- **Two-repo / two-PR shape from C, E, F** — same worktree pattern, sequencing, merge-locally convention.
- **Route group split** — new pages go under `(authed)/(shell)/`. Builder stays on `(immersive)`.
- **Force-dynamic + server fetch** — list/detail pages compose with `Promise.all` of fetchers + zod parse, mirroring F's profile/leaderboard composition.
- **Provider pattern for backend extensibility** — not directly reused, but the AI review provider pattern is preserved (Gemma 4 work continues separately, untouched by G).
- **Permission matrix table** — same shape as the security gate's prior reviews.

## References

- Resolved decisions: memory note `project_instructor_role.md` (2026-05-09).
- Existing instructor-review surface: `platform/src/instructor-review/`, `web/components/instructor/`, `web/lib/instructor.ts`.
- Existing builder UI (mock-only): `web/components/instructor/builder/BuilderShell.tsx`, `web/lib/builder.ts`.
- Predecessor specs: F (2026-05-04 profile-leaderboard), E (2026-05-04 lesson player) — for two-repo flow.
- Roadmap: `vault/Decisions/UI Refactor Roadmap.md` (G entry will be expanded post-merge).
- Original instructor-review design: `2026-04-13-human-instructor-review-design.md`.
- Capstone bridge: `2026-04-13-capstone-bridge-design.md` (where `Attempt.approvedByInstructorId` was introduced).
- CLAUDE.md constraints: gamification cannot fail submission (still holds — G doesn't touch gamification); student code untrusted (still holds — G doesn't change execution); versioned content immutable-per-version (G's custom exercises follow the same `(id, version)` rule).
