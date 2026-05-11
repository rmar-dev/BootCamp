# Spec #10 — Capstone Bridge

**Date:** 2026-04-13
**Status:** Design approved
**Depends on:** Specs #1 (content model), #4 (auth + cohorts), #5 (submission + grading), #8 (instructor review), #9 (curriculum authoring)

## Summary

Bridge the BootCamp lesson platform to real-world capstone projects. Students clone a starter repo, build locally, and submit repo URL + commit SHA at each milestone. Instructors review the code externally and approve milestones via the platform. Milestones are modeled as lessons within a capstone track — no new entities needed beyond a new exercise type and two schema fields.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Capstone structure | Single guided project per track, system supports multiple capstone tracks (A+) | Mini Peacock is the default; more can be added as Track entities with `kind: capstone` |
| What is a milestone | A lesson (A) | Zero new schema — the track's lessons ARE the milestones in order |
| Starter-repo handout | GitHub template URL in track metadata (A) | Experienced programmers know how to clone; no GitHub API integration needed |
| Submission format | Repo URL + commit SHA + notes (D) | Instructor reviews the repo directly; text field for build output and notes |
| Grading | Instructor-gated pass/fail (B) | Can't auto-grade a real project; submission pending until instructor approves |
| Architecture | New exercise type + approval field (B) | Dedicated `capstone_submission` type with `approvedByInstructorId` on Attempt |

## Data Model Changes

### Track — add `starterRepoUrl`

```prisma
model Track {
  // ... existing fields ...
  starterRepoUrl  String?
}
```

Nullable — only capstone tracks have a starter repo. Authored via frontmatter (`starterRepoUrl: https://github.com/...`).

### ExerciseType enum — add `capstone_submission`

```prisma
enum ExerciseType {
  code
  fix_bug
  fill_blank
  predict_output
  multiple_choice
  capstone_submission
}
```

### Attempt — add `approvedByInstructorId`

```prisma
model Attempt {
  // ... existing fields ...
  approvedByInstructorId  String?  @db.Uuid
}
```

Null = pending review. Set to instructor's userId on approval. When set, `passed` is flipped to `true` and `pointsAwarded` is calculated.

### New Zod schema for `capstone_submission`

```typescript
const capstoneSubmissionSchema = z.object({
  type: z.literal('capstone_submission'),
});
```

The payload at authoring time is just the type marker. The actual submission data (`repoUrl`, `commitSha`, `notes`) comes from the student at submit time and is stored in `Attempt.submissionPayload`.

### Submit DTO extension

The `POST /api/submit` body accepts additional optional fields for capstone submissions:

```typescript
{
  exerciseId: string;
  exerciseVersion: number;
  repoUrl?: string;    // required for capstone_submission
  commitSha?: string;  // required for capstone_submission
  notes?: string;      // optional
}
```

## Submission Flow

1. Student visits a capstone lesson. The `CapstoneSubmissionExercise` renderer shows a form: repo URL, commit SHA, notes textarea.
2. Student clicks "Submit Milestone". Frontend calls `POST /api/submit` with `{ exerciseId, exerciseVersion, repoUrl, commitSha, notes }`.
3. SubmissionService detects `type: capstone_submission`:
   - Validates `repoUrl` and `commitSha` are present (rejects if missing)
   - Skips Docker execution entirely
   - Creates Attempt with `passed: false`, `pointsAwarded: 0`, `approvedByInstructorId: null`, `submissionPayload: { repoUrl, commitSha, notes }`
   - Creates/updates ExerciseResult with `passed: false`
   - Returns `{ passed: false, attemptId, status: 'pending_review' }`
4. Submission appears in instructor's review queue.
5. Instructor reviews the repo (clicks URL), reads notes, writes feedback via InstructorReview.
6. Instructor clicks "Approve Milestone" → `PUT /api/instructor/approve/:attemptId`.
7. Student sees milestone as passed on next visit.

**Resubmission:** If the instructor requests revisions via the review thread, the student resubmits with a new commit SHA, creating a new Attempt. The old Attempt stays `passed: false`.

## API Changes

### Modified endpoints

| Method | Route | Change |
|--------|-------|--------|
| `POST` | `/api/submit` | Handle `capstone_submission` type — validate repoUrl/commitSha, skip execution, create pending Attempt |
| `GET` | `/api/instructor/queue` | Add a second query: find Attempts where the exercise type is `capstone_submission` and `approvedByInstructorId` is null, for students in the instructor's cohorts. Merge these into the queue results with a `queueType: 'capstone_approval'` field (vs `'code_review'` for regular items). |

