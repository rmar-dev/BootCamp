---
type: lesson
title: Environment, View Styles & Theme
level: beginner
summary: The Environment system, custom EnvironmentKeys, and how built-in styles cascade through the view tree.
---

## Environment values

`@Environment(\.colorScheme)` reads a value the framework injects from above. `colorScheme`, `dismiss`, `openURL`, `dynamicTypeSize` are common.

```swift
struct Title: View {
    @Environment(\.colorScheme) var scheme

    var body: some View {
        Text("Streaming")
            .foregroundStyle(scheme == .dark ? .white : .black)
    }
}
```

> **Coming from C++:** Think *thread-local storage*, but scoped to a region of the view tree instead of a thread. A parent sets a value with `.environment(...)`; descendants read it with `@Environment(...)`.

---

## Custom environment keys

For app-wide values (theme tokens, services), define a key.

```swift
private struct AccentTintKey: EnvironmentKey {
    static let defaultValue: Color = .blue
}

extension EnvironmentValues {
    var accentTint: Color {
        get { self[AccentTintKey.self] }
        set { self[AccentTintKey.self] = newValue }
    }
}
```

Inject from the parent:

```swift
ContentView()
    .environment(\.accentTint, .red)
```

---

## View styles

Built-in protocols `ButtonStyle`, `LabelStyle`, `ProgressViewStyle` decouple appearance from structure. Set them at any level; descendants inherit.

```swift
VStack {
    Button("Play") { }
    Button("Add") { }
}
.buttonStyle(.borderedProminent)
```

> **What's going on here**
> - `.buttonStyle(...)` cascades down the tree. Any `Button` below uses the style unless it sets its own.

---
type: exercise
kind: multiple_choice
pointsMax: 10
---
How does an `@Environment` value reach a child view?

- [x] A parent injects it with `.environment(...)`; descendants read it through the environment.
- [ ] It is passed as a constructor parameter to every view.
- [ ] It is stored in a global singleton.
- [ ] It is fetched via a synchronous network call.

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Define a custom environment key `mediaQuality` of type `String` with default `"sd"`. Expose it via an `EnvironmentValues` extension.

```swift:starter
import SwiftUI

// TODO: define MediaQualityKey and the extension
```

```swift:solution
import SwiftUI

private struct MediaQualityKey: EnvironmentKey {
    static let defaultValue: String = "sd"
}

extension EnvironmentValues {
    var mediaQuality: String {
        get { self[MediaQualityKey.self] }
        set { self[MediaQualityKey.self] = newValue }
    }
}
```

```swift:test
import XCTest
import SwiftUI

final class Tests: XCTestCase {
    func testDefaultQuality() {
        let env = EnvironmentValues()
        XCTAssertEqual(env.mediaQuality, "sd")
    }
}
```

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Build a `ThemedTitle` view that renders white text in dark mode and black text otherwise, reading from `@Environment(\.colorScheme)`.

```swift:starter
import SwiftUI

struct ThemedTitle: View {
    let text: String

    var body: some View {
        // TODO
        EmptyView()
    }
}
```

```swift:solution
import SwiftUI

struct ThemedTitle: View {
    @Environment(\.colorScheme) private var scheme
    let text: String

    var body: some View {
        Text(text)
            .foregroundStyle(scheme == .dark ? .white : .black)
    }
}
```

```swift:test
import XCTest
import SwiftUI

final class Tests: XCTestCase {
    func testThemedTitleBuilds() {
        XCTAssertNotNil(ThemedTitle(text: "Hi").body)
    }
}
```

---
type: exercise
kind: fix_bug
pointsMax: 40
language: swift
---
The button styling is not being applied. Apply the style at the stack level so it cascades to both buttons.

```swift:broken
import SwiftUI

struct Toolbar: View {
    var body: some View {
        HStack {
            Button("Play") {}
            Button("Add") {}
        }
    }
}
```

```swift:test
import XCTest
import SwiftUI

final class Tests: XCTestCase {
    func testToolbarBuilds() {
        XCTAssertNotNil(Toolbar().body)
    }
}
```

---
type: exercise
kind: fill_blank
pointsMax: 20
language: swift
blanks:
  "1": ["Environment"]
---
Fill in the property wrapper that reads a value the parent injected.

```swift:starter
struct V: View {
    @___1___(\.colorScheme) var scheme
    var body: some View { Text("\(String(describing: scheme))") }
}
```

---
type: recap
---

## What you learned

**Concepts:** `@Environment(\.key)` for scoped value injection · custom `EnvironmentKey` + `EnvironmentValues` extension · cascading view styles via `.buttonStyle`, `.labelStyle`

**Swift-specific vs other languages:** Closer to React Context than to UIKit's appearance proxies. Values flow down the tree; setting them at a parent affects all descendants without a global.

**What's next:** Week 4 introduces stateful SwiftUI: `@State`, `@Binding`, `@Observable`, and `NavigationStack` — the spine of an app shell.
