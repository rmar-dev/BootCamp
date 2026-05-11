---
type: lesson
title: Codable & JSON
level: intermediate
summary: Decodable for incoming JSON, CodingKeys, snake_case strategies, dates, and nested types.
---

## Decodable

Mark a value type `Decodable` (or `Codable`) and JSONDecoder fills it from JSON.

```swift
struct Movie: Decodable {
    let id: String
    let title: String
    let runtimeMinutes: Int
}

let json = """
{ "id": "tt-001", "title": "Inception", "runtimeMinutes": 148 }
""".data(using: .utf8)!

let movie = try JSONDecoder().decode(Movie.self, from: json)
```

Property names map directly to JSON keys.

> **Coming from Java:** Closer to Jackson with `ObjectMapper` than to Gson, but without runtime annotations or reflection — the synthesis is at compile time. Missing keys throw a typed `DecodingError`, not return null.

---

## CodingKeys & key strategies

For non-matching key names, declare a `CodingKeys` enum:

```swift
struct Movie: Decodable {
    let id: String
    let title: String
    let runtimeMinutes: Int

    enum CodingKeys: String, CodingKey {
        case id
        case title
        case runtimeMinutes = "runtime_minutes"
    }
}
```

Or, for a whole-object snake_case API, set the decoder strategy once:

```swift
let decoder = JSONDecoder()
decoder.keyDecodingStrategy = .convertFromSnakeCase
```

> **What's going on here**
> - `.convertFromSnakeCase` rewrites `runtime_minutes` to `runtimeMinutes` automatically. Use it project-wide when the API is consistent.

---

## Dates

Dates require an explicit strategy.

```swift
decoder.dateDecodingStrategy = .iso8601
```

For epoch seconds, use `.secondsSince1970`. Custom formats use `.formatted(DateFormatter)`.

---

## Nested objects & arrays

Compose by referencing another `Decodable` type. Arrays of decodable elements decode as `[T]`.

```swift
struct Catalog: Decodable {
    let movies: [Movie]
}
```

---
type: exercise
kind: multiple_choice
pointsMax: 10
---
What does `keyDecodingStrategy = .convertFromSnakeCase` do?

- [ ] Converts JSON values from snake_case to camelCase strings.
- [x] Maps snake_case JSON keys to camelCase Swift property names automatically.
- [ ] Renames Swift properties at compile time.
- [ ] Lowercases all keys in the JSON before decoding.

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Decode the JSON `{"id":"a","title":"X"}` into a `Movie` struct.

```swift:starter
import Foundation

struct Movie: Decodable {
    let id: String
    let title: String
}

func decodeMovie(_ data: Data) throws -> Movie {
    // TODO
    return Movie(id: "", title: "")
}
```

```swift:solution
import Foundation

struct Movie: Decodable {
    let id: String
    let title: String
}

func decodeMovie(_ data: Data) throws -> Movie {
    try JSONDecoder().decode(Movie.self, from: data)
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testDecode() throws {
        let json = #"{"id":"a","title":"X"}"#.data(using: .utf8)!
        let m = try decodeMovie(json)
        XCTAssertEqual(m.id, "a")
        XCTAssertEqual(m.title, "X")
    }
}
```

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Decode JSON with snake_case keys (`{"id":"a","runtime_minutes":120}`) into a Swift struct with `runtimeMinutes`. Use the snake-case key strategy.

```swift:starter
import Foundation

struct Movie: Decodable {
    let id: String
    let runtimeMinutes: Int
}

func decode(_ data: Data) throws -> Movie {
    // TODO
    return Movie(id: "", runtimeMinutes: 0)
}
```

```swift:solution
import Foundation

struct Movie: Decodable {
    let id: String
    let runtimeMinutes: Int
}

func decode(_ data: Data) throws -> Movie {
    let decoder = JSONDecoder()
    decoder.keyDecodingStrategy = .convertFromSnakeCase
    return try decoder.decode(Movie.self, from: data)
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testDecodeSnakeCase() throws {
        let json = #"{"id":"a","runtime_minutes":120}"#.data(using: .utf8)!
        let m = try decode(json)
        XCTAssertEqual(m.runtimeMinutes, 120)
    }
}
```

---
type: exercise
kind: fix_bug
pointsMax: 40
language: swift
---
Decoding fails because the date format is ISO-8601 but the decoder is using its default. Fix it.

```swift:broken
import Foundation

struct Episode: Decodable {
    let id: String
    let airDate: Date
}

func decode(_ data: Data) throws -> Episode {
    let decoder = JSONDecoder()
    return try decoder.decode(Episode.self, from: data)
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testDecodeISODate() throws {
        let json = #"{"id":"a","airDate":"2026-01-01T00:00:00Z"}"#.data(using: .utf8)!
        let e = try decode(json)
        XCTAssertEqual(e.id, "a")
    }
}
```

---
type: exercise
kind: fill_blank
pointsMax: 20
language: swift
blanks:
  "1": ["CodingKeys"]
---
Fill in the enum name SwiftUI's compiler synthesizes (and that you can override) for property-to-JSON-key mapping.

```swift:starter
struct Movie: Decodable {
    let id: String
    let title: String

    enum ___1___: String, CodingKey {
        case id
        case title = "name"
    }
}
```

---
type: recap
---

## What you learned

**Concepts:** `Decodable` synthesizes parsing from JSON · `CodingKeys` for explicit key mapping · `keyDecodingStrategy = .convertFromSnakeCase` · `dateDecodingStrategy` for ISO-8601 / epoch · nested decodable types

**Swift-specific vs other languages:** No runtime reflection — code generation happens at compile time. Missing keys, type mismatches, and decoding failures all throw typed `DecodingError`s.

**What's next:** Lesson 03 wraps URLSession + Codable into a generic typed API client.
