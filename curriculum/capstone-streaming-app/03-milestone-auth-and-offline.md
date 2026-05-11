---
type: lesson
title: Milestone 2 — Auth, Persistence, and Offline
level: advanced
summary: Second milestone — Sign in with Apple, watch history, offline downloads, and the auth-aware API client.
---

## What this milestone delivers

A user can:

1. Sign in with Apple (or skip, if running offline-only).
2. See their actual catalog from a real API (or stubbed JSON for grading purposes).
3. Have watch history persisted across app launches via SwiftData.
4. Download a movie for offline viewing, see it in an Offline tab, play it without internet.
5. Log out — the Keychain token is cleared, history remains.

> **Coming from JavaScript:** Treat the auth + persistence layers like a Next.js app shipping NextAuth + Prisma. The pieces are different (Apple Sign In, SwiftData) but the responsibilities are identical.

---

## Build sequence

1. **`KeychainStore`** — copy from Week 10, Lesson 03. Service name like `com.example.minipeacock`.
2. **`AuthSession`** actor — Week 10, Lesson 04. Reads/writes the access token via Keychain.
3. **`SignInWithAppleButton`** wired to `AuthSession.setToken(...)` after server validation. For the capstone, you can stub the server validation with a hard-coded "if identityToken is non-empty, treat as logged in".
4. **`APIClient`** — Week 6, Lesson 03 + Week 10, Lesson 04. Inject `Authorization: Bearer ...` from `AuthSession`. Single-flight 401 refresh.
5. **`Catalog` endpoints** — `Endpoint<[Movie]>.trending`, `Endpoint<Movie>.detail(id:)`, etc. Hit a real API or your own dev backend.
6. **`WatchHistoryEntry`** + **`OfflineDownload`** SwiftData models from Week 7 / Week 11.
7. **`@Query`** in `HomeView`'s "Continue Watching" carousel — Week 7, Lesson 02.
8. **`AVAssetDownloadURLSession`** download manager — Week 11, Lesson 04. Persist the relative path; rebuild the absolute URL on each launch.
9. **`OfflineLibrary` tab** — list of `OfflineDownload`. Tap to play offline.
10. **Logout flow** — clear token from `AuthSession`, return to login screen. SwiftData stays (graders may want to inspect history).

---

## Acceptance checklist

- [ ] Signing in surfaces the system Apple sheet.
- [ ] After sign-in, the catalog is populated from the API.
- [ ] Killing and relaunching the app keeps the user signed in (token in Keychain).
- [ ] Watching a movie for ≥10 seconds, killing the app, returning, finds it in Continue Watching with the correct position.
- [ ] Downloading a movie shows progress, then a "Downloaded" badge.
- [ ] Toggling Airplane Mode does not break offline playback of a previously downloaded item.
- [ ] Logging out clears the catalog and pushes the login screen, but offline downloads remain.

---

## Recording requirements

Save as `milestone-2-auth-offline.mp4`, ≤5 minutes:

1. Open the app on a fresh install (or after Logout). Show the login screen.
2. Sign in with Apple.
3. Show the catalog populated.
4. Watch a movie for a few seconds, kill the app via the app switcher, relaunch — show Continue Watching has the correct position.
5. Tap "Save offline" on a movie. Show the progress UI.
6. Wait until complete. Switch to Airplane Mode. Open the Offline tab. Play the downloaded movie.
7. Switch off Airplane Mode. Log out. Show the login screen returns.

> **What's going on here**
> - The Continue Watching demo is the part graders look at most carefully — it proves SwiftData round-trips through `@Model` insert + `@Query` fetch correctly.
> - The Airplane Mode demo proves the offline path. Without it, you're just downloading; with it, you're playing offline.

---
type: exercise
kind: multiple_choice
pointsMax: 10
---
Why must Continue Watching be demonstrated *after* killing and relaunching the app, not in the same session?

- [ ] To verify the simulator is correctly emulating the device.
- [x] To prove the data round-trips through SwiftData persistence — same-session behavior could be in-memory only.
- [ ] To test cold-start performance.
- [ ] To verify the App Store policy.

---
type: exercise
kind: multiple_choice
pointsMax: 10
---
After Logout, which of the following SHOULD remain on the device?

- [x] Offline downloads on disk.
- [ ] The Keychain access token.
- [ ] The signed-in catalog data in memory.
- [ ] The user's identity token.

---
type: exercise
kind: multiple_choice
pointsMax: 10
---
Which framework is required for the offline download portion of this milestone?

- [ ] `URLSession` with `data(from:)`.
- [ ] `WKWebView`.
- [x] `AVAssetDownloadURLSession`.
- [ ] `Network.framework`.

---
type: exercise
kind: capstone_submission
pointsMax: 100
---
Record a ≤5-minute screen capture demonstrating Milestone 2 acceptance criteria above. Upload via the BootCamp web UI.

In your written self-assessment, include: (a) which auth provider you used (Sign in with Apple or OAuth/PKCE), (b) any acceptance items that did not work and why, (c) one concrete bug you fixed during the milestone and how you diagnosed it.
---
type: recap
---

## What you learned

**Concepts:** chaining auth → APIClient → catalog endpoints · SwiftData round-trip across launch · offline download as a relative-path persisted asset · Airplane Mode as the deterministic offline test

**Swift-specific vs other languages:** SwiftData's `@Query` + `@Model` integration with the SwiftUI view tree is the part with no direct equivalent in other stacks. The auth + offline pieces are portable; the SwiftData reactivity is not.

**What's next:** Lesson 04 covers polish, the final submission, and what to include in your self-assessment.
