---
type: lesson
title: UserDefaults & File System
level: intermediate
summary: AppStorage for tiny preferences, FileManager for the cache directory, and where to store downloaded video assets.
---

## @AppStorage

`@AppStorage("key")` reads/writes `UserDefaults` and tracks changes for SwiftUI re-render.

```swift
struct Settings: View {
    @AppStorage("playbackSpeed") private var speed: Double = 1.0

    var body: some View {
        Slider(value: $speed, in: 0.5...2.0, step: 0.25)
    }
}
```

Use it for booleans, strings, numbers, and small arrays/dicts. Do NOT use it for user content or anything sensitive — `UserDefaults` is plaintext.

> **Coming from JavaScript:** Closer to `localStorage` with reactive bindings than to a key-value DB. Same caveat: not for secrets, not for large blobs.

---

## FileManager directories

For larger files (downloaded videos, decoded thumbnails) use the file system. The right directory depends on lifetime intent.

```swift
let fm = FileManager.default

// Survives across launches; backed up by iCloud.
let docs = try fm.url(for: .documentDirectory, in: .userDomainMask, appropriateFor: nil, create: true)

// Survives across launches; not backed up — for downloads the user could re-fetch.
let caches = try fm.url(for: .cachesDirectory, in: .userDomainMask, appropriateFor: nil, create: true)

// Cleared when the device needs space; only for re-downloadable derivatives.
let tmp = fm.temporaryDirectory
```

Place downloaded videos in `caches`. Place user-authored files (notes, exports) in `documents`.

> **What's going on here**
> - `caches` is the right home for re-downloadable assets — iOS may delete it under disk pressure but the user has not "lost" anything.
> - `documents` is backed up via iCloud. Putting downloaded videos there bloats backups and the user's iCloud quota.

---

## Reading & writing

```swift
let data = try Data(contentsOf: url)
try data.write(to: url, options: .atomic)
```

`.atomic` writes to a temp file then rewrites — protects against partial writes if the app is killed mid-save.

---
type: exercise
kind: multiple_choice
pointsMax: 10
---
Where should you store downloaded video files in iOS?

- [ ] `documentDirectory` so they back up to iCloud.
- [x] `cachesDirectory` so the system can reclaim space and they don't bloat backups.
- [ ] `temporaryDirectory` because it persists indefinitely.
- [ ] `applicationSupportDirectory` because it is hidden from the user.

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Build a `Toggle` view bound to an `@AppStorage("autoplay")` Bool default `true`.

```swift:starter
import SwiftUI

struct AutoplayToggle: View {
    var body: some View {
        // TODO
        EmptyView()
    }
}
```

```swift:solution
import SwiftUI

struct AutoplayToggle: View {
    @AppStorage("autoplay") private var autoplay: Bool = true

    var body: some View {
        Toggle("Autoplay next", isOn: $autoplay)
    }
}
```

```swift:test
import XCTest
import SwiftUI

final class Tests: XCTestCase {
    func testBuilds() {
        XCTAssertNotNil(AutoplayToggle().body)
    }
}
```

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Implement `cacheURL(forMovie:)` returning a path inside `cachesDirectory` named `"<movieID>.mp4"`.

```swift:starter
import Foundation

func cacheURL(forMovie id: String) throws -> URL {
    // TODO
    return URL(fileURLWithPath: "")
}
```

```swift:solution
import Foundation

func cacheURL(forMovie id: String) throws -> URL {
    let fm = FileManager.default
    let caches = try fm.url(for: .cachesDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
    return caches.appendingPathComponent("\(id).mp4")
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testReturnsCachesPath() throws {
        let url = try cacheURL(forMovie: "tt-001")
        XCTAssertTrue(url.lastPathComponent == "tt-001.mp4")
    }
}
```

---
type: exercise
kind: fix_bug
pointsMax: 40
language: swift
---
The write is not atomic. Fix it so a crash mid-save does not corrupt the file.

```swift:broken
import Foundation

func save(_ data: Data, to url: URL) throws {
    try data.write(to: url)
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testCompiles() {
        let f: (Data, URL) throws -> Void = save(_:to:)
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
  "1": ["AppStorage"]
---
Fill in the property wrapper that exposes a `UserDefaults` value with reactive binding.

```swift:starter
@___1___("hasOnboarded") var hasOnboarded: Bool = false
```

---
type: recap
---

## What you learned

**Concepts:** `@AppStorage` for small preferences only · `FileManager` directories: documents (iCloud-backed), caches (re-downloadable), temporary (system-pruned) · `.atomic` writes to avoid partial saves

**Swift-specific vs other languages:** AppStorage is the SwiftUI-native binding; the underlying `UserDefaults` API also works in non-SwiftUI code. Caches vs documents matters for backup size and iCloud quota — not just lifetime.

**What's next:** Week 8 introduces `AVKit` and `AVPlayer` — the heart of the streaming app.
