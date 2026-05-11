'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from './cn';
import { Icon } from './Icon';

export type ModalSize = 'sm' | 'md' | 'lg';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  size?: ModalSize;
  /** Footer content — typically action buttons. */
  footer?: ReactNode;
  /** Hide the X close button in the header. */
  hideClose?: boolean;
  children: ReactNode;
  className?: string;
  /** Disable closing via backdrop click + escape. */
  disableDismiss?: boolean;
}

export function Modal({
  open,
  onClose,
  title,
  size = 'sm',
  footer,
  hideClose,
  children,
  className,
  disableDismiss,
}: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || disableDismiss) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, disableDismiss]);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (disableDismiss) return;
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        className={cn('modal', size === 'md' && 'modal-md', size === 'lg' && 'modal-lg', className)}
      >
        {(title || !hideClose) && (
          <div className="modal-head">
            {title ? (
              <h2 id="modal-title" className="modal-title">
                {title}
              </h2>
            ) : (
              <span />
            )}
            {!hideClose && (
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-icon"
                aria-label="Close"
                onClick={onClose}
              >
                <Icon name="x" size={16} />
              </button>
            )}
          </div>
        )}
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
