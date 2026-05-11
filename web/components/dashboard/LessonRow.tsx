import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon, type IconName } from '@/components/ui/Icon';
import { cn } from '@/components/ui/cn';

export type LessonRowProps = {
  icon: IconName;
  title: string;
  meta: string;
  state: 'next' | 'queued' | 'completed';
  href: string;
  badge?: ReactNode;
  accentColor?: string;
};

export function LessonRow({ icon, title, meta, state, href, badge, accentColor }: LessonRowProps) {
  const className = cn('lesson-row', state === 'completed' && 'completed');
  const iconStyle =
    state === 'next' && accentColor
      ? { background: accentColor, color: '#0a0a0a', borderColor: accentColor }
      : undefined;
  return (
    <Link href={href} className={className}>
      <div className="lesson-icon" style={iconStyle}>
        <Icon name={icon} size={20} />
      </div>
      <div>
        <div style={{ fontWeight: 600, marginBottom: 2 }}>{title}</div>
        <div className="muted mono" style={{ fontSize: 'var(--t-xs)' }}>{meta}</div>
      </div>
      {badge ?? <span />}
      <Icon name="chevR" size={16} style={{ color: 'var(--text-3)' }} />
    </Link>
  );
}
