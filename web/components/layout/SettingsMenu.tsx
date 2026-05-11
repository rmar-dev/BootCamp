'use client';
import { useEffect, useRef, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/layout/AuthProvider';
import { useTweaks } from '@/lib/tweaks';
import { Avatar } from '@/components/ui/Avatar';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Divider } from '@/components/ui/Divider';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Row } from '@/components/ui/Row';
import { Stack } from '@/components/ui/Stack';

const ROLE_TONES: Record<string, BadgeTone> = {
  admin: 'iris',
  instructor: 'amber',
  student: 'brand',
};

export interface SettingsMenuProps {
  anchored?: boolean;
  onClose?: () => void;
}

export function SettingsMenu({ anchored, onClose }: SettingsMenuProps = {}) {
  const { user, logout } = useAuth();
  const { theme, density, setTheme, setDensity } = useTweaks();
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!anchored || !onClose) return;
    function onDown(e: MouseEvent) {
      if (!ref.current || ref.current.contains(e.target as Node)) return;
      onClose?.();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose?.();
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [anchored, onClose]);

  async function handleSignOut() {
    await logout();
    onClose?.();
    router.push('/login');
  }

  const popoverStyle: CSSProperties = anchored
    ? { position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: 8, zIndex: 20, width: 280 }
    : {};

  return (
    <div ref={ref} style={popoverStyle} role="dialog" aria-label="Settings">
      <Card variant="elevated">
        <Stack>
          <section>
            <Eyebrow>Appearance</Eyebrow>
            <Row style={{ gap: 6, marginTop: 8 }}>
              {(['system', 'light', 'dark'] as const).map((m) => (
                <Chip key={m} active={theme === m} onClick={() => setTheme(m)}>{m}</Chip>
              ))}
            </Row>
          </section>

          <section>
            <Eyebrow>Density</Eyebrow>
            <Row style={{ gap: 6, marginTop: 8 }}>
              {(['comfortable', 'compact'] as const).map((d) => (
                <Chip key={d} active={density === d} onClick={() => setDensity(d)}>{d}</Chip>
              ))}
            </Row>
          </section>

          <Divider />

          <section>
            <Eyebrow>Account</Eyebrow>
            {user ? (
              <Stack gap="tight" style={{ marginTop: 8 }}>
                <Row style={{ gap: 12 }}>
                  <Avatar initials={user.name.charAt(0).toUpperCase()} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 'var(--t-sm)', fontWeight: 600 }}>{user.name}</div>
                    <div className="muted" style={{ fontSize: 'var(--t-xs)' }}>{user.email}</div>
                  </div>
                  <Badge tone={ROLE_TONES[user.role] ?? 'brand'}>{user.role}</Badge>
                </Row>
                <Button variant="outline" onClick={handleSignOut} style={{ width: '100%' }}>
                  Sign out
                </Button>
              </Stack>
            ) : (
              <p className="muted" style={{ fontSize: 'var(--t-sm)', marginTop: 8 }}>Not signed in.</p>
            )}
          </section>
        </Stack>
      </Card>
    </div>
  );
}
