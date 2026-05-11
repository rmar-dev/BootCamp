---
type: lesson
title: Bitrate Diagnostics & FairPlay Overview
level: advanced
summary: AVPlayerItem.accessLog, observed bitrate, and a high-level overview of FairPlay Streaming for premium content.
---

## Access log diagnostics

`AVPlayerItem.accessLog()` returns a snapshot of how the player has been performing — observed bitrate, switches, stalls.

```swift
if let log = player.currentItem?.accessLog() {
    for event in log.events {
        print("uri=\(event.uri ?? "?")")
        print("observedBitrate=\(event.observedBitrate)")
        print("indicatedBitrate=\(event.indicatedBitrate)")
        print("numberOfStalls=\(event.numberOfStalls)")
        print("switchCount=\(event.numberOfMediaRequests)")
    }
}
```

Use it for in-app QoS reporting and debugging the ABR ladder.

> **Coming from JavaScript:** Closer to ExoPlayer's `EventLogger` than to anything in HTML5. The browser hides this; AVKit exposes it.

---

## Error log

Failures surface in `errorLog()`:

```swift
if let log = player.currentItem?.errorLog() {
    for event in log.events {
        print("error=\(event.errorComment ?? "?") at uri=\(event.uri ?? "?")")
    }
}
```

Failed segments, decryption failures, and recoverable network drops all appear here.

---

## FairPlay Streaming (FPS) overview

For premium content (movies, paid subscriptions), HLS supports FairPlay DRM. The flow:

1. Master playlist marks segments as encrypted.
2. AVPlayer downloads the encrypted segments and asks for a decryption key.
3. App responds with a *content key* fetched from a *key server* — including a license that binds the key to the device.
4. AVPlayer hands the key to the secure decryption hardware (Secure Enclave) and plays.

Implementation: a custom `AVAssetResourceLoaderDelegate` handles `loadingRequestsForKey` and POSTs an SPC (Server Playback Context) blob to your key server. The server returns a CKC (Content Key Context); you call `loadingRequest.dataRequest?.respond(with: ckc)`.

> **What's going on here**
> - SPC = "what does the device need to play this?"; CKC = "here's the key, encrypted to that device".
> - Hardware-backed key handling means you cannot extract the decrypted key from the app — that is what makes the studios accept it.

---

## When FairPlay is required

| Content type | Typical requirement |
|---|---|
| User-uploaded video | None |
| Free / ad-supported catalog | Often optional, but reduces piracy |
| Paid subscription, recent release | FairPlay or equivalent typically required by license |
| 4K HDR studio content | Usually FairPlay + HDCP enforcement |

For the capstone in Week 12, FairPlay is *not* required — you stream open or self-hosted content. This lesson is awareness so the architecture has a place to plug DRM in later.

---
type: exercise
kind: multiple_choice
pointsMax: 10
---
What does the FairPlay SPC blob represent?

- [ ] The encrypted video itself.
- [x] A device-specific request for a content decryption key, sent to the app's key server.
- [ ] The DRM license duration.
- [ ] The HLS master playlist URL.

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Write `summarize(log:)` that prints `observedBitrate` and `numberOfStalls` for each event in an `AVPlayerItemAccessLog`.

```swift:starter
import AVFoundation

func summarize(log: AVPlayerItemAccessLog) {
    // TODO
}
```

```swift:solution
import AVFoundation

func summarize(log: AVPlayerItemAccessLog) {
    for event in log.events {
        print("observed=\(event.observedBitrate) stalls=\(event.numberOfStalls)")
    }
}
```

```swift:test
import XCTest
import AVFoundation

final class Tests: XCTestCase {
    func testCompiles() {
        let f: (AVPlayerItemAccessLog) -> Void = summarize(log:)
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
Write `meanObservedBitrate(_:)` returning the average `observedBitrate` across events, or `0` if empty.

```swift:starter
import AVFoundation

func meanObservedBitrate(_ log: AVPlayerItemAccessLog) -> Double {
    // TODO
    return 0
}
```

```swift:solution
import AVFoundation

func meanObservedBitrate(_ log: AVPlayerItemAccessLog) -> Double {
    let events = log.events
    guard !events.isEmpty else { return 0 }
    let total = events.reduce(0.0) { $0 + $1.observedBitrate }
    return total / Double(events.count)
}
```

```swift:test
import XCTest
import AVFoundation

final class Tests: XCTestCase {
    func testCompiles() {
        let f: (AVPlayerItemAccessLog) -> Double = meanObservedBitrate(_:)
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
The function ignores the error log entirely. Iterate it and forward each `errorComment` to a closure.

```swift:broken
import AVFoundation

func reportErrors(_ item: AVPlayerItem, to handler: (String) -> Void) {
    let _ = item.errorLog()
}
```

```swift:test
import XCTest
import AVFoundation

final class Tests: XCTestCase {
    func testCompiles() {
        let f: (AVPlayerItem, (String) -> Void) -> Void = reportErrors
        _ = f
    }
}
```

---
type: exercise
kind: fill_blank
pointsMax: 20
language: swift
blanks:
  "1": ["AVAssetResourceLoaderDelegate"]
---
Fill in the protocol an app implements to handle FairPlay key requests on `AVURLAsset.resourceLoader`.

```swift:starter
final class KeyLoader: NSObject, ___1___ {
    func resourceLoader(_ loader: AVAssetResourceLoader,
                        shouldWaitForLoadingOfRequestedResource req: AVAssetResourceLoadingRequest) -> Bool {
        return true
    }
}
```

---
type: recap
---

## What you learned

**Concepts:** `accessLog()` and `errorLog()` for QoS reporting · `observedBitrate` vs `indicatedBitrate` · FairPlay flow: SPC (request) ↔ CKC (key) via a key server · `AVAssetResourceLoaderDelegate` is where DRM hooks in

**Swift-specific vs other languages:** Apple's stack treats DRM as a delegate plug-in to AVKit, not a separate library. The hardware-backed Secure Enclave is the differentiator that makes FPS acceptable to studios.

**What's next:** Week 10 covers authentication, OAuth, and the Keychain — the user identity layer of the streaming app.
