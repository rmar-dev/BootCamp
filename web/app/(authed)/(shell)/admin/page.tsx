'use client';
import { useEffect, useState, type FormEvent } from 'react';
import {
  createInvitation,
  listInvitations,
  revokeInvitation,
  type Invitation,
} from '@/lib/invitations';
import { InvitationCard } from '@/components/invitations/InvitationCard';

export default function AdminPage() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [issued, setIssued] = useState<{ link: string; email: string; name: string; expiresAt: string } | null>(null);
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function refresh() {
    setInvites(await listInvitations());
  }
  useEffect(() => {
    refresh().catch(() => {});
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await createInvitation(email, name, 'instructor');
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      setIssued({ link: `${origin}${res.acceptUrlPath}`, email, name, expiresAt: res.invitation.expiresAt });
      setEmail('');
      setName('');
      await refresh();
    } catch (err) {
      setError((err as Error).message ?? 'Could not create invitation');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRevoke(id: string) {
    await revokeInvitation(id);
    await refresh();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Invite an instructor</h1>

      <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
        <input type="text" required placeholder="Instructor name" value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
        <input type="email" required placeholder="instructor@example.com" value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
        {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
        <button type="submit" disabled={submitting}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:bg-gray-300">
          {submitting ? 'Creating…' : 'Create invitation'}
        </button>
      </form>

      {issued && (
        <InvitationCard email={issued.email} name={issued.name} link={issued.link} expiresAt={issued.expiresAt} />
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Invitations</h2>
        <ul className="space-y-2">
          {invites.map((inv) => (
            <li key={inv.id} className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-2 text-sm dark:border-gray-700">
              <span>{inv.email} · <span className="text-gray-500">{inv.role}</span> · <span className="text-gray-500">{inv.status}</span></span>
              {inv.status === 'pending' && (
                <button onClick={() => handleRevoke(inv.id)} className="text-xs text-red-600 hover:underline">Revoke</button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
