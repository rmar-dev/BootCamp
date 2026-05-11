'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { fetchTracks, type TrackSummary } from '@/lib/tracks';

const STORAGE_KEY = 'bootcamp.activeTrackId';

type TrackContextValue = {
  trackId: string | null;
  setTrackId: (id: string) => void;
  tracks: TrackSummary[];
  loading: boolean;
};

const TrackContext = createContext<TrackContextValue | null>(null);

function readStorage(): string | null {
  if (typeof window === 'undefined') return null;
  try { return window.localStorage.getItem(STORAGE_KEY); } catch { return null; }
}

function writeStorage(id: string): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(STORAGE_KEY, id); } catch { /* ignore */ }
}

export function TrackProvider({ children }: { children: ReactNode }) {
  const [trackId, _setTrackId] = useState<string | null>(null);
  const [tracks, setTracks] = useState<TrackSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetchTracks()
      .then((ts) => {
        if (!alive) return;
        setTracks(ts);
        const stored = readStorage();
        if (stored && ts.some((t) => t.id === stored)) _setTrackId(stored);
        else if (ts.length > 0) {
          _setTrackId(ts[0].id);
          writeStorage(ts[0].id);
        }
      })
      .catch(() => { /* leave trackId null, tracks empty */ })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const setTrackId = (id: string) => {
    _setTrackId(id);
    writeStorage(id);
  };

  return (
    <TrackContext.Provider value={{ trackId, setTrackId, tracks, loading }}>
      {children}
    </TrackContext.Provider>
  );
}

export function useActiveTrack(): TrackContextValue {
  const ctx = useContext(TrackContext);
  if (!ctx) throw new Error('useActiveTrack must be used inside <TrackProvider>');
  return ctx;
}
