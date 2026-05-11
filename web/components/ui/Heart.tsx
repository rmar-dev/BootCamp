import { cn } from './cn';

export interface HeartProps {
  empty?: boolean;
  size?: number;
  className?: string;
}

export function Heart({ empty, size = 16, className }: HeartProps) {
  return (
    <svg className={cn('heart', empty && 'empty', className)} viewBox="0 0 24 24" width={size} height={size}>
      <path
        d="M12 21s-7-4.5-9.5-9C1 9 2.5 5 6 5c2 0 3.5 1 4.5 2.5C11.5 6 13 5 15 5c3.5 0 5 4 3.5 7-2.5 4.5-9.5 9-9.5 9z"
        fill="currentColor"
      />
    </svg>
  );
}
