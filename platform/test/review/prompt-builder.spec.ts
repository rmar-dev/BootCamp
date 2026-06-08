import {
  buildReviewPrompt,
  detectUnavailableModules,
} from '../../src/review/prompt-builder';

describe('buildReviewPrompt', () => {
  it('includes the language and PASSED status', () => {
    const prompt = buildReviewPrompt({
      language: 'swift',
      promptMarkdown: 'Write a function that adds two numbers.',
      code: 'func add(_ a: Int, _ b: Int) -> Int { a + b }',
      passed: true,
    });

    expect(prompt).toContain('swift');
    expect(prompt).toContain('PASSED');
  });

  it('includes FAILED and stderr when the submission did not pass', () => {
    const prompt = buildReviewPrompt({
      language: 'kotlin',
      promptMarkdown: 'Write a function that reverses a string.',
      code: 'fun reverse(s: String) = s',
      passed: false,
      stderr: 'AssertionError: expected "olleh" but got "hello"',
    });

    expect(prompt).toContain('FAILED');
    expect(prompt).toContain('AssertionError: expected "olleh" but got "hello"');
  });

  it('suppresses Apple-SDK "no such module" noise and tells the reviewer to review statically', () => {
    const stderr = [
      "main.swift:3:8: error: no such module 'SwiftUI'",
      'import SwiftUI',
      '       ^',
      "main.swift:7:6: error: unknown attribute 'State'",
      "main.swift:9:14: error: cannot find type 'View' in scope",
    ].join('\n');

    const prompt = buildReviewPrompt({
      language: 'swift',
      promptMarkdown: 'Build a catalog row view.',
      code: 'import SwiftUI\nstruct CatalogRow: View { var body: some View { Text("hi") } }',
      passed: false,
      stderr,
    });

    // The compiler noise must NOT reach the reviewer.
    expect(prompt).not.toContain('no such module');
    expect(prompt).not.toContain("cannot find type 'View'");
    // Instead, an explicit instruction to ignore it and review the source.
    expect(prompt).toContain('SwiftUI');
    expect(prompt.toLowerCase()).toContain('not available in the grading sandbox');
    expect(prompt.toLowerCase()).toContain('do not comment on missing');
  });

  it('still passes through genuine (non-SDK) failure output', () => {
    const prompt = buildReviewPrompt({
      language: 'swift',
      promptMarkdown: 'Reverse a string.',
      code: 'func reverse(_ s: String) -> String { s }',
      passed: false,
      stderr: '❌ FAIL: expected "olleh", got "hello" (main.swift:42)',
    });

    expect(prompt).toContain('FAILED output (stderr):');
    expect(prompt).toContain('❌ FAIL: expected "olleh", got "hello"');
  });

  describe('detectUnavailableModules', () => {
    it('flags Apple-only modules missing on the Linux toolchain', () => {
      const stderr = [
        "error: no such module 'SwiftUI'",
        "error: no such module 'AVKit'",
      ].join('\n');
      expect(detectUnavailableModules(stderr).sort()).toEqual(['AVKit', 'SwiftUI']);
    });

    it('ignores a missing module that is not an Apple SDK', () => {
      // A typo'd user module is a real mistake, not an environment gap.
      expect(detectUnavailableModules("error: no such module 'MyHelpers'")).toEqual([]);
    });

    it('returns empty for stderr without module errors', () => {
      expect(detectUnavailableModules('❌ FAIL: expected 3, got 4')).toEqual([]);
    });
  });

  it('instructs the LLM not to explain basics', () => {
    const prompt = buildReviewPrompt({
      language: 'swift',
      promptMarkdown: 'Implement a stack.',
      code: 'struct Stack<T> { var items: [T] = [] }',
      passed: true,
    });

    expect(prompt.toLowerCase()).toContain('do not explain basics');
  });
});
