---
type: lesson
title: List & Identifiable
level: beginner
summary: List, ForEach, Identifiable, and row deletion / reordering for the watch-history screen.
---

## List + Identifiable

`List` produces a scrollable, native-styled vertical list. Items must be `Identifiable` (or you supply a key path).

```swift
struct Movie: Identifiable {
    let id: String
    let title: String
}

struct History: View {
    let movies: [Movie]

    var body: some View {
        List(movies) { movie in
            Text(movie.title)
        }
    }
}
```

> **Coming from Python:** Closer to a Jinja `{% for %}` template than a manual loop. `List` rebuilds rows from the data; you do not manage row lifecycle.

---

## ForEach inside List

When the list also has static rows or sections, switch to `ForEach`:

```swift
List {
    Section("Continue Watching") {
        ForEach(continueWatching) { movie in
            Row(movie: movie)
        }
    }
    Section("Recommended") {
        ForEach(recommended) { movie in
            Row(movie: movie)
        }
    }
}
```

---

## Swipe actions & deletion

Provide swipe actions per row, or `onDelete` for the whole list.

```swift
List {
    ForEach(items) { item in
        Text(item.title)
            .swipeActions {
                Button("Remove", role: .destructive) { remove(item) }
            }
    }
    .onDelete { offsets in items.remove(atOffsets: offsets) }
}
```

> **What's going on here**
> - `role: .destructive` styles the action red and gives it the standard delete affordance.
> - `onDelete { offsets in ... }` enables the standard left-swipe-to-delete and the edit-mode minus button.

---
type: exercise
kind: multiple_choice
pointsMax: 10
---
What does `List` require of its row data when used as `List(items) { ... }`?

- [x] Each item must be `Identifiable`.
- [ ] Each item must be a class.
- [ ] Each item must conform to `View`.
- [ ] Each item must be `Codable`.

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Build a `WatchHistory` view that takes `[Movie]` and shows each title in a row.

```swift:starter
import SwiftUI

struct Movie: Identifiable {
    let id: String
    let title: String
}

struct WatchHistory: View {
    let movies: [Movie]

    var body: some View {
        // TODO
        EmptyView()
    }
}
```

```swift:solution
import SwiftUI

struct Movie: Identifiable {
    let id: String
    let title: String
}

struct WatchHistory: View {
    let movies: [Movie]

    var body: some View {
        List(movies) { movie in
            Text(movie.title)
        }
    }
}
```

```swift:test
import XCTest
import SwiftUI

final class Tests: XCTestCase {
    func testHistoryBuilds() {
        let h = WatchHistory(movies: [Movie(id: "1", title: "A")])
        XCTAssertNotNil(h.body)
    }
}
```

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Build a list with two sections: "Continue" and "Recommended", each holding `[Movie]`.

```swift:starter
import SwiftUI

struct Movie: Identifiable {
    let id: String
    let title: String
}

struct Browse: View {
    let continueWatching: [Movie]
    let recommended: [Movie]

    var body: some View {
        // TODO
        EmptyView()
    }
}
```

```swift:solution
import SwiftUI

struct Movie: Identifiable {
    let id: String
    let title: String
}

struct Browse: View {
    let continueWatching: [Movie]
    let recommended: [Movie]

    var body: some View {
        List {
            Section("Continue") {
                ForEach(continueWatching) { Text($0.title) }
            }
            Section("Recommended") {
                ForEach(recommended) { Text($0.title) }
            }
        }
    }
}
```

```swift:test
import XCTest
import SwiftUI

final class Tests: XCTestCase {
    func testBrowseBuilds() {
        XCTAssertNotNil(Browse(continueWatching: [], recommended: []).body)
    }
}
```

---
type: exercise
kind: fix_bug
pointsMax: 40
language: swift
---
The list does not compile because the row type lacks an identity. Add the right conformance.

```swift:broken
import SwiftUI

struct Movie {
    let title: String
}

struct V: View {
    let movies: [Movie]
    var body: some View {
        List(movies) { Text($0.title) }
    }
}
```

```swift:test
import XCTest
import SwiftUI

final class Tests: XCTestCase {
    func testVBuilds() {
        XCTAssertNotNil(V(movies: []).body)
    }
}
```

---
type: exercise
kind: fill_blank
pointsMax: 20
language: swift
blanks:
  "1": ["destructive"]
---
Fill in the role that gives a swipe button the standard red destructive styling.

```swift:starter
Button("Remove", role: .___1___) { /* ... */ }
```

---
type: recap
---

## What you learned

**Concepts:** `List(data) { row }` requires `Identifiable` · `ForEach` for embedded loops · `Section` headers · `swipeActions` and `onDelete` for row mutations

**Swift-specific vs other languages:** Lists are *data-driven* — you describe rows from the array; the framework reconciles row identity to drive enter/leave animations. No table-view delegate required.

**What's next:** Lesson 02 covers `LazyVGrid` and `ScrollView` paging for poster grids.
