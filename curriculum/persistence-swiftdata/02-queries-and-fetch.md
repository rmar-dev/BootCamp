---
type: lesson
title: "@Query, Predicates & Sort"
level: intermediate
summary: "The @Query property wrapper, #Predicate macro, and SortDescriptor for filtered, ordered fetches."
---

## @Query

`@Query` declaratively fetches model objects into a view. The view auto-updates when the underlying data changes.

```swift
import SwiftUI
import SwiftData

struct HistoryList: View {
    @Query(sort: \WatchHistoryEntry.watchedAt, order: .reverse)
    private var entries: [WatchHistoryEntry]

    var body: some View {
        List(entries) { entry in
            Text(entry.movieID)
        }
    }
}
```

The wrapper opens a live query — a `context.insert(...)` from another view rerenders this list automatically.

> **Coming from Java:** Closer to Spring Data's `@Query` plus reactive observation than to manual JPQL. The fetch is a view-level dependency; SwiftData diffs results across changes.

---

## #Predicate

Filter with a typed predicate expression.

```swift
@Query(filter: #Predicate<WatchHistoryEntry> { $0.positionSeconds < $0.durationSeconds * 0.95 })
private var unfinished: [WatchHistoryEntry]
```

The macro typechecks the closure body at compile time — referring to a misspelled property fails to compile.

> **What's going on here**
> - `#Predicate<T>` is a macro, not a closure. It generates a serializable predicate the storage engine can run efficiently.
> - You may not call arbitrary Swift functions inside; only operators and a small allowlist of methods.

---

## Dynamic queries

For predicates derived from `@State`, define a child view that takes the value as a parameter and uses it in `init`:

```swift
struct FilteredHistory: View {
    @Query private var entries: [WatchHistoryEntry]

    init(after date: Date) {
        _entries = Query(filter: #Predicate { $0.watchedAt > date })
    }

    var body: some View { /* ... */ EmptyView() }
}
```

The underscore prefix accesses the `@Query`'s storage to reinitialize it.

---
type: exercise
kind: multiple_choice
pointsMax: 10
---
What kind of expression does `#Predicate` accept?

- [ ] An arbitrary Swift closure with full language access.
- [x] A restricted closure body checked at compile time, compiled to a serializable predicate.
- [ ] A SQL string literal.
- [ ] A regular expression.

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Add a `@Query` to `HistoryList` that fetches `WatchHistoryEntry` sorted by `watchedAt` in reverse.

```swift:starter
import SwiftUI
import SwiftData

@Model
final class WatchHistoryEntry {
    var movieID: String
    var watchedAt: Date
    init(movieID: String, watchedAt: Date) { self.movieID = movieID; self.watchedAt = watchedAt }
}

struct HistoryList: View {
    // TODO

    var body: some View {
        // TODO
        EmptyView()
    }
}
```

```swift:solution
import SwiftUI
import SwiftData

@Model
final class WatchHistoryEntry {
    var movieID: String
    var watchedAt: Date
    init(movieID: String, watchedAt: Date) { self.movieID = movieID; self.watchedAt = watchedAt }
}

struct HistoryList: View {
    @Query(sort: \WatchHistoryEntry.watchedAt, order: .reverse)
    private var entries: [WatchHistoryEntry]

    var body: some View {
        List(entries) { entry in
            Text(entry.movieID)
        }
    }
}
```

```swift:test
import XCTest
import SwiftUI

final class Tests: XCTestCase {
    func testHistoryListBuilds() {
        XCTAssertNotNil(HistoryList().body)
    }
}
```

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Add a `@Query` filter for `WatchHistoryEntry` whose `positionSeconds` is greater than zero (still in progress).

```swift:starter
import SwiftUI
import SwiftData

@Model
final class WatchHistoryEntry {
    var movieID: String
    var positionSeconds: Double
    init(movieID: String, positionSeconds: Double) {
        self.movieID = movieID
        self.positionSeconds = positionSeconds
    }
}

struct ContinueWatching: View {
    // TODO

    var body: some View {
        // TODO
        EmptyView()
    }
}
```

```swift:solution
import SwiftUI
import SwiftData

@Model
final class WatchHistoryEntry {
    var movieID: String
    var positionSeconds: Double
    init(movieID: String, positionSeconds: Double) {
        self.movieID = movieID
        self.positionSeconds = positionSeconds
    }
}

struct ContinueWatching: View {
    @Query(filter: #Predicate<WatchHistoryEntry> { $0.positionSeconds > 0 })
    private var entries: [WatchHistoryEntry]

    var body: some View {
        List(entries) { Text($0.movieID) }
    }
}
```

```swift:test
import XCTest
import SwiftUI

final class Tests: XCTestCase {
    func testBuilds() {
        XCTAssertNotNil(ContinueWatching().body)
    }
}
```

---
type: exercise
kind: fix_bug
pointsMax: 40
language: swift
---
The query sorts in the wrong direction. Reverse it.

```swift:broken
import SwiftUI
import SwiftData

@Model
final class Entry {
    var date: Date
    init(date: Date) { self.date = date }
}

struct V: View {
    @Query(sort: \Entry.date) private var entries: [Entry]
    var body: some View { List(entries) { Text("\($0.date)") } }
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
  "1": ["Query"]
---
Fill in the property wrapper that opens a live, view-bound fetch.

```swift:starter
@___1___ private var movies: [Movie]
```

---
type: recap
---

## What you learned

**Concepts:** `@Query` declares a live, view-bound fetch · `#Predicate<T>` for type-checked filters · `sort:` + `order:` for ordering · re-init `_query = Query(...)` in a child view's `init` for dynamic predicates

**Swift-specific vs other languages:** Auto-update of the view on data changes is a built-in feature, no manual subscription. Compared to Realm's auto-updating results, SwiftData's `@Query` is tied to the view's render lifecycle.

**What's next:** Lesson 03 covers relationships and cascading deletes.
