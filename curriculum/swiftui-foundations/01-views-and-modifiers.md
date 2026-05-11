---
type: lesson
title: Views & Modifiers
level: beginner
summary: The View protocol, view trees, and the modifier chain pattern.
---

## The View protocol

Every SwiftUI view is a value type that conforms to `View` and exposes a single `body` of type `some View`. The framework re-evaluates `body` whenever inputs change.

```swift
import SwiftUI

struct Title: View {
    var body: some View {
        Text("Streaming")
            .font(.largeTitle)
            .foregroundStyle(.white)
    }
}
```

> **Coming from Python:** SwiftUI views are not objects you mutate. Each render is a *value* describing what the screen should look like — closer to React function components than to a Tkinter widget tree.

---

## Modifiers return new views

Each `.font(...)`, `.padding(...)`, `.foregroundStyle(...)` call wraps the receiver in a new view. Modifier order matters.

```swift
Text("Now Playing")
    .padding()
    .background(.black)        // black extends across padded area

Text("Now Playing")
    .background(.black)        // black is tight to the text
    .padding()                 // padding adds clear space outside the black
```

> **What's going on here**
> - `.padding()` and `.background(.black)` each return a new wrapped view. Reordering them changes the wrapping, and therefore the rendered geometry.

---

## Composing views

Pull repeated UI into a custom `View`. Pass dependencies as parameters.

```swift
struct Tag: View {
    let label: String

    var body: some View {
        Text(label)
            .font(.caption)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(.white.opacity(0.15), in: .capsule)
    }
}
```

The `some View` opaque return is the same `some` from the protocols lesson — the body's concrete type is hidden but fixed.

---
type: exercise
kind: multiple_choice
pointsMax: 10
---
What does `body` return in a SwiftUI view?

- [ ] A `UIView` instance.
- [x] An opaque `some View` describing the rendered tree.
- [ ] A void closure executed on render.
- [ ] A `String` of HTML.

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Build a `Badge` view that takes a `text` parameter, displays it in a rounded blue capsule with white foreground and 8pt horizontal padding.

```swift:starter
import SwiftUI

struct Badge: View {
    let text: String

    var body: some View {
        // TODO
        EmptyView()
    }
}
```

```swift:solution
import SwiftUI

struct Badge: View {
    let text: String

    var body: some View {
        Text(text)
            .foregroundStyle(.white)
            .padding(.horizontal, 8)
            .background(.blue, in: .capsule)
    }
}
```

```swift:test
import XCTest
import SwiftUI

final class Tests: XCTestCase {
    func testBadgeBuilds() {
        let b = Badge(text: "HD")
        // Smoke check: the view value can be constructed without runtime error.
        XCTAssertNotNil(b.body)
    }
}
```

---
type: exercise
kind: fix_bug
pointsMax: 40
language: swift
---
The view does not compile because `body` is missing its return type. Fix it.

```swift:broken
import SwiftUI

struct Card: View {
    var body {
        Text("Movie")
    }
}
```

```swift:test
import XCTest
import SwiftUI

final class Tests: XCTestCase {
    func testCardBuilds() {
        let c = Card()
        XCTAssertNotNil(c.body)
    }
}
```

---
type: exercise
kind: fill_blank
pointsMax: 20
language: swift
blanks:
  "1": ["some"]
---
Fill in the keyword that gives `body` an opaque return type.

```swift:starter
struct Title: View {
    var body: ___1___ View {
        Text("Title")
    }
}
```

---
type: exercise
kind: predict_output
pointsMax: 15
language: swift
expectedOutput: "12"
---
What does this print? Reason about the SwiftUI modifier chain returning a wrapper view.

```swift:starter
let radius: CGFloat = 12
print(Int(radius))
```

---
type: recap
---

## What you learned

**Concepts:** View protocol with `some View` body · modifier chain returns a new wrapper view · composition by extracting custom views · order-sensitivity of modifiers

**Swift-specific vs other languages:** SwiftUI is closer to React function components than to UIKit's mutable view hierarchy. Each render builds a fresh value tree; the framework diffs it against the previous one.

**What's next:** Lesson 02 covers HStack/VStack/ZStack and how SwiftUI lays out children.
