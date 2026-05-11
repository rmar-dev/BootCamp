---
type: lesson
title: Live vs VOD Streams
level: intermediate
summary: Live playlists, sliding windows, DVR vs event, the live edge, and forward buffer constraints.
---

## Live playlists

A live playlist refreshes — the client re-fetches the `.m3u8` periodically and finds new segments at the bottom (and old ones rotated out at the top). No `#EXT-X-ENDLIST`.

```
#EXTM3U
#EXT-X-VERSION:6
#EXT-X-TARGETDURATION:6
#EXT-X-MEDIA-SEQUENCE:1042
#EXTINF:6.000,
seg-1042.ts
#EXTINF:6.000,
seg-1043.ts
#EXTINF:6.000,
seg-1044.ts
```

`#EXT-X-MEDIA-SEQUENCE` is the index of the *first* segment in the current window. As segments scroll off, this number increases.

> **Coming from JavaScript:** Closer to a websocket-fed live stream than to a media file. The client and server agree on a sliding window; the player tracks the live edge.

---

## Live edge

The "live edge" is the latest segment available. `AVPlayer` exposes it as `currentItem.currentDate()`.

```swift
let edge = player.currentItem?.currentDate()
```

For an "watch from start" UX in a live event, seek to a `CMTime` near zero. For "live", seek with `seekableTimeRanges.last`:

```swift
if let live = player.currentItem?.seekableTimeRanges.last as? CMTimeRange {
    player.seek(to: CMTimeRangeGetEnd(live))
}
```

---

## DVR window

A DVR-enabled live stream keeps a longer window — say 4 hours of past content. The user can scrub backward inside it. `seekableTimeRanges` describes that window.

> **What's going on here**
> - `seekableTimeRanges` is an `[NSValue]` of `CMTimeRange`. The window slides forward as time passes.
> - Live = small window; DVR = large window. Same protocol, different `EXT-X-PLAYLIST-TYPE` and segment retention.

---

## Forward buffer constraints

Live streams should not buffer ahead aggressively — there is no "ahead" beyond the live edge. The player handles this internally; do not set `preferredForwardBufferDuration` to a large value on live streams.

```swift
// VOD: large buffer is fine
item.preferredForwardBufferDuration = 30

// Live: keep it short or default
item.preferredForwardBufferDuration = 0    // system-managed
```

---
type: exercise
kind: multiple_choice
pointsMax: 10
---
Why does a live HLS playlist not include `#EXT-X-ENDLIST`?

- [ ] To signal the stream is encrypted.
- [x] Because more segments will be appended over time — the playlist is open-ended.
- [ ] To save bandwidth.
- [ ] To prevent caching.

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Write `isLive(_:)` returning `true` if the playlist text lacks `#EXT-X-ENDLIST`.

```swift:starter
func isLive(_ text: String) -> Bool {
    // TODO
    return false
}
```

```swift:solution
func isLive(_ text: String) -> Bool {
    !text.contains("#EXT-X-ENDLIST")
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testLive() {
        XCTAssertTrue(isLive("#EXTM3U\nseg-001.ts\n"))
    }
    func testVOD() {
        XCTAssertFalse(isLive("#EXTM3U\nseg-001.ts\n#EXT-X-ENDLIST\n"))
    }
}
```

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Write `seekToLiveEdge(on:)` that seeks the player to the end of the latest seekable range, if any.

```swift:starter
import AVFoundation

func seekToLiveEdge(on player: AVPlayer) {
    // TODO
}
```

```swift:solution
import AVFoundation

func seekToLiveEdge(on player: AVPlayer) {
    guard let item = player.currentItem else { return }
    guard let last = item.seekableTimeRanges.last as? CMTimeRange else { return }
    player.seek(to: CMTimeRangeGetEnd(last))
}
```

```swift:test
import XCTest
import AVFoundation

final class Tests: XCTestCase {
    func testCompiles() {
        let f: (AVPlayer) -> Void = seekToLiveEdge(on:)
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
The forward buffer is too large for live; reset it to system-managed (0).

```swift:broken
import AVFoundation

func tuneLive(_ item: AVPlayerItem) {
    item.preferredForwardBufferDuration = 60
}
```

```swift:test
import XCTest
import AVFoundation

final class Tests: XCTestCase {
    func testTune() {
        let url = URL(string: "https://example.com/m.m3u8")!
        let item = AVPlayerItem(url: url)
        tuneLive(item)
        XCTAssertEqual(item.preferredForwardBufferDuration, 0)
    }
}
```

---
type: exercise
kind: fill_blank
pointsMax: 20
language: swift
blanks:
  "1": ["MEDIA-SEQUENCE"]
---
Fill in the HLS tag whose value is the index of the first segment currently in the playlist window.

```swift:starter
#EXT-X-___1___:1042
```

---
type: recap
---

## What you learned

**Concepts:** live playlists omit `#EXT-X-ENDLIST` and refresh · `#EXT-X-MEDIA-SEQUENCE` indexes the sliding window · `seekableTimeRanges` describes scrubbable territory (DVR window) · keep `preferredForwardBufferDuration` modest on live streams

**Swift-specific vs other languages:** AVPlayer handles the live refresh internally. You drive the live-edge seek explicitly when the user requests "Go Live"; otherwise the framework keeps the playhead near the edge.

**What's next:** Lesson 04 covers FairPlay DRM and a brief look at premium-content protection.
