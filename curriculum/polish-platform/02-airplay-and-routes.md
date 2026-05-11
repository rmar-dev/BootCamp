---
type: lesson
title: AirPlay & Route Picker
level: intermediate
summary: AVRoutePickerView, allowsExternalPlayback, and route change notifications.
---

## AirPlay basics

`AVPlayer` supports AirPlay out of the box when `allowsExternalPlayback` is enabled (default on iOS).

```swift
let player = AVPlayer(url: url)
player.allowsExternalPlayback = true   // default
player.usesExternalPlaybackWhileExternalScreenIsActive = true
```

`usesExternalPlaybackWhileExternalScreenIsActive` is the key to "throw video to the TV; phone shows controls".

> **Coming from JavaScript:** Closer to the Cast SDK than to anything in HTML5. AirPlay works at the OS level; you grant the player permission to use it, the system handles the discovery and routing.

---

## Route picker UI

`AVRoutePickerView` is the system-supplied AirPlay button. It is a `UIView`, so wrap it for SwiftUI.

```swift
import AVKit
import SwiftUI

struct RoutePickerButton: UIViewRepresentable {
    func makeUIView(context: Context) -> AVRoutePickerView {
        let v = AVRoutePickerView()
        v.activeTintColor = .systemBlue
        v.tintColor = .label
        return v
    }

    func updateUIView(_ uiView: AVRoutePickerView, context: Context) {}
}
```

Drop `RoutePickerButton()` into the controls overlay alongside play/pause.

> **What's going on here**
> - `UIViewRepresentable` is the bridge from UIKit to SwiftUI. `makeUIView` builds it once; `updateUIView` reconciles state.
> - `activeTintColor` is the color when AirPlay is active; `tintColor` is the inactive color.

---

## Route change notifications

`AVAudioSession.routeChangeNotification` fires when output changes — user plugged in headphones, picked AirPlay, switched to a Bluetooth speaker.

```swift
NotificationCenter.default.addObserver(
    forName: AVAudioSession.routeChangeNotification,
    object: nil,
    queue: .main
) { note in
    guard let raw = note.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt,
          let reason = AVAudioSession.RouteChangeReason(rawValue: raw) else { return }
    if reason == .oldDeviceUnavailable {
        player.pause()    // headphones were unplugged — pause is the polite thing
    }
}
```

The "headphones unplugged → pause" behavior is the expected media-app default since iPods.

---
type: exercise
kind: multiple_choice
pointsMax: 10
---
What happens when you set `usesExternalPlaybackWhileExternalScreenIsActive = true`?

- [ ] The player mirrors the screen pixel-for-pixel via AirPlay.
- [x] The video is sent directly to the AirPlay receiver, while the phone keeps the controls.
- [ ] AirPlay is disabled.
- [ ] Audio is sent but video stays on the phone.

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Wrap `AVRoutePickerView` as a SwiftUI `UIViewRepresentable` named `RoutePickerButton` with `activeTintColor = .systemBlue` and `tintColor = .label`.

```swift:starter
import SwiftUI
import AVKit
import UIKit

struct RoutePickerButton: UIViewRepresentable {
    func makeUIView(context: Context) -> AVRoutePickerView {
        // TODO
        return AVRoutePickerView()
    }
    func updateUIView(_ uiView: AVRoutePickerView, context: Context) {}
}
```

```swift:solution
import SwiftUI
import AVKit
import UIKit

struct RoutePickerButton: UIViewRepresentable {
    func makeUIView(context: Context) -> AVRoutePickerView {
        let v = AVRoutePickerView()
        v.activeTintColor = .systemBlue
        v.tintColor = .label
        return v
    }
    func updateUIView(_ uiView: AVRoutePickerView, context: Context) {}
}
```

```swift:test
import XCTest
import SwiftUI

final class Tests: XCTestCase {
    func testBuilds() {
        let _ = RoutePickerButton()
    }
}
```

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Write `pauseOnRouteChange(_:)` that registers an observer on `routeChangeNotification` and calls `player.pause()` when the reason is `.oldDeviceUnavailable`. Return the observer token.

```swift:starter
import AVFoundation

func pauseOnRouteChange(_ player: AVPlayer) -> NSObjectProtocol {
    // TODO
    return NotificationCenter.default.addObserver(forName: nil, object: nil, queue: nil) { _ in }
}
```

```swift:solution
import AVFoundation

func pauseOnRouteChange(_ player: AVPlayer) -> NSObjectProtocol {
    NotificationCenter.default.addObserver(
        forName: AVAudioSession.routeChangeNotification,
        object: nil,
        queue: .main
    ) { note in
        guard let raw = note.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt,
              let reason = AVAudioSession.RouteChangeReason(rawValue: raw) else { return }
        if reason == .oldDeviceUnavailable {
            player.pause()
        }
    }
}
```

```swift:test
import XCTest
import AVFoundation

final class Tests: XCTestCase {
    func testCompiles() {
        let f: (AVPlayer) -> NSObjectProtocol = pauseOnRouteChange(_:)
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
The player ignores AirPlay because external playback is disabled. Re-enable it.

```swift:broken
import AVFoundation

func setup(_ player: AVPlayer) {
    player.allowsExternalPlayback = false
    player.usesExternalPlaybackWhileExternalScreenIsActive = false
}
```

```swift:test
import XCTest
import AVFoundation

final class Tests: XCTestCase {
    func testEnabled() {
        let p = AVPlayer()
        setup(p)
        XCTAssertTrue(p.allowsExternalPlayback)
        XCTAssertTrue(p.usesExternalPlaybackWhileExternalScreenIsActive)
    }
}
```

---
type: exercise
kind: fill_blank
pointsMax: 20
language: swift
blanks:
  "1": ["UIViewRepresentable"]
---
Fill in the protocol that bridges a UIKit view into SwiftUI.

```swift:starter
struct RoutePickerButton: ___1___ {
    func makeUIView(context: Context) -> AVRoutePickerView { AVRoutePickerView() }
    func updateUIView(_ uiView: AVRoutePickerView, context: Context) {}
}
```

---
type: recap
---

## What you learned

**Concepts:** `allowsExternalPlayback` (default on) and `usesExternalPlaybackWhileExternalScreenIsActive` for AirPlay routing · `AVRoutePickerView` wrapped via `UIViewRepresentable` · `routeChangeNotification` with `.oldDeviceUnavailable` for the unplug-pause UX

**Swift-specific vs other languages:** AirPlay is OS-managed — no app code drives discovery or session negotiation. Closer to Android's MediaRouter than to a custom Cast integration.

**What's next:** Lesson 03 enables background audio and registers `MPRemoteCommandCenter` for lock-screen controls.
