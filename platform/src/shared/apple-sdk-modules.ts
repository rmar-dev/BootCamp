/**
 * Apple-platform frameworks that ship only with the macOS/iOS SDKs and are
 * absent from the open-source Linux Swift toolchain used by the grading
 * sandbox (see `platform/docker/swift-lsp/Dockerfile`).
 *
 * Two consumers depend on this single list so they can never drift apart:
 *   - the runner harness strips a stray `import <Framework>` so otherwise
 *     pure-logic submissions compile, run, and produce real output instead of
 *     aborting at the import (see `execution/harness.ts`);
 *   - the AI review prompt suppresses the resulting "no such module" noise when
 *     code genuinely depends on these frameworks (see `review/prompt-builder.ts`).
 */
export const APPLE_ONLY_MODULES = [
  'SwiftUI',
  'UIKit',
  'AppKit',
  'WatchKit',
  'AVKit',
  'AVFoundation',
  'Combine',
  'SwiftData',
  'CoreData',
  'CoreGraphics',
  'CoreImage',
  'MapKit',
  'WidgetKit',
  'StoreKit',
  'PhotosUI',
  'Charts',
];

const MODULE_NOT_FOUND = /no such module ['"]([^'"]+)['"]/g;

/**
 * Returns the Apple-only modules a compile failure blamed for "no such module",
 * de-duplicated. A missing module that is NOT an Apple SDK (e.g. a typo'd
 * user-defined module) is a genuine mistake and is intentionally not flagged.
 */
export function detectUnavailableModules(stderr: string): string[] {
  const found = new Set<string>();
  for (const match of stderr.matchAll(MODULE_NOT_FOUND)) {
    if (APPLE_ONLY_MODULES.includes(match[1])) found.add(match[1]);
  }
  return [...found];
}

const IMPORT_LINE = /^[ \t]*import[ \t]+([A-Za-z_][A-Za-z0-9_]*)\b/;

/**
 * Removes top-level `import <AppleFramework>` lines from Swift source so the
 * remaining (pure-logic) code can compile and run on the Linux toolchain.
 * Returns the rewritten source plus the de-duplicated list of modules removed.
 *
 * A reflexive `import SwiftUI` on top of code that only exercises Foundation /
 * standard-library logic is the common case; stripping it lets the runner
 * actually execute the submission and capture its output. Code that genuinely
 * depends on the framework's types will still fail to compile — but on a real
 * "cannot find type" error about the code itself, not a module-resolution stub.
 */
export function stripUnavailableImports(code: string): {
  code: string;
  stripped: string[];
} {
  const stripped = new Set<string>();
  const kept = code.split('\n').filter((line) => {
    const match = line.match(IMPORT_LINE);
    if (match && APPLE_ONLY_MODULES.includes(match[1])) {
      stripped.add(match[1]);
      return false;
    }
    return true;
  });
  return { code: kept.join('\n'), stripped: [...stripped] };
}
