---
type: lesson
title: Stacks & Layout
level: beginner
summary: HStack, VStack, ZStack, frame, alignment, and Spacer for the streaming app's row layouts.
---

## The three stacks

`VStack` lays children top-to-bottom, `HStack` left-to-right, `ZStack` back-to-front (depth).

```swift
ZStack(alignment: .bottomLeading) {
    Image("poster").resizable()
    Text("Now Playing")
        .padding()
        .background(.black.opacity(0.5))
}
```

> **Coming from JavaScript:** Think Flexbox. `HStack` ≈ `flex-direction: row`, `VStack` ≈ `column`. Alignment maps to `align-items` on the cross axis. `Spacer` is `flex-grow: 1`.

---

## Frame & alignment

`.frame(width:, height:, alignment:)` sets a fixed size; `.frame(maxWidth: .infinity)` grows to fill available space.

```swift
HStack {
    Text("Title").frame(maxWidth: .infinity, alignment: .leading)
    Text("4K").foregroundStyle(.secondary)
}
```

`maxWidth: .infinity` is the SwiftUI idiom for "fill the parent". Combined with `alignment:` it positions content inside the filled frame.

---

## Spacer & layout priority

`Spacer` is a flexible-size view that pushes siblings apart. Set `.layoutPriority(1)` to give a child precedence when space is tight.

```swift
HStack {
    Text("Long movie title that may truncate")
        .lineLimit(1)
        .layoutPriority(1)
    Spacer()
    Image(systemName: "play.fill")
}
```

> **What's going on here**
> - `.layoutPriority(1)` — when both texts compete for width, the higher-priority one keeps its space.

---
type: exercise
kind: multiple_choice
pointsMax: 10
---
Which stack lays children back-to-front along the depth axis?

- [ ] `HStack`
- [ ] `VStack`
- [x] `ZStack`
- [ ] `LazyVStack`

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Build a `Row` view that takes a `title` and `duration` and lays them out: title on the left filling space, duration on the right in secondary color.

```swift:starter
import SwiftUI

struct Row: View {
    let title: String
    let duration: String

    var body: some View {
        // TODO
        EmptyView()
    }
}
```

```swift:solution
import SwiftUI

struct Row: View {
    let title: String
    let duration: String

    var body: some View {
        HStack {
            Text(title)
                .frame(maxWidth: .infinity, alignment: .leading)
            Text(duration)
                .foregroundStyle(.secondary)
        }
    }
}
```

```swift:test
import XCTest
import SwiftUI

final class Tests: XCTestCase {
    func testRowBuilds() {
        let r = Row(title: "Inception", duration: "2h 28m")
        XCTAssertNotNil(r.body)
    }
}
```

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Build a `Hero` view: a `ZStack` with a colored rectangle background and a title text in the bottom leading corner with 16pt padding.

```swift:starter
import SwiftUI

struct Hero: View {
    let title: String

    var body: some View {
        // TODO
        EmptyView()
    }
}
```

```swift:solution
import SwiftUI

struct Hero: View {
    let title: String

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            Rectangle().fill(.indigo)
            Text(title)
                .font(.title)
                .foregroundStyle(.white)
                .padding(16)
        }
    }
}
```

```swift:test
import XCTest
import SwiftUI

final class Tests: XCTestCase {
    func testHeroBuilds() {
        let h = Hero(title: "Featured")
        XCTAssertNotNil(h.body)
    }
}
```

---
type: exercise
kind: fix_bug
pointsMax: 40
language: swift
---
The two texts collide in the center. Push them apart so the title is leading and the duration is trailing.

```swift:broken
import SwiftUI

struct Row: View {
    var body: some View {
        HStack {
            Text("Title")
            Text("2h 18m")
        }
    }
}
```

```swift:test
import XCTest
import SwiftUI

final class Tests: XCTestCase {
    func testRowBuilds() {
        let r = Row()
        XCTAssertNotNil(r.body)
    }
}
```

---
type: exercise
kind: fill_blank
pointsMax: 20
language: swift
blanks:
  "1": ["Spacer"]
---
Fill in the view that pushes its siblings apart along the stack's axis.

```swift:starter
HStack {
    Text("Left")
    ___1___()
    Text("Right")
}
```

---
type: recap
---

## What you learned

**Concepts:** `HStack` / `VStack` / `ZStack` axes · `.frame(maxWidth: .infinity, alignment:)` for fill-and-position · `Spacer` for flexible separation · `.layoutPriority` for tie-breaking

**Swift-specific vs other languages:** SwiftUI's layout is closer to CSS Flexbox than to UIKit's frame math. Stacks measure children, then resolve frames in a single pass — there is no manual constraint solving.

**What's next:** Lesson 03 covers `Image`, `Shape`, and async image loading — the asset surface for the catalog UI.
