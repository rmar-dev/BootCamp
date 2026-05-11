'use client';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type Message = {
  id: string;
  authorId: string;
  body: string;
  createdAt: string;
};

export function ReviewThread({
  messages,
  currentUserId,
  onPostMessage,
}: {
  messages: Message[];
  currentUserId: string;
  onPostMessage: (body: string) => Promise<void>;
}) {
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);

  async function handlePost() {
    if (!body.trim()) return;
    setPosting(true);
    try {
      await onPostMessage(body);
      setBody('');
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="space-y-4">
      {messages.length > 0 && (
        <div className="space-y-3">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`rounded-lg p-3 text-sm ${
                msg.authorId === currentUserId
                  ? 'ml-8 bg-blue-50 dark:bg-blue-950/40'
                  : 'mr-8 bg-gray-50 dark:bg-gray-800'
              }`}
            >
              <div className="mb-1 text-xs text-gray-500 dark:text-gray-400">
                {msg.authorId === currentUserId ? 'You' : 'Other'} &middot;{' '}
                {new Date(msg.createdAt).toLocaleString()}
              </div>
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.body}</ReactMarkdown>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write a message..."
          rows={3}
          className="w-full rounded-lg border border-gray-300 bg-white p-3 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        />
        <button
          type="button"
          onClick={handlePost}
          disabled={posting || !body.trim()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-gray-300 dark:disabled:bg-gray-700"
        >
          {posting ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
}
