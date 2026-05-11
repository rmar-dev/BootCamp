---
type: lesson
title: HLS Protocol Basics
level: intermediate
summary: HTTP Live Streaming over plain HTTP, .m3u8 playlists, segment files, and AVPlayer's native support.
---

## What HLS is

HTTP Live Streaming serves video as a sequence of small segments listed in a `.m3u8` text playlist. The client downloads the playlist, then the segments in order. No special server protocol — just HTTP.

```
#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:6
#EXTINF:6.000,
seg-001.ts
#EXTINF:6.000,
seg-002.ts
#EXTINF:6.000,
seg-003.ts
#EXT-X-ENDLIST
```

`#EXT-X-ENDLIST` marks a finite, on-demand playlist (a movie). Live streams omit it.

> **Coming from JavaScript:** Closer to MPEG-DASH consumed via HLS.js than to a raw `<video>` source. Browsers usually need a polyfill for HLS; iOS / macOS / tvOS support it natively in `AVPlayer`.

---

## AVPlayer playback

`AVPlayer` plays HLS without any extra setup. Hand it the playlist URL and `play()`.

```swift
let url = URL(string: "https://cdn.example.com/movie/main.m3u8")!
let player = AVPlayer(url: url)
player.play()
```

The framework downloads segments, decodes them, and feeds the renderer. ABR (adaptive bitrate) is automatic when the master playlist lists multiple variants — Lesson 02.

> **What's going on here**
> - `AVURLAsset` (which the convenience initializer creates) is HLS-aware. It parses the `.m3u8`, follows redirects, and manages the buffer.

---

## Why HLS won

Three properties drove HLS adoption:

1. **CDN-friendly** — every segment is a static GET, cacheable at the edge.
2. **Firewall-friendly** — port 80/443 only, looks like normal HTTP.
3. **Native on Apple platforms** — first-class `AVPlayer` support, no SDK.

For an Apple-targeted streaming app, HLS is the default. DASH support requires extra libraries.

---
type: exercise
kind: multiple_choice
pointsMax: 10
---
What does `#EXT-X-ENDLIST` indicate at the bottom of an HLS playlist?

- [ ] The stream is encrypted.
- [x] The playlist is a complete, on-demand asset (VOD), not live.
- [ ] The viewer should disconnect.
- [ ] The playlist has expired.

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Write `isVODPlaylist(_:)` that scans the playlist text for `#EXT-X-ENDLIST` and returns `true` if present.

```swift:starter
func isVODPlaylist(_ text: String) -> Bool {
    // TODO
    return false
}
```

```swift:solution
func isVODPlaylist(_ text: String) -> Bool {
    text.contains("#EXT-X-ENDLIST")
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testVOD() {
        let vod = "#EXTM3U\n#EXTINF:6,\nseg-001.ts\n#EXT-X-ENDLIST\n"
        XCTAssertTrue(isVODPlaylist(vod))
    }
    func testLive() {
        let live = "#EXTM3U\n#EXTINF:6,\nseg-001.ts\n"
        XCTAssertFalse(isVODPlaylist(live))
    }
}
```

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Write `segmentFilenames(_:)` that returns the list of segment filenames from a playlist (lines that do not start with `#`).

```swift:starter
func segmentFilenames(_ text: String) -> [String] {
    // TODO
    return []
}
```

```swift:solution
func segmentFilenames(_ text: String) -> [String] {
    text.split(whereSeparator: \.isNewline)
        .map(String.init)
        .filter { !$0.isEmpty && !$0.hasPrefix("#") }
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testParse() {
        let text = """
        #EXTM3U
        #EXTINF:6.0,
        seg-001.ts
        #EXTINF:6.0,
        seg-002.ts
        #EXT-X-ENDLIST
        """
        XCTAssertEqual(segmentFilenames(text), ["seg-001.ts", "seg-002.ts"])
    }
}
```

---
type: exercise
kind: fix_bug
pointsMax: 40
language: swift
---
The function should also strip blank lines but currently keeps them. Fix it.

```swift:broken
func segments(_ text: String) -> [String] {
    text.split(whereSeparator: \.isNewline)
        .map(String.init)
        .filter { !$0.hasPrefix("#") }
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testStripsBlanks() {
        let t = "#EXTM3U\n\nseg-001.ts\n\nseg-002.ts\n"
        XCTAssertEqual(segments(t), ["seg-001.ts", "seg-002.ts"])
    }
}
```

---
type: exercise
kind: fill_blank
pointsMax: 20
language: swift
blanks:
  "1": [".m3u8"]
---
Fill in the file extension HLS playlists use.

```swift:starter
let url = URL(string: "https://cdn.example.com/movie/main___1___")!
```

---
type: recap
---

## What you learned

**Concepts:** HLS = `.m3u8` playlist + numbered segment files served via plain HTTP · `#EXT-X-ENDLIST` distinguishes VOD from live · `AVPlayer` plays HLS natively · CDN- and firewall-friendly are the reasons HLS dominated

**Swift-specific vs other languages:** Browsers need HLS.js or similar; Apple platforms have native support — one of the strongest arguments for HLS over DASH on iOS targets.

**What's next:** Lesson 02 covers master playlists and how variants drive adaptive bitrate.
