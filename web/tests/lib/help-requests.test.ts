import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  appendHelpReply,
  createHelpRequest,
  fetchHelpRequest,
  fetchInstructorInbox,
  setHelpRequestStatus,
} from '@/lib/help-requests';

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('lib/help-requests', () => {
  it('createHelpRequest POSTs to /api/help-requests', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'r1', messages: [] }));
    await createHelpRequest({
      anchorKind: 'lesson',
      anchorId: 'L1',
      title: 'Stuck',
      body: 'help',
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/help-requests');
    expect(init?.method).toBe('POST');
  });

  it('fetchHelpRequest returns null on 404', async () => {
    fetchMock.mockResolvedValueOnce(new Response('not found', { status: 404 }));
    expect(await fetchHelpRequest('r1')).toBeNull();
  });

  it('appendHelpReply POSTs to messages subpath', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'm1' }));
    await appendHelpReply('r1', 'sure');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/help-requests/r1/messages');
    expect(init?.method).toBe('POST');
  });

  it('setHelpRequestStatus PUTs to status subpath', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'r1', status: 'resolved' }));
    await setHelpRequestStatus('r1', 'resolved');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/help-requests/r1/status');
    expect(init?.method).toBe('PUT');
    expect(JSON.parse(init?.body as string)).toEqual({ status: 'resolved' });
  });

  it('fetchInstructorInbox passes status query when provided', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    await fetchInstructorInbox('open');
    expect(fetchMock.mock.calls[0][0]).toContain(
      '/api/instructor/help-requests?status=open',
    );
  });

  it('fetchInstructorInbox omits status query when undefined', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    await fetchInstructorInbox();
    expect(fetchMock.mock.calls[0][0]).toContain('/api/instructor/help-requests');
    expect(fetchMock.mock.calls[0][0]).not.toContain('?status=');
  });
});
