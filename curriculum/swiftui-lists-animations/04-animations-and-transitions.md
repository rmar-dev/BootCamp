---
type: lesson
title: Animations & Transitions
level: intermediate
summary: withAnimation, implicit animations, transitions, and matchedGeometryEffect for hero-to-detail transitions.
---

## withAnimation

Wrap a state mutation in `withAnimation` to animate every dependent view's update.

```swift
struct PlayButton: View {
    @State private var isPlaying = false

    var body: some View {
        Button {
            withAnimation(.spring) { isPlaying.toggle() }
        } label: {
            Image(systemName: isPlaying ? "pause.fill" : "play.fill")
                .font(.system(size: 64))
        }
    }
}
```

The Button's icon swaps with a spring transition.

> **Coming from JavaScript:** Closer to React's `<motion.div animate>` than to manual CSS transitions. You declare the animation; the framework computes interpolations.

---

## Implicit `.animation(_:value:)`

For a property that animates whenever a specific value changes:

```swift
Circle()
    .fill(.red)
    .frame(width: scale, height: scale)
    .animation(.easeInOut(duration: 0.3), value: scale)
```

The animation triggers each time `scale` changes — no explicit `withAnimation` block needed.

---

## .transition for insertions / removals

When a view is added or removed (e.g., conditional content), `.transition` describes the entry/exit.

```swift
if showsCaption {
    Text("Captions on")
        .transition(.move(edge: .bottom).combined(with: .opacity))
}
```

---

## matchedGeometryEffect — hero transitions

For a poster that morphs into the player on tap, give both views the same `id` in a shared `Namespace`.

```swift
struct Browse: View {
    @Namespace private var ns
    @State private var selected: Movie?

    var body: some View {
        ZStack {
            if let movie = selected {
                Detail(movie: movie, ns: ns)
                    .onTapGesture { withAnimation(.spring) { selected = nil } }
            } else {
                Grid(ns: ns, onTap: { withAnimation(.spring) { selected = $0 } })
            }
        }
    }
}
```

Inside both views, attach `.matchedGeometryEffect(id: movie.id, in: ns)` to the poster. SwiftUI animates between the two positions.

> **What's going on here**
> - `@Namespace` defines a shared coordinate space.
> - `.matchedGeometryEffect(id:in:)` declares "this view, in either branch of the if/else, is the same thing".

---
type: exercise
kind: multiple_choice
pointsMax: 10
---
What does `withAnimation(.spring) { value.toggle() }` do?

- [ ] Animates only the receiver of `.spring`.
- [x] Wraps a state mutation so all dependent views animate their updates.
- [ ] Pauses rendering until the spring completes.
- [ ] Reads the value with a spring-physics easing.

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Build an `Expandable` view with a `@State` `Bool`. Tap to toggle. The detail block uses a `.transition(.opacity.combined(with: .move(edge: .top)))` and the toggle is wrapped in `withAnimation(.spring)`.

```swift:starter
import SwiftUI

struct Expandable: View {
    var body: some View {
        // TODO
        EmptyView()
    }
}
```

```swift:solution
import SwiftUI

struct Expandable: View {
    @State private var open = false

    var body: some View {
        VStack {
            Button("Toggle") {
                withAnimation(.spring) { open.toggle() }
            }
            if open {
                Text("Detail")
                    .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
    }
}
```

```swift:test
import XCTest
import SwiftUI

final class Tests: XCTestCase {
    func testExpandableBuilds() {
        XCTAssertNotNil(Expandable().body)
    }
}
```

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Build a circle whose diameter is bound to a `@State` `CGFloat`. Add a button that animates the diameter from 100 to 200 with `.easeInOut(duration: 0.4)` using implicit `.animation(_:value:)`.

```swift:starter
import SwiftUI

struct Pulse: View {
    var body: some View {
        // TODO
        EmptyView()
    }
}
```

```swift:solution
import SwiftUI

struct Pulse: View {
    @State private var size: CGFloat = 100

    var body: some View {
        VStack {
            Circle()
                .fill(.blue)
                .frame(width: size, height: size)
                .animation(.easeInOut(duration: 0.4), value: size)
            Button("Pulse") {
                size = size == 100 ? 200 : 100
            }
        }
    }
}
```

```swift:test
import XCTest
import SwiftUI

final class Tests: XCTestCase {
    func testPulseBuilds() {
        XCTAssertNotNil(Pulse().body)
    }
}
```

---
type: exercise
kind: fix_bug
pointsMax: 40
language: swift
---
The view changes but does not animate. Wrap the mutation in the right call.

```swift:broken
import SwiftUI

struct V: View {
    @State private var open = false

    var body: some View {
        VStack {
            Button("Open") { open.toggle() }
            if open {
                Text("Detail").transition(.opacity)
            }
        }
    }
}
```

```swift:test
import XCTest
import SwiftUI

final class Tests: XCTestCase {
    func testVBuilds() {
        XCTAssertNotNil(V().body)
    }
}
```

---
type: exercise
kind: fill_blank
pointsMax: 20
language: swift
blanks:
  "1": ["Namespace"]
---
Fill in the property wrapper that defines a shared coordinate space for `matchedGeometryEffect`.

```swift:starter
struct V: View {
    @___1___ private var ns
    var body: some View { Color.clear }
}
```

---
type: recap
---

## What you learned

**Concepts:** `withAnimation` wraps state mutations · implicit `.animation(_:value:)` for value-driven animation · `.transition` for insert/remove · `matchedGeometryEffect` + `@Namespace` for hero transitions

**Swift-specific vs other languages:** Animations are declarative — you describe state, then describe the *animation curve* between states. The framework interpolates view properties, not mutates them imperatively.

**What's next:** Week 6 leaves the UI behind for one week to build the networking layer that will feed all the catalog views.
