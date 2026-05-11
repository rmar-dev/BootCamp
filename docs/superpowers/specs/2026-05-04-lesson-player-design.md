# Lesson Player — Sub-project E design

**Date:** 2026-05-04
**Sub-project:** E (Lesson Player) — fifth in the multi-PR UI refactor
**Web base:** `master @ 33b8d40`
**Platform base:** `master @ a376a48`
**Repo scope:** two-repo, platform-first then web
**Predecessors:** A (UI Foundation), B (App Shell), C (Dashboard, two-repo), D (Tracks / Skill Tree, web-only)

## Summary

Refactor the lesson page to match the design bundle's `app-lesson.jsx`: full-bleed player chrome (head + body + foot), linear step-by-step progression replacing the current sidebar-driven block list, and a per-lesson hex bar that earns one badge per exercise based on first-try-pass quality. Replace heart "lose-on-failure" gameplay with hex "earn-on-success" tokens. Add SSE streaming for AI review with a polling fallback. Treat capstone as a single-exercise lesson sharing the same shell.

The work spans both the `web/` and `platform/` repos and ships in two sequenced branches.

## Goals

- Port the design bundle's `.player` chrome and `.player` CSS slice into the live `web/` app.
- Replace the current `BlockList`-driven two-column layout with a linear step-walker that owns its own URL state.
- Introduce a per-lesson hex bar in the player-head that fills based on per-exercise attempt quality.
- Deliver AI review with a streaming-by-default UX backed by server-side fake streaming and a polling fallback.
- Refactor all six exercise renderers (`MultipleChoiceExercise`, `FillBlankExercise`, `PredictOutputExercise`, `CodeExercise`, `FixBugExercise`, `CapstoneSubmissionExercise`) to fit inside the new shell and report their attempt status upward.
- Clean up the 21 pre-existing TypeScript errors in `tests/renderers/*.test.tsx` as each renderer is refactored.
- Reach `npx tsc --noEmit` clean across the whole `web/` tree at the end of the sub-project.

## Non-goals

- True end-to-end provider-level token streaming (deferred to Gemma 4 provider work).
- Hard gameplay mechanics around hearts/lives — replaced entirely by the earn-only hex model.
- Drawer-based jump-around navigation inside a lesson — pure linear for now.
- Cross-lesson navigation as a global UI affordance — moved into the lesson-complete celebration screen.
- Reviving any element of the deleted `BlockList`, `LessonNavigation`, `FreshExercisesButton`, or `PoolHeaderClient` outside their absorption into the new shell.
- Changes to the review provider interface (`platform/src/review/review-provider.interface.ts`) — explicitly out of scope per CLAUDE.md's "stable surface" constraint.
- Deleting the existing `components/ui/Hearts.tsx` primitive shipped in sub-project A. It is not used by E (replaced conceptually by `HexBar`), but staying in place as an unused foundation primitive is acceptable; pruning unused A-era primitives is a separate cleanup pass.

## Design decisions

### Q1 — Hex badges, earn-on-perfection, one per exercise

The design's hearts slot in `.player-head` becomes a hex bar. Each exercise in the lesson can earn one badge.

| Status | Visual | Rule |
|---|---|---|
| `first_try` | Filled hex | Student passed on the first submission |
| `eventual` | Half-filled hex | Student passed but with at least one prior failed attempt |
| `unattempted` | Outline only | Student has not yet passed |

The hex is hidden when the lesson contains a single exercise of type `capstone_submission` (per Q3).

### Q2 / Q2.1 — Server-side fake SSE streaming with polling fallback

A new endpoint `GET /api/reviews/:attemptId/stream` waits for the review to finish, then chunks the resulting markdown across SSE events at a 30 ms cadence. The client uses `EventSource`; on disconnect or `error` it falls back to the existing polling endpoint `GET /api/reviews/:attemptId`. The review provider interface is untouched.

### Q3 — Capstone uses the same shell as a single-exercise lesson

When `lesson.blocks.length === 1` and that block's exercise is `capstone_submission`:

- Hex bar is hidden (no auto-grade).
- Player-head's progress text reads "Awaiting instructor review" once submitted.
- Player-foot collapses: no Continue, no Previous, only "Back to track".

Otherwise the capstone renderer behaves identically to the auto-graded renderers in terms of the player-shell contract.

