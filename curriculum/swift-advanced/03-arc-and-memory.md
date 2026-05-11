---
type: lesson
title: ARC, Capture Lists & Reference Cycles
level: intermediate
summary: How ARC counts references, when cycles form, and how `weak` / `unowned` capture lists break them.
---

## ARC

Swift uses Automatic Reference Counting for class instances. Every strong reference increments the count; when it drops to zero the instance is deallocated. Value types (struct, enum) are not ref-counted — they are copied.

```swift
final class Player {
    let id: String
    init(id: String) { self.id = id }
    deinit { print("deinit \(id)") }
}

var a: Player? = Player(id: "main")
var b = a            // ref count: 2
a = nil              // ref count: 1
b = nil              // ref count: 0 → deinit prints
```

> **Coming from Java:** Java uses tracing GC; Swift uses ARC. The cost model differs — Swift's deallocation is deterministic (when the last reference drops), but cycles do not get collected. You must break them yourself.

---

## Reference cycles

Two classes that strongly reference each other form a cycle. Neither's count can reach zero, so neither deinitializes.

```swift
final class Asset {
    var owner: AssetOwner?
}
final class AssetOwner {
    var asset: Asset?
}

let a = Asset()
let o = AssetOwner()
a.owner = o
o.asset = a
// neither will deinit when a and o leave scope — leak
```

The same pattern appears with closures: a closure stored on `self` that captures `self` strongly forms a cycle.

---

## Capture lists: `weak` and `unowned`

`weak` makes the captured reference an `Optional` that becomes `nil` when the target deallocates. `unowned` is non-optional and crashes if accessed after deallocation — use only when the target is guaranteed to outlive the closure.

```swift
final class PlayerView {
    var onTap: (() -> Void)?
    let id: String
    init(id: String) { self.id = id }

    func wireUp() {
        onTap = { [weak self] in
            guard let self else { return }
            print("tapped \(self.id)")
        }
    }
}
```

> **What's going on here**
> - `[weak self]` — the closure does not retain `self`. If the view deallocates, `self` becomes `nil` inside.
> - `guard let self else { return }` — early-exit unwrap of the weak reference.

---
type: exercise
kind: multiple_choice
pointsMax: 10
---
Which type of reference will become `nil` when its target is deallocated, requiring the user to handle the optional?

- [x] `weak`
- [ ] `unowned`
- [ ] `strong`
- [ ] `inout`

---
type: exercise
kind: fix_bug
pointsMax: 40
language: swift
---
The closure forms a retain cycle with `self`. Fix it with a capture list.

```swift:broken
final class Loader {
    var onLoad: (() -> Void)?
    var name: String = "loader"

    func wire() {
        onLoad = {
            print(self.name)
        }
    }
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testNoCycle() {
        weak var weakRef: Loader?
        do {
            let l = Loader()
            l.wire()
            weakRef = l
        }
        XCTAssertNil(weakRef, "Loader should deallocate; closure must not retain self strongly")
    }
}
```

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Write a `Cache` class that exposes a `set(_:for:)` method and stores values weakly so cached objects can deallocate. Use `NSMapTable` semantics or a manual weak wrapper.

```swift:starter
final class WeakBox<T: AnyObject> {
    weak var value: T?
    init(_ v: T) { self.value = v }
}

final class Cache<T: AnyObject> {
    private var store: [String: WeakBox<T>] = [:]

    func set(_ value: T, for key: String) {
        // TODO
    }

    func get(_ key: String) -> T? {
        // TODO
        return nil
    }
}
```

```swift:solution
final class WeakBox<T: AnyObject> {
    weak var value: T?
    init(_ v: T) { self.value = v }
}

final class Cache<T: AnyObject> {
    private var store: [String: WeakBox<T>] = [:]

    func set(_ value: T, for key: String) {
        store[key] = WeakBox(value)
    }

    func get(_ key: String) -> T? {
        store[key]?.value
    }
}
```

```swift:test
import XCTest

final class Item { let name: String; init(_ n: String) { name = n } }

final class Tests: XCTestCase {
    func testCacheReleasesAfterRefDrops() {
        let cache = Cache<Item>()
        do {
            let item = Item("a")
            cache.set(item, for: "k")
            XCTAssertNotNil(cache.get("k"))
        }
        XCTAssertNil(cache.get("k"))
    }
}
```

---
type: exercise
kind: fill_blank
pointsMax: 20
language: swift
blanks:
  "1": ["weak"]
---
Pick the capture qualifier that prevents the closure from retaining `self`.

```swift:starter
button.onTap = { [___1___ self] in
    self?.handle()
}
```

---
type: exercise
kind: predict_output
pointsMax: 15
language: swift
expectedOutput: "deinit"
---
What does this print?

```swift:starter
final class Box {
    deinit { print("deinit") }
}
do {
    let b = Box()
    _ = b
}
```

---
type: recap
---

## What you learned

**Concepts:** ARC reference counting · reference cycles between classes and via closures · `weak` (optional, auto-nils) · `unowned` (non-optional, crashes if dangling) · capture lists `[weak self]`

**Swift-specific vs other languages:** Java GC collects cycles transparently; Swift requires you to break them manually with `weak`/`unowned`. Value types (structs) are not ref-counted at all.

**What's next:** Lesson 04 introduces structured concurrency — task trees, cancellation, and actors.
