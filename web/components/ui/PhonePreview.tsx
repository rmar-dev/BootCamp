import { type ReactNode } from 'react';
import { cn } from './cn';

export interface PhonePreviewProps {
  children: ReactNode;
  caption?: ReactNode;
  className?: string;
}

/**
 * Phone-shaped chrome used by visual playground exercises to frame the
 * rendered preview. Children render in a centered area inside the phone body.
 */
export function PhonePreview({ children, caption = 'preview', className }: PhonePreviewProps) {
  return (
    <div className={cn('phone-preview', className)}>
      <div className="phone-preview-body">
        <div className="phone-preview-stage">{children}</div>
        {caption && <div className="phone-preview-caption">{caption}</div>}
      </div>
    </div>
  );
}
