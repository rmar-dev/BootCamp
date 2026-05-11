'use client';
import { useEffect, useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Callout } from '@/components/ui';

const BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3000';
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 30_000;

export function AIReview({ attemptId }: { attemptId: string | null }) {
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!attemptId) {
      setMarkdown(null);
      setLoading(false);
      setTimedOut(false);
      return;
    }
    cancelledRef.current = false;
    setLoading(true);
    setMarkdown(null);
    setTimedOut(false);

    let sse: EventSource | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let pollAbort: AbortController | null = null;

    const cleanup = () => {
      cancelledRef.current = true;
      if (sse) {
        sse.close();
        sse = null;
      }
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
      if (pollAbort) {
        pollAbort.abort();
        pollAbort = null;
      }
    };

    const startPolling = () => {
      const start = Date.now();
      pollAbort = new AbortController();

      const doPoll = async () => {
        if (cancelledRef.current) return;
        if (Date.now() - start > POLL_TIMEOUT_MS) {
          if (pollTimer) clearInterval(pollTimer);
          setLoading(false);
          setTimedOut(true);
          return;
        }
        try {
          const res = await fetch(`${BASE}/api/reviews/${attemptId}`, {
            credentials: 'include',
            signal: pollAbort?.signal,
          });
          if (res.ok) {
            const json = await res.json();
            if (!cancelledRef.current) {
              setMarkdown(json.markdown);
              setLoading(false);
              if (pollTimer) clearInterval(pollTimer);
            }
          }
        } catch {
          /* retry */
        }
      };

      // Fire immediately, then on each interval
      doPoll();
      pollTimer = setInterval(doPoll, POLL_INTERVAL_MS);
    };

    try {
      sse = new EventSource(`${BASE}/api/reviews/${attemptId}/stream`, { withCredentials: true });
      sse.addEventListener('chunk', (e) => {
        if (cancelledRef.current) return;
        const piece = JSON.parse((e as MessageEvent).data) as string;
        setMarkdown((prev) => (prev ?? '') + piece);
      });
      sse.addEventListener('done', () => {
        if (cancelledRef.current) return;
        setLoading(false);
        sse?.close();
        sse = null;
      });
      sse.addEventListener('error', () => {
        if (cancelledRef.current) return;
        sse?.close();
        sse = null;
        setMarkdown(null); // discard partial; fallback re-renders the full markdown
        startPolling();
      });
    } catch {
      startPolling();
    }

    return cleanup;
  }, [attemptId]);

  if (!attemptId || timedOut) return null;
  if (loading && !markdown) {
    return (
      <Callout tone="neutral" title="Reviewing your code…" icon={<span style={{ fontSize: 'var(--t-base)' }}>🤖</span>} />
    );
  }
  if (!markdown) return null;

  return (
    <Callout tone="info" title="AI review" icon={<span style={{ fontSize: 'var(--t-base)' }}>🤖</span>}>
      <div className="prose prose-sm max-w-none dark:prose-invert">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
      </div>
    </Callout>
  );
}
