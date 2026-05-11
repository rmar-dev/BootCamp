'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/layout/AuthProvider';
import { QueueTable } from '@/components/instructor/QueueTable';
import { fetchQueue, fetchReviewedQueue, type QueueItem } from '@/lib/instructor';

export default function InstructorDashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [pending, setPending] = useState<QueueItem[]>([]);
  const [reviewed, setReviewed] = useState<QueueItem[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user || (user.role !== 'instructor' && user.role !== 'admin')) {
      router.replace('/dashboard');
      return;
    }
    Promise.all([fetchQueue(), fetchReviewedQueue()])
      .then(([p, r]) => { setPending(p); setReviewed(r); })
      .catch((err) => setError(err.message))
      .finally(() => setFetching(false));
  }, [user, loading, router]);

  if (loading || fetching) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl p-8">
        <p className="text-red-600">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-gray-100">
        Review Queue
      </h1>
      <QueueTable pending={pending} reviewed={reviewed} />
    </div>
  );
}
