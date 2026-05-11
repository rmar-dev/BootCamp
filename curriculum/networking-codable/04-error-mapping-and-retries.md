---
type: lesson
title: Error Mapping & Retries
level: intermediate
summary: A typed APIError, mapping URLError / DecodingError / HTTP into one surface, and exponential backoff retries.
---

## A typed APIError

Define a single error type the UI can switch on.

```swift
enum APIError: Error {
    case offline
    case timeout
    case http(status: Int, body: Data)
    case decoding(Error)
    case unknown(Error)
}
```

The UI does not care that something was a `URLError` vs a `DecodingError` — it cares whether to show "no internet" vs "we'll retry" vs "something is wrong".

> **Coming from C++:** Closer to a `std::variant` than a class hierarchy. Each case carries its own associated values; `switch` is exhaustive.

---

## Mapping at the boundary

Funnel everything through one helper:

```swift
func map(_ error: Error) -> APIError {
    switch error {
    case let urlErr as URLError:
        switch urlErr.code {
        case .notConnectedToInternet, .networkConnectionLost: return .offline
        case .timedOut: return .timeout
        default: return .unknown(urlErr)
        }
    case let decErr as DecodingError:
        return .decoding(decErr)
    default:
        return .unknown(error)
    }
}
```

Apply it inside `APIClient.send`:

```swift
do {
    return try await performRequest()
} catch {
    throw map(error)
}
```

> **What's going on here**
> - The `case let X as Y` syntax is type-cast pattern matching. Each branch handles one underlying error type at a time.

---

## Retries with backoff

Transient errors (offline, timeout, 5xx) deserve a few retries with exponential backoff.

```swift
func retry<T>(times: Int = 3, body: () async throws -> T) async throws -> T {
    var delay: Duration = .milliseconds(250)
    for attempt in 0..<times {
        do {
            return try await body()
        } catch let error as APIError where isTransient(error) {
            if attempt == times - 1 { throw error }
            try await Task.sleep(for: delay)
            delay *= 2
        }
    }
    fatalError("unreachable")
}

func isTransient(_ error: APIError) -> Bool {
    switch error {
    case .offline, .timeout: return true
    case .http(let status, _): return status >= 500
    default: return false
    }
}
```

Do not retry 4xx. Do not retry decoding errors — those are programmer bugs, not transient failures.

---
type: exercise
kind: multiple_choice
pointsMax: 10
---
Which class of error should NOT be retried with backoff?

- [ ] Transient network drops.
- [ ] HTTP 503 Service Unavailable.
- [x] HTTP 400 Bad Request and decoding errors — these will fail again the same way.
- [ ] Request timeout.

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Implement `map(_:)` that converts a `URLError(.notConnectedToInternet)` to `.offline`, `URLError(.timedOut)` to `.timeout`, a `DecodingError` to `.decoding(error)`, and any other to `.unknown(error)`.

```swift:starter
import Foundation

enum APIError: Error {
    case offline
    case timeout
    case decoding(Error)
    case unknown(Error)
}

func map(_ error: Error) -> APIError {
    // TODO
    return .unknown(error)
}
```

```swift:solution
import Foundation

enum APIError: Error {
    case offline
    case timeout
    case decoding(Error)
    case unknown(Error)
}

func map(_ error: Error) -> APIError {
    if let urlErr = error as? URLError {
        switch urlErr.code {
        case .notConnectedToInternet, .networkConnectionLost: return .offline
        case .timedOut: return .timeout
        default: return .unknown(urlErr)
        }
    }
    if let decErr = error as? DecodingError {
        return .decoding(decErr)
    }
    return .unknown(error)
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testOffline() {
        let e = URLError(.notConnectedToInternet)
        if case .offline = map(e) { return }
        XCTFail("expected .offline")
    }
    func testTimeout() {
        let e = URLError(.timedOut)
        if case .timeout = map(e) { return }
        XCTFail("expected .timeout")
    }
}
```

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Implement `isTransient(_:)` returning `true` for `.offline`, `.timeout`, and `.http` with status >= 500.

```swift:starter
enum APIError: Error {
    case offline
    case timeout
    case http(status: Int, body: Data)
    case decoding(Error)
    case unknown(Error)
}

func isTransient(_ error: APIError) -> Bool {
    // TODO
    return false
}
```

```swift:solution
enum APIError: Error {
    case offline
    case timeout
    case http(status: Int, body: Data)
    case decoding(Error)
    case unknown(Error)
}

func isTransient(_ error: APIError) -> Bool {
    switch error {
    case .offline, .timeout: return true
    case .http(let status, _): return status >= 500
    default: return false
    }
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testTransientOffline() {
        XCTAssertTrue(isTransient(.offline))
    }
    func testTransient503() {
        XCTAssertTrue(isTransient(.http(status: 503, body: Data())))
    }
    func testNotTransient400() {
        XCTAssertFalse(isTransient(.http(status: 400, body: Data())))
    }
}
```

---
type: exercise
kind: fix_bug
pointsMax: 40
language: swift
---
The retry helper retries decoding errors. Restrict it to transient ones.

```swift:broken
enum APIError: Error {
    case offline, timeout, decoding, unknown
}

func retry<T>(times: Int, body: () async throws -> T) async throws -> T {
    var lastError: Error?
    for _ in 0..<times {
        do { return try await body() }
        catch { lastError = error }
    }
    throw lastError!
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testCompiles() {
        // Retry must only re-attempt on transient APIError; decoding/unknown should rethrow immediately.
        // Verified by signature — check that retry throws when the body throws .decoding once.
        Task {
            do {
                _ = try await retry(times: 3) { () -> Int in
                    throw APIError.decoding
                }
                XCTFail("expected .decoding to surface immediately")
            } catch APIError.decoding {
                // ok
            } catch {
                XCTFail("unexpected: \(error)")
            }
        }
    }
}
```

---
type: exercise
kind: fill_blank
pointsMax: 20
language: swift
blanks:
  "1": ["Task"]
---
Fill in the call that suspends the current task for the given duration.

```swift:starter
try await ___1___.sleep(for: .milliseconds(250))
```

---
type: recap
---

## What you learned

**Concepts:** typed `APIError` enum funnels every error class · `map(_:)` translates `URLError` / `DecodingError` / HTTP into the single surface · exponential backoff retries only for transient cases · never retry 4xx or decoding errors

**Swift-specific vs other languages:** A typed enum gives the UI exhaustive `switch` on error states — closer to Rust's `Result<T, E>` than to a Java exception hierarchy.

**What's next:** Week 7 introduces SwiftData for storing watch history and downloads on-device.
