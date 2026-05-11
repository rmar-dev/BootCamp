import { RunnerLanguage } from './types';

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
    return `${SWIFT_WRAPPER_PREFIX}\n\n${studentCode.trimEnd()}\n\n${MARKER}\n\n${testCode.trimEnd()}\n`;
  }
  return `${studentCode.trimEnd()}\n\n${MARKER}\n\nfun main() {\n${testCode.trimEnd()}\n}\n`;
}
