---
type: lesson
title: Picture-in-Picture
level: intermediate
summary: AVPictureInPictureController, capabilities check, and the audio session category required for PiP.
---

## Capability check

PiP is not available on every device or every OS version. Always gate behind a capability check.

```swift
import AVKit

guard AVPictureInPictureController.isPictureInPictureSupported() else {
    return
}
```

iPhone supports PiP since iOS 14. iPad supports it since iOS 9. Older or restricted devices return `false`.

> **Coming from JavaScript:** Closer to `document.pictureInPictureEnabled` than to a feature flag. The capability is system-supplied; you only ask, never assert.

---

## Setup

PiP needs an `AVPlayerLayer` *or* a custom video sample buffer source. With `VideoPlayer` (which uses an `AVPlayerLayer` internally), reach into the AVPlayer.

```swift
final class PiPController: NSObject, AVPictureInPictureControllerDelegate {
    private var pip: AVPictureInPictureController?

    func attach(to player: AVPlayer, in playerLayer: AVPlayerLayer) {
        guard AVPictureInPictureController.isPictureInPictureSupported() else { return }
        let controller = AVPictureInPictureController(playerLayer: playerLayer)
        controller?.delegate = self
        self.pip = controller
    }

    func startIfReady() {
        guard let pip, pip.isPictureInPicturePossible else { return }
        pip.startPictureInPicture()
    }
}
```

`isPictureInPicturePossible` is true once the player has a video track and the layer is attached to a window.

---

## Audio session category

PiP requires the audio session category to be `.playback`. Set this once at app start:

```swift
import AVFoundation

try AVAudioSession.sharedInstance().setCategory(.playback, mode: .moviePlayback)
try AVAudioSession.sharedInstance().setActive(true)
```

`.playback` is the same category required for background audio. Without it, PiP fails to start with no error in the UI — only an entry in the device console.

> **What's going on here**
> - `.playback` tells the system "this app's audio is the focus" — it interrupts the silent switch and competes with other audio for the output route.
> - PiP also requires the `audio` background mode entitlement in Info.plist (Lesson 03 covers this).

---

## Auto-PiP on background

Enable `canStartPictureInPictureAutomaticallyFromInline = true` so the app enters PiP automatically when the user backgrounds the app while playing.

```swift
controller.canStartPictureInPictureAutomaticallyFromInline = true
```

This is the streaming-app expectation — Netflix, YouTube, Apple TV all do it.

---
type: exercise
kind: multiple_choice
pointsMax: 10
---
Without which audio session category will Picture-in-Picture fail to start?

- [ ] `.ambient`
- [ ] `.soloAmbient`
- [x] `.playback`
- [ ] `.record`

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Write `enablePiPAudio()` that sets the shared audio session to `.playback` with mode `.moviePlayback` and activates it.

```swift:starter
import AVFoundation

func enablePiPAudio() throws {
    // TODO
}
```

```swift:solution
import AVFoundation

func enablePiPAudio() throws {
    let session = AVAudioSession.sharedInstance()
    try session.setCategory(.playback, mode: .moviePlayback)
    try session.setActive(true)
}
```

```swift:test
import XCTest
import AVFoundation

final class Tests: XCTestCase {
    func testCompiles() {
        let f: () throws -> Void = enablePiPAudio
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
Build a `PiPController` class that owns an `AVPictureInPictureController?`, gates on `isPictureInPictureSupported()`, and exposes `startIfPossible()`.

```swift:starter
import AVKit

final class PiPController: NSObject {
    private var pip: AVPictureInPictureController?

    init(playerLayer: AVPlayerLayer) {
        super.init()
        // TODO
    }

    func startIfPossible() {
        // TODO
    }
}
```

```swift:solution
import AVKit

final class PiPController: NSObject {
    private var pip: AVPictureInPictureController?

    init(playerLayer: AVPlayerLayer) {
        super.init()
        guard AVPictureInPictureController.isPictureInPictureSupported() else { return }
        self.pip = AVPictureInPictureController(playerLayer: playerLayer)
    }

    func startIfPossible() {
        guard let pip, pip.isPictureInPicturePossible else { return }
        pip.startPictureInPicture()
    }
}
```

```swift:test
import XCTest
import AVKit

final class Tests: XCTestCase {
    func testInitCompiles() {
        let layer = AVPlayerLayer()
        _ = PiPController(playerLayer: layer)
    }
}
```

---
type: exercise
kind: fix_bug
pointsMax: 40
language: swift
---
The function calls `startPictureInPicture` even when not supported. Add the capability check.

```swift:broken
import AVKit

func tryStart(_ controller: AVPictureInPictureController) {
    controller.startPictureInPicture()
}
```

```swift:test
import XCTest
import AVKit

final class Tests: XCTestCase {
    func testCompiles() {
        let f: (AVPictureInPictureController) -> Void = tryStart
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
  "1": ["canStartPictureInPictureAutomaticallyFromInline"]
---
Fill in the property that triggers PiP automatically when the app is backgrounded mid-playback.

```swift:starter
controller.___1___ = true
```

---
type: recap
---

## What you learned

**Concepts:** `isPictureInPictureSupported()` capability gate · `AVPictureInPictureController(playerLayer:)` for `VideoPlayer`-backed layers · `.playback` audio session is mandatory · `canStartPictureInPictureAutomaticallyFromInline` for auto-enter on background

**Swift-specific vs other languages:** PiP is a system-level affordance on iOS — there is no JavaScript equivalent in Safari for arbitrary apps. The audio session category is the silent gotcha that breaks most first attempts.

**What's next:** Lesson 02 covers AirPlay and how to discover and present route choices.
