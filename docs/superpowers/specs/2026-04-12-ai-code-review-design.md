# Spec #7 — AI Code Review

**Date:** 2026-04-12
**Status:** Design approved, awaiting implementation plan
**Depends on:** Specs #1–6 (all on `master` at `065132b`)
**Successor specs:** #8 (human instructor review)

## Goal

After a student submits a `code` or `fix_bug` exercise, an LLM reviews their solution and provides brief, idiomatic, audience-appropriate feedback. The review is generated asynchronously (fire-and-forget after the submit response) and displayed in the web UI when ready. Provider-agnostic — works with any OpenAI-compatible API (Augment, Claude, OpenAI, etc.) via env config.

## Non-goals

- Reviews for MC/fill/predict exercises (nothing meaningful to review)
- Review history page or instructor view of reviews (spec #8)
- Re-review / "review again" button
- Streaming SSE (polling is sufficient for ~3-5s generation time)
- Prompt engineering beyond the V1 template (iterate based on real feedback)
- Rate limiting on review generation (bootcamp scale doesn't need it)

## Data model

### New: `CodeReview` entity

```prisma
model CodeReview {
  id         String   @id @db.Uuid
  attemptId  String   @unique @db.Uuid
  studentId  String   @db.Uuid
  markdown   String
  createdAt  DateTime @default(now())

  @@index([studentId])
}
```

One review per attempt. The `attemptId` unique constraint means a second review for the same attempt is rejected (idempotent).

## Architecture

### New module: `ReviewModule`

```
platform/src/
  review/
    review.module.ts
    review.service.ts                 (orchestrate: build prompt → call provider → store)
    review.repository.ts              (CodeReview CRUD)
    review-provider.interface.ts      (abstract provider contract)
    review.controller.ts              (GET /api/reviews/:attemptId)
    prompt-builder.ts                 (pure function: builds the LLM prompt)
    providers/
      mock.provider.ts                (returns template review for dev/test)
      openai-compat.provider.ts       (calls any OpenAI-compatible chat completions endpoint)
```

### Provider interface

```ts
export interface ReviewProvider {
  review(prompt: string): Promise<string>;
}
```

Single method, takes a prompt string, returns markdown review text. Implementations:

**`MockProvider`** — returns a hardcoded template review mentioning the language and pass/fail status. Used when `AI_REVIEW_ENABLED` is not `true` or in tests.

**`OpenAICompatProvider`** — calls `POST {AI_REVIEW_BASE_URL}/chat/completions` with:
```json
{
  "model": "{AI_REVIEW_MODEL}",
  "messages": [{"role": "user", "content": "{prompt}"}],
  "max_tokens": 500,
  "temperature": 0.3
}
```
Reads the response `choices[0].message.content`. Handles errors gracefully (timeout, 4xx, 5xx → returns a fallback "review unavailable" string, never throws to the caller).

Compatible with: Augment API, OpenAI API, Anthropic's OpenAI-compatible endpoint, Azure OpenAI, any proxy.

### Environment variables

```env
AI_REVIEW_ENABLED=false              # set to 'true' to enable
AI_REVIEW_BASE_URL=                  # e.g. https://api.augment.dev/v1
AI_REVIEW_API_KEY=                   # provider API key
AI_REVIEW_MODEL=                     # e.g. gpt-4o, claude-sonnet-4-20250514, augment-code
```

Added to `.env.template`. When `AI_REVIEW_ENABLED` is not `true`, the `ReviewModule` uses `MockProvider` and `ReviewService.generateReview()` is a no-op (returns immediately without creating a CodeReview row). The web UI checks for the review's existence and shows nothing if there is none.

### Review flow

```
1. Student submits code/fix_bug via POST /api/submit
2. SubmissionService.submit() returns SubmitResponse immediately (unchanged)
3. After returning, SubmissionService fires ReviewService.generateReview() as a fire-and-forget
   (not awaited — the submit response is already sent)
4. ReviewService:
   a. Fetches the Attempt + Exercise (for prompt context)
   b. Builds prompt via promptBuilder(exercise, code, passed, stderr, language)
   c. Calls reviewProvider.review(prompt) → markdown string
   d. Stores CodeReview row (attemptId, studentId, markdown)
5. Client polls GET /api/reviews/:attemptId every 2s
   → 404 while generating
   → 200 { markdown, createdAt } when ready
   → stops polling after 30s (shows "Review not available" fallback)
```

### Fire-and-forget pattern

In `SubmissionService.submit()`, after building the response but before returning it:

```ts
// Fire-and-forget — don't await, don't block the response
if (payload.type === 'code' || payload.type === 'fix_bug') {
  this.reviewService.generateReview(attempt.id, student.id, exercise, req.code!, passed, stderr ?? '')
    .catch((err) => this.logger.warn('review generation failed', err));
}

return submitResponse;
```

The `.catch()` ensures unhandled rejections don't crash the process.

### Prompt template

```ts
export function buildReviewPrompt(opts: {
  language: string;
  promptMarkdown: string;
  code: string;
  passed: boolean;
  stderr: string;
}): string {
  return `You are reviewing a ${opts.language} exercise submission from an experienced programmer who is learning ${opts.language} for the first time.

Exercise: ${opts.promptMarkdown}

Student code:
\`\`\`${opts.language}
${opts.code}
\`\`\`

Test result: ${opts.passed ? 'PASSED' : 'FAILED'}
${opts.stderr ? `Compiler/runtime output:\n${opts.stderr}` : ''}

Provide a brief review (3-5 sentences) focused on:
- Whether the code is idiomatic ${opts.language}
- One specific improvement the student could make
- If failed: a hint toward the fix WITHOUT giving the answer

Do not explain basic programming concepts. The student already knows how to program — they are learning ${opts.language} specifically.`;
}
```

Pure function, trivially testable.

### Submit response update

`SubmitResponse` gains one field:

```ts
type SubmitResponse = {
  // ... existing fields ...
  attemptId: string;    // NEW — needed for the client to poll for the review
};
```

The `attemptId` was already available (from `AttemptService.recordAttempt()`) but not exposed in the response. Now it is.

## API contract

### `GET /api/reviews/:attemptId`

Requires `JwtAuthGuard`. Only the student who owns the attempt can read the review (verified via `studentId` match).

**200:**
```json
{
  "markdown": "Your solution works but...",
  "createdAt": "2026-04-12T..."
}
```

**404:** Review not yet generated (or never will be — the client stops polling after 30s).

**401:** Not authenticated.

**403:** Attempt belongs to a different student.

## Web UI changes

### Code/FixBug submit result — review section

After a Submit that returns an `attemptId`, the result panel gains an "AI Review" section below the RunResult + PointsBadge:

```
┌─────────────────────────────┐
│ ✅ Tests passed!             │
│ +100 points (200 total)     │
│ 🚀 Badge unlocked: Nailed It│
│                             │
│ 🤖 AI Review                │
│ ┌─────────────────────────┐ │
│ │ Reviewing your code...  │ │  ← loading skeleton
│ └─────────────────────────┘ │
│         ↓ (2-5 seconds)     │
│ ┌─────────────────────────┐ │
│ │ Your solution is correct│ │  ← rendered markdown
│ │ but consider using...   │ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

### New web files

```
web/
  components/lesson/renderers/AIReview.tsx     (polling + display component)
  tests/renderers/AIReview.test.tsx
```

### Modified web files

```
  lib/submit.ts                (SubmitResponse gains attemptId)
  components/lesson/renderers/CodeExercise.tsx   (show AIReview after submit)
  components/lesson/renderers/FixBugExercise.tsx (same)
```

### `AIReview` component

Client component. Props: `{ attemptId: string | null }`.

- When `attemptId` is null: renders nothing.
- When set: starts polling `GET /api/reviews/:attemptId` every 2 seconds.
- Shows "🤖 Reviewing your code..." loading state.
- On 200: renders the review markdown (via `react-markdown` + `remark-gfm`, same as `ExplanationBlock`).
- On 404 after 30 seconds of polling: shows "Review not available" and stops.
- Cleanup: cancels polling on unmount or when `attemptId` changes.

## Testing

| Layer | Tool | Coverage |
|---|---|---|
| `buildReviewPrompt` (pure) | Jest | Correct language, code, pass/fail, stderr interpolation |
| `MockProvider` | Jest | Returns template string containing language |
| `OpenAICompatProvider` | Jest (mocked fetch) | Happy path returns markdown; timeout/error returns fallback |
| `ReviewService` | Jest (mocked deps) | Generates review for code type; skips for MC type; stores CodeReview; no-op when disabled |
| `ReviewRepository` | Jest | CRUD: create, findByAttemptId |
| `ReviewController` | Jest + supertest | 200 with review; 404 when pending; 401 without auth; 403 for wrong student |
| SubmissionService integration | Jest | submit returns attemptId; fires generateReview for code type |
| Web `AIReview` component | Vitest + RTL | Shows loading, then review after mocked fetch resolves; shows fallback after timeout |
| Playwright | Playwright | Submit code → see "Reviewing your code..." → (if AI enabled) review appears |

## Success criteria

1. Submit a code exercise → response includes `attemptId` → "🤖 Reviewing your code..." appears → review markdown displays within ~5 seconds (when AI_REVIEW_ENABLED=true with valid credentials).
2. Without `AI_REVIEW_ENABLED=true`: no review generated, no error, UI shows nothing (no loading state, no review section).
3. `GET /api/reviews/:attemptId` returns 200 with markdown after generation, 404 while pending.
4. Review text is language-specific and appropriate for experienced devs learning a new language.
5. MC/fill/predict submissions don't trigger review generation.
6. Submit response is NOT delayed by review generation (fire-and-forget).
7. Provider errors (timeout, bad key, 500) are caught gracefully — logged as warning, no crash, no error to the user.
8. All existing tests pass.

## Architectural decisions

1. **Fire-and-forget async, not synchronous.** The submit response returns immediately. Review generation runs in the background. This adds 0ms latency to submission and the review appears ~3-5s later via polling.
2. **Provider-agnostic via OpenAI-compatible interface.** The `POST /v1/chat/completions` format is the de facto standard. Augment, Claude (via Anthropic's compatibility layer), OpenAI, Azure, and local proxies all speak it.
3. **Polling, not websockets/SSE.** For a 3-5s wait with 2s poll interval, polling adds 1-2 extra requests total. SSE would save those requests but adds connection management complexity. Not worth it.
4. **One review per attempt (`attemptId` unique).** Prevents accidental double-reviews. If the generation fails, there's simply no row — the client times out and shows the fallback.
5. **Mock provider as default.** When `AI_REVIEW_ENABLED` is not set, `ReviewService.generateReview()` is a no-op — no CodeReview row created, no provider called. The web UI gracefully shows nothing. Dev setup works without any API key.
6. **Prompt tuned for experienced devs.** Explicitly says "do not explain basic programming concepts" and focuses on language idioms. Matches the audience profile from memory.
