---
type: lesson
title: Auth-Aware APIClient
level: intermediate
summary: Authorization header injection, single-flight 401 refresh, and the AuthSession actor.
---

## Injecting the bearer token

Adapt the typed `APIClient` from Week 6 to inject `Authorization: Bearer <token>` from a token provider.

```swift
final class APIClient {
    let baseURL: URL
    let auth: AuthSession

    init(baseURL: URL, auth: AuthSession) {
        self.baseURL = baseURL
        self.auth = auth
    }

    func send<T>(_ endpoint: Endpoint<T>) async throws -> T {
        var request = URLRequest(url: baseURL.appendingPathComponent(endpoint.path))
        request.httpMethod = endpoint.method
        if let token = await auth.accessToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        let (data, response) = try await URLSession.shared.data(for: request)
        if let http = response as? HTTPURLResponse, http.statusCode == 401 {
            try await auth.refresh()
            return try await send(endpoint)   // retry once
        }
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }
        return try JSONDecoder().decode(T.self, from: data)
    }
}
```

> **Coming from Java:** Closer to a Retrofit `Authenticator` that reissues a request after refresh than to a plain interceptor. The retry is bounded — once. Two consecutive 401s mean credentials are dead.

---

## Single-flight refresh with an actor

If 50 requests fire and all get 401, you don't want 50 parallel refresh calls. Centralize via an actor so only one refresh runs at a time and the rest await its result.

```swift
actor AuthSession {
    private var token: String?
    private var refreshTask: Task<String, Error>?

    func accessToken() -> String? { token }

    func refresh() async throws {
        if let task = refreshTask {
            _ = try await task.value
            return
        }
        let task = Task<String, Error> {
            let new = try await performRefresh()
            self.token = new
            return new
        }
        refreshTask = task
        defer { refreshTask = nil }
        _ = try await task.value
    }

    private func performRefresh() async throws -> String {
        // POST to refresh endpoint with the stored refresh_token
        return "new-token"
    }
}
```

> **What's going on here**
> - The `refreshTask` field deduplicates concurrent calls. The first caller starts the task; the rest `await task.value` and share the result.
> - `defer { refreshTask = nil }` clears the slot whether refresh succeeded or threw, so the next failure can try again.

---

## Storage: tie it to Keychain

`AuthSession.token` is in memory. Persist it in Keychain (Lesson 03) so it survives restart.

```swift
actor AuthSession {
    private let store: KeychainStore
    private var cached: String?

    init(store: KeychainStore) {
        self.store = store
        self.cached = try? store.get("access_token")
    }

    func accessToken() -> String? { cached }

    func setToken(_ token: String) throws {
        cached = token
        try store.set(token, for: "access_token")
    }
}
```

---
type: exercise
kind: multiple_choice
pointsMax: 10
---
Why is single-flight refresh important?

- [ ] It avoids triggering rate limits on the catalog API.
- [x] It prevents many parallel 401-retries from each spawning their own refresh, which would race and waste tokens.
- [ ] It makes the UI render faster.
- [ ] The Keychain locks during simultaneous access.

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Add `Authorization: Bearer <token>` injection to a request. Skip when the token is `nil`.

```swift:starter
import Foundation

func authorize(_ request: inout URLRequest, token: String?) {
    // TODO
}
```

```swift:solution
import Foundation

func authorize(_ request: inout URLRequest, token: String?) {
    guard let token else { return }
    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testInjects() {
        var req = URLRequest(url: URL(string: "https://example.com")!)
        authorize(&req, token: "abc")
        XCTAssertEqual(req.value(forHTTPHeaderField: "Authorization"), "Bearer abc")
    }
    func testNilSkips() {
        var req = URLRequest(url: URL(string: "https://example.com")!)
        authorize(&req, token: nil)
        XCTAssertNil(req.value(forHTTPHeaderField: "Authorization"))
    }
}
```

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Implement an actor `Counter` with `increment()` that is single-flight: parallel callers must observe the resulting count exactly once each.

```swift:starter
actor Counter {
    private(set) var value = 0

    func increment() {
        // TODO
    }
}
```

```swift:solution
actor Counter {
    private(set) var value = 0

    func increment() {
        value += 1
    }
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testParallelIncrement() async {
        let c = Counter()
        await withTaskGroup(of: Void.self) { group in
            for _ in 0..<200 { group.addTask { await c.increment() } }
        }
        let v = await c.value
        XCTAssertEqual(v, 200)
    }
}
```

---
type: exercise
kind: fix_bug
pointsMax: 40
language: swift
---
The retry never happens — after refresh, the function returns the original 401 response without retrying.

```swift:broken
import Foundation

func send(_ request: URLRequest, refresh: () async throws -> Void) async throws -> Data {
    let (data, response) = try await URLSession.shared.data(for: request)
    if (response as? HTTPURLResponse)?.statusCode == 401 {
        try await refresh()
    }
    return data
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testCompiles() {
        let f: (URLRequest, () async throws -> Void) async throws -> Data = send(_:refresh:)
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
  "1": ["actor"]
---
Fill in the keyword that makes a type's mutable state safe under concurrent calls without manual locks.

```swift:starter
___1___ AuthSession {
    var token: String?
}
```

---
type: recap
---

## What you learned

**Concepts:** inject `Authorization: Bearer <token>` per request · single-flight refresh via an actor with a held `Task` · 401-driven retry-once · persist tokens via the Keychain wrapper from Lesson 03

**Swift-specific vs other languages:** Actors give built-in single-flight semantics — no manual mutex around the refresh state, no risk of two refreshes racing. JS / Java equivalents need an explicit lock or a shared promise.

**What's next:** Week 11 covers polish: Picture-in-Picture, AirPlay, background audio, and offline downloads.
