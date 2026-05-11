---
type: lesson
title: Tabs & Deep Links
level: intermediate
summary: TabView, programmatic tab selection, and handling deep-link URLs.
---

## TabView

`TabView` displays children as siblings; the user switches with the tab bar. Bind a selection to drive it from code.

```swift
enum Tab: Hashable { case home, library, search }

struct AppShell: View {
    @State private var tab: Tab = .home

    var body: some View {
        TabView(selection: $tab) {
            HomeView()
                .tabItem { Label("Home", systemImage: "house") }
                .tag(Tab.home)

            LibraryView()
                .tabItem { Label("Library", systemImage: "rectangle.stack") }
                .tag(Tab.library)

            SearchView()
                .tabItem { Label("Search", systemImage: "magnifyingglass") }
                .tag(Tab.search)
        }
    }
}
```

The `tag` value must match the `selection` type.

> **Coming from C++:** Closer to a Qt `QTabWidget` than to anything in standard C++. The selection is bound, not commanded — change the bound value, the tab follows.

---

## onOpenURL

The system delivers deep-link URLs to the root view via `.onOpenURL { url in ... }`. Parse, then mutate state.

```swift
.onOpenURL { url in
    guard url.host == "movie",
          let id = url.pathComponents.dropFirst().first else { return }
    tab = .library
    libraryPath.append(Movie(id: id))
}
```

> **What's going on here**
> - `url.pathComponents.dropFirst()` skips the leading `/`. The first remaining component is the id.
> - Switching the tab and pushing onto the path together delivers the user from any state to the deep-linked screen.

---

## URL scheme registration

Register a custom scheme (`mystream://`) or a Universal Link (`https://stream.example.com/movie/...`) in the Info.plist / associated domains. The handler is the same: `onOpenURL`.

---
type: exercise
kind: multiple_choice
pointsMax: 10
---
How does a child view declare itself as the destination for a `TabView` selection?

- [ ] By overriding `tabIndex`.
- [x] By calling `.tag(value)` with a value matching the selection type.
- [ ] By naming the view with the selection key.
- [ ] By placing it first in the tab list.

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Build an `AppShell` with three tabs (Home, Library, Search), each labeled with an SF Symbol. Selection state is `enum Tab` with three cases.

```swift:starter
import SwiftUI

enum Tab: Hashable { case home, library, search }

struct AppShell: View {
    var body: some View {
        // TODO
        EmptyView()
    }
}
```

```swift:solution
import SwiftUI

enum Tab: Hashable { case home, library, search }

struct AppShell: View {
    @State private var tab: Tab = .home

    var body: some View {
        TabView(selection: $tab) {
            Text("Home")
                .tabItem { Label("Home", systemImage: "house") }
                .tag(Tab.home)
            Text("Library")
                .tabItem { Label("Library", systemImage: "rectangle.stack") }
                .tag(Tab.library)
            Text("Search")
                .tabItem { Label("Search", systemImage: "magnifyingglass") }
                .tag(Tab.search)
        }
    }
}
```

```swift:test
import XCTest
import SwiftUI

final class Tests: XCTestCase {
    func testAppShellBuilds() {
        XCTAssertNotNil(AppShell().body)
    }
}
```

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Write a function `parseMovieDeepLink(_ url: URL) -> String?` that extracts the movie id from `mystream://movie/<id>`. Return `nil` for any other URL shape.

```swift:starter
import Foundation

func parseMovieDeepLink(_ url: URL) -> String? {
    // TODO
    return nil
}
```

```swift:solution
import Foundation

func parseMovieDeepLink(_ url: URL) -> String? {
    guard url.scheme == "mystream", url.host == "movie" else { return nil }
    let parts = url.pathComponents.filter { $0 != "/" }
    return parts.first
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testParsesValid() {
        let url = URL(string: "mystream://movie/tt-001")!
        XCTAssertEqual(parseMovieDeepLink(url), "tt-001")
    }
    func testRejectsScheme() {
        let url = URL(string: "https://movie/tt-001")!
        XCTAssertNil(parseMovieDeepLink(url))
    }
    func testRejectsMissingId() {
        let url = URL(string: "mystream://movie/")!
        XCTAssertNil(parseMovieDeepLink(url))
    }
}
```

---
type: exercise
kind: fix_bug
pointsMax: 40
language: swift
---
The tab selection does not switch tabs. Fix the binding.

```swift:broken
import SwiftUI

struct Shell: View {
    @State private var tab = 0

    var body: some View {
        TabView(selection: tab) {
            Text("A").tabItem { Text("A") }.tag(0)
            Text("B").tabItem { Text("B") }.tag(1)
        }
    }
}
```

```swift:test
import XCTest
import SwiftUI

final class Tests: XCTestCase {
    func testShellBuilds() {
        XCTAssertNotNil(Shell().body)
    }
}
```

---
type: exercise
kind: fill_blank
pointsMax: 20
language: swift
blanks:
  "1": ["onOpenURL"]
---
Fill in the modifier that delivers an incoming deep-link URL to a view.

```swift:starter
ContentView()
    .___1___ { url in
        // handle url
    }
```

---
type: recap
---

## What you learned

**Concepts:** `TabView` with `selection: $tab` · `.tag(value)` to match the selection type · `.onOpenURL` to receive deep links · combining tab switch + path push to deliver users to deep-linked content

**Swift-specific vs other languages:** Selection-driven UI is the Swift idiom. Instead of telling the tab bar to switch, you change the value and let the framework reconcile.

**What's next:** Week 5 introduces `List`, `LazyVGrid`, forms, and animations — the catalog browsing surface of the streaming app.
