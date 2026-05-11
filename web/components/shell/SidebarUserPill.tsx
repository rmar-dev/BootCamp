'use client';
import { useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { useAuth } from '@/components/layout/AuthProvider';
import { SettingsMenu } from '@/components/layout/SettingsMenu';

export function SidebarUserPill() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  if (!user) return null;
  return (
    <div style={{ marginTop: 'auto', position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Open settings for ${user.name}`}
        style={{
          width: '100%',
          padding: 12,
          borderRadius: 'var(--r-md)',
          background: 'var(--bg-2)',
          border: '1px solid var(--line-1)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          textAlign: 'left',
          cursor: 'pointer',
        }}
      >
        <Avatar size="sm" initials={user.name.charAt(0).toUpperCase()} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 'var(--t-sm)', fontWeight: 600 }}>{user.name}</div>
          <div className="mono muted" style={{ fontSize: 'var(--t-2xs)' }}>{user.email}</div>
        </div>
      </button>
      {open && <SettingsMenu anchored onClose={() => setOpen(false)} />}
    </div>
  );
}
