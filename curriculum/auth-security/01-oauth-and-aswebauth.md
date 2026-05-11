---
type: lesson
title: OAuth with ASWebAuthenticationSession
level: intermediate
summary: PKCE flow, ASWebAuthenticationSession, and exchanging an authorization code for an access token.
---

## OAuth code + PKCE

Native apps use the *authorization code with PKCE* flow:

1. Generate a random `code_verifier`. Hash it with SHA-256, base64-url encode → `code_challenge`.
2. Open the auth URL with `code_challenge`. User signs in.
3. The provider redirects to your custom URL scheme with `?code=...`.
4. POST `code` + `code_verifier` to the token endpoint. Receive an access token (and refresh token).

PKCE prevents an interceptor with the redirect URL from completing the flow without the original verifier.

> **Coming from JavaScript:** Same flow as a SPA, but the redirect lands on a custom scheme (`mystream://callback`) instead of an HTTPS URL. Apple's `ASWebAuthenticationSession` is the supported way to host the browser tab.

---

## ASWebAuthenticationSession

```swift
import AuthenticationServices

func startLogin(
    authorizeURL: URL,
    callbackScheme: String
) async throws -> URL {
    try await withCheckedThrowingContinuation { cont in
        let session = ASWebAuthenticationSession(
            url: authorizeURL,
            callbackURLScheme: callbackScheme
        ) { callback, error in
            if let error { cont.resume(throwing: error); return }
            guard let callback else {
                cont.resume(throwing: URLError(.badServerResponse)); return
            }
            cont.resume(returning: callback)
        }
        session.presentationContextProvider = ContextProvider.shared
        session.start()
    }
}
```

The system presents an in-app browser sandbox; the redirect URI is captured automatically.

> **What's going on here**
> - `withCheckedThrowingContinuation` bridges the callback API to async/await — ASWebAuthenticationSession was designed for completion handlers.
> - `presentationContextProvider` is the platform's hook to get the parent window. Define a small `NSObject` subclass that returns the app's key window.

---

## PKCE generation

```swift
import CryptoKit
import Foundation

func makePKCE() -> (verifier: String, challenge: String) {
    var bytes = [UInt8](repeating: 0, count: 32)
    _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
    let verifier = Data(bytes).base64URLEncoded()
    let challenge = Data(SHA256.hash(data: Data(verifier.utf8))).base64URLEncoded()
    return (verifier, challenge)
}

extension Data {
    func base64URLEncoded() -> String {
        base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
}
```

base64-url is base64 with `+` → `-`, `/` → `_`, `=` stripped. Standard base64 has characters that need URL-encoding.

---
type: exercise
kind: multiple_choice
pointsMax: 10
---
Why does PKCE require both a verifier and a challenge?

- [ ] To support multi-factor authentication.
- [x] So an interceptor of the redirect cannot exchange the code without the original verifier.
- [ ] To rotate keys per session.
- [ ] To bind the token to the device hardware.

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Implement `base64URLEncoded()` on `Data` returning base64 with `+` → `-`, `/` → `_`, and `=` stripped.

```swift:starter
import Foundation

extension Data {
    func base64URLEncoded() -> String {
        // TODO
        return ""
    }
}
```

```swift:solution
import Foundation

extension Data {
    func base64URLEncoded() -> String {
        base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testEncode() {
        let bytes: [UInt8] = [0xff, 0xfe, 0xfd]
        let s = Data(bytes).base64URLEncoded()
        XCTAssertFalse(s.contains("="))
        XCTAssertFalse(s.contains("+"))
        XCTAssertFalse(s.contains("/"))
    }
}
```

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Write `extractCode(from:)` returning the value of the `code` query parameter on a callback URL, or `nil`.

```swift:starter
import Foundation

func extractCode(from url: URL) -> String? {
    // TODO
    return nil
}
```

```swift:solution
import Foundation

func extractCode(from url: URL) -> String? {
    URLComponents(url: url, resolvingAgainstBaseURL: false)?
        .queryItems?
        .first { $0.name == "code" }?
        .value
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testExtract() {
        let url = URL(string: "mystream://callback?state=abc&code=AUTH_CODE")!
        XCTAssertEqual(extractCode(from: url), "AUTH_CODE")
    }
    func testMissing() {
        let url = URL(string: "mystream://callback")!
        XCTAssertNil(extractCode(from: url))
    }
}
```

---
type: exercise
kind: fix_bug
pointsMax: 40
language: swift
---
The function builds the auth URL but forgets `code_challenge_method=S256`. Add it.

```swift:broken
import Foundation

func authURL(base: URL, clientID: String, challenge: String, redirect: String) -> URL {
    var c = URLComponents(url: base, resolvingAgainstBaseURL: false)!
    c.queryItems = [
        URLQueryItem(name: "client_id", value: clientID),
        URLQueryItem(name: "response_type", value: "code"),
        URLQueryItem(name: "code_challenge", value: challenge),
        URLQueryItem(name: "redirect_uri", value: redirect),
    ]
    return c.url!
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testIncludesMethod() {
        let url = authURL(
            base: URL(string: "https://login.example.com/auth")!,
            clientID: "id",
            challenge: "ch",
            redirect: "mystream://cb"
        )
        XCTAssertTrue(url.absoluteString.contains("code_challenge_method=S256"))
    }
}
```

---
type: exercise
kind: fill_blank
pointsMax: 20
language: swift
blanks:
  "1": ["ASWebAuthenticationSession"]
---
Fill in the system class that hosts the OAuth browser flow on Apple platforms.

```swift:starter
let session = ___1___(url: authURL, callbackURLScheme: "mystream") { url, err in /* ... */ }
session.start()
```

---
type: recap
---

## What you learned

**Concepts:** authorization code + PKCE for native apps · `ASWebAuthenticationSession` hosts the system-supplied browser tab · code_verifier (random) + code_challenge (SHA-256 base64-url) · extract the `code` from the callback URL via `URLComponents`

**Swift-specific vs other languages:** Apple does not allow embedding a `WKWebView` for OAuth on most providers; ASWebAuthenticationSession is mandatory for the system Safari sandbox. Other platforms have looser requirements.

**What's next:** Lesson 02 covers Sign in with Apple — the streamlined flow when the provider is Apple's account system.
