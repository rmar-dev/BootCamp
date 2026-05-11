# Spec #8 — Human Instructor Review

**Date:** 2026-04-13
**Status:** Design approved
**Depends on:** Specs #1 (content model), #3 (code execution), #4 (auth + cohorts), #5 (submission + grading), #7 (AI code review)

## Summary

Add asynchronous human instructor review that layers on top of the existing AI code review. Instructors review the best passing attempt per exercise for students in their cohort, provide markdown feedback, and can engage in a follow-up conversation thread with the student.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Relationship to AI review | Layer on top (B) | AI gives instant feedback; instructor adds targeted human insight asynchronously |
| What enters the queue | Best passing attempt per student-exercise (C) | Avoids noise from failed attempts; focuses instructor time on representative work |
| Feedback format | Single markdown comment (A) | Mirrors AI review format; short exercises don't need inline annotations |
| Student follow-up | Flat message thread (A) | Simple to build, no artificial limits, no lifecycle state |
| Notifications | None (A) | Instructor checks the queue; student sees review on revisit. Notifications are a future concern |
| AI review visibility | Collapsed by default (B) | Avoids anchoring bias; instructor can expand to avoid duplicating AI feedback |
| Architecture | Separate InstructorReview entity (B) | Clean separation from AI review; independent lifecycle; follows existing module-per-domain pattern |

## Data Model

### InstructorReview

| Field | Type | Constraints |
|-------|------|-------------|
| id | String | `@id @default(uuid())` |
| attemptId | String | `@unique` — one instructor review per attempt |
| instructorId | String | FK → User (role=instructor) |
| markdown | String | Instructor's feedback in markdown |
| createdAt | DateTime | `@default(now())` |
| updatedAt | DateTime | `@updatedAt` |

Relations: Attempt (1:1), User (many:1), ReviewMessage[] (1:many).

### ReviewMessage

| Field | Type | Constraints |
|-------|------|-------------|
| id | String | `@id @default(uuid())` |
| instructorReviewId | String | FK → InstructorReview |
| authorId | String | FK → User (student or instructor) |
| body | String | Markdown text |
| createdAt | DateTime | `@default(now())` |

Relations: InstructorReview (many:1), User (many:1).

## Review Queue

The queue is a derived query, not a stored state:

1. Find all cohorts where the instructor is assigned (`Cohort.instructorId = currentUser.id`).
2. Find all `ExerciseResult` rows where `passed = true` for students in those cohorts.
3. LEFT JOIN `InstructorReview` on the best attempt (`ExerciseResult.bestAttemptId`).
4. Rows with no `InstructorReview` are "pending review".

This gives the instructor one entry per student-exercise pair across all their cohorts, showing only passing work.

## API Routes

All routes are under the `/api/instructor` prefix.

| Method | Route | Purpose | Auth |
|--------|-------|---------|------|
| GET | `/api/instructor/queue` | Pending reviews for instructor's cohort | instructor |
| GET | `/api/instructor/queue/reviewed` | Already-reviewed submissions | instructor |
| GET | `/api/instructor/attempt/:attemptId` | Full attempt detail: code, AI review, exercise prompt | instructor |
| POST | `/api/instructor/review` | Create instructor review `{ attemptId, markdown }` | instructor |
| PUT | `/api/instructor/review/:id` | Edit review markdown | instructor |
| GET | `/api/instructor/review/:attemptId` | Get instructor review + thread messages | instructor, student (own attempt) |
| POST | `/api/instructor/review/:id/messages` | Post a thread message `{ body }` | instructor, student (own attempt) |

### Auth Guards

- New `@Roles('instructor')` guard on instructor-only routes.
- Student-accessible routes (`GET review`, `POST message`) verify the student owns the attempt via `attempt.studentId`.
- Reuses existing JWT cookie auth from spec #4.

## Web App — Instructor Pages

### `/instructor` — Dashboard

- **Header:** "Review Queue" with pending count.
- **Filter bar:** Dropdown to filter by track/lesson (client-side filter).
- **Queue table:** Columns — student name, exercise title, lesson title, submission date, status (pending/reviewed). Row click navigates to review detail.
- **Tab toggle:** "Pending" (default) / "Reviewed" switches between the two queue endpoints.
- **Access control:** Redirect to `/dashboard` if `user.role !== 'instructor'`.

### `/instructor/review/[attemptId]` — Review Detail

- **Left pane:** Student's submitted code in read-only Monaco editor (reuses existing Monaco setup).
- **Right pane, top:** Exercise prompt rendered as markdown.
- **Right pane, middle:** AI review in a collapsible `<details>` element, collapsed by default.
- **Right pane, bottom:** Instructor review area:
  - If no review yet: markdown textarea + "Submit Review" button.
  - If review exists: rendered markdown with an "Edit" toggle.
  - Below: conversation thread — flat list of messages (author name + timestamp), plus a reply textarea.

## Student-Facing Changes

Minimal additions to the existing lesson page:

- **New `InstructorReview` component** rendered below the existing `AIReview` component.
  - Shows: "Instructor Review" heading, instructor name, timestamp, rendered markdown.
  - Below: conversation thread + "Ask a Question" reply textarea.
- **If no instructor review exists:** Component is not rendered. No "pending" placeholder — the student doesn't need to know a review is coming.
- **Data fetching:** Single `GET /api/instructor/review/:attemptId` on page load. 404 → don't render. No polling needed.

## Testing Strategy

### Platform (~15-20 tests)

- **Unit — InstructorReviewService:** Create review, edit review, post message, one-review-per-attempt constraint.
- **Unit — Queue query:** Returns correct pending/reviewed sets, filters by cohort, only includes best passing attempts.
- **Integration — InstructorReviewController:** Auth guard rejects students, instructor can CRUD reviews, student can read own review + post messages but not others'.
- **Edge cases:** Instructor reviews attempt that already has AI review (independent), student posts message on review from different cohort (403).

### Web (~8-10 tests)

- **Component — InstructorReview:** Renders markdown, shows thread, reply form works.
- **Component — Queue table:** Renders rows, filter toggles, navigation to detail.
- **Page — Review detail:** Monaco loads read-only, AI review collapsed by default, submit creates review.

## Out of Scope

- Email or push notifications (future spec).
- Inline code annotations / line-anchored comments.
- Structured rubric scoring.
- Review assignment / load balancing across multiple instructors.
- Review of non-code exercise types.
