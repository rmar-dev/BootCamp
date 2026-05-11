import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { cn } from './cn';
import { Icon } from './Icon';

export type InputProps = ComponentPropsWithoutRef<'input'>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} className={cn('input', className)} {...rest} />;
});

export interface SearchInputProps extends InputProps {
  wrapperClassName?: string;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
  { className, wrapperClassName, ...rest },
  ref,
) {
  return (
    <div className={cn('search', wrapperClassName)} style={{ position: 'relative' }}>
      <Icon name="search" size={16} />
      <input ref={ref} className={cn('input', 'input-search', className)} {...rest} />
    </div>
  );
});
