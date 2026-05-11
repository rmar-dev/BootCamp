---
type: lesson
title: Time Observers & Playback State
level: intermediate
summary: addPeriodicTimeObserver, KVO on rate / status, and an @Observable playback model.
---

## Periodic time observer

`AVPlayer.addPeriodicTimeObserver` calls a closure on a queue every N seconds of playback wall-clock time. Use it to drive a scrubber.

```swift
let interval = CMTime(seconds: 0.5, preferredTimescale: CMTimeScale(NSEC_PER_SEC))
let token = player.addPeriodicTimeObserver(forInterval: interval, queue: .main) { time in
    let seconds = time.seconds
    print("now: \(seconds)")
}
// Later: player.removeTimeObserver(token)
```

The token must be removed before the player is deallocated, or the observer leaks.

> **Coming from Java:** Closer to ExoPlayer's `Player.Listener` than to a stream. Each observer is a registration with a manual-dispose lifetime, similar to a Listener you must `remove*` on teardown.

---

## An @Observable playback model

Wrap the time observer in an `@Observable` class so SwiftUI views can read live progress.

```swift
import AVKit
import Observation

@Observable
final class PlaybackModel {
    let player: AVPlayer
    var currentTime: Double = 0
    var duration: Double = 0
    var isPlaying = false

    private var timeToken: Any?
    private var rateToken: NSKeyValueObservation?

    init(url: URL) {
        self.player = AVPlayer(url: url)
        observeTime()
        observeRate()
    }

    private func observeTime() {
        let interval = CMTime(seconds: 0.5, preferredTimescale: CMTimeScale(NSEC_PER_SEC))
        timeToken = player.addPeriodicTimeObserver(forInterval: interval, queue: .main) { [weak self] time in
            guard let self else { return }
            self.currentTime = time.seconds
            if let item = self.player.currentItem, item.duration.isNumeric {
                self.duration = item.duration.seconds
            }
        }
    }

    private func observeRate() {
        rateToken = player.observe(\.rate, options: [.new]) { [weak self] player, _ in
            self?.isPlaying = player.rate > 0
        }
    }

    deinit {
        if let token = timeToken { player.removeTimeObserver(token) }
    }
}
```

> **What's going on here**
> - `[weak self]` — the time observer captures `self`. Without `weak`, the observer retains the model and the model retains the observer through `timeToken`. Cycle.
> - `player.observe(\.rate, ...)` is Swift's typed KVO. The returned `NSKeyValueObservation` token disposes itself when set to nil or replaced.

---

## Driving a scrubber

A SwiftUI slider can drive both reads and writes via the model:

```swift
Slider(
    value: Binding(
        get: { model.currentTime },
        set: { newValue in
            model.player.seek(to: CMTime(seconds: newValue, preferredTimescale: 600))
        }
    ),
    in: 0...max(model.duration, 0.1)
)
```

`preferredTimescale: 600` is the conventional value for video — divisible into common frame rates without loss.

---
type: exercise
kind: multiple_choice
pointsMax: 10
---
Why must you keep the token returned from `addPeriodicTimeObserver` and call `removeTimeObserver` before the player is gone?

- [ ] The token records the cumulative play time.
- [x] Otherwise the observer is leaked and may crash if it fires after the player is deallocated.
- [ ] It is required to start playback.
- [ ] It enables AirPlay routing.

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Build a minimal `@Observable PlaybackModel` that exposes `currentTime` and updates it every 0.5s via a periodic time observer.

```swift:starter
import AVKit
import Observation

@Observable
final class PlaybackModel {
    let player: AVPlayer
    var currentTime: Double = 0

    init(url: URL) {
        self.player = AVPlayer(url: url)
        // TODO: install the periodic observer
    }
}
```

```swift:solution
import AVKit
import Observation

@Observable
final class PlaybackModel {
    let player: AVPlayer
    var currentTime: Double = 0
    private var token: Any?

    init(url: URL) {
        self.player = AVPlayer(url: url)
        let interval = CMTime(seconds: 0.5, preferredTimescale: CMTimeScale(NSEC_PER_SEC))
        token = player.addPeriodicTimeObserver(forInterval: interval, queue: .main) { [weak self] time in
            self?.currentTime = time.seconds
        }
    }

    deinit {
        if let token = token { player.removeTimeObserver(token) }
    }
}
```

```swift:test
import XCTest
import AVKit

final class Tests: XCTestCase {
    func testInit() {
        let url = URL(string: "https://example.com/m.m3u8")!
        let model = PlaybackModel(url: url)
        XCTAssertEqual(model.currentTime, 0)
    }
}
```

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Implement `seek(to seconds:)` on `PlaybackModel` that calls `player.seek(to:)` with `preferredTimescale: 600`.

```swift:starter
import AVKit
import Observation

@Observable
final class PlaybackModel {
    let player: AVPlayer
    init(url: URL) { self.player = AVPlayer(url: url) }

    func seek(to seconds: Double) {
        // TODO
    }
}
```

```swift:solution
import AVKit
import Observation

@Observable
final class PlaybackModel {
    let player: AVPlayer
    init(url: URL) { self.player = AVPlayer(url: url) }

    func seek(to seconds: Double) {
        let time = CMTime(seconds: seconds, preferredTimescale: 600)
        player.seek(to: time)
    }
}
```

```swift:test
import XCTest
import AVKit

final class Tests: XCTestCase {
    func testSeekCompiles() {
        let url = URL(string: "https://example.com/m.m3u8")!
        let m = PlaybackModel(url: url)
        m.seek(to: 30)
    }
}
```

---
type: exercise
kind: fix_bug
pointsMax: 40
language: swift
---
The time observer captures `self` strongly and the model leaks. Fix the capture.

```swift:broken
import AVKit
import Observation

@Observable
final class M {
    let player: AVPlayer
    var t: Double = 0

    init(url: URL) {
        self.player = AVPlayer(url: url)
        _ = player.addPeriodicTimeObserver(forInterval: CMTime(seconds: 0.5, preferredTimescale: 600), queue: .main) { time in
            self.t = time.seconds
        }
    }
}
```

```swift:test
import XCTest
import AVKit

final class Tests: XCTestCase {
    func testInit() {
        let url = URL(string: "https://example.com/m.m3u8")!
        _ = M(url: url)
    }
}
```

---
type: exercise
kind: fill_blank
pointsMax: 20
language: swift
blanks:
  "1": ["seek"]
---
Fill in the `AVPlayer` method that jumps to a given `CMTime`.

```swift:starter
player.___1___(to: CMTime(seconds: 60, preferredTimescale: 600))
```

---
type: recap
---

## What you learned

**Concepts:** `addPeriodicTimeObserver` calls back on an interval · the returned token must be removed manually · KVO via `player.observe(\.rate)` for play/pause edges · wrap both in an `@Observable` model so SwiftUI views observe `currentTime` and `isPlaying`

**Swift-specific vs other languages:** Manual observer-token disposal is unusual in modern Swift — most APIs use async sequences or Combine. AVKit pre-dates structured concurrency, so the dispose pattern remains.

**What's next:** Lesson 03 builds a custom controls overlay so the streaming app's player UI is fully styled.
