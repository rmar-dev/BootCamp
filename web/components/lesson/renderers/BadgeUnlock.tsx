'use client';
import { useEffect, useState } from 'react';
import { Toast, ToastStack } from '@/components/ui';

const TOAST_DURATION_MS = 4000;

export function BadgeUnlock({
  badges,
}: {
  badges: Array<{ id: string; name: string; icon: string }>;
}) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!badges || badges.length === 0) return;
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    badges.forEach((b, i) => {
      timeouts.push(
        setTimeout(() => setRevealed((prev) => new Set(prev).add(b.id)), 30 + i * 150),
      );
      timeouts.push(
        setTimeout(() => setDismissed((prev) => new Set(prev).add(b.id)), TOAST_DURATION_MS + i * 150),
      );
    });
    return () => timeouts.forEach(clearTimeout);
  }, [badges]);

  if (!badges || badges.length === 0) return null;
  const visibleBadges = badges.filter((b) => !dismissed.has(b.id));
  if (visibleBadges.length === 0) return null;

  return (
    <ToastStack position="top-right">
      {visibleBadges.map((b) => (
        <Toast
          key={b.id}
          tone="brand"
          visible={revealed.has(b.id)}
          icon={<span style={{ fontSize: 'var(--t-xl)' }}>{b.icon}</span>}
          title={b.name}
          description="Badge unlocked"
        />
      ))}
    </ToastStack>
  );
}
