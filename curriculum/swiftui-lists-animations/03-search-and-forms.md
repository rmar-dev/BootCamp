---
type: lesson
title: Search & Forms
level: intermediate
summary: searchable, TextField, Picker, Form, and async search results.
---

## .searchable

Attach `.searchable(text:)` to a list inside a `NavigationStack`. The system supplies the search bar and styling.

```swift
struct SearchScreen: View {
    @State private var query = ""
    @State private var results: [Movie] = []

    var body: some View {
        NavigationStack {
            List(results) { Text($0.title) }
                .navigationTitle("Search")
                .searchable(text: $query)
                .onChange(of: query) { _, new in
                    Task { results = await search(new) }
                }
        }
    }
}
```

`.onChange(of:)` reacts to changes; the `Task { ... }` runs the async search off the render path.

> **Coming from Java:** Closer to LiveData / StateFlow observation than an EditText listener. The framework owns the input control; the view reacts to the query value.

---

## TextField & Form

`Form` lays out grouped sections of inputs with the system's settings styling.

```swift
struct Settings: View {
    @State private var quality = "auto"
    @State private var autoplay = true

    var body: some View {
        Form {
            Picker("Quality", selection: $quality) {
                Text("Auto").tag("auto")
                Text("HD").tag("hd")
                Text("4K").tag("4k")
            }
            Toggle("Autoplay next", isOn: $autoplay)
        }
    }
}
```

> **What's going on here**
> - `.tag(...)` ties each `Picker` option to a value. The selection binding receives the tag of the chosen row.

---

## Debouncing async search

Searching on every keystroke is wasteful. Cancel the prior task before starting a new one.

```swift
@State private var searchTask: Task<Void, Never>?

.onChange(of: query) { _, new in
    searchTask?.cancel()
    searchTask = Task {
        try? await Task.sleep(for: .milliseconds(250))
        if Task.isCancelled { return }
        results = await search(new)
    }
}
```

The 250ms sleep gives a window for cancellation when the user keeps typing.

---
type: exercise
kind: multiple_choice
pointsMax: 10
---
Where must `.searchable(text:)` be placed for the system to render the standard search bar above the content?

- [ ] On the leaf row view.
- [x] Inside a `NavigationStack`, on a content view such as `List`.
- [ ] On the `App` root.
- [ ] On a `TabView` directly.

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Build a `Settings` form with a `Quality` picker (`Auto` / `HD` / `4K`) bound to a `String` and a `Toggle` for Autoplay bound to a `Bool`.

```swift:starter
import SwiftUI

struct Settings: View {
    var body: some View {
        // TODO
        EmptyView()
    }
}
```

```swift:solution
import SwiftUI

struct Settings: View {
    @State private var quality = "auto"
    @State private var autoplay = true

    var body: some View {
        Form {
            Picker("Quality", selection: $quality) {
                Text("Auto").tag("auto")
                Text("HD").tag("hd")
                Text("4K").tag("4k")
            }
            Toggle("Autoplay next", isOn: $autoplay)
        }
    }
}
```

```swift:test
import XCTest
import SwiftUI

final class Tests: XCTestCase {
    func testSettingsBuilds() {
        XCTAssertNotNil(Settings().body)
    }
}
```

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Build a `SearchView` with a `searchable` query bound to `@State`. On query change, filter a fixed `[String]` of titles and display matches.

```swift:starter
import SwiftUI

struct SearchView: View {
    let titles: [String]

    var body: some View {
        // TODO
        EmptyView()
    }
}
```

```swift:solution
import SwiftUI

struct SearchView: View {
    let titles: [String]
    @State private var query = ""

    var matches: [String] {
        query.isEmpty ? titles : titles.filter { $0.localizedCaseInsensitiveContains(query) }
    }

    var body: some View {
        NavigationStack {
            List(matches, id: \.self) { Text($0) }
                .searchable(text: $query)
        }
    }
}
```

```swift:test
import XCTest
import SwiftUI

final class Tests: XCTestCase {
    func testSearchBuilds() {
        XCTAssertNotNil(SearchView(titles: ["A", "B"]).body)
    }
}
```

---
type: exercise
kind: fix_bug
pointsMax: 40
language: swift
---
The picker selection does not change anything. Wire it up to the state with the right binding.

```swift:broken
import SwiftUI

struct V: View {
    @State private var pick = "a"
    var body: some View {
        Picker("X", selection: pick) {
            Text("A").tag("a")
            Text("B").tag("b")
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
  "1": ["searchable"]
---
Fill in the modifier that adds a system search bar above the list.

```swift:starter
List(items) { Text($0.title) }
    .___1___(text: $query)
```

---
type: recap
---

## What you learned

**Concepts:** `.searchable(text:)` for the system search bar · `Form` + `Picker` + `Toggle` for settings · `.tag` ties options to selection values · debouncing async search by cancelling prior tasks

**Swift-specific vs other languages:** `Form`'s grouped styling and section visuals are the system-supplied iOS Settings look — no manual table styling required.

**What's next:** Lesson 04 covers animations and transitions — the polish that makes the streaming UI feel alive.
