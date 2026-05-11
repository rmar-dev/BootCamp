import { type ComponentPropsWithoutRef, type ElementType } from 'react';
import { cn } from './cn';

export type HeadingLevel = 'display' | 'h1' | 'h2' | 'h3' | 'h4';

const TAG_BY_LEVEL: Record<HeadingLevel, ElementType> = {
  display: 'h1', h1: 'h1', h2: 'h2', h3: 'h3', h4: 'h4',
};
const CLASS_BY_LEVEL: Record<HeadingLevel, string> = {
  display: 'h-display', h1: 'h1', h2: 'h2', h3: 'h3', h4: 'h4',
};

export interface HeadingProps extends ComponentPropsWithoutRef<'h1'> {
  level?: HeadingLevel;
  as?: ElementType;
}

export function Heading({ level = 'h2', as, className, ...rest }: HeadingProps) {
  const Tag = (as || TAG_BY_LEVEL[level]) as ElementType;
  return <Tag className={cn(CLASS_BY_LEVEL[level], className)} {...rest} />;
}
