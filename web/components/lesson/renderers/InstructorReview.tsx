'use client';
import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Avatar, Button, Callout, Eyebrow, Stack } from '@/components/ui';
import { useAuth } from '@/components/layout/AuthProvider';
import {
  fetchInstructorReview,
  postReviewMessage,
  type InstructorReviewResponse,
} from '@/lib/instructor';

export function InstructorReview({ attemptId }: { attemptId: string | null }) {
  const { user } = useAuth();
  const [review, setReview] = useState<InstructorReviewResponse | null>(null);
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    if (!attemptId) { setReview(null); return; }
    fetchInstructorReview(attemptId).then(setReview).catch(() => setReview(null));
  }, [attemptId]);

  if (!review) return null;

  async function handlePost() {
    if (!body.trim() || !review) return;
    setPosting(true);
    try {
      const msg = await postReviewMessage(review.id, body);
      setReview({ ...review, messages: [...review.messages, msg] });
      setBody('');
    } finally {
      setPosting(false);
    }
  }

  return (
    <Callout tone="success" title="Instructor Review">
      <Stack gap="default">
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{review.markdown}</ReactMarkdown>
        </div>

        {review.messages.length > 0 && (
          <Stack gap="tight" style={{ paddingTop: 12, borderTop: '1px solid color-mix(in oklch, var(--success-400) 25%, transparent)' }}>
            {review.messages.map((msg) => {
              const isYou = msg.authorId === user?.id;
              return (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    flexDirection: isYou ? 'row-reverse' : 'row',
                    gap: 8,
                    alignItems: 'flex-start',
                  }}
                >
                  <Avatar size="sm" initials={isYou ? 'You' : 'Ins'} />
                  <div
                    style={{
                      flex: '1 1 auto',
                      maxWidth: '85%',
                      padding: '8px 12px',
                      borderRadius: 'var(--r-md)',
                      background: isYou ? 'var(--brand-bg)' : 'var(--bg-2)',
                      border: '1px solid var(--line-2)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                      <span className="mono" style={{ fontSize: 'var(--t-2xs)', color: 'var(--text-3)' }}>
                        {isYou ? 'You' : 'Instructor'}
                      </span>
                      <span className="mono" style={{ fontSize: 'var(--t-2xs)', color: 'var(--text-4)' }}>
                        {new Date(msg.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.body}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              );
            })}
          </Stack>
        )}

        <Stack gap="tight">
          <Eyebrow as="span">Reply</Eyebrow>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Ask a question about this review…"
            rows={2}
            className="predict-answer"
          />
          <div>
            <Button variant="primary" size="sm" onClick={handlePost} disabled={posting || !body.trim()}>
              {posting ? 'Sending…' : 'Ask a question'}
            </Button>
          </div>
        </Stack>
      </Stack>
    </Callout>
  );
}
