'use client';
import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { fetchMe, logout as apiLogout, type UserResponse } from '@/lib/auth';

const BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3000';

type AuthContextType = {
  user: UserResponse | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  totalPoints: number;
  setTotalPoints: (n: number) => void;
  streak: number;
};

const AuthContext = createContext<AuthContextType>({
  user: null, loading: true,
  refresh: async () => {}, logout: async () => {},
  totalPoints: 0, setTotalPoints: () => {},
  streak: 0,
});

export function useAuth() { return useContext(AuthContext); }

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [totalPoints, setTotalPoints] = useState(0);
  const [streak, setStreak] = useState(0);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const me = await fetchMe();
      setUser(me);
      if (me) {
        try {
          const [progressRes, dashRes] = await Promise.all([
            fetch(`${BASE}/api/progress/me`, { credentials: 'include' }),
            fetch(`${BASE}/api/dashboard/me`, { credentials: 'include' }),
          ]);
          if (progressRes.ok) {
            const data = await progressRes.json();
            setTotalPoints(data.totalPoints ?? 0);
          }
          if (dashRes.ok) {
            const data = await dashRes.json();
            setStreak(typeof data.streak === 'number' ? data.streak : (data.streak?.current ?? 0));
          }
        } catch {
          // silently ignore fetch failures
        }
      } else {
        setTotalPoints(0);
        setStreak(0);
      }
    } finally { setLoading(false); }
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
    setTotalPoints(0);
    setStreak(0);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <AuthContext.Provider value={{ user, loading, refresh, logout, totalPoints, setTotalPoints, streak }}>
      {children}
    </AuthContext.Provider>
  );
}
