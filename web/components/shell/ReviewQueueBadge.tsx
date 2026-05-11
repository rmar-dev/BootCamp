'use client';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { fetchReviewQueue } from '@/lib/review';

export function ReviewQueueBadge() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchReviewQueue()
      .then((res) => {
        if (cancelled) return;
        setCount(res.due.length);
      })
      .catch(() => {
        if (cancelled) return;
        setCount(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (count === null || count <= 0) return null;
  return <Badge tone="brand">{count}</Badge>;
}
