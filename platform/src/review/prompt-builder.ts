import { detectUnavailableModules } from '../shared/apple-sdk-modules';

export type PromptInput = {
  language: string;
  promptMarkdown: string;
  code: string;
  passed: boolean;
  stderr?: string;
};

// Re-exported for callers/tests that reach for it via the prompt builder.
export { detectUnavailableModules };

export function buildReviewPrompt(input: PromptInput): string {
  const { language, promptMarkdown, code, passed, stderr } = input;
  const status = passed ? 'PASSED' : 'FAILED';

  const lines: string[] = [
    `You are reviewing code submitted by an experienced developer who is learning ${language}.`,
    `They are NOT a beginner — do not explain basics like variables, loops, or functions. Do not explain what the language is.`,
    `Focus on idiomatic ${language} code: use of standard library, language-specific patterns, style, and best practices.`,
    `Keep your review to 3-5 sentences.`,
    ``,
    `Language: ${language}`,
    `Result: ${status}`,
    ``,
    `Exercise:`,
    promptMarkdown,
    ``,
    `Code submitted:`,
    '```',
    code,
    '```',
  ];

  if (!passed && stderr) {
    const unavailable = detectUnavailableModules(stderr);
    if (unavailable.length > 0) {
      // The submission targets Apple frameworks the Linux grader cannot
      // provide, so it never compiled and there is no meaningful failure
      // output. Suppress the module-resolution noise and direct the reviewer
      // to assess the source statically instead.
      lines.push('');
      lines.push(
        `NOTE: This exercise targets Apple frameworks (${unavailable.join(
          ', ',
        )}) that are not available in the grading sandbox, so the code could not be compiled here. This is an environment limitation, NOT a mistake in the submission. Do NOT comment on missing modules, unresolved imports, or module-resolution errors. Review the source above statically for correctness, idiomatic ${language} usage, and best practices.`,
      );
    } else {
      lines.push('');
      lines.push(`FAILED output (stderr):`);
      lines.push(stderr);
    }
  }

  lines.push('');
  lines.push('Please review the code above. Be concise (3-5 sentences). Do not explain basics.');

  return lines.join('\n');
}
