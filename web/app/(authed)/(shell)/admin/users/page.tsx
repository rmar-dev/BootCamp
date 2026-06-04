'use client';
import { useEffect, useState } from 'react';
import { listUsers, changeUserRole, type AdminUser, type AdminUserRole } from '@/lib/admin';
import { useAuth } from '@/components/layout/AuthProvider';

const ROLES: AdminUserRole[] = ['student', 'instructor', 'admin'];

export default function AdminUsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh() {
    setUsers(await listUsers());
  }
  useEffect(() => {
    refresh().catch((e) => setError((e as Error).message));
  }, []);

  async function onChangeRole(id: string, role: AdminUserRole) {
    setError('');
    setBusyId(id);
    try {
      await changeUserRole(id, role);
      await refresh();
    } catch (e) {
      setError((e as Error).message ?? 'Could not change role');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">User management</h1>
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
            <tr>
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Role</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isMe = u.id === me?.id;
              return (
                <tr key={u.id} className="border-t border-gray-100 dark:border-gray-800">
                  <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{u.email}</td>
                  <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{u.name}</td>
                  <td className="px-4 py-2 text-gray-500">{u.status}</td>
                  <td className="px-4 py-2">
                    <select
                      aria-label={`Role for ${u.email}`}
                      value={u.role}
                      disabled={isMe || busyId === u.id}
                      onChange={(e) => onChangeRole(u.id, e.target.value as AdminUserRole)}
                      className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                    {isMe && <span className="ml-2 text-xs text-gray-400">(you)</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