### Q4 — Per-renderer TypeScript-error cleanup

The 21 pre-existing errors in `tests/renderers/*.test.tsx` are fixed in the same commit as each renderer's refactor. The renderer commit and its test commit are one diff. The goal post moves toward a clean `npx tsc --noEmit` one renderer at a time.

### A1 — Full-bleed lesson route

A new `app/(authed)/lesson/[id]/layout.tsx` does not render `AppShell` and just returns `{children}`. The `.player` grid is `min-height: 100vh` and owns the entire viewport.

### A2 — Pure linear progression, sidebar deleted

`BlockList` is removed. Steps map 1:1 onto `lesson.blocks[]`. Explanation blocks are full-fledged steps that render with their own copy and earn no hex but still take a Continue click.

### A3 — Continue always enabled; lesson-complete screen on the synthetic last step

The Continue button is never gated. A synthetic step at index `lesson.blocks.length` renders the lesson-complete celebration: hex summary, next-lesson button (when a next lesson exists in the track), and a back-to-track button. For a `pool_complete` assignment the celebration variant shows the FreshExercises action absorbed from the deleted button.

### A4 — Backend ships per-exercise `attemptStatus`

The exercise DTO inside the lesson payload gains:

```ts
type ExerciseAttemptStatus = 'unattempted' | 'first_try' | 'eventual';
exercise: { ..., attemptStatus: ExerciseAttemptStatus }
```

The submit response gains `newAttemptStatus: ExerciseAttemptStatus` so the hex updates live without re-fetching the lesson.

Computation rule, version-scoped to `(studentId, exerciseId, exerciseVersion)`. The platform's `Attempt` model has a `failedAttemptsBefore` field, but that field is computed at insert time across *all* versions of the same exercise — so it does NOT support version-scoped semantics. We therefore query attempts directly:

- Zero attempts on this `(exerciseId, version)` → `unattempted`.
- Earliest attempt (by `submittedAt`) on this `(exerciseId, version)` has `passed === true` → `first_try`.
- Earliest attempt failed AND any later attempt on this `(exerciseId, version)` passed → `eventual`.
- All attempts failed → `unattempted` (treated as not-yet-passed for hex purposes).

Bulk-resolved with one `Attempt` query per lesson load, filtered by `studentId` and an `OR` over the lesson's `(exerciseId, exerciseVersion)` pairs, ordered by `submittedAt asc`. No N+1.

### A5 — Two-repo, platform-first

`platform/feat/lesson-payload` ships first, off platform `master @ a376a48`. `web/feat/lesson` consumes the new payload field, off web `master @ 33b8d40`. Both branches merge to their respective masters locally, no remotes, no PRs (consistent with sub-projects A–D).

The platform main checkout is currently on `feat/adaptive-next-lesson`; that drift is ignored. Worktrees are created off `origin/master` regardless of the main checkout state.

## Architecture

### Repo layout (after E merges)

```
platform/                      (branch: master ← feat/lesson-payload)
  src/
    content/dto/               — exercise DTO gains attemptStatus
    content/lesson.service.ts  — bulk-computes attemptStatus
    submission/                — submit response gains newAttemptStatus
    review/
      reviews.controller.ts    — GET /api/reviews/:attemptId/stream
      review.service.ts        — waitForReview() helper
      streaming.util.ts        — chunkMarkdown(text, size)
  test/                        — unit + integration tests for the above

web/                           (branch: master ← feat/lesson)
  app/(authed)/lesson/[id]/
    layout.tsx                 — full-bleed, no AppShell
    page.tsx                   — server component; fetchLesson + <LessonPlayerShell />
  components/lesson/
    LessonPlayerShell.tsx      — client; URL ?step=N + hex map; renders head/body/foot
    player/
      PlayerHead.tsx
      PlayerFoot.tsx
      PlayerBody.tsx
      HexBar.tsx
      LessonCompleteScreen.tsx
    renderers/
      _shared.tsx              — adds onAttempt callback prop type
      MultipleChoiceExercise.tsx
      FillBlankExercise.tsx
      PredictOutputExercise.tsx
      CodeExercise.tsx
      FixBugExercise.tsx
      CapstoneSubmissionExercise.tsx
      AIReview.tsx              — EventSource-first, polling fallback
  tests/renderers/             — fixed alongside each renderer commit
```

