---
type: lesson
title: URLSession with async/await
level: intermediate
summary: URLSession.data(from:), URLRequest construction, and HTTP status checks.
---

## Basic GET

`URLSession.shared.data(from:)` is async/throwing. It returns a `(Data, URLResponse)` pair.

```swift
import Foundation

func fetchHomeJSON() async throws -> Data {
    let url = URL(string: "https://api.example.com/v1/home")!
    let (data, response) = try await URLSession.shared.data(from: url)

    guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
        throw URLError(.badServerResponse)
    }
    return data
}
```

Always check the `HTTPURLResponse.statusCode` — a non-2xx response still resolves the call without throwing.

> **Coming from JavaScript:** `fetch` resolves on any HTTP response, including 500. Swift behaves the same — you must inspect `statusCode` yourself.

---

## URLRequest with headers

For anything beyond a bare GET, build a `URLRequest`.

```swift
var request = URLRequest(url: url)
request.httpMethod = "POST"
request.setValue("application/json", forHTTPHeaderField: "Content-Type")
request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
request.httpBody = try JSONEncoder().encode(payload)

let (data, response) = try await URLSession.shared.data(for: request)
```

Use `data(for:)` (request) — not `data(from:)` (URL) — when sending a configured request.

> **What's going on here**
> - `setValue(_:forHTTPHeaderField:)` replaces; `addValue(_:forHTTPHeaderField:)` appends. Use `set` for headers that can appear at most once.
> - `data(for: request)` honors all of `httpMethod`, `httpBody`, headers, cache policy, and timeouts.

---

## Cancellation

URLSession honors `Task` cancellation natively. If the parent task is cancelled, the call throws `URLError(.cancelled)`.

```swift
let task = Task {
    try await fetchHomeJSON()
}
task.cancel()   // throws URLError(.cancelled) inside fetchHomeJSON
```

---
type: exercise
kind: multiple_choice
pointsMax: 10
---
What does `URLSession.shared.data(from:)` throw when the server returns HTTP 500?

- [ ] `URLError(.badServerResponse)` automatically.
- [x] Nothing — the call resolves successfully; you must inspect `HTTPURLResponse.statusCode` yourself.
- [ ] `URLError(.cancelled)`.
- [ ] An automatic retry is performed and the error is suppressed.

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Write `fetchString(from:)` that performs a GET, validates 2xx, and returns the body as `String` decoded UTF-8. Throw `URLError(.badServerResponse)` on non-2xx.

```swift:starter
import Foundation

func fetchString(from url: URL) async throws -> String {
    // TODO
    return ""
}
```

```swift:solution
import Foundation

func fetchString(from url: URL) async throws -> String {
    let (data, response) = try await URLSession.shared.data(from: url)
    guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
        throw URLError(.badServerResponse)
    }
    return String(data: data, encoding: .utf8) ?? ""
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testSignatureCompiles() {
        // Ensures the function signature matches and is async/throws.
        let f: (URL) async throws -> String = fetchString(from:)
        _ = f
    }
}
```

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Write `postJSON(_:to:token:)` that POSTs the given `Data` to the URL with `Content-Type: application/json` and `Authorization: Bearer <token>` headers. Return the response body data on 2xx.

```swift:starter
import Foundation

func postJSON(_ body: Data, to url: URL, token: String) async throws -> Data {
    // TODO
    return Data()
}
```

```swift:solution
import Foundation

func postJSON(_ body: Data, to url: URL, token: String) async throws -> Data {
    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    request.httpBody = body

    let (data, response) = try await URLSession.shared.data(for: request)
    guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
        throw URLError(.badServerResponse)
    }
    return data
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testSignatureCompiles() {
        let f: (Data, URL, String) async throws -> Data = postJSON(_:to:token:)
        _ = f
    }
}
```

---
type: exercise
kind: fix_bug
pointsMax: 40
language: swift
---
The function does not throw on 4xx/5xx responses. Add a status code check.

```swift:broken
import Foundation

func loadHome() async throws -> Data {
    let url = URL(string: "https://api.example.com/home")!
    let (data, _) = try await URLSession.shared.data(from: url)
    return data
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testSignatureCompiles() {
        let f: () async throws -> Data = loadHome
        _ = f
    }
}
```

---
type: exercise
kind: fill_blank
pointsMax: 20
language: swift
blanks:
  "1": ["data(for:)"]
---
Fill in the URLSession method that takes a configured `URLRequest`.

```swift:starter
let (data, response) = try await URLSession.shared.___1___ request)
```

---
type: recap
---

## What you learned

**Concepts:** `URLSession.shared.data(from:)` async/throwing API · status code validation is the caller's job · `URLRequest` for headers, body, method · cancellation propagates via `Task`

**Swift-specific vs other languages:** Like JavaScript `fetch`, the call only throws on transport errors — non-2xx responses are still successful resolutions. The async/await form replaces both completion-handler delegates and Combine publishers.

**What's next:** Lesson 02 covers `Codable` for JSON decoding into typed model values.
