---
type: lesson
title: Final Submission — Polish, Bug Bash, and Walkthrough
level: advanced
summary: Final milestone — animations, accessibility, the bug bash, and the all-in-one walkthrough recording.
---

## Final polish pass

Before recording the final walkthrough, complete these:

| Area | Specific item |
|---|---|
| Animations | Hero `matchedGeometryEffect` from poster to player; `.spring` on detail open (Week 5, Lesson 04) |
| Now Playing | Lock-screen metadata + remote commands wired (Week 11, Lesson 03) |
| Auto-PiP | `canStartPictureInPictureAutomaticallyFromInline = true` (Week 11, Lesson 01) |
| Accessibility | Every poster has `.accessibilityLabel(movie.title)`; controls have descriptive labels |
| Empty states | Logged-out catalog, no-results search, empty offline tab — each has a friendly view |
| Error states | Network error during catalog load → retry button; player error → user-visible message |
| Theming | Dark mode looks right; SF Symbols not white-on-white anywhere |

> **Coming from C++:** Treat this like a release-candidate hardening sprint. The functional milestones already passed; this is about the cracks the grader will press on.

---

## Bug bash protocol

Run through these scripts in order. If any fail, fix before recording:

1. Cold launch → catalog → poster → play → background → resume.
2. Cold launch → catalog → poster → play → AirPlay route picker → cancel.
3. Cold launch → catalog → poster → play → PiP → switch app → return → end PiP.
4. Cold launch → search → empty results → search again with results → tap → play.
5. Cold launch → offline tab → play downloaded → Airplane Mode → seek backward.
6. Cold launch → settings → quality picker → Airplane Mode → catalog tab (offline empty state).
7. Logout → cold launch → login screen.
8. Headphones plugged → play → unplug → expect pause (Week 11, Lesson 02).

Any crash, hang, or visible glitch → fix → re-run from step 1.

---

## Final recording requirements

Save as `final-walkthrough.mp4`, ≤5 minutes. This is the showcase recording the grader watches first.

1. Cold launch on a real device.
2. Sign in.
3. Browse the home screen, scroll a carousel.
4. Search → tap a result.
5. Detail screen → hero animation into the player.
6. Play. Demonstrate scrubber, AirPlay button, PiP.
7. Background the app to confirm auto-PiP. Foreground.
8. Lock the device, show lock-screen Now Playing controls (play/pause/seek). Unlock.
9. Save the movie offline. Wait or fast-forward to download complete.
10. Airplane Mode → open offline tab → play offline.
11. Airplane Mode off → logout.

Talking head not required. Voice-over recommended at steps 5, 7, and 10 (the moments that are easy to miss visually).

---

## Self-assessment

The submission form requires a written self-assessment covering:

| Section | What to write |
|---|---|
| **Architecture choices** | Which patterns from the curriculum you used, where you diverged, why. |
| **Trade-offs** | One thing you would do differently with more time. |
| **Hardest bug** | One concrete bug you debugged. Symptom → root cause → fix. |
| **What's not done** | Any acceptance items that don't work. Be honest — graders prefer disclosure to discovery. |
| **Time spent** | Approximate hours per milestone. |

Length: 300–500 words total. The instructor reads this before watching the recording.

---

## Grading rubric

The instructor scores against:

| Category | Weight |
|---|---|
| Functional completeness across acceptance checklists | 40% |
| Code quality (architecture, naming, error handling) | 25% |
| Polish (animations, empty/error states, accessibility) | 15% |
| Recordings (clarity, all milestones present) | 10% |
| Self-assessment honesty and depth | 10% |

A passing submission scores ≥70%. Below that, the instructor will request a re-record or specific fixes.

---
type: exercise
kind: multiple_choice
pointsMax: 10
---
Which item belongs in the self-assessment, not the recordings?

- [ ] Demonstration of offline playback.
- [ ] Demonstration of lock-screen controls.
- [x] A written description of the hardest bug you fixed and how.
- [ ] Demonstration of Sign in with Apple.

---
type: exercise
kind: multiple_choice
pointsMax: 10
---
What is the right action when an acceptance item does not work in your final submission?

- [ ] Skip the recording for that item silently.
- [ ] Re-record without it and hope the grader doesn't notice.
- [x] Document it in the self-assessment under "What's not done" and explain why.
- [ ] Submit only after fixing every issue, even if weeks behind.

---
type: exercise
kind: multiple_choice
pointsMax: 10
---
Which polish item carries the most user-visible weight per minute of effort?

- [ ] Custom app icon.
- [x] Empty / error states (network failure, empty search results) with retry affordances.
- [ ] Custom font for the title screen.
- [ ] Hex-perfect color matching to a competitor app.

---
type: exercise
kind: capstone_submission
pointsMax: 200
---
Submit the FINAL package via the BootCamp web UI:

1. `final-walkthrough.mp4` — the all-in-one recording.
2. `milestone-1-catalog-player.mp4` and `milestone-2-auth-offline.mp4` from prior lessons.
3. Repo URL (private OK; add the instructor as a collaborator).
4. Self-assessment written into the submission form.

Confirm the iOS deployment target is set to 17.0+, the Audio background mode is enabled, and Sign in with Apple is configured before submitting. Once submitted, the instructor reviews and scores against the rubric in this lesson.
---
type: recap
---

## What you learned

**Concepts:** the polish pass (animations, accessibility, empty/error states) · bug bash protocol before recording · the final walkthrough recording sequence · self-assessment expectations and grading rubric

**Swift-specific vs other languages:** Submission via screen recording is unusual — it's the platform's adaptation to the fact iOS apps can't be auto-graded in a sandbox. Treat the recordings as you would a code-review video walk-through to a senior engineer.

**What's next:** You're done. The bootcamp ends here. The repo, the recordings, and the self-assessment together are the artefact you keep — closer to a real portfolio piece than to a coursework submission.
