import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AIReview } from '@/components/lesson/renderers/AIReview';

class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  withCredentials: boolean;
  listeners: Record<string, Array<(e: MessageEvent) => void>> = {};
  closed = false;
  constructor(url: string, opts?: { withCredentials?: boolean }) {
    this.url = url;
    this.withCredentials = opts?.withCredentials ?? false;
    MockEventSource.instances.push(this);
  }
  addEventListener(name: string, cb: (e: MessageEvent) => void) {
    (this.listeners[name] ??= []).push(cb);
  }
  emit(name: string, data: string) {
    for (const cb of this.listeners[name] ?? []) cb({ data } as MessageEvent);
  }
  close() {
    this.closed = true;
  }
}

beforeEach(() => {
  MockEventSource.instances = [];
  (global as any).EventSource = MockEventSource;
  vi.spyOn(global, 'fetch' as any).mockResolvedValue({
    ok: true,
    json: async () => ({ markdown: 'fallback markdown' }),
  } as any);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('AIReview', () => {
  it('renders nothing when attemptId is null', () => {
    const { container } = render(<AIReview attemptId={null} />);
    expect(container.textContent).toBe('');
  });

  it('streams chunks via SSE and appends them to the rendered markdown', async () => {
    render(<AIReview attemptId="a-1" />);
    const sse = MockEventSource.instances[0];
    sse.emit('chunk', JSON.stringify('Hello '));
    sse.emit('chunk', JSON.stringify('world'));
    sse.emit('done', '');
    await waitFor(() => expect(screen.getByText(/Hello world/)).toBeInTheDocument());
    expect(sse.closed).toBe(true);
  });

  it('falls back to polling when SSE errors', async () => {
    render(<AIReview attemptId="a-2" />);
    const sse = MockEventSource.instances[0];
    sse.emit('error', '');
    await waitFor(() => expect(screen.getByText(/fallback markdown/)).toBeInTheDocument());
  });
});
