---
type: lesson
title: Capstone Brief & Xcode Setup
level: advanced
summary: The Mini Peacock streaming app — scope, architecture, Xcode project layout, and submission requirements.
---

## What you are building

A native iOS streaming app, built entirely in Xcode using SwiftUI + AVKit. Working title: **Mini Peacock**. The user can:

1. Sign in (Sign in with Apple or OAuth flow from Week 10)
2. Browse a catalog of movies and live channels (Weeks 5, 6)
3. Tap a poster, push a player, watch the video (Weeks 4, 8)
4. Use full playback controls — scrubber, play/pause, AirPlay, PiP (Weeks 8, 11)
5. Save items for offline viewing (Week 11)
6. Maintain watch history (Week 7)

The app uses a public HLS test stream as content. No DRM. No real billing.

> **Coming from Java:** Closer to Android's "build a complete sample app integrating all the SDKs you've learned" capstones than a single-feature exercise. The grading rubric is the breadth of integration, not novelty.

---

## Submission requirement

The platform graders cannot run an iOS app in a sandbox. You ship the result by:

1. Building and running on a device or simulator from your local Xcode.
2. Screen-recording each milestone walkthrough (Lesson 02, 03, 04 below).
3. Uploading the recordings via the BootCamp web UI as part of `Lesson 04 — Final Submission`.

Each recording is a `.mp4` ≤ 5 minutes. Verbal narration is optional but encouraged. The instructor reviews the recordings, scores against the rubric, and may request a follow-up or re-record.

> **What's going on here**
> - The capstone is **not** auto-graded. There is no Docker sandbox running your iOS code. The deliverable is the *recording*, plus a link to your repo (private or public) for code review.
> - The instructor reviewing your submission has access to: your videos, your repo URL, and a written self-assessment you fill in at submission.

---

## Xcode project layout

Recommended folder structure for the Xcode project:

```
MiniPeacock/
├── App/
│   ├── MiniPeacockApp.swift         # @main, modelContainer, environment setup
│   └── AppShell.swift               # TabView + deep-link handling
├── Catalog/
│   ├── HomeView.swift
│   ├── BrowseView.swift
│   ├── SearchView.swift
│   └── MovieDetailView.swift
├── Player/
│   ├── PlayerScreen.swift
│   ├── PlaybackModel.swift
│   ├── ControlsOverlay.swift
│   └── PiPController.swift
├── Auth/
│   ├── LoginView.swift
│   ├── AuthSession.swift
│   └── KeychainStore.swift
├── Networking/
│   ├── APIClient.swift
│   ├── Endpoint.swift
│   └── APIError.swift
├── Persistence/
│   ├── WatchHistoryEntry.swift      # @Model
│   └── OfflineDownload.swift        # @Model
└── Resources/
    └── Assets.xcassets
```

This is a *suggestion*, not a constraint. Other layouts are fine if they keep concerns separated.

---

## Xcode configuration checklist

Before writing app code, verify these:

| Item | Where | Reason |
|---|---|---|
| iOS Deployment Target ≥ 17.0 | Project → General | `@Observable`, `NavigationStack`, `.scrollTargetBehavior` |
| Signing team set | Project → Signing & Capabilities | Required to run on device |
| Background Modes → Audio | Project → Signing & Capabilities → +Capability | Background audio + PiP |
| `UIBackgroundModes: audio` in Info.plist | Auto-added by the capability above | Same |
| Sign in with Apple capability | Project → Signing & Capabilities → +Capability | Lesson 03 milestone |

Without these, the app builds but features fail silently at runtime.

---
type: exercise
kind: multiple_choice
pointsMax: 10
---
What is the deliverable for the capstone, given the platform cannot run iOS apps in a sandbox?

- [ ] A zipped Xcode project that the grader compiles.
- [x] Screen recordings of each milestone walkthrough plus a repo URL for code review.
- [ ] A web build deployed to a public URL.
- [ ] Automated unit tests run on the platform's macOS runner.

---
type: exercise
kind: multiple_choice
pointsMax: 10
---
Which iOS deployment target is required given the capstone uses `@Observable`, `NavigationStack`, and `.scrollTargetBehavior`?

- [ ] iOS 13.0 or later
- [ ] iOS 15.0 or later
- [ ] iOS 16.0 or later
- [x] iOS 17.0 or later

---
type: exercise
kind: multiple_choice
pointsMax: 10
---
Which capability MUST be enabled in Signing & Capabilities for the player to keep audio playing while the app is backgrounded?

- [x] Background Modes → Audio, AirPlay, and Picture in Picture
- [ ] Push Notifications
- [ ] App Groups
- [ ] HomeKit

---
type: exercise
kind: multiple_choice
pointsMax: 10
---
Which is NOT required to be present in the capstone submission?

- [ ] Screen recording of catalog browse + playback
- [ ] Screen recording of login + offline download
- [ ] Repo URL for code review
- [x] A live demo over screen-share with the instructor

---
type: recap
---

## What you learned

**Concepts:** capstone scope (catalog, player, auth, offline, history) · submission via screen recordings + repo URL · suggested Xcode folder layout · capability checklist (iOS 17, background audio, Sign in with Apple)

**Swift-specific vs other languages:** Capability declarations in Info.plist + Signing & Capabilities are the iOS-specific gate that makes runtime features actually work. There is no "fix at runtime" if Background Audio is missing.

**What's next:** Lesson 02 walks the catalog + player milestone — the first recording.