Components deleted: `BlockList.tsx`, `LessonNavigation.tsx`, `FreshExercisesButton.tsx`, `PoolHeaderClient.tsx`. `PoolCompleteView.tsx` is folded into `LessonCompleteScreen` as a variant.

### URL state model

The active step lives in `?step=N`. `LessonPlayerShell` reads it via `useSearchParams()`, never mirrors it into local state. Prev/Continue calls `router.replace('?step=' + next, { scroll: false })`. Browser history works automatically. The synthetic lesson-complete step is `step === lesson.blocks.length`.

The legacy `?ex=N` query param is dropped. No automatic redirect — anyone deep-linking to `?ex=N` lands on `step=0`. If that turns out to be too aggressive, a one-liner `?ex=` → `?step=` redirect can be added in `page.tsx`; not part of E's scope.

### Renderer contract

```ts
type ExerciseAttemptStatus = 'unattempted' | 'first_try' | 'eventual';

type ExerciseProps = {
  exercise: ExerciseDTO;
  onAttempt?: (status: ExerciseAttemptStatus) => void;
};
```

Each renderer's submit handler calls `onAttempt(submitResponse.newAttemptStatus)` after a passing submission. Renderers continue to own their internal Submit/Run buttons (matching the design bundle pattern). Player-foot's Continue is pure navigation and never invokes a renderer's submit.

`LessonPlayerShell` provides the callback, maintains a `Map<exerciseId, ExerciseAttemptStatus>` initialized from the lesson payload's per-exercise `attemptStatus`, and overlays mid-session attempts on top.

### Hex bar

```ts
<HexBar
  states={['first_try','eventual','unattempted','unattempted']}
  accent={tint}                   // 'swift' | 'kotlin' | 'shared'
/>
```

One SVG hex per exercise step (explanation steps do not contribute). Filled, half-filled, or outline based on state. Hidden when the lesson contains a single capstone exercise.

### AI review streaming client

```ts
useEffect(() => {
  if (!attemptId) return;
  setLoading(true); setMarkdown(null);

  const sse = new EventSource(`${BASE}/api/reviews/${attemptId}/stream`, { withCredentials: true });
  sse.addEventListener('chunk', e => setMarkdown(prev => (prev ?? '') + JSON.parse(e.data)));
  sse.addEventListener('done',  () => { setLoading(false); sse.close(); });
  sse.addEventListener('error', () => { sse.close(); fallbackToPolling(); });

  return () => sse.close();
}, [attemptId]);
```

`fallbackToPolling()` is the existing 2 s / 30 s polling logic against `GET /api/reviews/:attemptId`, lifted into a helper.

### Platform — `attemptStatus` computation

`attemptStatus` is scoped to a specific `(studentId, exerciseId, exerciseVersion)` triple. Attempts made against an older published version of the same exercise do not contribute toward the hex on the current version — content is version-immutable (per CLAUDE.md), and a republished exercise is conceptually a fresh challenge.

The platform's `Attempt` table is the source of truth. We do NOT use `Attempt.failedAttemptsBefore` (it is computed across all versions and would mislead us here). We query attempts directly, version-scoped, and read the earliest one.

In `LessonAssemblerService.assembleLatestForStudent(id, assignment, studentId)`:

```ts
const exerciseRefs = blocks
  .filter(b => b.kind === 'exercise')
  .map(b => ({ id: b.exercise.id, version: b.exercise.version }));

const attempts = await prisma.attempt.findMany({
  where: {
    studentId,
    OR: exerciseRefs.map(r => ({ exerciseId: r.id, exerciseVersion: r.version })),
  },
  orderBy: { submittedAt: 'asc' },
  select: { exerciseId: true, exerciseVersion: true, passed: true },
});

const byKey = new Map<string, { passed: boolean }[]>();
for (const a of attempts) {
  const key = `${a.exerciseId}@${a.exerciseVersion}`;
  const list = byKey.get(key) ?? [];
  list.push({ passed: a.passed });
  byKey.set(key, list);
}

function computeStatus(rows: { passed: boolean }[]): ExerciseAttemptStatus {
  if (rows.length === 0) return 'unattempted';
  if (rows[0].passed) return 'first_try';
  if (rows.some(r => r.passed)) return 'eventual';
  return 'unattempted';
}

for (const block of blocks) {
  if (block.kind !== 'exercise') continue;
  const key = `${block.exercise.id}@${block.exercise.version}`;
  block.exercise.attemptStatus = computeStatus(byKey.get(key) ?? []);
}
```

