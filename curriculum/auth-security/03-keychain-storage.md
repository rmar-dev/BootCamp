---
type: lesson
title: Keychain for Secrets
level: intermediate
summary: SecItemAdd / SecItemCopyMatching / SecItemDelete, kSecAttrAccessible, and a typed KeychainStore wrapper.
---

## Why Keychain

Auth tokens, refresh tokens, and any secret must NOT live in `UserDefaults` (plaintext) or the file system without protection. Keychain entries are encrypted at rest, tied to the device, and protected by file-level data protection.

> **Coming from C++:** Closer to a system keystore (Linux secret service / Windows Credential Manager) than to `getenv`. The OS holds the encryption keys; your process gets values back only when entitled.

---

## Save / load / delete

The Keychain API is C-style. A small Swift wrapper makes it usable.

```swift
import Foundation
import Security

enum KeychainError: Error {
    case status(OSStatus)
}

struct KeychainStore {
    let service: String

    func set(_ value: String, for key: String) throws {
        let data = Data(value.utf8)
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]
        SecItemDelete(query as CFDictionary)

        var attributes = query
        attributes[kSecValueData as String] = data
        attributes[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly

        let status = SecItemAdd(attributes as CFDictionary, nil)
        if status != errSecSuccess { throw KeychainError.status(status) }
    }

    func get(_ key: String) throws -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecItemNotFound { return nil }
        if status != errSecSuccess { throw KeychainError.status(status) }
        guard let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    func delete(_ key: String) throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]
        let status = SecItemDelete(query as CFDictionary)
        if status != errSecSuccess && status != errSecItemNotFound {
            throw KeychainError.status(status)
        }
    }
}
```

> **What's going on here**
> - `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly` — the entry is decryptable only after the user has unlocked the device once after boot, and never restored to a different device. Right default for auth tokens.
> - `SecItemDelete` before `SecItemAdd` — Keychain throws `errSecDuplicateItem` if you add over an existing entry. The delete + add pattern is the idiomatic upsert.

---

## Accessibility constants

| Constant | When readable |
|---|---|
| `kSecAttrAccessibleWhenUnlocked` | While the device is unlocked |
| `kSecAttrAccessibleAfterFirstUnlock` | After first unlock, until reboot |
| `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly` | Same, plus never restored to a new device |
| `kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly` | Requires user to have a passcode |

For background tasks (download manager, notifications) that need the token while the device is locked, use `AfterFirstUnlock`. For "premium" secrets (banking, health), `WhenPasscodeSet`.

---
type: exercise
kind: multiple_choice
pointsMax: 10
---
Why prefer `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly` for an auth token?

- [ ] It is faster than other access classes.
- [x] Available to background tasks after the user unlocks once, and won't be restored to another device — preventing token theft via backup.
- [ ] It is required for App Store review.
- [ ] It encrypts the token with the user's biometric.

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Implement `KeychainStore.delete(_:)`. Treat `errSecItemNotFound` as a no-op success; throw on any other non-zero status.

```swift:starter
import Foundation
import Security

enum KeychainError: Error { case status(OSStatus) }

struct KeychainStore {
    let service: String

    func delete(_ key: String) throws {
        // TODO
    }
}
```

```swift:solution
import Foundation
import Security

enum KeychainError: Error { case status(OSStatus) }

struct KeychainStore {
    let service: String

    func delete(_ key: String) throws {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]
        let status = SecItemDelete(query as CFDictionary)
        if status != errSecSuccess && status != errSecItemNotFound {
            throw KeychainError.status(status)
        }
    }
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testCompiles() {
        let s = KeychainStore(service: "com.example.test")
        try? s.delete("missing")    // should not throw
    }
}
```

---
type: exercise
kind: code
pointsMax: 50
language: swift
---
Write `upsert(_:value:)` that deletes first, then adds. Use `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`.

```swift:starter
import Foundation
import Security

enum KeychainError: Error { case status(OSStatus) }

func upsert(service: String, key: String, value: String) throws {
    // TODO
}
```

```swift:solution
import Foundation
import Security

enum KeychainError: Error { case status(OSStatus) }

func upsert(service: String, key: String, value: String) throws {
    let baseQuery: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: service,
        kSecAttrAccount as String: key,
    ]
    SecItemDelete(baseQuery as CFDictionary)

    var attrs = baseQuery
    attrs[kSecValueData as String] = Data(value.utf8)
    attrs[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly

    let status = SecItemAdd(attrs as CFDictionary, nil)
    if status != errSecSuccess { throw KeychainError.status(status) }
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testCompiles() {
        let f: (String, String, String) throws -> Void = upsert(service:key:value:)
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
The function uses the wrong accessibility class — the token will not be readable after device restart. Pick one that allows background reads after first unlock.

```swift:broken
import Foundation
import Security

func saveToken(_ token: String, service: String) -> OSStatus {
    let attrs: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: service,
        kSecAttrAccount as String: "auth",
        kSecValueData as String: Data(token.utf8),
        kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlocked,
    ]
    return SecItemAdd(attrs as CFDictionary, nil)
}
```

```swift:test
import XCTest

final class Tests: XCTestCase {
    func testCompiles() {
        let f: (String, String) -> OSStatus = saveToken(_:service:)
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
  "1": ["kSecClassGenericPassword"]
---
Fill in the Keychain class constant used for application secrets like API tokens.

```swift:starter
let query: [String: Any] = [
    kSecClass as String: ___1___,
    kSecAttrService as String: "com.example.stream",
]
```

---
type: recap
---

## What you learned

**Concepts:** Keychain encrypted at rest, tied to device · `SecItemAdd` / `SecItemCopyMatching` / `SecItemDelete` C-API wrapped in a typed `KeychainStore` · `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly` is the right default for auth tokens · upsert = delete + add

**Swift-specific vs other languages:** Modern Swift wraps the CoreFoundation API with bridging that hides the worst of the casts. The accessibility constants are unique to Apple platforms — they map to the iOS data-protection class system.

**What's next:** Lesson 04 wires the Keychain-stored token into the API client and adds 401-driven refresh.
