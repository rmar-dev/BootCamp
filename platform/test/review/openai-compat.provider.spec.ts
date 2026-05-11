import { OpenAICompatProvider } from '../../src/review/providers/openai-compat.provider';

describe('OpenAICompatProvider', () => {
  const provider = new OpenAICompatProvider(
    'https://api.example.com/v1',
    'test-api-key',
    'gpt-4',
  );

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns markdown from a successful API response', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Great use of Swift optionals!' } }],
      }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const result = await provider.review('Review this code');

    expect(result).toBe('Great use of Swift optionals!');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.example.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-api-key',
        }),
      }),
    );
  });

  it('returns fallback string on API error (non-2xx)', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const result = await provider.review('Review this code');

    expect(result).toBe('Review unavailable');
  });

  it('returns fallback string on network error', async () => {
    const mockFetch = jest.fn().mockRejectedValue(new Error('Network failure'));
    global.fetch = mockFetch as unknown as typeof fetch;

    const result = await provider.review('Review this code');

    expect(result).toBe('Review unavailable');
  });
});
