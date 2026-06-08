import { RunnerLanguage } from './types';
import { stripUnavailableImports } from '../shared/apple-sdk-modules';

const MARKER = '// --- tests below ---';

/**
 * Swift wrapper that catches assertion failures and prints a clean one-line
 * error instead of the full backtrace + register dump that `assert()` produces.
 */
const SWIFT_WRAPPER_PREFIX = `
import Foundation

func bootcampAssert(_ condition: Bool, _ message: String = "Assertion failed", file: String = #file, line: Int = #line) {
  if !condition {
    print("❌ FAIL: \\(message) (\\(file):\\(line))")
    exit(1)
  }
}

func bootcampAssertEqual<T: Equatable>(_ a: T, _ b: T, _ message: String = "", file: String = #file, line: Int = #line) {
  if a != b {
    let msg = message.isEmpty ? "expected \\(b), got \\(a)" : message
    print("❌ FAIL: \\(msg) (\\(file):\\(line))")
    exit(1)
  }
}
`.trimEnd();

export function buildHarness(
  language: RunnerLanguage,
  studentCode: string,
  testCode: string,
): string {
  if (language === 'swift') {
    // Drop reflexive `import SwiftUI` / `import Combine` etc. — those Apple
    // frameworks don't exist in the Linux sandbox, and leaving them in aborts
    // the whole compile before the actual logic can run. Stripping them lets
    // pure-logic submissions execute so we can grade the code by its output.
    const { code } = stripUnavailableImports(studentCode);
    return `${SWIFT_WRAPPER_PREFIX}\n\n${code.trimEnd()}\n\n${MARKER}\n\n${testCode.trimEnd()}\n`;
  }
  return `${studentCode.trimEnd()}\n\n${MARKER}\n\nfun main() {\n${testCode.trimEnd()}\n}\n`;
}
