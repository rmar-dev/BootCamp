---
type: lesson
title: Offline Downloads
level: advanced
summary: AVAssetDownloadURLSession, AVAggregateAssetDownloadTask, persisting the local AVAsset, and SwiftData metadata.
---

## AVAssetDownloadURLSession

Standard `URLSession` cannot download HLS — segments must be assembled into a local `AVAsset`. Use `AVAssetDownloadURLSession`.

```swift
import AVFoundation

let config = URLSessionConfiguration.background(withIdentifier: "com.example.stream.downloads")
let session = AVAssetDownloadURLSession(
    configuration: config,
    assetDownloadDelegate: delegate,
    delegateQueue: .main
)

let asset = AVURLAsset(url: hlsURL)
let task = session.makeAssetDownloadTask(
    asset: asset,
    assetTitle: "Inception",
    assetArtworkData: nil,
    options: [AVAssetDownloadTaskMinimumRequiredMediaBitrateKey: 1_500_000]
)
task?.resume()
```

The download proceeds in the background. When complete, the delegate receives a local URL that points at a `.movpkg` bundle.

> **Coming from Java:** Closer to ExoPlayer's `DownloadManager` than to a raw download. The OS handles HLS-specific assembly, retries, and resumption.

---

## Delegate callbacks

```swift
final class DownloadDelegate: NSObject, AVAssetDownloadDelegate {
    var onDone: ((URL) -> Void)?

    func urlSession(_ session: URLSession,
                    assetDownloadTask: AVAssetDownloadTask,
                    didFinishDownloadingTo location: URL) {
        // location is RELATIVE to the app's container — persist the *path*, not an absolute URL.
        onDone?(location)
    }

    func urlSession(_ session: URLSession,
                    assetDownloadTask: AVAssetDownloadTask,
                    didLoad timeRange: CMTimeRange,
                    totalTimeRangesLoaded loadedTimeRanges: [NSValue],
                    timeRangeExpectedToLoad: CMTimeRange) {
        let progress = loadedTimeRanges
            .map { $0.timeRangeValue.duration.seconds }
            .reduce(0, +) / timeRangeExpectedToLoad.duration.seconds
        // update UI: progress * 100%
    }
}
```

> **What's going on here**
> - `location` is given as a *relative* URL because the app's container path can change across launches. Store the relative path; rebuild the absolute URL each launch.
> - Progress is computed from total seconds loaded vs total seconds expected — not bytes, since segment sizes vary.

---

## Playing back offline

When the user taps an offline download, build the asset from the persisted relative path:

```swift
let docs = try FileManager.default.url(for: .libraryDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
let assetURL = docs.appendingPathComponent(relativePath)
let asset = AVURLAsset(url: assetURL)
let item = AVPlayerItem(asset: asset)
player.replaceCurrentItem(with: item)
```

`AVPlayer` plays the offline `.movpkg` exactly like an online HLS asset.

---

## SwiftData metadata

Store the user-facing metadata (title, poster, relative path, expiry) in SwiftData (Week 7) so the offline tab can list downloads, sort by date, and show progress.

```swift
@Model
final class OfflineDownload {
    @Attribute(.unique) var movieID: String
    var title: String
    var relativePath: String
    var addedAt: Date
    var sizeBytes: Int

    init(movieID: String, title: String, relativePath: String, addedAt: Date, sizeBytes: Int) {
        self.movieID = movieID
        self.title = title
        self.relativePath = relativePath
        self.addedAt = addedAt
        self.sizeBytes = sizeBytes
    }
}
```

---
type: exercise
kind: multiple_choice
pointsMax: 10
---
Why store the *relative* path of a downloaded asset instead of the absolute URL?

- [ ] Relative paths are shorter and save disk space.
- [x] The app's container directory can change across launches; the relative path is stable, the absolute URL is not.
- [ ] iOS does not support absolute URLs in SwiftData.
- [ ] AVPlayer cannot resolve absolute file URLs.

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Write `progress(_ loaded:expected:)` that returns the fraction (0...1) of expected duration that has loaded.

```swift:starter
import AVFoundation

func progress(loaded: [CMTimeRange], expected: CMTimeRange) -> Double {
    // TODO
    return 0
}
```

```swift:solution
import AVFoundation

func progress(loaded: [CMTimeRange], expected: CMTimeRange) -> Double {
    let totalLoaded = loaded.reduce(0.0) { $0 + $1.duration.seconds }
    let totalExpected = expected.duration.seconds
    guard totalExpected > 0 else { return 0 }
    return min(1.0, totalLoaded / totalExpected)
}
```

```swift:test
import XCTest
import AVFoundation

final class Tests: XCTestCase {
    func testHalf() {
        let loaded = [CMTimeRange(start: .zero, duration: CMTime(seconds: 30, preferredTimescale: 600))]
        let expected = CMTimeRange(start: .zero, duration: CMTime(seconds: 60, preferredTimescale: 600))
        XCTAssertEqual(progress(loaded: loaded, expected: expected), 0.5, accuracy: 0.01)
    }
}
```

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Write `resolveLocalURL(relativePath:)` that returns an absolute file URL by appending the relative path to the app's library directory.

```swift:starter
import Foundation

func resolveLocalURL(relativePath: String) throws -> URL {
    // TODO
    return URL(fileURLWithPath: "")
}
```

```swift:solution
import Foundation

func resolveLocalURL(relativePath: String) throws -> URL {
    let library = try FileManager.default.url(
        for: .libraryDirectory,
        in: .userDomainMask,
        appropriateFor: nil,
        create: true
    )
    return library.appendingPathComponent(relativePath)
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testResolves() throws {
        let url = try resolveLocalURL(relativePath: "movies/abc.movpkg")
        XCTAssertTrue(url.path.hasSuffix("movies/abc.movpkg"))
    }
}
```

---
type: exercise
kind: fix_bug
pointsMax: 40
language: swift
---
The download task is configured with the foreground configuration; switch it to a background session so downloads survive app suspension.

```swift:broken
import AVFoundation

func makeDownloadSession(delegate: AVAssetDownloadDelegate) -> AVAssetDownloadURLSession {
    let config = URLSessionConfiguration.default
    return AVAssetDownloadURLSession(
        configuration: config,
        assetDownloadDelegate: delegate,
        delegateQueue: .main
    )
}
```

```swift:test
import XCTest
import AVFoundation

final class StubDelegate: NSObject, AVAssetDownloadDelegate {}

final class Tests: XCTestCase {
    func testCompiles() {
        let f: (AVAssetDownloadDelegate) -> AVAssetDownloadURLSession = makeDownloadSession(delegate:)
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
  "1": ["AVAssetDownloadURLSession"]
---
Fill in the URLSession subclass that knows how to download HLS into a local `.movpkg`.

```swift:starter
let session = ___1___(
    configuration: config,
    assetDownloadDelegate: delegate,
    delegateQueue: .main
)
```

---
type: recap
---

## What you learned

**Concepts:** `AVAssetDownloadURLSession` with a *background* configuration · delegate callbacks for completion and progress · persist a *relative* path · `.movpkg` plays in `AVPlayer` like a remote asset · SwiftData entity for download metadata

**Swift-specific vs other languages:** AVAssetDownload handles the HLS-specific assembly automatically. Without it, you would have to download every segment, parse the playlists, rewrite paths, and stitch them — the framework does all of that.

**What's next:** Week 12 is the capstone — assemble the streaming app in Xcode and submit a screen recording for instructor review.
