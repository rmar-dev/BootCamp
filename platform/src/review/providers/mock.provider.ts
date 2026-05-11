import { ReviewProvider } from '../review-provider.interface';

export class MockProvider implements ReviewProvider {
  async review(prompt: string): Promise<string> {
    const languageMatch = prompt.match(/Language:\s*(\w+)/i);
    const language = languageMatch ? languageMatch[1] : 'unknown';

    const passed = prompt.includes('PASSED');
    const status = passed ? 'passed' : 'failed';

    return `**Mock Code Review**

Your ${language} submission ${status}. This is a mock review for development purposes.

${passed
  ? `Good work! The solution is correct. Consider whether your ${language} code follows idiomatic conventions and takes advantage of language-specific features.`
  : `The solution did not pass. Review the error output and consider the expected behavior. Think about how ${language} idioms could help you write a cleaner solution.`
}

Keep practicing to write more idiomatic ${language} code.`;
  }
}
