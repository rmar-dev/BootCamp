---
type: lesson
title: Images, Shapes & AsyncImage
level: beginner
summary: Image, SF Symbols, Shape API, gradients, and AsyncImage for loading remote posters.
---

## Local & SF Symbol images

`Image("poster")` loads from the asset catalog. `Image(systemName: "play.fill")` uses an SF Symbol — Apple's built-in icon set.

```swift
Image(systemName: "play.fill")
    .font(.system(size: 24, weight: .bold))
    .foregroundStyle(.white)
```

Symbol size is controlled via `.font(.system(size:))` — they are vector glyphs, not bitmaps.

---

## AsyncImage

For remote posters, `AsyncImage` handles the URL load and supplies states.

```swift
AsyncImage(url: URL(string: "https://cdn.example.com/poster.jpg")) { phase in
    switch phase {
    case .empty:
        ProgressView()
    case .success(let image):
        image.resizable().scaledToFill()
    case .failure:
        Color.gray
    @unknown default:
        Color.gray
    }
}
.frame(width: 120, height: 180)
.clipped()
```

> **Coming from Java:** SwiftUI's `AsyncImage` is a declarative substitute for Glide / Picasso. You describe each load state once; the framework drives the transitions.

---

## Shapes & gradients

`Rectangle`, `RoundedRectangle`, `Circle`, `Capsule` are `Shape` types. They paint fills and strokes.

```swift
RoundedRectangle(cornerRadius: 12)
    .fill(LinearGradient(
        colors: [.black.opacity(0), .black.opacity(0.7)],
        startPoint: .top,
        endPoint: .bottom
    ))
```

The fade overlay above is the standard "title legible over poster" trick used in streaming UIs.

> **What's going on here**
> - `LinearGradient` is itself a `ShapeStyle` — it can be passed anywhere a color is expected.

---
type: exercise
kind: multiple_choice
pointsMax: 10
---
What is the role of the `phase` parameter in `AsyncImage`'s closure?

- [ ] Tracks the animation phase of a transition.
- [ ] Reports the current decoder backend.
- [x] Indicates whether the image is loading, succeeded, or failed.
- [ ] Sets the rendering color space.

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Build a `Poster` view that shows a remote image at fixed size 120×180 with rounded corners. Display a `ProgressView` while loading and a gray rectangle on failure.

```swift:starter
import SwiftUI

struct Poster: View {
    let url: URL?

    var body: some View {
        // TODO
        EmptyView()
    }
}
```

```swift:solution
import SwiftUI

struct Poster: View {
    let url: URL?

    var body: some View {
        AsyncImage(url: url) { phase in
            switch phase {
            case .empty: ProgressView()
            case .success(let image):
                image.resizable().scaledToFill()
            case .failure: Color.gray
            @unknown default: Color.gray
            }
        }
        .frame(width: 120, height: 180)
        .clipShape(.rect(cornerRadius: 8))
    }
}
```

```swift:test
import XCTest
import SwiftUI

final class Tests: XCTestCase {
    func testPosterBuilds() {
        let p = Poster(url: URL(string: "https://example.com/p.jpg"))
        XCTAssertNotNil(p.body)
    }
}
```

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Build a `GradientOverlay` view: a vertical linear gradient from clear at the top to black 70% at the bottom, using a `Rectangle`.

```swift:starter
import SwiftUI

struct GradientOverlay: View {
    var body: some View {
        // TODO
        EmptyView()
    }
}
```

```swift:solution
import SwiftUI

struct GradientOverlay: View {
    var body: some View {
        Rectangle()
            .fill(LinearGradient(
                colors: [.black.opacity(0), .black.opacity(0.7)],
                startPoint: .top,
                endPoint: .bottom
            ))
    }
}
```

```swift:test
import XCTest
import SwiftUI

final class Tests: XCTestCase {
    func testOverlayBuilds() {
        XCTAssertNotNil(GradientOverlay().body)
    }
}
```

---
type: exercise
kind: fix_bug
pointsMax: 40
language: swift
---
The image overflows its frame. Add the modifier that crops it to the frame bounds.

```swift:broken
import SwiftUI

struct Cover: View {
    var body: some View {
        Image(systemName: "tv")
            .resizable()
            .scaledToFill()
            .frame(width: 100, height: 60)
    }
}
```

```swift:test
import XCTest
import SwiftUI

final class Tests: XCTestCase {
    func testCoverBuilds() {
        XCTAssertNotNil(Cover().body)
    }
}
```

---
type: exercise
kind: fill_blank
pointsMax: 20
language: swift
blanks:
  "1": ["systemName"]
---
Fill in the parameter label that loads an SF Symbol icon.

```swift:starter
Image(___1___: "play.fill")
```

---
type: recap
---

## What you learned

**Concepts:** Asset catalog images via `Image("name")` · SF Symbols via `Image(systemName:)` · `AsyncImage` phase-based loading · Shapes and gradients as `ShapeStyle` fills · `.clipShape` and `.clipped`

**Swift-specific vs other languages:** AsyncImage replaces hand-rolled image loaders (Glide, SDWebImage, Kingfisher). Phase-driven transitions are declared once instead of with delegates.

**What's next:** Lesson 04 introduces the SwiftUI environment, view styles, and how to thread theme values through the tree.
