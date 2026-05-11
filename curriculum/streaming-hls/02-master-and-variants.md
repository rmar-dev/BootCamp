---
type: lesson
title: Master Playlists & Variants
level: intermediate
summary: Master playlists, EXT-X-STREAM-INF, audio renditions, and how AVPlayer chooses a variant.
---

## Master vs media playlist

A *master* playlist lists multiple *variants* (renditions) at different bitrates and resolutions. Each variant is itself a media playlist of segments.

```
#EXTM3U
#EXT-X-VERSION:6
#EXT-X-STREAM-INF:BANDWIDTH=600000,RESOLUTION=480x270
low.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=1500000,RESOLUTION=854x480
mid.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=4500000,RESOLUTION=1920x1080
high.m3u8
```

`AVPlayer` reads the master, measures throughput, and chooses a variant. As bandwidth changes, it switches segments — that's adaptive bitrate.

> **Coming from Java:** Closer to ExoPlayer's `AdaptiveTrackSelection` than to choosing a single source URL. The master playlist is the manifest the player reasons over.

---

## Audio renditions

Separate audio tracks (languages, descriptive audio) are referenced via `#EXT-X-MEDIA`:

```
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="aac",NAME="English",DEFAULT=YES,URI="audio-en.m3u8"
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="aac",NAME="Spanish",DEFAULT=NO,URI="audio-es.m3u8"

#EXT-X-STREAM-INF:BANDWIDTH=1500000,RESOLUTION=854x480,AUDIO="aac"
mid.m3u8
```

Variants reference the audio group via `AUDIO="aac"`. The user picks via `AVPlayerItem.tracks` and `AVMediaSelectionGroup`.

---

## Capping the bitrate

Some scenarios call for a max bitrate (cellular, kids' device, battery-saver). Set `preferredPeakBitRate` on the item.

```swift
item.preferredPeakBitRate = 1_500_000   // bits/sec — cap at ~mid quality
```

> **What's going on here**
> - `preferredPeakBitRate` is a hint, not a hard limit. The player won't pick a variant whose `BANDWIDTH` exceeds it.
> - Set to `0` (default) for unrestricted ABR.

---

## Forcing a maximum resolution

`preferredMaximumResolution: CGSize` similarly caps by pixels.

```swift
item.preferredMaximumResolution = CGSize(width: 854, height: 480)
```

Useful when the player view is small — no point pulling 4K when the surface is 480p tall.

---
type: exercise
kind: multiple_choice
pointsMax: 10
---
What does `#EXT-X-STREAM-INF:BANDWIDTH=...` indicate?

- [ ] The minimum download speed required.
- [x] One variant rendition at the given bitrate, with a media playlist URL on the next line.
- [ ] The current network bandwidth.
- [ ] An encryption key URL.

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Parse a master playlist into `[(bandwidth: Int, url: String)]` — pair each `#EXT-X-STREAM-INF:BANDWIDTH=N` with the next non-comment line.

```swift:starter
struct Variant { let bandwidth: Int; let url: String }

func parseMaster(_ text: String) -> [Variant] {
    // TODO
    return []
}
```

```swift:solution
struct Variant { let bandwidth: Int; let url: String }

func parseMaster(_ text: String) -> [Variant] {
    let lines = text.split(whereSeparator: \.isNewline).map(String.init).filter { !$0.isEmpty }
    var variants: [Variant] = []
    var pendingBandwidth: Int?
    for line in lines {
        if line.hasPrefix("#EXT-X-STREAM-INF:") {
            if let range = line.range(of: "BANDWIDTH=") {
                let after = line[range.upperBound...]
                let digits = after.prefix(while: { $0.isNumber })
                pendingBandwidth = Int(digits)
            }
        } else if !line.hasPrefix("#"), let bw = pendingBandwidth {
            variants.append(Variant(bandwidth: bw, url: line))
            pendingBandwidth = nil
        }
    }
    return variants
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testParse() {
        let text = """
        #EXTM3U
        #EXT-X-STREAM-INF:BANDWIDTH=600000,RESOLUTION=480x270
        low.m3u8
        #EXT-X-STREAM-INF:BANDWIDTH=1500000,RESOLUTION=854x480
        mid.m3u8
        """
        let v = parseMaster(text)
        XCTAssertEqual(v.count, 2)
        XCTAssertEqual(v[0].bandwidth, 600000)
        XCTAssertEqual(v[0].url, "low.m3u8")
        XCTAssertEqual(v[1].bandwidth, 1500000)
    }
}
```

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Write `applyDataSaver(_:)` that sets `preferredPeakBitRate = 1_000_000` on the item.

```swift:starter
import AVFoundation

func applyDataSaver(_ item: AVPlayerItem) {
    // TODO
}
```

```swift:solution
import AVFoundation

func applyDataSaver(_ item: AVPlayerItem) {
    item.preferredPeakBitRate = 1_000_000
}
```

```swift:test
import XCTest
import AVFoundation

final class Tests: XCTestCase {
    func testCap() {
        let url = URL(string: "https://example.com/m.m3u8")!
        let item = AVPlayerItem(url: url)
        applyDataSaver(item)
        XCTAssertEqual(item.preferredPeakBitRate, 1_000_000)
    }
}
```

---
type: exercise
kind: fix_bug
pointsMax: 40
language: swift
---
The cap was set in megabits but should be bits. Fix the unit.

```swift:broken
import AVFoundation

func cap(_ item: AVPlayerItem, atMbps mbps: Double) {
    item.preferredPeakBitRate = mbps
}
```

```swift:test
import XCTest
import AVFoundation

final class Tests: XCTestCase {
    func testCap() {
        let url = URL(string: "https://example.com/m.m3u8")!
        let item = AVPlayerItem(url: url)
        cap(item, atMbps: 2)
        XCTAssertEqual(item.preferredPeakBitRate, 2_000_000)
    }
}
```

---
type: exercise
kind: fill_blank
pointsMax: 20
language: swift
blanks:
  "1": ["preferredPeakBitRate"]
---
Fill in the AVPlayerItem property that caps the maximum HLS variant bitrate.

```swift:starter
item.___1___ = 1_500_000
```

---
type: recap
---

## What you learned

**Concepts:** master playlist lists variants via `#EXT-X-STREAM-INF` · `BANDWIDTH=` and `RESOLUTION=` annotate each variant · audio renditions via `#EXT-X-MEDIA` · `preferredPeakBitRate` and `preferredMaximumResolution` cap ABR

**Swift-specific vs other languages:** ABR happens for free with `AVPlayer` if the master playlist is well-formed. The capping properties are how you express "data saver" or "kids profile" without rolling your own selector.

**What's next:** Lesson 03 covers live vs VOD specifics — DVR, sliding windows, and live edge.
