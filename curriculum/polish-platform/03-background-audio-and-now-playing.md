---
type: lesson
title: Background Audio & Now Playing
level: intermediate
summary: UIBackgroundModes audio entitlement, MPNowPlayingInfoCenter metadata, and MPRemoteCommandCenter handlers.
---

## Background entitlement

For audio to keep playing while the app is suspended, add the *Audio, AirPlay, and Picture in Picture* background mode:

```xml
<!-- Info.plist -->
<key>UIBackgroundModes</key>
<array>
    <string>audio</string>
</array>
```

Without this, iOS suspends the app on background and audio stops mid-playback.

> **Coming from Java:** Closer to Android's `MediaBrowserService` foreground service than to running a thread. The OS issues the entitlement; your code declares it in the plist.

---

## MPNowPlayingInfoCenter

The lock screen and Control Center surface "Now Playing" UI fed by `MPNowPlayingInfoCenter`.

```swift
import MediaPlayer

func updateNowPlaying(title: String, subtitle: String, duration: Double, position: Double) {
    var info: [String: Any] = [
        MPMediaItemPropertyTitle: title,
        MPMediaItemPropertyArtist: subtitle,
        MPMediaItemPropertyPlaybackDuration: duration,
        MPNowPlayingInfoPropertyElapsedPlaybackTime: position,
    ]
    MPNowPlayingInfoCenter.default().nowPlayingInfo = info
}
```

Update `elapsedPlaybackTime` whenever the user seeks; the lock-screen scrubber is driven from this dictionary.

> **What's going on here**
> - The lock-screen UI mirrors `nowPlayingInfo`. It does not query your app — set the dictionary, the system reads it.
> - You also need to set the artwork via `MPMediaItemPropertyArtwork` for the cover image. Use `MPMediaItemArtwork(boundsSize:requestHandler:)` for fast async delivery.

---

## MPRemoteCommandCenter

Hardware buttons (headphone play/pause, lock-screen controls, AirPods double-tap) flow through `MPRemoteCommandCenter`.

```swift
let cc = MPRemoteCommandCenter.shared()
cc.playCommand.addTarget { _ in
    player.play()
    return .success
}
cc.pauseCommand.addTarget { _ in
    player.pause()
    return .success
}
cc.changePlaybackPositionCommand.addTarget { event in
    guard let event = event as? MPChangePlaybackPositionCommandEvent else { return .commandFailed }
    player.seek(to: CMTime(seconds: event.positionTime, preferredTimescale: 600))
    return .success
}
```

Return `.success` / `.commandFailed`. Apple uses this to determine whether the system should show the corresponding control.

---
type: exercise
kind: multiple_choice
pointsMax: 10
---
What is the minimum required to keep audio playing while the app is suspended?

- [ ] Just calling `player.play()` before the app goes to background.
- [x] Declaring `audio` in `UIBackgroundModes` in Info.plist plus the `.playback` audio session category.
- [ ] Setting `player.allowsBackgroundPlayback = true`.
- [ ] Enabling Picture-in-Picture.

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Write `setNowPlaying(title:duration:position:)` that sets the three corresponding `MPNowPlayingInfoCenter` keys.

```swift:starter
import MediaPlayer

func setNowPlaying(title: String, duration: Double, position: Double) {
    // TODO
}
```

```swift:solution
import MediaPlayer

func setNowPlaying(title: String, duration: Double, position: Double) {
    let info: [String: Any] = [
        MPMediaItemPropertyTitle: title,
        MPMediaItemPropertyPlaybackDuration: duration,
        MPNowPlayingInfoPropertyElapsedPlaybackTime: position,
    ]
    MPNowPlayingInfoCenter.default().nowPlayingInfo = info
}
```

```swift:test
import XCTest
import MediaPlayer

final class Tests: XCTestCase {
    func testCompiles() {
        let f: (String, Double, Double) -> Void = setNowPlaying(title:duration:position:)
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
Write `wirePlayPause(player:)` that hooks `playCommand` and `pauseCommand` of the shared remote command center to `player.play()` and `player.pause()`.

```swift:starter
import AVFoundation
import MediaPlayer

func wirePlayPause(player: AVPlayer) {
    // TODO
}
```

```swift:solution
import AVFoundation
import MediaPlayer

func wirePlayPause(player: AVPlayer) {
    let cc = MPRemoteCommandCenter.shared()
    cc.playCommand.addTarget { _ in
        player.play()
        return .success
    }
    cc.pauseCommand.addTarget { _ in
        player.pause()
        return .success
    }
}
```

```swift:test
import XCTest
import AVFoundation

final class Tests: XCTestCase {
    func testCompiles() {
        let f: (AVPlayer) -> Void = wirePlayPause(player:)
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
The seek command never reports back to the system. Return the right enum case.

```swift:broken
import AVFoundation
import MediaPlayer

func wireSeek(player: AVPlayer) {
    MPRemoteCommandCenter.shared().changePlaybackPositionCommand.addTarget { event in
        guard let event = event as? MPChangePlaybackPositionCommandEvent else { return .noActionableNowPlayingItem }
        player.seek(to: CMTime(seconds: event.positionTime, preferredTimescale: 600))
        return .commandFailed
    }
}
```

```swift:test
import XCTest
import AVFoundation

final class Tests: XCTestCase {
    func testCompiles() {
        let f: (AVPlayer) -> Void = wireSeek(player:)
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
  "1": ["MPNowPlayingInfoPropertyElapsedPlaybackTime"]
---
Fill in the constant whose value is the current playback position the lock-screen scrubber uses.

```swift:starter
info[___1___] = position
```

---
type: recap
---

## What you learned

**Concepts:** `audio` background mode in Info.plist + `.playback` audio session = playable in background · `MPNowPlayingInfoCenter.default().nowPlayingInfo` feeds the lock screen · `MPRemoteCommandCenter` routes hardware/lock-screen controls back to the app · always return `.success` / `.commandFailed`

**Swift-specific vs other languages:** `MediaPlayer` framework is the canonical surface — no DIY notification observer for hardware buttons. The same constants drive Control Center, Apple Watch Now Playing, and CarPlay.

**What's next:** Lesson 04 covers offline downloads via `AVAssetDownloadURLSession` for the streaming app's "Save for offline" feature.
