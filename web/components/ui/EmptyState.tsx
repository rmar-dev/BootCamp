import type { ReactNode } from 'react';
import { cn } from './cn';
import { Icon, type IconName } from './Icon';

export interface EmptyStateProps {
  icon?: IconName | ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  const renderedIcon =
    typeof icon === 'string' ? <Icon name={icon as IconName} size={20} /> : icon;
  return (
    <div className={cn('empty', className)}>
      {renderedIcon && <div className="empty-icon">{renderedIcon}</div>}
      <h3 className="empty-title">{title}</h3>
      {description && <p className="empty-desc">{description}</p>}
      {action}
    </div>
  );
}
