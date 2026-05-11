---
type: lesson
title: Sign in with Apple
level: intermediate
summary: SignInWithAppleButton, ASAuthorizationController, identity tokens, and the App Store policy.
---

## SignInWithAppleButton

SwiftUI ships a button that runs the entire flow.

```swift
import AuthenticationServices
import SwiftUI

struct LoginView: View {
    var body: some View {
        SignInWithAppleButton(.signIn) { request in
            request.requestedScopes = [.email, .fullName]
        } onCompletion: { result in
            switch result {
            case .success(let auth): handle(auth)
            case .failure(let error): print(error)
            }
        }
        .frame(height: 50)
    }
}

func handle(_ auth: ASAuthorization) {
    guard let credential = auth.credential as? ASAuthorizationAppleIDCredential else { return }
    let userID = credential.user
    let identityToken = credential.identityToken.flatMap { String(data: $0, encoding: .utf8) }
    // Send identityToken to your server. Server validates the JWT against Apple's JWKS.
}
```

The `identityToken` is a signed JWT. Trust validation happens on the server, not the client.

> **Coming from Java:** Closer to using the Sign in with Apple JWT spec on a Spring backend than to a client-only flow. The client gets the credential; the server verifies it.

---

## App Store policy

If your app offers third-party social logins (Google, Facebook), it MUST also offer Sign in with Apple. App Store Review Guideline 4.8 enforces this.

A back-end-only login (email + password) does *not* trigger the requirement. Adding a Google button alongside email login does.

---

## Identity token shape

The token is a standard JWT:

- `iss`: `https://appleid.apple.com`
- `sub`: stable user ID (the same as `credential.user`)
- `email`: present on first sign-in only (or always if not hidden)
- `email_verified`: always true for Apple
- `is_private_email`: true if the user chose the relay address

Validate `iss`, `aud` (your bundle id), `exp`, and the signature against Apple's JWKS.

> **What's going on here**
> - Apple gives the client the token for convenience and gives the server the same token via the redirect (web flow). For mobile, the client forwards it.
> - Email is delivered exactly once. If your server didn't catch it, ask the user to remove the app from their Apple ID settings to receive a fresh email on next sign-in.

---

## ASAuthorizationController (UIKit-style)

For non-SwiftUI hosts, `ASAuthorizationController` is the underlying API:

```swift
let request = ASAuthorizationAppleIDProvider().createRequest()
request.requestedScopes = [.email, .fullName]
let controller = ASAuthorizationController(authorizationRequests: [request])
controller.delegate = self
controller.presentationContextProvider = self
controller.performRequests()
```

---
type: exercise
kind: multiple_choice
pointsMax: 10
---
Where should the Sign in with Apple identity token's signature be validated?

- [ ] In the iOS app, before sending it anywhere.
- [x] On your server, against Apple's JWKS, with `iss` and `aud` checks.
- [ ] By Apple, before delivering it to the app.
- [ ] By the keychain, on every read.

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Write `decodeIdentityToken(_:)` that takes the `Data` from `credential.identityToken` and returns the UTF-8 string, or `nil`.

```swift:starter
import Foundation

func decodeIdentityToken(_ data: Data?) -> String? {
    // TODO
    return nil
}
```

```swift:solution
import Foundation

func decodeIdentityToken(_ data: Data?) -> String? {
    guard let data else { return nil }
    return String(data: data, encoding: .utf8)
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testDecodes() {
        XCTAssertEqual(decodeIdentityToken("hello".data(using: .utf8)), "hello")
    }
    func testNil() {
        XCTAssertNil(decodeIdentityToken(nil))
    }
}
```

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Write `extractAppleSub(fromJWT:)` that splits a JWT on `"."`, base64-url decodes the middle part, and returns the JSON's `sub` value if present.

```swift:starter
import Foundation

func extractAppleSub(fromJWT token: String) -> String? {
    // TODO
    return nil
}
```

```swift:solution
import Foundation

func extractAppleSub(fromJWT token: String) -> String? {
    let parts = token.split(separator: ".")
    guard parts.count >= 2 else { return nil }
    var b64 = String(parts[1])
        .replacingOccurrences(of: "-", with: "+")
        .replacingOccurrences(of: "_", with: "/")
    while b64.count % 4 != 0 { b64.append("=") }
    guard let data = Data(base64Encoded: b64),
          let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    else { return nil }
    return json["sub"] as? String
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testExtract() throws {
        // header.payload.signature - payload is {"sub":"abc"}
        let payload = #"{"sub":"abc"}"#.data(using: .utf8)!
        let b64 = payload.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
        let token = "header.\(b64).sig"
        XCTAssertEqual(extractAppleSub(fromJWT: token), "abc")
    }
}
```

---
type: exercise
kind: fix_bug
pointsMax: 40
language: swift
---
The flow forgets to request the user's email scope. Add it.

```swift:broken
import AuthenticationServices

func makeRequest() -> ASAuthorizationAppleIDRequest {
    let req = ASAuthorizationAppleIDProvider().createRequest()
    req.requestedScopes = [.fullName]
    return req
}
```

```swift:test
import XCTest
import AuthenticationServices

final class Tests: XCTestCase {
    func testIncludesEmail() {
        let req = makeRequest()
        XCTAssertTrue(req.requestedScopes?.contains(.email) ?? false)
    }
}
```

---
type: exercise
kind: fill_blank
pointsMax: 20
language: swift
blanks:
  "1": ["identityToken"]
---
Fill in the credential property whose `Data` is a signed JWT your server validates.

```swift:starter
let token = credential.___1___
```

---
type: recap
---

## What you learned

**Concepts:** `SignInWithAppleButton` runs the flow in SwiftUI · `identityToken` is a JWT — validate on the server · email is delivered once · App Store rule 4.8 requires Sign in with Apple alongside other social logins

**Swift-specific vs other languages:** Sign in with Apple is platform-specific; the `Data`-typed token + JWKS validation pattern is portable to any backend that already speaks JWT.

**What's next:** Lesson 03 covers Keychain — the only acceptable place to store auth tokens.
