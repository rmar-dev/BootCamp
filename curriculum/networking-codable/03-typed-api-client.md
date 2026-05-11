---
type: lesson
title: Typed API Client
level: intermediate
summary: A generic Endpoint + Client pattern that consolidates URLSession + Codable behind a single typed API surface.
---

## Endpoint as a generic value type

Each API call is described as an `Endpoint<T>` — the value type carries the response type at the type level.

```swift
struct Endpoint<Response: Decodable> {
    let path: String
    let method: String
    let body: Data?

    static func get(_ path: String) -> Endpoint<Response> {
        Endpoint(path: path, method: "GET", body: nil)
    }
}
```

Each callsite picks a concrete `Response`, so the client returns the right typed value:

```swift
extension Endpoint where Response == [Movie] {
    static let trending = Endpoint.get("/v1/trending")
}
```

---

## The Client

The client knows the base URL and how to perform any endpoint.

```swift
final class APIClient {
    let baseURL: URL
    private let session: URLSession
    private let decoder: JSONDecoder

    init(baseURL: URL, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        decoder.dateDecodingStrategy = .iso8601
        self.decoder = decoder
    }

    func send<T>(_ endpoint: Endpoint<T>) async throws -> T {
        var request = URLRequest(url: baseURL.appendingPathComponent(endpoint.path))
        request.httpMethod = endpoint.method
        request.httpBody = endpoint.body
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }
        return try decoder.decode(T.self, from: data)
    }
}
```

> **Coming from JavaScript:** Closer to a tRPC client than to `axios.get('/url')`. The endpoint *and* the response type are co-located, so `client.send(.trending)` returns `[Movie]` with no manual generic argument.

---

## Calling it

```swift
let client = APIClient(baseURL: URL(string: "https://api.example.com")!)
let movies = try await client.send(.trending)   // [Movie]
```

> **What's going on here**
> - `Endpoint<Response>` is a phantom-type pattern: the response type is part of the endpoint's identity but never stored as a value.
> - Type inference walks from `.trending: Endpoint<[Movie]>` through `send<T>` to `T == [Movie]`, so the call is statically typed end to end.

---
type: exercise
kind: multiple_choice
pointsMax: 10
---
What benefit does parameterizing `Endpoint` over `Response: Decodable` provide?

- [ ] Allows the endpoint to mutate the response.
- [x] Statically pairs each endpoint with its response type so the client returns the right value without a manual generic argument.
- [ ] Removes the need for JSON decoding.
- [ ] Makes endpoints work without a base URL.

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Define `Endpoint<Response: Decodable>` with `path`, `method`, `body`. Add a static `get(_:)` factory.

```swift:starter
import Foundation

struct Endpoint<Response: Decodable> {
    // TODO
}
```

```swift:solution
import Foundation

struct Endpoint<Response: Decodable> {
    let path: String
    let method: String
    let body: Data?

    static func get(_ path: String) -> Endpoint<Response> {
        Endpoint(path: path, method: "GET", body: nil)
    }
}
```

```swift:test
import XCTest

struct Movie: Decodable { let id: String }

final class Tests: XCTestCase {
    func testGetEndpoint() {
        let e: Endpoint<[Movie]> = .get("/v1/trending")
        XCTAssertEqual(e.path, "/v1/trending")
        XCTAssertEqual(e.method, "GET")
        XCTAssertNil(e.body)
    }
}
```

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Implement `APIClient.send<T>(_ endpoint: Endpoint<T>) async throws -> T`. Validate 2xx and decode into `T`. Use a base URL and `URLSession.shared`.

```swift:starter
import Foundation

struct Endpoint<Response: Decodable> {
    let path: String
    let method: String
    let body: Data?
}

final class APIClient {
    let baseURL: URL
    init(baseURL: URL) { self.baseURL = baseURL }

    func send<T>(_ endpoint: Endpoint<T>) async throws -> T {
        // TODO
        throw URLError(.unknown)
    }
}
```

```swift:solution
import Foundation

struct Endpoint<Response: Decodable> {
    let path: String
    let method: String
    let body: Data?
}

final class APIClient {
    let baseURL: URL
    init(baseURL: URL) { self.baseURL = baseURL }

    func send<T>(_ endpoint: Endpoint<T>) async throws -> T {
        var request = URLRequest(url: baseURL.appendingPathComponent(endpoint.path))
        request.httpMethod = endpoint.method
        request.httpBody = endpoint.body

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        return try decoder.decode(T.self, from: data)
    }
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testClientCompiles() {
        let c = APIClient(baseURL: URL(string: "https://example.com")!)
        XCTAssertNotNil(c)
    }
}
```

---
type: exercise
kind: fix_bug
pointsMax: 40
language: swift
---
The `send` method does not validate the HTTP status. Add a 2xx check and throw `URLError(.badServerResponse)` otherwise.

```swift:broken
import Foundation

func send(url: URL) async throws -> Data {
    let (data, _) = try await URLSession.shared.data(from: url)
    return data
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testCompiles() {
        let f: (URL) async throws -> Data = send(url:)
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
  "1": ["Decodable"]
---
Fill in the constraint that lets `Endpoint`'s response type be JSON-decoded.

```swift:starter
struct Endpoint<Response: ___1___> {
    let path: String
}
```

---
type: recap
---

## What you learned

**Concepts:** `Endpoint<Response>` as a typed value · phantom type carrying the response · single generic `send<T>` consolidates URLSession + Codable · static factories per endpoint co-locate path and shape

**Swift-specific vs other languages:** Phantom-type endpoints are idiomatic Swift. The same pattern in JavaScript/Python requires a runtime registry; Swift gets it from the type system.

**What's next:** Lesson 04 covers turning URLError, decoding errors, and HTTP errors into a single typed `APIError` and how to retry transient failures.
