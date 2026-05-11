---
type: lesson
title: Grids & Horizontal Scrollers
level: intermediate
summary: LazyVGrid, LazyHStack, ScrollView, and the carousel pattern used on streaming home screens.
---

## LazyVGrid

`LazyVGrid` wraps items into a grid based on a column spec.

```swift
struct PosterGrid: View {
    let movies: [Movie]
    let columns = [GridItem(.adaptive(minimum: 110), spacing: 12)]

    var body: some View {
        ScrollView {
            LazyVGrid(columns: columns, spacing: 12) {
                ForEach(movies) { Poster(url: $0.posterURL) }
            }
            .padding()
        }
    }
}
```

`.adaptive(minimum:)` fits as many columns as the width allows — the grid auto-reflows on rotation.

> **Coming from JavaScript:** `.adaptive(minimum:)` is roughly `repeat(auto-fill, minmax(110px, 1fr))` in CSS Grid. The "lazy" prefix means rows are realized on demand as they enter the viewport.

---

## Horizontal carousel

For the home-screen "rows of posters" layout, nest a horizontal `LazyHStack` inside a horizontal `ScrollView`.

```swift
ScrollView(.horizontal, showsIndicators: false) {
    LazyHStack(spacing: 12) {
        ForEach(movies) { Poster(url: $0.posterURL) }
    }
    .padding(.horizontal)
}
```

The `.horizontal` axis on both the scroll view *and* the stack is required.

---

## Snap-to-paging with scrollTargetBehavior

iOS 17+ introduced declarative scroll snapping:

```swift
ScrollView(.horizontal) {
    LazyHStack { ForEach(movies) { Poster(url: $0.posterURL) } }
        .scrollTargetLayout()
}
.scrollTargetBehavior(.viewAligned)
```

> **What's going on here**
> - `.scrollTargetLayout()` opts the stack's children into being scroll targets.
> - `.scrollTargetBehavior(.viewAligned)` snaps each scroll to the nearest child boundary.

---
type: exercise
kind: multiple_choice
pointsMax: 10
---
What does `GridItem(.adaptive(minimum: 110))` do?

- [x] Fills the available width with as many columns as fit, each at least 110pt wide.
- [ ] Forces exactly 110 columns.
- [ ] Renders a single column 110pt wide.
- [ ] Sets the row height to 110pt.

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Build a `PosterRow` view: a horizontal scroller of poster cards (use a `Text(movie.title).frame(width: 120, height: 180)` placeholder).

```swift:starter
import SwiftUI

struct Movie: Identifiable { let id: String; let title: String }

struct PosterRow: View {
    let movies: [Movie]

    var body: some View {
        // TODO
        EmptyView()
    }
}
```

```swift:solution
import SwiftUI

struct Movie: Identifiable { let id: String; let title: String }

struct PosterRow: View {
    let movies: [Movie]

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            LazyHStack(spacing: 12) {
                ForEach(movies) { movie in
                    Text(movie.title)
                        .frame(width: 120, height: 180)
                        .background(.gray, in: .rect(cornerRadius: 8))
                }
            }
            .padding(.horizontal)
        }
    }
}
```

```swift:test
import XCTest
import SwiftUI

final class Tests: XCTestCase {
    func testRowBuilds() {
        XCTAssertNotNil(PosterRow(movies: []).body)
    }
}
```

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Build a `Catalog` view: a vertical adaptive grid of poster placeholders sized 110pt minimum, 12pt spacing.

```swift:starter
import SwiftUI

struct Movie: Identifiable { let id: String }

struct Catalog: View {
    let movies: [Movie]

    var body: some View {
        // TODO
        EmptyView()
    }
}
```

```swift:solution
import SwiftUI

struct Movie: Identifiable { let id: String }

struct Catalog: View {
    let movies: [Movie]
    private let columns = [GridItem(.adaptive(minimum: 110), spacing: 12)]

    var body: some View {
        ScrollView {
            LazyVGrid(columns: columns, spacing: 12) {
                ForEach(movies) { _ in
                    Color.gray.frame(height: 165)
                        .clipShape(.rect(cornerRadius: 8))
                }
            }
            .padding()
        }
    }
}
```

```swift:test
import XCTest
import SwiftUI

final class Tests: XCTestCase {
    func testCatalogBuilds() {
        XCTAssertNotNil(Catalog(movies: []).body)
    }
}
```

---
type: exercise
kind: fix_bug
pointsMax: 40
language: swift
---
The horizontal scroller does not scroll horizontally. Fix the axes.

```swift:broken
import SwiftUI

struct Row: View {
    let titles: [String]
    var body: some View {
        ScrollView {
            HStack {
                ForEach(titles, id: \.self) { Text($0) }
            }
        }
    }
}
```

```swift:test
import XCTest
import SwiftUI

final class Tests: XCTestCase {
    func testRowBuilds() {
        XCTAssertNotNil(Row(titles: ["a","b"]).body)
    }
}
```

---
type: exercise
kind: fill_blank
pointsMax: 20
language: swift
blanks:
  "1": ["LazyVGrid"]
---
Fill in the container that wraps items into a vertically scrolling grid only realized on demand.

```swift:starter
ScrollView {
    ___1___(columns: [GridItem(.flexible())]) {
        ForEach(0..<100) { Text("\($0)") }
    }
}
```

---
type: recap
---

## What you learned

**Concepts:** `LazyVGrid` with `.adaptive(minimum:)` columns · `ScrollView(.horizontal)` + `LazyHStack` carousel pattern · `.scrollTargetBehavior(.viewAligned)` for snap paging

**Swift-specific vs other languages:** `LazyVGrid`'s adaptive sizing is closer to CSS Grid `auto-fill` than to UICollectionViewFlowLayout. The "lazy" prefix is the equivalent of UICollectionView cell reuse — items are realized on demand.

**What's next:** Lesson 03 covers `Form`, `TextField`, `Picker`, and `searchable` for the search and settings screens.
