'use client';
import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useActiveTrack } from '@/lib/track-context';

export default function TrackRedirectPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { setTrackId, tracks, loading } = useActiveTrack();

  useEffect(() => {
    if (loading || !params?.id) return;
    const exists = tracks.some((t) => t.id === params.id);
    if (exists) setTrackId(params.id);
    router.replace('/tracks');
  }, [params?.id, loading, tracks, setTrackId, router]);

  return null;
}