The same `computeStatus` runs in `SubmissionService.submit()` after `attemptService.recordAttempt()` persists the new row: query attempts for `(studentId, exerciseId, exerciseVersion)`, ordered by `submittedAt`, run `computeStatus`, return `newAttemptStatus` to the client.

Edge case: once a student earns `first_try`, subsequent attempts on the same `(exerciseId, exerciseVersion)` cannot downgrade it — the earliest row by `submittedAt` keeps its `passed === true` regardless of later rows.

### Platform — SSE endpoint

```ts
@Get(':attemptId/stream')
async stream(@Param('attemptId') id: string, @Res() res: Response) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Connection', 'keep-alive');

  const review = await this.reviewService.waitForReview(id, { timeoutMs: 30_000 });
  if (!review) {
    res.write(`event: error\ndata: timeout\n\n`); res.end(); return;
  }
  for (const chunk of chunkMarkdown(review.markdown, 40)) {
    res.write(`event: chunk\ndata: ${JSON.stringify(chunk)}\n\n`);
    await sleep(30);
  }
  res.write(`event: done\ndata: \n\n`);
  res.end();
}
```

`waitForReview()` polls or subscribes to the same internal review-pipeline state the existing `GET /api/reviews/:attemptId` reads from. Polling fallback (the existing endpoint) is unchanged.

## Build sequence

### Platform branch — `feat/lesson-payload`

| Step | Description |
|---|---|
| P0 | Create worktree at `c:/tmp/bootcamp-platform-lesson` off `origin/master` (`a376a48`). |
| P1 | Add `attemptStatus` field + `computeStatus` helper. Wire into `LessonAssemblerService`. Unit tests for `computeStatus`. |
| P2 | Add `newAttemptStatus` to submit response. Unit + integration test. |
| P3 | Add `ReviewService.waitForReview()` helper + `chunkMarkdown` util + SSE controller route. Integration test with mock provider. |
| P4 | Sweep tests, run `npm run test` clean. |
| P5 | Merge platform → master locally. |

### Web branch — `feat/lesson`

| Step | Description |
|---|---|
| W0 | Create worktree at `c:/tmp/bootcamp-web-lesson` off `origin/master` (`33b8d40`). |
| W1 | Add `(authed)/lesson/[id]/layout.tsx` (full-bleed, no AppShell). Port `.player` CSS slice into `globals.css`. |
| W2 | Build `LessonPlayerShell` + `PlayerHead`/`PlayerFoot`/`PlayerBody`/`HexBar`. URL `?step=N` integration. Unit tests. |
| W3a | Refactor `MultipleChoiceExercise` + fix its test file. tsc partial-clean checkpoint. |
| W3b | Refactor `FillBlankExercise` + fix its test file. |
| W3c | Refactor `PredictOutputExercise` + fix its test file. |
| W3d | Refactor `CodeExercise` + fix its test file. |
| W3e | Refactor `FixBugExercise` + fix its test file. |
| W3f | Refactor `CapstoneSubmissionExercise` + fix its test file. |
| W4 | Refactor `AIReview` to EventSource-first with polling fallback. Test happy-path + fallback. |
| W5 | Build `LessonCompleteScreen` (regular + pool_complete variant). Delete `BlockList`, `LessonNavigation`, `FreshExercisesButton`, `PoolHeaderClient`, `PoolCompleteView`. |
| W6 | Compose `(authed)/lesson/[id]/page.tsx` as thin server component. |
| W7 | E2E sanity walks. Confirm `npx tsc --noEmit` clean across the whole tree. |
| W8 | Merge web → master locally. |

Estimated 6–8 platform commits, 14–18 web commits.

## Testing strategy

### Platform unit / integration

- `computeStatus` against zero / first-pass / fail-then-pass / fail-fail-fail / mixed-version inputs.
- `LessonAssemblerService.assembleLatestForStudent()` returns `attemptStatus` per block for a seeded student.
- `SubmissionService.submit()` returns `newAttemptStatus` matching the post-insert state.
- SSE controller emits `chunk` events in order, terminating `done`, timeout produces `error`.

