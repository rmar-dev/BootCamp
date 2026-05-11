import { buildReviewPrompt } from '../../src/review/prompt-builder';

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
