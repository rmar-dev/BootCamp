'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { fetchDashboard, type DashboardData, type BadgeStatus } from '@/lib/gamification';

function BadgeRow({ badge }: { badge: BadgeStatus }) {
  return (
    <div
      title={badge.earned ? badge.description : `Locked — ${badge.description}`}
      className="flex items-start gap-3 border-b border-gray-200 px-4 py-3 last:border-b-0 dark:border-gray-800"
    >
      <span
        className={
          badge.earned
            ? 'text-2xl leading-none'
            : 'text-2xl leading-none grayscale opacity-30'
        }
      >
        {badge.icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={
              badge.earned
                ? 'text-sm font-semibold text-gray-900 dark:text-gray-100'
                : 'text-sm font-semibold text-gray-500 dark:text-gray-500'
            }
          >
            {badge.name}
          </span>
          {badge.earned ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-400">
              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-green-600 dark:bg-green-500" />
              Earned
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
              Locked
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
          {badge.description}
        </p>
        {badge.earned && badge.earnedAt && (
          <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-500">
            Earned on {new Date(badge.earnedAt).toLocaleDateString()}
          </p>
        )}
      </div>
    </div>
  );
}

export default function BadgesPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboard()
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load badges'));
  }, []);

  const badges = data?.badges ?? [];
  const earned = badges.filter((b) => b.earned);
  const locked = badges.filter((b) => !b.earned);
  const progressPct = badges.length > 0 ? Math.round((earned.length / badges.length) * 100) : 0;

  return (
    <AppShell title="Achievements">
      <div className="mx-auto max-w-3xl px-6 py-6">
        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
            {error}
          </div>
        )}

        {!data && !error && (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
        )}

        {data && (
          <>
            {/* Summary */}
            <div className="mb-6 rounded-md border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
              <div className="flex items-baseline justify-between">
                <div>
                  <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                    Achievements
                  </h1>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {earned.length} of {badges.length} earned · {progressPct}% complete
                  </p>
                </div>
              </div>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                <div
                  className="h-full rounded-full bg-green-600 transition-all duration-500 ease-out dark:bg-green-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            {earned.length > 0 && (
              <section className="mb-6">
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Earned ({earned.length})
                </h2>
                <div className="rounded-md border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
                  {earned.map((b) => <BadgeRow key={b.id} badge={b} />)}
                </div>
              </section>
            )}

            {locked.length > 0 && (
              <section>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Locked ({locked.length})
                </h2>
                <div className="rounded-md border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
                  {locked.map((b) => <BadgeRow key={b.id} badge={b} />)}
                </div>
              </section>
            )}

            {badges.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">No achievements available yet.</p>
            )}

            <div className="mt-6">
              <Link
                href="/tracks"
                className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                Browse tracks →
              </Link>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
