'use client';
import { Suspense, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { acceptInvite } from '@/lib/auth';
import { useAuth } from '@/components/layout/AuthProvider';

function AcceptInviteInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const { refresh } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setSubmitting(true);
    try {
      await acceptInvite(token, password);
      await refresh();
      router.push('/');
    } catch (err) {
      setError((err as Error).message === 'accept_failed'
        ? 'This invitation is invalid or has expired.'
        : (err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return <p className="p-8 text-center text-sm text-red-600">Missing invitation token.</p>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <h1 className="mb-6 text-center text-xl font-semibold text-gray-900 dark:text-gray-100">
          Set your password
        </h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="password" required autoComplete="new-password" placeholder="New password"
            value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
          <input type="password" required autoComplete="new-password" placeholder="Confirm password"
            value={confirm} onChange={(e) => setConfirm(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
          {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
          <button type="submit" disabled={submitting}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:bg-gray-300">
            {submitting ? 'Activating…' : 'Activate account'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<p className="p-8 text-center text-sm">Loading…</p>}>
      <AcceptInviteInner />
    </Suspense>
  );
}
