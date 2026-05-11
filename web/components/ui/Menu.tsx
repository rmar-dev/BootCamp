'use client';
import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { cn } from './cn';

export interface MenuItem {
  label: ReactNode;
  icon?: ReactNode;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
}

export interface MenuProps {
  /** The element that opens the menu when clicked. Must accept onClick + ref. */
  trigger: ReactElement;
  items: (MenuItem | 'divider')[];
  align?: 'start' | 'end';
  className?: string;
}

export function Menu({ trigger, items, align = 'end', className }: MenuProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const triggerWithHandler = isValidElement(trigger)
    ? cloneElement(trigger as ReactElement<{ onClick?: (e: React.MouseEvent) => void; 'aria-haspopup'?: string; 'aria-expanded'?: boolean; 'aria-controls'?: string }>, {
        onClick: (e: React.MouseEvent) => {
          (trigger.props as { onClick?: (e: React.MouseEvent) => void }).onClick?.(e);
          setOpen((v) => !v);
        },
        'aria-haspopup': 'menu',
        'aria-expanded': open,
        'aria-controls': menuId,
      })
    : trigger;

  return (
    <span
      ref={wrapperRef}
      className={cn(className)}
      style={{ position: 'relative', display: 'inline-flex' }}
    >
      {triggerWithHandler}
      {open && (
        <div
          id={menuId}
          role="menu"
          className="menu"
          style={{
            top: 'calc(100% + 4px)',
            [align === 'end' ? 'right' : 'left']: 0,
          }}
        >
          {items.map((item, i) => {
            if (item === 'divider') return <div key={i} className="menu-divider" />;
            return (
              <button
                key={i}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                className={cn('menu-item', item.danger && 'danger')}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
              >
                {item.icon}
                <span style={{ flex: 1 }}>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </span>
  );
}
