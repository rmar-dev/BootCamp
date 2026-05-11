---
type: lesson
title: Relationships & Cascading Deletes
level: intermediate
summary: "@Relationship deleteRule, inverse relationships, and the unique attribute."
---

## Relationships

Annotate a property with `@Relationship` to declare an association. Provide `deleteRule:` to control cascading.

```swift
@Model
final class Show {
    @Attribute(.unique) var id: String
    var title: String

    @Relationship(deleteRule: .cascade, inverse: \Episode.show)
    var episodes: [Episode] = []

    init(id: String, title: String) {
        self.id = id
        self.title = title
    }
}

@Model
final class Episode {
    var number: Int
    var title: String
    var show: Show?

    init(number: Int, title: String, show: Show? = nil) {
        self.number = number
        self.title = title
        self.show = show
    }
}
```

`.cascade` deletes the children when the parent is deleted. `.nullify` keeps them but clears the back-reference. `.deny` blocks the parent's delete while children exist.

> **Coming from Java:** `deleteRule: .cascade` is JPA's `cascade = CascadeType.REMOVE`. Inverse declaration is the equivalent of `mappedBy` — SwiftData uses the key path explicitly.

---

## .unique

`@Attribute(.unique)` enforces a unique index. Inserting a duplicate throws on save.

```swift
@Attribute(.unique) var id: String
```

Use it for natural keys (movie IDs from the API). Surrogate auto-generated IDs do not need it — SwiftData's `PersistentIdentifier` is internal.

---

## Deleting

`context.delete(_:)` schedules a delete; `save()` commits.

```swift
context.delete(show)
try context.save()
// All Episode instances whose show.id == show.id are also deleted (cascade).
```

> **What's going on here**
> - The `inverse: \Episode.show` parameter tells SwiftData both ends of the relationship. Without it, the engine cannot route updates correctly when only one side is mutated.

---
type: exercise
kind: multiple_choice
pointsMax: 10
---
What does `deleteRule: .cascade` do when a `Show` is deleted?

- [ ] Keeps episodes; clears their `show` reference.
- [x] Deletes all related `Episode` instances along with the show.
- [ ] Refuses to delete the show while episodes exist.
- [ ] Marks the show as soft-deleted but keeps it queryable.

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Define a `Playlist` model with a unique `id`, a `name`, and a one-to-many `movies: [PlaylistEntry]` relationship that cascades deletes.

```swift:starter
import SwiftData
import Foundation

// TODO: Playlist + PlaylistEntry

@Model
final class PlaylistEntry {
    var movieID: String
    init(movieID: String) { self.movieID = movieID }
}
```

```swift:solution
import SwiftData
import Foundation

@Model
final class Playlist {
    @Attribute(.unique) var id: String
    var name: String

    @Relationship(deleteRule: .cascade, inverse: \PlaylistEntry.playlist)
    var movies: [PlaylistEntry] = []

    init(id: String, name: String) {
        self.id = id
        self.name = name
    }
}

@Model
final class PlaylistEntry {
    var movieID: String
    var playlist: Playlist?

    init(movieID: String) {
        self.movieID = movieID
    }
}
```

```swift:test
import XCTest
import SwiftData

final class Tests: XCTestCase {
    func testInit() {
        let p = Playlist(id: "p1", name: "Favorites")
        XCTAssertEqual(p.id, "p1")
    }
}
```

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Add an inverse to `Episode.show` for the `Show.episodes` relationship.

```swift:starter
import SwiftData
import Foundation

@Model
final class Show {
    @Attribute(.unique) var id: String
    var title: String

    @Relationship(deleteRule: .cascade)
    var episodes: [Episode] = []

    init(id: String, title: String) {
        self.id = id
        self.title = title
    }
}

@Model
final class Episode {
    var number: Int
    var show: Show?

    init(number: Int) { self.number = number }
}
```

```swift:solution
import SwiftData
import Foundation

@Model
final class Show {
    @Attribute(.unique) var id: String
    var title: String

    @Relationship(deleteRule: .cascade, inverse: \Episode.show)
    var episodes: [Episode] = []

    init(id: String, title: String) {
        self.id = id
        self.title = title
    }
}

@Model
final class Episode {
    var number: Int
    var show: Show?

    init(number: Int) { self.number = number }
}
```

```swift:test
import XCTest
import SwiftData

final class Tests: XCTestCase {
    func testShowInit() {
        let s = Show(id: "s1", title: "Show A")
        XCTAssertEqual(s.episodes.count, 0)
    }
}
```

---
type: exercise
kind: fix_bug
pointsMax: 40
language: swift
---
The unique constraint on `movieID` is missing — duplicate IDs slip in. Add the right attribute.

```swift:broken
import SwiftData
import Foundation

@Model
final class Bookmark {
    var movieID: String
    init(movieID: String) { self.movieID = movieID }
}
```

```swift:test
import XCTest
import SwiftData

final class Tests: XCTestCase {
    func testInit() {
        let b = Bookmark(movieID: "m1")
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
  "1": ["nullify"]
---
Fill in the delete rule that clears the back-reference but keeps the children.

```swift:starter
@Relationship(deleteRule: .___1___) var episodes: [Episode] = []
```

---
type: recap
---

## What you learned

**Concepts:** `@Relationship(deleteRule:inverse:)` for typed associations · `.cascade` / `.nullify` / `.deny` semantics · `@Attribute(.unique)` for uniqueness · always declare the `inverse:` to keep both sides consistent

**Swift-specific vs other languages:** SwiftData's relationship API is closer to Core Data's NSManagedObject relationships than to Realm's, but with compile-time key paths instead of strings.

**What's next:** Lesson 04 covers `UserDefaults` for small key-value preferences and the file system for downloaded assets.
