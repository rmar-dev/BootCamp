---
type: lesson
title: AVPlayer & VideoPlayer
level: intermediate
summary: AVPlayer fundamentals, AVPlayerItem, the SwiftUI VideoPlayer view, and basic playback control.
---

## AVPlayer

`AVPlayer` plays an `AVPlayerItem`. The item wraps an `AVAsset` (a remote URL, a local file, or an HLS playlist).

```swift
import AVKit

let url = URL(string: "https://example.com/movie.m3u8")!
let item = AVPlayerItem(url: url)
let player = AVPlayer(playerItem: item)
player.play()
```

`AVPlayer` is a *reference type*. The same player instance can be passed to multiple views, paused, resumed, and reused for the next item.

> **Coming from JavaScript:** Closer to the HTMLMediaElement Media Source API than to a `<video>` tag — you control the source, the buffering, and the lifecycle. Browsers hide a lot; AVPlayer hides less.

---

## VideoPlayer SwiftUI view

`VideoPlayer` wraps an `AVPlayer` in a SwiftUI view, with system playback controls.

```swift
import SwiftUI
import AVKit

struct PlayerScreen: View {
    let url: URL

    @State private var player: AVPlayer

    init(url: URL) {
        self.url = url
        _player = State(initialValue: AVPlayer(url: url))
    }

    var body: some View {
        VideoPlayer(player: player)
            .onAppear { player.play() }
            .onDisappear { player.pause() }
    }
}
```

> **What's going on here**
> - `_player = State(initialValue: ...)` is the underscored-storage syntax used inside an `init`. You cannot write `@State private var player = AVPlayer(url: url)` in the body declaration because `url` is not yet bound there.
> - `.onAppear` / `.onDisappear` start and stop playback in lockstep with the view's lifecycle. Without `.pause()`, the player keeps going after navigating away.

---

## Replacing the current item

To switch movies on the same player, replace the item:

```swift
let next = AVPlayerItem(url: nextURL)
player.replaceCurrentItem(with: next)
player.play()
```

Reusing the player avoids the cold-start cost of allocating a new playback pipeline.

---
type: exercise
kind: multiple_choice
pointsMax: 10
---
What is the relationship between `AVPlayer` and `AVPlayerItem`?

- [ ] `AVPlayerItem` is the container; `AVPlayer` is its child.
- [x] `AVPlayer` plays one `AVPlayerItem` at a time and can be told to switch items.
- [ ] They are interchangeable.
- [ ] `AVPlayerItem` is only used for offline files; `AVPlayer` for streaming.

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Build a `PlayerScreen` that takes a `url`, holds an `@State AVPlayer`, and uses `VideoPlayer`. Auto-play on appear, pause on disappear.

```swift:starter
import SwiftUI
import AVKit

struct PlayerScreen: View {
    let url: URL

    var body: some View {
        // TODO
        EmptyView()
    }
}
```

```swift:solution
import SwiftUI
import AVKit

struct PlayerScreen: View {
    let url: URL

    @State private var player: AVPlayer

    init(url: URL) {
        self.url = url
        _player = State(initialValue: AVPlayer(url: url))
    }

    var body: some View {
        VideoPlayer(player: player)
            .onAppear { player.play() }
            .onDisappear { player.pause() }
    }
}
```

```swift:test
import XCTest
import SwiftUI

final class Tests: XCTestCase {
    func testBuilds() {
        let url = URL(string: "https://example.com/m.m3u8")!
        XCTAssertNotNil(PlayerScreen(url: url).body)
    }
}
```

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Write `playNext(_:on:)` that replaces the player's current item with a new `AVPlayerItem` from the given URL and starts playback.

```swift:starter
import AVKit
import Foundation

func playNext(_ url: URL, on player: AVPlayer) {
    // TODO
}
```

```swift:solution
import AVKit
import Foundation

func playNext(_ url: URL, on player: AVPlayer) {
    let item = AVPlayerItem(url: url)
    player.replaceCurrentItem(with: item)
    player.play()
}
```

```swift:test
import XCTest
import AVKit

final class Tests: XCTestCase {
    func testCompiles() {
        let f: (URL, AVPlayer) -> Void = playNext(_:on:)
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
The player keeps playing after the user navigates away. Pause it on disappear.

```swift:broken
import SwiftUI
import AVKit

struct V: View {
    let url: URL
    @State private var player: AVPlayer

    init(url: URL) {
        self.url = url
        _player = State(initialValue: AVPlayer(url: url))
    }

    var body: some View {
        VideoPlayer(player: player)
            .onAppear { player.play() }
    }
}
```

```swift:test
import XCTest
import SwiftUI

final class Tests: XCTestCase {
    func testBuilds() {
        let url = URL(string: "https://example.com/m.m3u8")!
        XCTAssertNotNil(V(url: url).body)
    }
}
```

---
type: exercise
kind: fill_blank
pointsMax: 20
language: swift
blanks:
  "1": ["replaceCurrentItem"]
---
Fill in the AVPlayer method that swaps the playing item without allocating a new player.

```swift:starter
player.___1___(with: AVPlayerItem(url: nextURL))
```

---
type: recap
---

## What you learned

**Concepts:** `AVPlayer` is a long-lived reference type that plays one `AVPlayerItem` at a time · `VideoPlayer` is the SwiftUI wrapper · `replaceCurrentItem` keeps the pipeline warm between items · `.onAppear` / `.onDisappear` drive playback start and stop

**Swift-specific vs other languages:** AVKit gives you direct access to the playback pipeline — closer to ExoPlayer on Android than to a `<video>` tag. The `AVPlayer` instance is what you reuse; views are disposable.

**What's next:** Lesson 02 covers periodic time observers and a custom playback model that drives a UI scrubber.