### Web unit (Vitest, located in `tests/<area>/X.test.tsx`)

- Each renderer fires `onAttempt` on pass with the right status.
- `LessonPlayerShell`: URL `?step=N` drives active block, prev/continue calls `router.replace`, hex map updates from `onAttempt`.
- `HexBar` snapshot for filled / half / outline states.
- `AIReview`: EventSource happy path, EventSource error → polling fallback, no leaks on unmount.
- `LessonCompleteScreen`: regular variant + pool_complete variant.

### Web E2E (Playwright)

- Walk a Swift lesson end-to-end, assert hex bar reflects attempt outcomes, reach lesson-complete screen, click next-lesson.
- Capstone lesson: no hex, "Awaiting instructor review" copy after submit.
- Pool-complete lesson: celebration variant renders with FreshExercises action.

### Verification gate

`npx tsc --noEmit` clean across the whole `web/` tree at the end of the sub-project (no `grep -v "tests/renderers/"` exclusion needed).

## Migration & rollback

- `attemptStatus` and `newAttemptStatus` are derived fields with no schema migration. Older clients ignoring the new fields keep working.
- `GET /api/reviews/:attemptId/stream` is purely additive. Reverting the web client's `EventSource` use is a one-line revert; the SSE endpoint can stay.
- Web rollback = revert the web branch. Platform branch can stay merged with no consumer impact.

## Risks

- **Platform branch drift on `feat/adaptive-next-lesson`:** worktree is created off `origin/master` so this is irrelevant unless that branch's changes overlap E's platform footprint. Reconcile on first concrete conflict.
- **ReactMarkdown re-render perf during SSE streaming:** ~33 re-renders/sec for the streaming duration. Throttle via `requestAnimationFrame` if observed stutter on lower-end hardware.
- **SSE behind reverse proxies:** local dev is direct, so this is a deploy-time concern; the `X-Accel-Buffering: no` header is set preemptively for nginx-class proxies.
- **Deletions are aggressive:** `BlockList`, `LessonNavigation`, `FreshExercisesButton`, `PoolHeaderClient` go away. Anything in `daily/` or other docs that links into them by name will rot. Quick grep at the end of W5 to catch stragglers.

## Open follow-ups (out of scope for E)

- True end-to-end provider-level token streaming, scoped to the upcoming Gemma 4 provider work that will touch `review-provider.interface.ts` anyway.
- Per-attempt history visible to the student inside a lesson (the current `PoolCompleteView` had a TODO about this).
- Drawer-based jump-around inside a lesson if user testing surfaces demand.
- A `?ex=` → `?step=` redirect for stale deep links if anyone reports broken bookmarks.

## Predecessor patterns this design reuses

- **Two-repo / two-PR shape from sub-project C** (Dashboard) — same worktree pattern, same sequencing, same merge-locally convention.
- **Load-on-ID generation counter pattern from sub-project D** — `LessonPlayerShell` uses a `useRef` generation counter when fetching `attemptStatus` updates after a submit, discarding stale responses if the user navigates between lessons mid-stream.
- **Inline page-private helpers from sub-project D** — `LessonPlayerShell`'s `LoadingPlaceholder`, `NotFoundCard`, etc. stay inline rather than promoted into separate files.
- **Tint resolution at page level from sub-project D** — `detail.language === 'kotlin' ? 'kotlin' : 'swift' : 'shared'` threaded down into `HexBar` and other renderer chrome.
- **`'Mastered' / 'In progress · n of m' / 'Tap to start'` meta-string convention from `sections.ts`** — adapted to player-foot Continue copy ("Continue" / "Submit again" / "Finish lesson" / "Back to track").

## References

- Design bundle: `docs/superpowers/design/app-lesson.jsx`, `docs/superpowers/design/app.css` (`.player` slice at lines 151–179).
- Predecessor specs:
  - `2026-05-01-ui-foundation-design.md` (A — Hearts primitive shipped here)
  - `2026-05-01-app-shell-design.md` (B — AppShell shipped here, opted out by E's nested layout)
  - `2026-05-02-dashboard-design.md` (C — two-repo precedent)
  - `2026-05-03-tracks-design.md` (D — load-on-ID + inline helpers + tint patterns reused by E)
- CLAUDE.md constraints: review provider interface stable surface, untrusted student code stays sandboxed, gamification cannot fail submission.