### New endpoint

| Method | Route | Purpose | Auth |
|--------|-------|---------|------|
| `PUT` | `/api/instructor/approve/:attemptId` | Approve a capstone milestone | instructor |

### Approve endpoint logic

1. Verify the attempt exists and its exercise type is `capstone_submission`.
2. Verify `approvedByInstructorId` is null (not already approved).
3. Set `approvedByInstructorId = currentUser.userId`.
4. Update Attempt: `passed: true`, `pointsAwarded` = exercise's `pointsMax`.
5. Update ExerciseResult: `passed: true`, `bestAttemptId` = this attempt, `pointsEarned`, `firstPassedAt`.
6. Return updated attempt.

## Web App Changes

### New component: `CapstoneSubmissionExercise`

Renderer for `capstone_submission` exercises. Shows:
- Repo URL input field (pre-filled from previous submission if exists)
- Commit SHA input field
- Notes textarea
- "Submit Milestone" button
- After submission: status badge — "Pending Review" (yellow) or "Approved" (green)
- If approved: points badge + instructor review (reuses existing `PointsBadge` and `InstructorReview` components)

### Modified: `ExerciseBlock.tsx`

Add `capstone_submission` case in the renderer switch, dispatching to `CapstoneSubmissionExercise`.

### Modified: Instructor review detail page

For capstone submissions, the left pane shows:
- Repo URL as a clickable external link
- Commit SHA
- Student's notes (rendered as markdown)

Instead of the Monaco code editor used for regular code submissions.

Add an "Approve Milestone" button below the review form. Only visible when `approvedByInstructorId` is null. Calls `PUT /api/instructor/approve/:attemptId` and updates the UI on success.

### Modified: Instructor queue table

Add a badge/indicator distinguishing "Code Review" items from "Capstone Approval" items. Both link to the same review detail page, which adapts its layout based on exercise type.

## Curriculum Authoring

### Track frontmatter

Add `starterRepoUrl` to the track parser and compiler:

```markdown
---
id: mini-peacock
title: Mini Peacock
language: swift
kind: capstone
description: Build a simplified version of Peacock from scratch.
starterRepoUrl: https://github.com/bootcamp/mini-peacock-starter
lessons:
  - 01-project-setup
  - 02-model-layer
---
```

### Milestone lesson

```markdown
---
type: lesson
title: "Milestone 1: Project Setup"
level: beginner
summary: Clone the starter repo and get the project building.
---

# Project Setup

Clone the starter repository and follow the README to get it building.

---
type: exercise
kind: capstone_submission
pointsMax: 50
---

Submit your repo URL and commit SHA once the project builds and all starter tests pass.
```

### Compiler changes

- Add `capstone_submission` to the Zod schema in the validator. Payload is `{ type: 'capstone_submission' }` — no code fences.
- Add `starterRepoUrl` to `TrackMeta` parser and track DB write.

## Testing Strategy

### Platform (~10-12 new tests)

- **Submission:** `POST /api/submit` with `capstone_submission` creates pending Attempt (passed: false, approvedByInstructorId: null). No Docker execution. Rejects missing repoUrl/commitSha.
- **Approval:** `PUT /api/instructor/approve/:attemptId` sets passed: true, awards points, updates ExerciseResult. Rejects non-capstone exercise. Rejects already-approved attempt. Returns 403 for student role.
- **Queue:** Instructor queue includes pending capstone submissions.
- **Resubmission:** New Attempt created on resubmit, old stays passed: false.

### Web (~4-5 new tests)

- **CapstoneSubmissionExercise:** Renders form fields and submit button. Shows "Pending Review" after submission. Shows "Approved" when passed.
- **Instructor review detail:** Shows repo URL + notes for capstone type. Shows "Approve Milestone" button when pending.

### Curriculum (~2 new tests)

- **Compiler:** Capstone exercises compile with empty payload. Track with `starterRepoUrl` persists to DB.

## Out of Scope

- Automated builds or CI integration on the platform.
- GitHub API integration (forking, webhook on push).
- Deadline enforcement for milestones.
- Peer review of capstone projects.
- Capstone presentation/demo scheduling.
- Progress visualization beyond the existing lesson sidebar.
