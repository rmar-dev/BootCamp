---
type: lesson
title: NavigationStack & Typed Routing
level: intermediate
summary: NavigationStack with value-based path, typed destinations, and programmatic navigation.
---

## NavigationStack with values

`NavigationStack` paired with `navigationDestination(for:)` gives a typed, value-based push API.

```swift
struct Browse: View {
    let movies: [Movie] = []

    var body: some View {
        NavigationStack {
            List(movies) { movie in
                NavigationLink(value: movie) {
                    Text(movie.title)
                }
            }
            .navigationDestination(for: Movie.self) { movie in
                MovieDetail(movie: movie)
            }
        }
    }
}
```

The destination is matched by value type. Pushing `Episode.self` shows a different screen — same stack, same modifier API.

> **Coming from Java:** Closer to typed Compose Navigation than to a UIKit `UINavigationController`. The screen graph is value-typed, not based on string routes.

---

## Programmatic navigation

Bind a `path: [Route]` to drive navigation from code (e.g. after a deep link arrives).

```swift
@State private var path: [Movie] = []

var body: some View {
    NavigationStack(path: $path) {
        // ...
    }
    .onAppear { path = [favorite] }   // pushes MovieDetail
}
```

For multi-type stacks, use `NavigationPath`:

```swift
@State private var path = NavigationPath()
path.append(Movie(...))
path.append(Episode(...))
```

> **What's going on here**
> - `NavigationPath` is a type-erased stack. It accepts any `Hashable` value. The matching `navigationDestination(for:)` modifier resolves it.

---

## Hashable requirement

Destinations must conform to `Hashable`. For value types of plain stored properties, that is auto-synthesized.

```swift
struct Movie: Identifiable, Hashable {
    let id: String
    let title: String
}
```

---
type: exercise
kind: multiple_choice
pointsMax: 10
---
What does `navigationDestination(for: Movie.self)` resolve against?

- [ ] The view's parent route name.
- [x] The value type pushed onto the stack — matched by `.self`.
- [ ] A URL path component.
- [ ] A storyboard segue identifier.

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Build a `Browse` view with a list of two `Movie` values. Tapping a row pushes a `MovieDetail` showing the title. Use `NavigationStack` and `navigationDestination(for:)`.

```swift:starter
import SwiftUI

struct Movie: Identifiable, Hashable {
    let id: String
    let title: String
}

struct MovieDetail: View {
    let movie: Movie
    var body: some View { Text(movie.title) }
}

struct Browse: View {
    var body: some View {
        // TODO
        EmptyView()
    }
}
```

```swift:solution
import SwiftUI

struct Movie: Identifiable, Hashable {
    let id: String
    let title: String
}

struct MovieDetail: View {
    let movie: Movie
    var body: some View { Text(movie.title) }
}

struct Browse: View {
    let movies: [Movie] = [
        Movie(id: "1", title: "Inception"),
        Movie(id: "2", title: "Interstellar"),
    ]

    var body: some View {
        NavigationStack {
            List(movies) { movie in
                NavigationLink(value: movie) {
                    Text(movie.title)
                }
            }
            .navigationDestination(for: Movie.self) { movie in
                MovieDetail(movie: movie)
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
        XCTAssertNotNil(Browse().body)
    }
}
```

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Add a button to `Home` that programmatically pushes a `Movie` onto the stack via a bound `path`.

```swift:starter
import SwiftUI

struct Movie: Hashable { let id: String }

struct Home: View {
    @State private var path: [Movie] = []

    var body: some View {
        NavigationStack(path: $path) {
            VStack {
                Button("Open Featured") {
                    // TODO
                }
            }
            .navigationDestination(for: Movie.self) { movie in
                Text(movie.id)
            }
        }
    }
}
```

```swift:solution
import SwiftUI

struct Movie: Hashable { let id: String }

struct Home: View {
    @State private var path: [Movie] = []

    var body: some View {
        NavigationStack(path: $path) {
            VStack {
                Button("Open Featured") {
                    path.append(Movie(id: "feat-1"))
                }
            }
            .navigationDestination(for: Movie.self) { movie in
                Text(movie.id)
            }
        }
    }
}
```

```swift:test
import XCTest
import SwiftUI

final class Tests: XCTestCase {
    func testHomeBuilds() {
        XCTAssertNotNil(Home().body)
    }
}
```

---
type: exercise
kind: fix_bug
pointsMax: 40
language: swift
---
The push value will not compile because the type is not `Hashable`. Make it conform.

```swift:broken
import SwiftUI

struct Movie {
    let id: String
}

struct Browse: View {
    var body: some View {
        NavigationStack {
            NavigationLink(value: Movie(id: "1")) { Text("Open") }
                .navigationDestination(for: Movie.self) { _ in Text("Detail") }
        }
    }
}
```

```swift:test
import XCTest
import SwiftUI

final class Tests: XCTestCase {
    func testBrowseBuilds() {
        XCTAssertNotNil(Browse().body)
    }
}
```

---
type: exercise
kind: fill_blank
pointsMax: 20
language: swift
blanks:
  "1": ["NavigationStack"]
---
Fill in the container that hosts a typed navigation path.

```swift:starter
___1___ {
    NavigationLink(value: 42) { Text("Push") }
        .navigationDestination(for: Int.self) { Text("\($0)") }
}
```

---
type: recap
---

## What you learned

**Concepts:** `NavigationStack` value-based pushes · `navigationDestination(for:)` matches by type · `path: [Route]` and `NavigationPath` for programmatic navigation · destinations must be `Hashable`

**Swift-specific vs other languages:** Closer to Jetpack Compose Navigation than to UIKit segues. The screen graph is described as value-type bindings, not string identifiers.

**What's next:** Lesson 04 introduces `TabView` and deep-link handling — the streaming app uses both.
