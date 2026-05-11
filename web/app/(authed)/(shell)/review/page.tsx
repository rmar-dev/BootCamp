'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AppShell } from '@/components/layout/AppShell';
import { fetchReviewQueue, submitReview, type ReviewQueueItem } from '@/lib/review';
import { ReviewMultipleChoice } from '@/components/review/ReviewMultipleChoice';
import { ReviewFillBlank } from '@/components/review/ReviewFillBlank';
import { ReviewPredictOutput } from '@/components/review/ReviewPredictOutput';
import type {
  MultipleChoicePayload,
  FillBlankPayload,
  PredictOutputPayload,
} from '@/lib/exercise-payloads';

type Status = 'loading' | 'error' | 'reviewing' | 'done';

export default function ReviewPage() {
  const [items, setItems] = useState<ReviewQueueItem[]>([]);
  const [idx, setIdx] = useState(0);
  const [status, setStatus] = useState<Status>('loading');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [answered, setAnswered] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    fetchReviewQueue()
      .then((res) => {
        if (res.due.length === 0) {
          setStatus('done');
        } else {
          setItems(res.due);
          setStatus('reviewing');
        }
      })
      .catch((e: unknown) => {
        setStatus('error');
        setErrorMsg(e instanceof Error ? e.message : 'Failed to load review queue');
      });
  }, []);

  const current = items[idx];

  async function handleAnswer(payload: unknown) {
    if (!current || answered) return;
    setSubmitError(null);
    try {
      await submitReview(current.cardId, payload);
      setAnswered(true);
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : 'Submit failed');
    }
  }

  function advance() {
    if (idx + 1 >= items.length) {
      setStatus('done');
    } else {
      setIdx(idx + 1);
      setAnswered(false);
      setSubmitError(null);
    }
  }

  return (
    <AppShell title="Review">
      <div className="mx-auto max-w-2xl px-6 py-8">
        {status === 'loading' && (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading review queue...</p>
        )}

        {status === 'error' && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
            {errorMsg}
          </div>
        )}

        {status === 'done' && (
          <div className="rounded-md border border-gray-200 bg-white p-6 text-sm text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              All done — you&apos;re all caught up
            </h2>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Come back when the next card is due.
            </p>
            <div className="mt-4 flex gap-2">
              <Link href="/dashboard" className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500">
                Back to dashboard
              </Link>
              <Link href="/tracks" className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800">
                Browse tracks
              </Link>
            </div>
          </div>
        )}

        {status === 'reviewing' && current && (
          <div>
            <div className="mb-4 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>Review · card {idx + 1} of {items.length}</span>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
              <div className="prose prose-sm mb-4 max-w-none text-gray-700 dark:prose-invert dark:text-gray-300">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {current.exercise.promptMarkdown}
                </ReactMarkdown>
              </div>

              {current.exercise.type === 'multiple_choice' && (
                <ReviewMultipleChoice
                  payload={current.exercise.payload as MultipleChoicePayload}
                  onSubmit={handleAnswer}
                  disabled={answered}
                />
              )}
              {current.exercise.type === 'fill_blank' && (
                <ReviewFillBlank
                  payload={current.exercise.payload as FillBlankPayload}
                  onSubmit={handleAnswer}
                  disabled={answered}
                />
              )}
              {current.exercise.type === 'predict_output' && (
                <ReviewPredictOutput
                  payload={current.exercise.payload as PredictOutputPayload}
                  onSubmit={handleAnswer}
                  disabled={answered}
                />
              )}

              {submitError && (
                <p className="mt-3 text-xs text-red-600 dark:text-red-400">{submitError}</p>
              )}

              {answered && !submitError && (
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={advance}
                    className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500"
                  >
                    Next →
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
