---
type: lesson
title: Milestone 1 — Catalog & Player
level: advanced
summary: First milestone — browse posters, tap to play, and verify all playback controls work.
---

## What this milestone delivers

A user can:

1. Open the app and see a Home screen with at least two horizontal carousels of posters (Featured, Continue Watching).
2. Tap a poster → push a `PlayerScreen` via `NavigationStack`.
3. Watch the video play with custom controls overlaid on `VideoPlayer`.
4. Use scrubber, play/pause, AirPlay button, PiP entry.
5. Back out and the video stops.

No login. No persistence. No offline. Those come in Milestone 2.

> **Coming from Java:** Treat this milestone like a vertical-slice MVP — every layer (UI, data, playback) wired with stub/sample data, but every layer present.

---

## Sample content

Use these public HLS test streams during development:

| Source | URL |
|---|---|
| Apple sample (BipBop, advanced) | `https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_ts/master.m3u8` |
| Mux sample | `https://stream.mux.com/maEJsNVozOmSaT6KOsSJaXEv1GSrmt5Y5Z9oJ02f01iD8.m3u8` |
| Bitmovin Art of Motion | `https://bitdash-a.akamaihd.net/content/MI201109210084_1/m3u8s/f08e80da-bf1d-4e3d-8899-f0f6155f6efa.m3u8` |

Hard-code a small `[Movie]` array in code for this milestone. Wire the catalog API only after Milestone 2.

---

## Build sequence

1. **`Movie` model** — value type with `id`, `title`, `posterURL`, `streamURL`. Conform to `Identifiable, Hashable`.
2. **`HomeView`** — vertical `ScrollView` with two horizontal carousels (Week 5, Lesson 02).
3. **`PosterCard`** — reusable view; uses `AsyncImage` for the poster (Week 3).
4. **`NavigationStack`** wrap with `navigationDestination(for: Movie.self) { PlayerScreen(movie: $0) }`.
5. **`PlaybackModel`** — `@Observable` class with periodic time observer (Week 8, Lesson 02).
6. **`PlayerScreen`** — `VideoPlayer { EmptyView() }` + `ControlsOverlay`.
7. **`ControlsOverlay`** — play/pause, scrubber bound to `model.currentTime`, time labels, `RoutePickerButton` (Week 11, Lesson 02), PiP toggle.
8. **App lifecycle** — `.onDisappear { player.pause() }` on the player screen.

> **What's going on here**
> - Steps 1–4 build the navigation graph and the catalog UI.
> - Steps 5–7 build the playback layer in isolation.
> - Step 8 prevents the audio-keeps-playing-after-leaving bug that fails review.

---

## Acceptance checklist

Before recording, manually verify:

- [ ] Home screen renders without dev-time warnings in the Xcode console.
- [ ] Tapping a poster pushes the player.
- [ ] Video starts within 3 seconds on a normal Wi-Fi connection.
- [ ] Scrubber moves smoothly; tapping mid-track seeks.
- [ ] AirPlay button opens the system route picker.
- [ ] PiP button minimizes the video to a floating window.
- [ ] Pressing Back stops playback.

---

## Recording requirements

Save the recording as `milestone-1-catalog-player.mp4`, ≤5 minutes:

1. Show the home screen with both carousels populated.
2. Tap a poster, show the player launching.
3. Demonstrate scrubber, play/pause, time-elapsed updates.
4. Tap the AirPlay button (no need to actually cast — showing the picker is enough).
5. Trigger PiP. Background the app to confirm PiP continues.
6. Foreground the app, end PiP, navigate back. Confirm audio stops.

Use a real device if you have one — simulator AirPlay/PiP behavior is limited.

---
type: exercise
kind: multiple_choice
pointsMax: 10
---
Which sample HLS source is suitable for development?

- [ ] A YouTube video URL.
- [x] Apple's BipBop advanced master playlist (a standard public HLS test stream).
- [ ] A Twitch RTMP stream.
- [ ] A FairPlay-protected studio movie URL.

---
type: exercise
kind: multiple_choice
pointsMax: 10
---
Why is `Movie` required to be `Hashable` for this milestone?

- [x] `NavigationStack` destinations resolved by `navigationDestination(for: Movie.self)` require `Hashable`.
- [ ] `AsyncImage` requires `Hashable` for caching.
- [ ] `JSONDecoder` requires `Hashable`.
- [ ] `AVPlayer` requires `Hashable`.

---
type: exercise
kind: multiple_choice
pointsMax: 10
---
Which item is NOT in the milestone-1 acceptance checklist?

- [ ] PiP entry from the player screen.
- [ ] Audio stops on navigating back.
- [ ] AirPlay route picker opens.
- [x] Video continues to play on the lock screen.

---
type: exercise
kind: capstone_submission
pointsMax: 100
---
Record a ≤5-minute screen capture demonstrating Milestone 1 acceptance criteria above. Upload via the BootCamp web UI.

In your written self-assessment include: (a) a link to the Xcode project repo, (b) a list of any acceptance items that did not work and why, (c) the device or simulator you used.
---
type: recap
---

## What you learned

**Concepts:** vertical slice MVP — every layer wired with stub data · public HLS test sources · the build sequence from data type → view tree → player → controls · acceptance checklist before recording

**Swift-specific vs other languages:** The capstone deliberately uses every framework introduced earlier. The submission format (recording + repo) is a one-time choice imposed by the platform, not by Apple's tooling.

**What's next:** Lesson 03 covers Milestone 2 — auth + offline downloads — which together are the second recording.
