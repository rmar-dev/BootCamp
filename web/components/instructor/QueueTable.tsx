'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { QueueItem } from '@/lib/instructor';

type Tab = 'pending' | 'reviewed';

export function QueueTable({
  pending,
  reviewed,
}: {
  pending: QueueItem[];
  reviewed: QueueItem[];
}) {
  const [tab, setTab] = useState<Tab>('pending');
  const [lessonFilter, setLessonFilter] = useState<string>('all');

  const allItems = tab === 'pending' ? pending : reviewed;
  const lessons = [...new Set([...pending, ...reviewed].map((i) => i.lessonTitle))].sort();
  const items = lessonFilter === 'all' ? allItems : allItems.filter((i) => i.lessonTitle === lessonFilter);

  return (
    <div>
      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => setTab('pending')}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            tab === 'pending'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
          }`}
        >
          Pending ({pending.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('reviewed')}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            tab === 'reviewed'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
          }`}
        >
          Reviewed ({reviewed.length})
        </button>
      </div>

      {lessons.length > 1 && (
        <div className="mb-4">
          <select
            value={lessonFilter}
            onChange={(e) => setLessonFilter(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          >
            <option value="all">All lessons</option>
            {lessons.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>
      )}

      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
          {tab === 'pending' ? 'No submissions waiting for review.' : 'No reviewed submissions yet.'}
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Student</th>
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Exercise</th>
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Lesson</th>
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Submitted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {items.map((item) => (
                <tr key={item.attemptId} className="transition hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/instructor/review/${item.attemptId}`}
                      className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {item.studentName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    {item.exercisePrompt.slice(0, 60)}{item.exercisePrompt.length > 60 ? '...' : ''}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{item.lessonTitle}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {new Date(item.submittedAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
