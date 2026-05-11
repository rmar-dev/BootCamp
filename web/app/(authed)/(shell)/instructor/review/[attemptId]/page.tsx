'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Editor from '@monaco-editor/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAuth } from '@/components/layout/AuthProvider';
import { ReviewForm } from '@/components/instructor/ReviewForm';
import { ReviewThread } from '@/components/instructor/ReviewThread';
import {
  fetchAttemptDetail,
  fetchInstructorReview,
  createInstructorReview,
  updateInstructorReview,
  postReviewMessage,
  approveCapstone,
  type AttemptDetail,
  type InstructorReviewResponse,
} from '@/lib/instructor';

export default function InstructorReviewPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [detail, setDetail] = useState<AttemptDetail | null>(null);
  const [review, setReview] = useState<InstructorReviewResponse | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [d, r] = await Promise.all([
        fetchAttemptDetail(attemptId),
        fetchInstructorReview(attemptId),
      ]);
      setDetail(d);
      setReview(r);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setFetching(false);
    }
  }, [attemptId]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.role !== 'instructor') {
      router.replace('/dashboard');
      return;
    }
    loadData();
  }, [user, authLoading, router, loadData]);

  async function handleSubmitReview(markdown: string) {
    if (review) {
      const updated = await updateInstructorReview(review.id, markdown);
      setReview({ ...review, ...updated });
    } else {
      const created = await createInstructorReview(attemptId, markdown);
      setReview({ ...created, messages: [] });
    }
  }

  async function handlePostMessage(body: string) {
    if (!review) return;
    const msg = await postReviewMessage(review.id, body);
    setReview({ ...review, messages: [...review.messages, msg] });
  }

  async function handleApprove() {
    setApproving(true);
    try {
      await approveCapstone(attemptId);
      await loadData();
    } finally {
      setApproving(false);
    }
  }

  if (authLoading || fetching) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="mx-auto max-w-4xl p-8">
        <p className="text-red-600">Error: {error ?? 'Attempt not found'}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 p-8">
      {/* Left pane: student code or capstone submission */}
      <div className="space-y-4">
        {detail.code ? (
          <>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Student Code
            </h2>
            <div className="overflow-hidden rounded-lg border border-gray-700 bg-gray-900">
              <div className="flex items-center border-b border-gray-700 bg-gray-800 px-3 py-2">
                <span className="text-xs font-medium uppercase tracking-wider text-gray-400">
                  {detail.language}
                </span>
              </div>
              <div className="h-96">
                <Editor
                  height="100%"
                  language={detail.language}
                  value={detail.code}
                  theme="vs-dark"
                  options={{
                    readOnly: true,
                    minimap: { enabled: false },
                    fontSize: 13,
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    tabSize: 2,
                    renderLineHighlight: 'all',
                  }}
                />
              </div>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Capstone Submission
            </h2>
            <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-4 dark:border-gray-700 dark:bg-gray-800">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                  Repository
                </p>
                {detail.submissionPayload?.repoUrl ? (
                  <a
                    href={String(detail.submissionPayload.repoUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 underline break-all dark:text-blue-400"
                  >
                    {String(detail.submissionPayload.repoUrl)}
                  </a>
                ) : (
                  <span className="text-sm text-gray-400">—</span>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                  Commit SHA
                </p>
                <span className="font-mono text-sm text-gray-900 dark:text-gray-100">
                  {detail.submissionPayload?.commitSha ? String(detail.submissionPayload.commitSha) : '—'}
                </span>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                  Notes
                </p>
                <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
                  {detail.submissionPayload?.notes ? String(detail.submissionPayload.notes) : '(no notes)'}
                </pre>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Right pane: prompt, AI review, instructor review, thread */}
      <div className="space-y-6">
        {/* Exercise prompt */}
        <div>
          <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
            Exercise
          </h2>
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {detail.exercisePrompt}
            </ReactMarkdown>
          </div>
        </div>

        {/* AI Review (collapsed) */}
        {detail.aiReviewMarkdown && (
          <details className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800/60 dark:bg-blue-950/40">
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              AI Review
            </summary>
            <div className="prose prose-sm mt-2 max-w-none dark:prose-invert">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {detail.aiReviewMarkdown}
              </ReactMarkdown>
            </div>
          </details>
        )}

        {/* Instructor review form */}
        <div>
          <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
            Your Review
          </h2>
          <ReviewForm
            existingMarkdown={review?.markdown ?? null}
            onSubmit={handleSubmitReview}
          />
        </div>

        {/* Approve Milestone (capstone only, not yet approved) */}
        {!detail.code && detail.approvedByInstructorId == null && (
          <div>
            <button
              type="button"
              onClick={handleApprove}
              disabled={approving}
              className="rounded-lg bg-green-600 px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-green-500 disabled:cursor-not-allowed disabled:bg-gray-300 dark:disabled:bg-gray-700"
            >
              {approving ? 'Approving…' : 'Approve Milestone'}
            </button>
          </div>
        )}

        {/* Thread */}
        {review && (
          <div>
            <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
              Discussion
            </h2>
            <ReviewThread
              messages={review.messages}
              currentUserId={user!.id}
              onPostMessage={handlePostMessage}
            />
          </div>
        )}
      </div>
    </div>
  );
}
