import Link from 'next/link';
import { type ReactNode } from 'react';
import { cn } from '@/components/ui/cn';
import { Icon, type IconName } from '@/components/ui/Icon';

interface CommonProps {
  icon: IconName;
  label: string;
  active?: boolean;
  badge?: ReactNode;
  className?: string;
}

interface LinkVariant extends CommonProps {
  href: string;
  onClick?: never;
}

interface ButtonVariant extends CommonProps {
  href?: never;
  onClick: () => void;
}

export type SidebarNavItemProps = LinkVariant | ButtonVariant;

export function SidebarNavItem(props: SidebarNavItemProps) {
  const { icon, label, active, badge, className } = props;
  const klass = cn('side-link', active && 'active', className);
  const inner = (
    <>
      <Icon name={icon} size={18} className="side-icon" />
      <span className="side-link-label" title={label}>{label}</span>
      {badge}
    </>
  );

  if ('href' in props && props.href !== undefined) {
    return (
      <Link href={props.href} className={klass}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={props.onClick} className={klass} style={{ width: '100%', textAlign: 'left' }}>
      {inner}
    </button>
  );
}
