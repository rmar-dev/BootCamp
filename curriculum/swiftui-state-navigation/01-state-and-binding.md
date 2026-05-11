---
type: lesson
title: State & Binding
level: beginner
summary: Local view state with @State and two-way bindings with @Binding for child views.
---

## @State

`@State` declares a piece of mutable state owned by a view. SwiftUI stores it across re-renders and re-runs `body` when it changes.

```swift
struct PlayToggle: View {
    @State private var isPlaying = false

    var body: some View {
        Button(isPlaying ? "Pause" : "Play") {
            isPlaying.toggle()
        }
    }
}
```

`@State` properties are private to the view. Mark them `private` to make this explicit.

> **Coming from JavaScript:** `@State` is React's `useState`. The view re-renders when the value changes; the storage survives the rebuild.

---

## @Binding

A child view that needs to *write* to a parent's state takes a `@Binding`. The parent passes it with `$state`.

```swift
struct Slider2: View {
    @Binding var value: Double

    var body: some View {
        Slider(value: $value, in: 0...1)
    }
}

struct Player: View {
    @State private var progress = 0.0

    var body: some View {
        Slider2(value: $progress)
    }
}
```

> **What's going on here**
> - `$progress` — the projected value of `@State` is a `Binding<Double>`. The `$` prefix unlocks it.

---

## When to lift state up

If two sibling views must agree on the same value, the closest common ancestor owns the `@State`; siblings receive `@Binding`s. This mirrors React's "lifting state up".

---
type: exercise
kind: multiple_choice
pointsMax: 10
---
What does the `$` prefix on a `@State` property return?

- [ ] The wrapped value, but synchronously.
- [x] A `Binding` to the wrapped value.
- [ ] A copy of the underlying storage.
- [ ] Nothing — it is a parsing error outside of property wrappers.

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Build a `Counter` view with `@State` storing an `Int` starting at 0, an increment button, and a `Text` displaying the current value.

```swift:starter
import SwiftUI

struct Counter: View {
    var body: some View {
        // TODO
        EmptyView()
    }
}
```

```swift:solution
import SwiftUI

struct Counter: View {
    @State private var count = 0

    var body: some View {
        VStack {
            Text("\(count)")
            Button("Add") { count += 1 }
        }
    }
}
```

```swift:test
import XCTest
import SwiftUI

final class Tests: XCTestCase {
    func testCounterBuilds() {
        XCTAssertNotNil(Counter().body)
    }
}
```

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Build a parent `MuteSwitch` with `@State` holding a `Bool` and a child `Toggle2` taking a `@Binding<Bool>`. Pass the binding correctly.

```swift:starter
import SwiftUI

struct Toggle2: View {
    @Binding var on: Bool

    var body: some View {
        Toggle("Muted", isOn: $on)
    }
}

struct MuteSwitch: View {
    var body: some View {
        // TODO
        EmptyView()
    }
}
```

```swift:solution
import SwiftUI

struct Toggle2: View {
    @Binding var on: Bool

    var body: some View {
        Toggle("Muted", isOn: $on)
    }
}

struct MuteSwitch: View {
    @State private var isMuted = false

    var body: some View {
        Toggle2(on: $isMuted)
    }
}
```

```swift:test
import XCTest
import SwiftUI

final class Tests: XCTestCase {
    func testMuteSwitchBuilds() {
        XCTAssertNotNil(MuteSwitch().body)
    }
}
```

---
type: exercise
kind: fix_bug
pointsMax: 40
language: swift
---
The child cannot mutate the parent's value. Change the child's property so it can write back.

```swift:broken
import SwiftUI

struct Field: View {
    var text: String

    var body: some View {
        TextField("Title", text: $text)
    }
}
```

```swift:test
import XCTest
import SwiftUI

final class Tests: XCTestCase {
    func testFieldBuilds() {
        XCTAssertNotNil(Field(text: .constant("hi")).body)
    }
}
```

---
type: exercise
kind: fill_blank
pointsMax: 20
language: swift
blanks:
  "1": ["Binding"]
---
Fill in the property wrapper a child view uses to write back to a parent's state.

```swift:starter
struct Child: View {
    @___1___ var on: Bool
    var body: some View { Toggle("", isOn: $on) }
}
```

---
type: recap
---

## What you learned

**Concepts:** `@State` for view-owned mutable storage · `@Binding` for two-way connection from a child · `$state` projects a binding · lifting state up to a common ancestor

**Swift-specific vs other languages:** `@State`/`@Binding` is React's `useState` plus a typed two-way prop. The compiler enforces the read/write boundary — passing `state` (read-only) where `$state` (read-write) is expected fails to compile.

**What's next:** Lesson 02 introduces `@Observable` for state shared across many views — the streaming app's player and library models.
