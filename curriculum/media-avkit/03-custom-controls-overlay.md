---
type: lesson
title: Custom Controls Overlay
level: intermediate
summary: A controls layer composed over VideoPlayer with play/pause, scrubber, time labels, and auto-hide.
---

## Overlay structure

`VideoPlayer` provides system controls; for branded UI, hide them and overlay your own.

```swift
struct PlayerScreen: View {
    @State private var model: PlaybackModel
    @State private var showControls = true

    init(url: URL) {
        _model = State(initialValue: PlaybackModel(url: url))
    }

    var body: some View {
        ZStack {
            VideoPlayer(player: model.player) { EmptyView() }     // suppress system overlay
                .onTapGesture { showControls.toggle() }

            if showControls {
                ControlsOverlay(model: model)
                    .transition(.opacity)
            }
        }
        .background(.black)
    }
}
```

Passing `{ EmptyView() }` to the `VideoPlayer` content closure suppresses the default playback controls.

> **Coming from C++:** `VideoPlayer { EmptyView() }` is the SwiftUI trailing-closure form. Closer to Qt's `setStyleSheet` to suppress native chrome than to a flag, but expressed declaratively.

---

## Controls overlay

```swift
struct ControlsOverlay: View {
    let model: PlaybackModel

    var body: some View {
        VStack {
            Spacer()
            HStack {
                Button(action: togglePlay) {
                    Image(systemName: model.isPlaying ? "pause.fill" : "play.fill")
                        .font(.system(size: 28))
                }
                Slider(
                    value: Binding(
                        get: { model.currentTime },
                        set: { model.seek(to: $0) }
                    ),
                    in: 0...max(model.duration, 0.1)
                )
                Text(format(model.currentTime))
                    .monospacedDigit()
            }
            .padding()
            .background(.black.opacity(0.6))
        }
        .foregroundStyle(.white)
    }

    private func togglePlay() {
        if model.isPlaying { model.player.pause() } else { model.player.play() }
    }

    private func format(_ seconds: Double) -> String {
        let s = Int(seconds.rounded())
        return String(format: "%d:%02d", s / 60, s % 60)
    }
}
```

> **What's going on here**
> - `Slider` uses a derived `Binding` that maps reads to `currentTime` and writes to `seek(to:)` — same pattern as Lesson 02.
> - `.monospacedDigit()` keeps the time label width stable so `0:09 → 0:10` does not jitter.

---

## Auto-hide after inactivity

Reset a timer on tap; hide when it fires.

```swift
@State private var hideTask: Task<Void, Never>?

func scheduleHide() {
    hideTask?.cancel()
    hideTask = Task {
        try? await Task.sleep(for: .seconds(3))
        if Task.isCancelled { return }
        withAnimation { showControls = false }
    }
}
```

Call `scheduleHide()` whenever the user taps to show controls.

---
type: exercise
kind: multiple_choice
pointsMax: 10
---
How do you suppress the default `VideoPlayer` system controls?

- [ ] Set `.controlsHidden(true)`.
- [x] Pass an `EmptyView()` (or any custom view) as the trailing-closure content.
- [ ] Set `player.allowsExternalPlayback = false`.
- [ ] Wrap the player in a `Group { ... }`.

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Write a `format(_:)` helper that turns `Double` seconds into `"M:SS"` (e.g. `90.5` -> `"1:30"`). Round to the nearest second.

```swift:starter
func format(_ seconds: Double) -> String {
    // TODO
    return ""
}
```

```swift:solution
func format(_ seconds: Double) -> String {
    let s = Int(seconds.rounded())
    return String(format: "%d:%02d", s / 60, s % 60)
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testFormat() {
        XCTAssertEqual(format(0), "0:00")
        XCTAssertEqual(format(9), "0:09")
        XCTAssertEqual(format(90.5), "1:31")
        XCTAssertEqual(format(125), "2:05")
    }
}
```

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Build a `PlayPauseButton` view that takes a model with `isPlaying: Bool`, `play()`, `pause()` and shows the right SF Symbol.

```swift:starter
import SwiftUI

protocol PlaybackControl: AnyObject {
    var isPlaying: Bool { get }
    func play()
    func pause()
}

struct PlayPauseButton: View {
    let control: any PlaybackControl

    var body: some View {
        // TODO
        EmptyView()
    }
}
```

```swift:solution
import SwiftUI

protocol PlaybackControl: AnyObject {
    var isPlaying: Bool { get }
    func play()
    func pause()
}

struct PlayPauseButton: View {
    let control: any PlaybackControl

    var body: some View {
        Button {
            if control.isPlaying { control.pause() } else { control.play() }
        } label: {
            Image(systemName: control.isPlaying ? "pause.fill" : "play.fill")
                .font(.system(size: 28))
        }
    }
}
```

```swift:test
import XCTest
import SwiftUI

final class StubControl: PlaybackControl {
    var isPlaying = false
    func play() { isPlaying = true }
    func pause() { isPlaying = false }
}

final class Tests: XCTestCase {
    func testBuilds() {
        XCTAssertNotNil(PlayPauseButton(control: StubControl()).body)
    }
}
```

---
type: exercise
kind: fix_bug
pointsMax: 40
language: swift
---
The time label width changes between `0:09` and `0:10`. Add the modifier that keeps digit widths fixed.

```swift:broken
import SwiftUI

struct TimeLabel: View {
    let seconds: Int
    var body: some View {
        Text("\(seconds)")
    }
}
```

```swift:test
import XCTest
import SwiftUI

final class Tests: XCTestCase {
    func testBuilds() {
        XCTAssertNotNil(TimeLabel(seconds: 90).body)
    }
}
```

---
type: exercise
kind: fill_blank
pointsMax: 20
language: swift
blanks:
  "1": ["EmptyView"]
---
Fill in the SwiftUI view you pass as `VideoPlayer`'s content to suppress the default system controls.

```swift:starter
VideoPlayer(player: player) {
    ___1___()
}
```

---
type: recap
---

## What you learned

**Concepts:** suppress system chrome by passing a custom content closure to `VideoPlayer` · derive a `Binding` from `get` / `set` for the scrubber · `.monospacedDigit()` for stable time labels · Task-based auto-hide of controls after inactivity

**Swift-specific vs other languages:** Closer to a custom HTML5 player skin than to ExoPlayer's `PlayerView` styling. SwiftUI gives you the layout primitives directly — no XML overlays.

**What's next:** Lesson 04 covers asset loading status, errors, and the buffering state for a robust player.
