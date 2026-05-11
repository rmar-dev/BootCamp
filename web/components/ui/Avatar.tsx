import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { cn } from './cn';

export type AvatarSize = 'sm' | 'md' | 'lg';

export interface AvatarProps extends ComponentPropsWithoutRef<'div'> {
  size?: AvatarSize;
  initials?: string;
  src?: string;
  alt?: string;
}

export const Avatar = forwardRef<HTMLDivElement, AvatarProps>(function Avatar(
  { size = 'md', initials, src, alt = '', className, children, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        'avatar',
        size === 'sm' && 'avatar-sm',
        size === 'lg' && 'avatar-lg',
        className,
      )}
      {...rest}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- Avatar is framework-neutral; pages wrap with next/image when LCP matters.
        <img src={src} alt={alt} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
      ) : (
        initials || children
      )}
    </div>
  );
});
