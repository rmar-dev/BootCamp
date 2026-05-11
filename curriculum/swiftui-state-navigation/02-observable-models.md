---
type: lesson
title: "@Observable Models"
level: intermediate
summary: "The @Observable macro for reference-type state shared across views."
---

## @Observable

`@Observable` makes a class observable — SwiftUI tracks which properties each view *reads* and re-renders only those views when those properties change. It replaces the older `ObservableObject` + `@Published` pattern.

```swift
import SwiftUI

@Observable
final class PlayerModel {
    var isPlaying = false
    var currentTime: Double = 0
    var duration: Double = 0
}
```

No `@Published` annotations. The macro instruments every stored property automatically.

> **Coming from Java:** `@Observable` is closer to a Vue 3 reactive object than to JavaBeans `PropertyChangeListener`. Reads at render time auto-subscribe; writes auto-invalidate.

---

## @State for an @Observable instance

A view that *owns* an instance stores it with `@State`. Children receive it as a regular `let` parameter (or read it from the environment).

```swift
struct Player: View {
    @State private var model = PlayerModel()

    var body: some View {
        VStack {
            Controls(model: model)
            ProgressBar(model: model)
        }
    }
}

struct Controls: View {
    let model: PlayerModel    // not @ObservedObject — just `let`

    var body: some View {
        Button(model.isPlaying ? "Pause" : "Play") {
            model.isPlaying.toggle()
        }
    }
}
```

> **What's going on here**
> - `@State private var model = PlayerModel()` — the *view* owns the instance lifetime.
> - `let model: PlayerModel` in `Controls` — passing the reference is enough; SwiftUI tracks reads at render time.

---

## @Bindable for two-way bindings to model fields

To bind a model field to a control, write `@Bindable` and prefix with `$`.

```swift
struct VolumeView: View {
    @Bindable var model: PlayerModel

    var body: some View {
        Slider(value: $model.currentTime, in: 0...model.duration)
    }
}
```

---
type: exercise
kind: multiple_choice
pointsMax: 10
---
What does the `@Observable` macro do?

- [ ] Marks a property for synchronous KVO compatibility.
- [x] Generates per-property change tracking so views re-render only for fields they actually read.
- [ ] Forces the class to inherit from `NSObject`.
- [ ] Disables ARC for the class.

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Define an `@Observable` class `LibraryModel` with `var movies: [String]` initialized empty and an `addMovie(_:)` method.

```swift:starter
import SwiftUI

// TODO
```

```swift:solution
import SwiftUI

@Observable
final class LibraryModel {
    var movies: [String] = []

    func addMovie(_ title: String) {
        movies.append(title)
    }
}
```

```swift:test
import XCTest
import SwiftUI

final class Tests: XCTestCase {
    func testLibraryAdds() {
        let lib = LibraryModel()
        lib.addMovie("Inception")
        XCTAssertEqual(lib.movies, ["Inception"])
    }
}
```

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Wire up a parent `Player` view that owns a `PlayerModel` and a child `Controls` view that toggles `isPlaying` on tap.

```swift:starter
import SwiftUI

@Observable
final class PlayerModel {
    var isPlaying = false
}

struct Controls: View {
    let model: PlayerModel
    var body: some View {
        // TODO
        EmptyView()
    }
}

struct Player: View {
    var body: some View {
        // TODO
        EmptyView()
    }
}
```

```swift:solution
import SwiftUI

@Observable
final class PlayerModel {
    var isPlaying = false
}

struct Controls: View {
    let model: PlayerModel
    var body: some View {
        Button(model.isPlaying ? "Pause" : "Play") {
            model.isPlaying.toggle()
        }
    }
}

struct Player: View {
    @State private var model = PlayerModel()

    var body: some View {
        Controls(model: model)
    }
}
```

```swift:test
import XCTest
import SwiftUI

final class Tests: XCTestCase {
    func testPlayerToggles() {
        let m = PlayerModel()
        m.isPlaying.toggle()
        XCTAssertTrue(m.isPlaying)
    }
}
```

---
type: exercise
kind: fix_bug
pointsMax: 40
language: swift
---
The slider does not write back to the model. Make the model bindable.

```swift:broken
import SwiftUI

@Observable
final class M {
    var volume: Double = 0.5
}

struct VolumeView: View {
    var model: M

    var body: some View {
        Slider(value: $model.volume, in: 0...1)
    }
}
```

```swift:test
import XCTest
import SwiftUI

final class Tests: XCTestCase {
    func testVolumeBuilds() {
        XCTAssertNotNil(VolumeView(model: M()).body)
    }
}
```

---
type: exercise
kind: fill_blank
pointsMax: 20
language: swift
blanks:
  "1": ["Observable"]
---
Fill in the macro that generates property-level change tracking on a class.

```swift:starter
@___1___
final class Settings {
    var quality: String = "hd"
}
```

---
type: recap
---

## What you learned

**Concepts:** `@Observable` macro replaces `ObservableObject + @Published` · owner stores instance with `@State` · `@Bindable` exposes `$model.field` two-way bindings · per-property granularity avoids over-rendering

**Swift-specific vs other languages:** SwiftUI's tracking is finer-grained than React Context. Reading `model.currentTime` subscribes only that view to that property — siblings reading other fields are unaffected.

**What's next:** Lesson 03 covers `NavigationStack` — the typed, value-based navigation API used to push movie detail screens.
