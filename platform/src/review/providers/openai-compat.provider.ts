import { ReviewProvider } from '../review-provider.interface';

export class OpenAICompatProvider implements ReviewProvider {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async review(prompt: string): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 512,
          temperature: 0.7,
        }),
        signal: AbortSignal.timeout(30_000),
      });

      if (!response.ok) {
        return 'Review unavailable';
      }

      const data = await response.json() as {
        choices?: Array<{ message?: { content?: string } }>;
      };

      return data?.choices?.[0]?.message?.content ?? 'Review unavailable';
    } catch {
      return 'Review unavailable';
    }
  }
}
