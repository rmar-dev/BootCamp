'use client';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function ReviewForm({
  existingMarkdown,
  onSubmit,
}: {
  existingMarkdown: string | null;
  onSubmit: (markdown: string) => Promise<void>;
}) {
  const [markdown, setMarkdown] = useState(existingMarkdown ?? '');
  const [editing, setEditing] = useState(existingMarkdown === null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!markdown.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit(markdown);
      setEditing(false);
    } finally {
      setSubmitting(false);
    }
  }

  if (!editing && existingMarkdown) {
    return (
      <div>
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{existingMarkdown}</ReactMarkdown>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-2 text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          Edit review
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <textarea
        value={markdown}
        onChange={(e) => setMarkdown(e.target.value)}
        placeholder="Write your review in markdown..."
        rows={6}
        className="w-full rounded-lg border border-gray-300 bg-white p-3 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || !markdown.trim()}
          className="rounded-lg bg-green-600 px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-green-500 disabled:cursor-not-allowed disabled:bg-gray-300 dark:disabled:bg-gray-700"
        >
          {submitting ? 'Saving...' : existingMarkdown ? 'Update Review' : 'Submit Review'}
        </button>
        {existingMarkdown && (
          <button
            type="button"
            onClick={() => { setEditing(false); setMarkdown(existingMarkdown); }}
            className="rounded-lg bg-gray-200 px-5 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
