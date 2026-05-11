---
type: lesson
title: SwiftData Models & Container
level: intermediate
summary: "@Model macro, ModelContainer, ModelContext, and the modelContainer view modifier."
---

## @Model

Annotate a final class with `@Model` to declare a SwiftData entity. Stored properties become persisted attributes.

```swift
import SwiftData

@Model
final class WatchHistoryEntry {
    var movieID: String
    var watchedAt: Date
    var positionSeconds: Double

    init(movieID: String, watchedAt: Date, positionSeconds: Double) {
        self.movieID = movieID
        self.watchedAt = watchedAt
        self.positionSeconds = positionSeconds
    }
}
```

`@Model` generates the persistence machinery and conforms the class to `Observable` so views update when fields change.

> **Coming from Java:** Closer to a JPA `@Entity` than to a hand-rolled DAO. The class is the schema; SwiftData manages the migration story.

---

## ModelContainer & ModelContext

The container holds the schema. The context is the unit of work — inserts, deletes, and saves.

```swift
@main
struct StreamApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
        .modelContainer(for: WatchHistoryEntry.self)
    }
}
```

`.modelContainer(for:)` registers the schema and wires `\.modelContext` into the environment.

---

## Inserting

Inside a view, read the context from the environment, build the model, and insert it.

```swift
struct PlayerView: View {
    @Environment(\.modelContext) private var context
    let movie: Movie

    var body: some View {
        Button("Mark watched") {
            let entry = WatchHistoryEntry(
                movieID: movie.id,
                watchedAt: .now,
                positionSeconds: 0
            )
            context.insert(entry)
            try? context.save()
        }
    }
}
```

> **What's going on here**
> - `context.insert(_:)` stages the entry; it is not visible to queries until the next persistence step.
> - `context.save()` commits to disk. SwiftUI also auto-saves at sensible points; explicit saves are for "must persist now" cases.

---
type: exercise
kind: multiple_choice
pointsMax: 10
---
What does the `@Model` macro generate for an annotated class?

- [ ] A copy-on-write value-type wrapper.
- [x] Persistence attribute storage and an Observable conformance.
- [ ] A SwiftUI `View` body.
- [ ] A serializable Codable mapping.

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Define a SwiftData model `Bookmark` with `movieID: String`, `note: String`, `createdAt: Date`.

```swift:starter
import SwiftData
import Foundation

// TODO
```

```swift:solution
import SwiftData
import Foundation

@Model
final class Bookmark {
    var movieID: String
    var note: String
    var createdAt: Date

    init(movieID: String, note: String, createdAt: Date) {
        self.movieID = movieID
        self.note = note
        self.createdAt = createdAt
    }
}
```

```swift:test
import XCTest
import SwiftData

final class Tests: XCTestCase {
    func testBookmarkInit() {
        let b = Bookmark(movieID: "m1", note: "rewatch", createdAt: .now)
        XCTAssertEqual(b.movieID, "m1")
    }
}
```

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Add an action to a SwiftUI view that inserts a `WatchHistoryEntry` into `\.modelContext` and calls `save()`.

```swift:starter
import SwiftUI
import SwiftData

@Model
final class WatchHistoryEntry {
    var movieID: String
    var watchedAt: Date
    init(movieID: String, watchedAt: Date) {
        self.movieID = movieID
        self.watchedAt = watchedAt
    }
}

struct PlayerView: View {
    let movieID: String

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
    init(movieID: String, watchedAt: Date) {
        self.movieID = movieID
        self.watchedAt = watchedAt
    }
}

struct PlayerView: View {
    @Environment(\.modelContext) private var context
    let movieID: String

    var body: some View {
        Button("Mark watched") {
            context.insert(WatchHistoryEntry(movieID: movieID, watchedAt: .now))
            try? context.save()
        }
    }
}
```

```swift:test
import XCTest
import SwiftUI

final class Tests: XCTestCase {
    func testPlayerViewBuilds() {
        XCTAssertNotNil(PlayerView(movieID: "m1").body)
    }
}
```

---
type: exercise
kind: fix_bug
pointsMax: 40
language: swift
---
The model class lacks the `@Model` macro. Add it.

```swift:broken
import SwiftData
import Foundation

final class Bookmark {
    var movieID: String
    var createdAt: Date
    init(movieID: String, createdAt: Date) {
        self.movieID = movieID
        self.createdAt = createdAt
    }
}
```

```swift:test
import XCTest
import SwiftData

final class Tests: XCTestCase {
    func testBookmarkInit() {
        let b = Bookmark(movieID: "m1", createdAt: .now)
        XCTAssertEqual(b.movieID, "m1")
    }
}
```

---
type: exercise
kind: fill_blank
pointsMax: 20
language: swift
blanks:
  "1": ["modelContext"]
---
Fill in the environment key the view reads to access the SwiftData unit of work.

```swift:starter
@Environment(\.___1___) private var context
```

---
type: recap
---

## What you learned

**Concepts:** `@Model` annotates a final class as a persisted entity · `ModelContainer` registers the schema via `.modelContainer(for:)` · `\.modelContext` is the unit of work · `context.insert(_:)` + `context.save()` for writes

**Swift-specific vs other languages:** SwiftData is a thin layer over Core Data with a Swift-first API. Closer to Realm or Hibernate-with-annotations than to writing SQL by hand.

**What's next:** Lesson 02 covers `@Query` and predicates for reading data into views.
