# BootCamp Flow Catalog

Source of truth for the agent-browser QA harness. Every flow has:
`id`, `role`, `mode` (smoke | journey | both), `route(s)`, `steps`,
`smoke-assert` (exact check the batch encodes — only for smoke/both),
`verdict` (what "good" means for journey mode).

Seeded accounts (password `test1234`): `student@bootcamp.dev`,
`instructor@bootcamp.dev`, `admin@bootcamp.dev`.
Ports: web `:3001`, API `:3002`, Postgres `:5433`. Base URL `http://localhost:3001`.

---

## Public / auth

### auth-login  ·  role: public  ·  mode: both
- route: `/login`
- steps: open `/login` → fill Email `student@bootcamp.dev` → fill Password `test1234` → click "Sign in" → wait for URL to leave `/login`.
- smoke-assert: URL no longer starts with `/login` (lands on `/tracks` or `/dashboard`).
- verdict: lands on an authed page; sidebar visible; no console errors.

### auth-login-invalid  ·  role: public  ·  mode: both
- route: `/login`
- steps: open `/login` → fill Email `student@bootcamp.dev` → fill Password `wrongpass` → click "Sign in".
- smoke-assert: an error message is visible AND URL still starts with `/login`.
- verdict: clear inline error; no crash; user stays on login.

### auth-register  ·  role: public  ·  mode: journey
- route: `/register`
- steps: open `/register` → fill email/name/password with a fresh unique email → submit.
- verdict: account created and signed in, OR a clear validation message for duplicates; no crash.

### auth-logout  ·  role: student  ·  mode: both
- route: any authed → sign out
- steps: login as student → open settings/user menu → click Sign out.
- smoke-assert: URL returns to `/login`.
- verdict: session cleared; protected routes redirect afterward.

### route-guard  ·  role: public  ·  mode: both
- route: `/dashboard` (unauthenticated)
- steps: ensure logged out → open `/dashboard`.
- smoke-assert: URL redirects to `/login`.
- verdict: no protected content flashes before redirect.

---

## Student

### student-dashboard  ·  role: student  ·  mode: both
- route: `/dashboard`
- steps: login student → open `/dashboard`.
- smoke-assert: "Welcome back" heading visible AND a leaderboard heading visible.
- verdict: daily strip, paths, mini-leaderboard, streak/points render; no console errors.

### student-tracks  ·  role: student  ·  mode: journey
- route: `/tracks`
- verdict: skill tree renders grouped lessons; opening a track works.

### student-lesson-mc  ·  role: student  ·  mode: both
- route: `/lesson/22222222-2222-4222-8222-222222222222`
- steps: login student → open the seeded lesson → navigate to the multiple_choice block → select the correct option → submit.
- smoke-assert: a correct/success state is shown for the MC exercise.
- verdict: correct answer accepted; locked/next state appears; reset available.
- note: requires fresh `npm run seed` (progress is reset there).

### student-lesson-fill / -predict / -code  ·  role: student  ·  mode: journey
- route: same seeded lesson, other blocks
- verdict: each exercise type accepts a correct answer and shows result; Monaco loads for code.

### student-review  ·  role: student  ·  mode: journey
- route: `/review`
- verdict: due AI reviews render; completing one advances the queue.

### student-feedback  ·  role: student  ·  mode: both
- route: `/feedback`
- steps: login student → open `/feedback` → fill the comment textarea → submit.
- smoke-assert: the submitted feedback appears in the history list below.
- verdict: submission persists and shows in history; no crash.

### student-leaderboard  ·  role: student  ·  mode: both
- route: `/leaderboard`
- steps: login student → open `/leaderboard` → toggle weekly → monthly → all-time.
- smoke-assert: the page shows a leaderboard heading and the period toggle is present after switching.
- verdict: each period renders a ranking without error.

### student-badges  ·  role: student  ·  mode: journey
- route: `/badges`
- verdict: earned/locked badges render with icons + descriptions.

### student-profile  ·  role: student  ·  mode: journey
- route: `/profile`
- verdict: profile + KPI render; instructor-authored badges show if present.

---

## Instructor

### instructor-dashboard  ·  role: instructor  ·  mode: both
- route: `/instructor`
- steps: login instructor → open `/instructor`.
- smoke-assert: a pending-submissions queue and a reviewed queue are present.
- verdict: both queues render; counts plausible; no console errors.

### instructor-students  ·  role: instructor  ·  mode: both
- route: `/instructor/students`
- steps: login instructor → open `/instructor/students`.
- smoke-assert: the roster shows an "Assigned" tab and at least one student row/link.
- verdict: tabs switch; student rows link to detail.

### instructor-student-detail  ·  role: instructor  ·  mode: both
- route: `/instructor/students/<id>`
- steps: login instructor → open roster → open the seeded student → read KPI cards + difficulty/language controls.
- smoke-assert: difficulty baseline controls (easy/standard/challenging) and language controls (Swift/Kotlin/Any) are present.
- verdict: KPI cards render; controls reflect current state; changing a control persists.

### instructor-builder  ·  role: instructor  ·  mode: journey
- route: `/instructor/builder`
- verdict: "New lesson" opens the immersive editor; Monaco loads.

### instructor-review  ·  role: instructor  ·  mode: journey
- route: `/instructor/review/<attemptId>`
- verdict: a submission's code + test output render; a grade/feedback can be assigned.

### instructor-ratings  ·  role: instructor  ·  mode: journey
- route: `/instructor/ratings`
- verdict: entering an attemptId loads its ratings.

### instructor-badges  ·  role: instructor  ·  mode: both
- route: `/instructor/badges`
- steps: login instructor → open `/instructor/badges` → fill Name → create badge.
- smoke-assert: the new badge name appears in the badge list after creation.
- verdict: badge persists in the instructor-authored list; system badges still shown.
- note: creating duplicate-named badges across runs is acceptable; assertion checks presence of the name, not uniqueness.

### instructor-skill-tree  ·  role: instructor  ·  mode: journey
- route: `/instructor/skill-tree`
- verdict: cohort picker drives per-cohort custom-exercise rules.

### instructor-assign-tree  ·  role: instructor  ·  mode: both  ·  CURRENT BRANCH FEATURE
- route: `/instructor/skill-tree` (composer)
- steps: login instructor → open the skill-tree composer → assign a tree to one student via the composer's assign control → confirm.
- smoke-assert: a success/confirmation state for the assignment is shown.
- verdict: the tree is assigned to exactly the chosen student; dropdown labels are clear (the feature on `feat/assign-tree-to-student-from-composer`).
