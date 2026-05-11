export type PromptInput = {
  language: string;
  promptMarkdown: string;
  code: string;
  passed: boolean;
  stderr?: string;
};

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
    lines.push('');
    lines.push(`FAILED output (stderr):`);
    lines.push(stderr);
  }

  lines.push('');
  lines.push('Please review the code above. Be concise (3-5 sentences). Do not explain basics.');

  return lines.join('\n');
}
