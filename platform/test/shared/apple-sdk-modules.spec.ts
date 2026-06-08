import {
  detectUnavailableModules,
  stripUnavailableImports,
} from '../../src/shared/apple-sdk-modules';

describe('detectUnavailableModules', () => {
  it('flags Apple-only modules missing on the Linux toolchain', () => {
    const stderr = [
      "error: no such module 'SwiftUI'",
      "error: no such module 'AVKit'",
    ].join('\n');
    expect(detectUnavailableModules(stderr).sort()).toEqual(['AVKit', 'SwiftUI']);
  });

  it('ignores a missing module that is not an Apple SDK', () => {
    expect(detectUnavailableModules("error: no such module 'MyHelpers'")).toEqual([]);
  });

  it('returns empty for stderr without module errors', () => {
    expect(detectUnavailableModules('❌ FAIL: expected 3, got 4')).toEqual([]);
  });
});

describe('stripUnavailableImports', () => {
  it('removes Apple-only imports and reports which were stripped', () => {
    const src = 'import SwiftUI\nimport Combine\nfunc f() -> Int { 1 }';
    const { code, stripped } = stripUnavailableImports(src);
    expect(code).toBe('func f() -> Int { 1 }');
    expect(stripped.sort()).toEqual(['Combine', 'SwiftUI']);
  });

  it('strips imports with leading whitespace', () => {
    const { code, stripped } = stripUnavailableImports('\timport UIKit\nlet x = 1');
    expect(code).toBe('let x = 1');
    expect(stripped).toEqual(['UIKit']);
  });

  it('keeps Foundation and standard-library imports intact', () => {
    const src = 'import Foundation\nfunc f() {}';
    const { code, stripped } = stripUnavailableImports(src);
    expect(code).toBe(src);
    expect(stripped).toEqual([]);
  });

  it('does not strip a user module whose name merely starts like an SDK', () => {
    // "SwiftUIHelpers" is a distinct identifier — must not match SwiftUI.
    const src = 'import SwiftUIHelpers\nlet x = 1';
    const { code, stripped } = stripUnavailableImports(src);
    expect(code).toBe(src);
    expect(stripped).toEqual([]);
  });

  it('de-duplicates repeated imports of the same module', () => {
    const { stripped } = stripUnavailableImports('import SwiftUI\nimport SwiftUI\nlet x = 1');
    expect(stripped).toEqual(['SwiftUI']);
  });
});
