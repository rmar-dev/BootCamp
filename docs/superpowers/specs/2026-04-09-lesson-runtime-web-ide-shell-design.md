# Spec #2 — Lesson Runtime / Web IDE Shell

**Date:** 2026-04-09
**Status:** Design approved, awaiting implementation plan
**Depends on:** Spec #1 (content & curriculum model) — merged to `master` at `ba1f333`
**Successor specs:** #3 (code execution backend), #4 (auth + cohorts), #5 (submission & grading)

## Goal

Deliver the first student-facing UI for BootCamp: a two-pane lesson page that fetches a published lesson from the Nest API and renders all five exercise types. Three of the five types (multiple_choice, fill_blank, predict_output) get a working client-side "Check" button. The two execution-dependent types (code, fix_bug) render Monaco with stubbed Run buttons.

This spec proves the rendering, layout, and API-wiring story end-to-end without introducing auth, persistence, grading, or code execution. Each of those concerns has its own later spec.

## Non-goals

- Auth, sessions, student identity (spec #4)
- Submission persistence, real grading, hidden tests (spec #5)
- Code execution — SwiftWasm/Kotlin-JS/cloud sandbox (spec #3)
- Track listing page, lesson navigation, "next lesson" button (spec #4 or #9)
- Hint UI (spec #5 or #6, since hints affect scoring)
- Points display, streaks, leaderboards (spec #6)
- Swift/Kotlin syntax highlighting in Monaco — plaintext editor for now

## Architecture

### Repo layout

```
BootCamp/
  platform/                                # existing Nest API
    src/content/lesson.controller.ts       (NEW)
    prisma/seed.ts                         (NEW)
  web/                                     # NEW Next.js 14 App Router app
    app/
      layout.tsx
      lesson/[id]/page.tsx                 (Server Component)
    components/
      lesson/
        BlockList.tsx                      (Server)
        ExplanationBlock.tsx               (Server, react-markdown)
        ExerciseBlock.tsx                  (Client wrapper)
        renderers/
          CodeExercise.tsx
          FixBugExercise.tsx
          FillBlankExercise.tsx
          PredictOutputExercise.tsx
          MultipleChoiceExercise.tsx
    lib/
      api.ts                               (typed fetch wrapper)
      exercise-payloads.ts                 (TS types mirroring spec #1 Zod)
      check.ts                             (pure client-side answer comparison)
    tests/
      renderers/*.test.tsx                 (Vitest + RTL)
      check.test.ts                        (Vitest)
      contract.test.ts                     (Vitest, hits live Nest)
      e2e/lesson.spec.ts                   (Playwright)
```

`web/` is a standalone npm project. No pnpm workspace, no monorepo tooling. Spec #1's `platform/` directory is untouched except for the new controller and seed script.

### Tech stack

| Concern | Choice |
|---|---|
| Framework | Next.js 14, App Router |
| Language | TypeScript 5 |
| Editor | `@monaco-editor/react` (plaintext mode) |
| Styling | Tailwind CSS + a few shadcn/ui primitives (Button, Card) |
| Markdown | `react-markdown` + `remark-gfm` |
| Data fetching | Plain `fetch` from Server Components |
| State | Local `useState` in renderers; no Zustand/Redux |
| Component tests | Vitest + React Testing Library |
| E2E tests | Playwright |
| Contract tests | Vitest with a local Zod copy of payload schemas |

### Two-pane layout

`/lesson/[id]` renders:

- **Left pane** (40% width, scrollable): lesson title, ordered list of explanation blocks rendered as markdown, and a sidebar list of exercise blocks the student can jump to.
- **Right pane** (60% width, sticky on desktop): the currently-active exercise rendered by its type-specific component.
- Below ~768px the panes stack vertically.
- A `?ex=<index>` query param tracks the active exercise. No global store, no client router state.

### Cross-process flow

```
Browser
  → Next Server Component (lesson/[id]/page.tsx)
    → fetch(http://localhost:3000/api/lessons/:id)
      → Nest LessonController
        → ContentService (spec #1)
          → Postgres
```

Nest runs on `:3000`, Next on `:3001`. CORS opened on Nest for `localhost:3001` in dev only. No auth header, no cookies.

## API contract

New controller at `platform/src/content/lesson.controller.ts`:

```
GET /api/lessons/:id              → latest published version of lesson :id
GET /api/lessons/:id/v/:version   → specific published version
```

Both routes return:

```ts
type LessonResponse = {
  id: string;
  version: number;
  title: string;
  trackId: string | null;
  blocks: Block[];                 // ordered as authored
};

type Block =
  | { kind: 'explanation'; id: string; markdown: string }
  | { kind: 'exercise';    id: string; exercise: ExerciseDTO };

type ExerciseDTO = {
  id: string;
  version: number;
  type: 'code' | 'fix_bug' | 'fill_blank' | 'predict_output' | 'multiple_choice';
  prompt: string;                  // markdown
  pointsMax: number;
  payload: ExercisePayload;        // discriminated by `type`
};
```

Behavior:

- Returns only published lessons. Drafts → 404. Reuses spec #1's `LessonRepository`; adds `findPublished` if not present.
- Resolves each block's `(exerciseId, exerciseVersion)` and inlines the full `ExerciseDTO`. The lesson is the version-pinned root, so all child versions are deterministic.
- Returns `{ error: 'not_found' }` with HTTP 404 on missing or unpublished. No other error states.
- Public read: no pagination, no auth header, no rate limiting.

### Client-side payload type drift

`web/lib/exercise-payloads.ts` is a hand-mirrored copy of the Zod-inferred types from `platform/src/content/exercise-payload.types.ts`. A contract test in `web/tests/contract.test.ts` boots Nest, fetches the seeded lesson, and asserts each payload parses against a local Zod copy. This is a cheap drift detector until a shared package becomes worthwhile (revisit in spec #4).

### Client-side check function

`web/lib/check.ts`:

```ts
checkAnswer(exercise: ExerciseDTO, answer: unknown): { passed: boolean }
```

- `multiple_choice`: set equality of submitted option ids against `payload.correctOptionIds`.
- `fill_blank`: trimmed, case-sensitive string equality per blank against `payload.blanks[i].correct`.
- `predict_output`: trimmed string equality against `payload.expectedOutput`.
- `code` / `fix_bug`: throws `Error('execution backend not available')`. Caller never invokes for these types.

The check function is pure and synchronous. No network call, no persistence. When spec #5 lands, this entire file is deleted in favor of `POST /api/attempts`.

## Renderer behavior

| Type | Input UI | Action button | On click |
|---|---|---|---|
| `multiple_choice` | radio (single) or checkboxes (multi) keyed off `payload.allowMultiple` | "Check" | runs `checkAnswer`, shows green/red state |
| `fill_blank` | one `<input>` per blank | "Check" | runs `checkAnswer`, shows pass/fail per blank |
| `predict_output` | one `<textarea>` | "Check" | runs `checkAnswer`, shows green/red state |
| `code` | Monaco, prefilled with `payload.starterCode` | "Run" (disabled) | tooltip: "Execution backend coming in spec #3" |
| `fix_bug` | Monaco, prefilled with `payload.buggyCode` | "Run" (disabled) | tooltip: "Execution backend coming in spec #3" |

All renderers use local `useState`. No persistence, no parent communication beyond the initial exercise prop.

## Seed data

`platform/prisma/seed.ts` creates one published track + one published lesson titled **"Hello BootCamp"** containing, in order:

1. Explanation block — ~100 words on what BootCamp is
2. `multiple_choice` — "Which language are you learning?" (Swift / Kotlin / Both / Neither)
3. Explanation block — short paragraph on variables
4. `fill_blank` — `let ___ = 42` (answer: `x`)
5. `predict_output` — 3-line snippet, type the output
6. `code` — "Write a function that returns 'hello'"
7. `fix_bug` — buggy snippet prefilled in Monaco

Idempotent: re-running upserts by stable id. Wired via `prisma.seed` in `platform/package.json`. Run with `npm run seed` or `npx prisma db seed`.

## Testing

| Layer | Tool | Coverage |
|---|---|---|
| Nest controller | Jest (existing setup) | `GET /api/lessons/:id` returns published lesson; 404 on draft; 404 on missing; version-specific route returns the right version |
| Web renderers | Vitest + RTL | Each of 5 renderers in isolation: renders prompt, accepts input, `Check` button invokes `checkAnswer` and shows pass/fail UI; `code`/`fix_bug` show disabled Run with tooltip |
| `check.ts` | Vitest | Pure-function tests for all 3 checkable types, including empty answer, extra whitespace, wrong case |
| Contract | Vitest | Boots Nest in test mode, fetches the seeded lesson, asserts each payload parses against the web-side Zod copy |
| E2E | Playwright | One smoke test: boot both servers, visit `/lesson/<seed-id>`, assert all 7 blocks render, answer the multiple-choice, see green "Correct" state |

## Success criteria

1. `npm run start:dev` in `platform/` and `npm run dev` in `web/` boots both servers; visiting `http://localhost:3001/lesson/<seed-id>` renders the seeded lesson with all 7 blocks visible.
2. The 3 checkable exercise types accept input and show a correct/incorrect state on Check.
3. The 2 execution-required types render Monaco with the right initial code and a disabled Run button labeled "Execution backend coming in spec #3".
4. All Jest, Vitest, and Playwright suites pass.
5. Contract test passes against the seeded lesson.
6. No auth, no progress persistence, no points display, no track navigation. (Deferred by design.)

## Architectural decisions worth flagging

1. **Standalone `web/` rather than monorepo.** Avoids introducing pnpm workspaces mid-project. Cost: payload types are duplicated. Mitigation: contract test catches drift. Revisit in spec #4 when auth introduces more shared types.
2. **Plaintext Monaco.** Swift and Kotlin aren't built into Monaco. Highlighting is cosmetic and can be added in spec #3 alongside execution. Skipping it keeps spec #2 focused.
3. **Client-side check for 3 of 5 types.** The correct answer is already in the payload. A client check gives a demoable end-to-end experience for 3/5 types with zero new infrastructure. The code is intentionally throwaway — spec #5 deletes it when grading moves server-side.
4. **No `POST /api/attempts` yet.** Even a stub controller would be rewritten in spec #5. Better to skip.
5. **Seed lesson is hand-written TypeScript.** Authoring tooling is spec #9. For now, one hardcoded lesson is enough to drive UI development.
