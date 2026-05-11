---
type: lesson
title: Asset Loading & Status
level: intermediate
summary: AVAsset.load(_:), AVPlayerItem status, buffering signals, and error surfacing.
---

## AVAsset async loading

`AVAsset` properties (`duration`, `tracks`, `metadata`) are not synchronous. Use the async `load(_:)` API.

```swift
import AVFoundation

let asset = AVURLAsset(url: url)
let duration = try await asset.load(.duration)
let tracks = try await asset.load(.tracks)
```

Synchronous reads (e.g. `asset.duration`) can return `kCMTimeIndefinite` until the value actually loads. Always `await load(.duration)` for accurate values.

> **Coming from Java:** Closer to ExoPlayer's `MediaSource.prepareSource` callbacks made into async/await. The synchronous getters are deprecated for non-trivial values.

---

## AVPlayerItem.status

The item moves through `.unknown` → `.readyToPlay` (or `.failed`). KVO surfaces the change.

```swift
let statusToken = item.observe(\.status, options: [.new]) { item, _ in
    switch item.status {
    case .readyToPlay: print("ready")
    case .failed: print("failed: \(item.error?.localizedDescription ?? "?")")
    case .unknown: break
    @unknown default: break
    }
}
```

Drive the UI off this — show a spinner during `.unknown`, an error banner on `.failed`.

---

## Buffering

`AVPlayerItem.isPlaybackLikelyToKeepUp` is `true` when the buffer is healthy enough to play through. Observe it to drive a "rebuffering" spinner.

```swift
let bufferToken = item.observe(\.isPlaybackLikelyToKeepUp, options: [.new]) { item, _ in
    isBuffering = !item.isPlaybackLikelyToKeepUp
}
```

> **What's going on here**
> - `isPlaybackLikelyToKeepUp` is the system's stall predictor. Use it as the "should I show a spinner" flag instead of timing the seconds yourself.

---

## Surfacing errors

When `item.status == .failed`, `item.error` carries the underlying `Error`. Common cases:

- HLS playlist 404 → `URLError(.fileDoesNotExist)`
- Unsupported codec → `AVError.contentNotPlayable`
- Network drop → `URLError(.networkConnectionLost)`

Map these into your `APIError` from Week 6 if you want unified UI handling.

---
type: exercise
kind: multiple_choice
pointsMax: 10
---
What value does `AVAsset.load(.duration)` give you that the synchronous `asset.duration` may not?

- [ ] The buffered duration only.
- [x] The fully resolved duration after the asset's metadata has loaded.
- [ ] The encoded duration (always smaller than realtime).
- [ ] The remaining duration from the current playhead.

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Write `loadDuration(_ url: URL) async throws -> Double` that opens an `AVURLAsset` and returns its duration in seconds.

```swift:starter
import AVFoundation

func loadDuration(_ url: URL) async throws -> Double {
    // TODO
    return 0
}
```

```swift:solution
import AVFoundation

func loadDuration(_ url: URL) async throws -> Double {
    let asset = AVURLAsset(url: url)
    let duration = try await asset.load(.duration)
    return duration.seconds
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testCompiles() {
        let f: (URL) async throws -> Double = loadDuration(_:)
        _ = f
    }
}
```

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Write `observeStatus(_:onReady:onFailed:)` that observes an `AVPlayerItem`'s `status` and calls the matching closure. Return the observation token.

```swift:starter
import AVFoundation

func observeStatus(
    _ item: AVPlayerItem,
    onReady: @escaping () -> Void,
    onFailed: @escaping (Error) -> Void
) -> NSKeyValueObservation {
    // TODO
    return item.observe(\.status, options: [.new]) { _, _ in }
}
```

```swift:solution
import AVFoundation

func observeStatus(
    _ item: AVPlayerItem,
    onReady: @escaping () -> Void,
    onFailed: @escaping (Error) -> Void
) -> NSKeyValueObservation {
    item.observe(\.status, options: [.new]) { item, _ in
        switch item.status {
        case .readyToPlay: onReady()
        case .failed:
            if let error = item.error { onFailed(error) }
        case .unknown: break
        @unknown default: break
        }
    }
}
```

```swift:test
import XCTest
import AVFoundation

final class Tests: XCTestCase {
    func testCompiles() {
        let f: (AVPlayerItem, @escaping () -> Void, @escaping (Error) -> Void) -> NSKeyValueObservation =
            observeStatus(_:onReady:onFailed:)
        _ = f
    }
}
```

---
type: exercise
kind: fix_bug
pointsMax: 40
language: swift
---
The buffer observer never updates `isBuffering`. Observe the right key path.

```swift:broken
import AVFoundation

final class M {
    let item: AVPlayerItem
    var isBuffering = false
    private var token: NSKeyValueObservation?

    init(url: URL) {
        self.item = AVPlayerItem(url: url)
        token = item.observe(\.duration, options: [.new]) { [weak self] item, _ in
            self?.isBuffering = !item.isPlaybackLikelyToKeepUp
        }
    }
}
```

```swift:test
import XCTest
import AVFoundation

final class Tests: XCTestCase {
    func testInit() {
        let url = URL(string: "https://example.com/m.m3u8")!
        let m = M(url: url)
        XCTAssertNotNil(m)
    }
}
```

---
type: exercise
kind: fill_blank
pointsMax: 20
language: swift
blanks:
  "1": ["readyToPlay"]
---
Fill in the `AVPlayerItem.Status` case that signals the item is loaded enough to begin playback.

```swift:starter
if item.status == .___1___ {
    player.play()
}
```

---
type: recap
---

## What you learned

**Concepts:** async `AVAsset.load(.duration)` for accurate metadata · KVO on `AVPlayerItem.status` for ready/failed transitions · `isPlaybackLikelyToKeepUp` for buffering UI · `item.error` for failure surfacing

**Swift-specific vs other languages:** AVFoundation pre-dates async/await but is gradually being modernized. The mix of async loading + KVO observers is the current idiom.

**What's next:** Week 9 covers HLS streaming protocol, adaptive bitrate, and how to build catalog playlists.
