import type { CSSProperties, ReactNode } from 'react';

export type IconName =
  | 'home' | 'tree' | 'play' | 'user' | 'trophy' | 'bookmark'
  | 'settings' | 'flame' | 'bolt' | 'check' | 'chevR' | 'chevL'
  | 'star' | 'lock' | 'code' | 'grid' | 'book' | 'target'
  | 'search' | 'plus' | 'arrowR' | 'refresh'
  | 'drag' | 'dots' | 'x' | 'pencil' | 'trash' | 'eye'
  | 'duplicate' | 'video' | 'text' | 'puzzle';

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
}

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const paths: Record<IconName, ReactNode> = {
  home: (<><path d="M3 11l9-8 9 8" {...stroke} /><path d="M5 10v10h14V10" {...stroke} /></>),
  tree: (<><circle cx="6" cy="6" r="2.5" {...stroke} /><circle cx="18" cy="6" r="2.5" {...stroke} /><circle cx="12" cy="18" r="2.5" {...stroke} /><path d="M6 8.5v3a3 3 0 003 3h6a3 3 0 003-3v-3" {...stroke} /><path d="M12 14.5V18" {...stroke} /></>),
  play: <polygon points="6 4 20 12 6 20 6 4" fill="currentColor" />,
  user: (<><circle cx="12" cy="8" r="4" {...stroke} /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" {...stroke} /></>),
  trophy: (<><path d="M7 4h10v4a5 5 0 01-10 0V4z" {...stroke} /><path d="M7 6H4v2a3 3 0 003 3M17 6h3v2a3 3 0 01-3 3" {...stroke} /><path d="M9 14h6l-1 4h-4l-1-4zM7 20h10" {...stroke} /></>),
  bookmark: <path d="M6 3h12v18l-6-4-6 4V3z" {...stroke} />,
  settings: (<><circle cx="12" cy="12" r="3" {...stroke} /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" {...stroke} /></>),
  flame: <path d="M12 3c1 4 5 4 5 9a5 5 0 11-10 0c0-2 1-3 2-4-1 4 3 4 3-5z" {...stroke} />,
  bolt: <polygon points="13 2 4 14 11 14 9 22 20 10 13 10 13 2" {...stroke} />,
  check: <polyline points="5 12 10 17 19 7" {...stroke} strokeWidth={2.5} />,
  chevR: <polyline points="9 6 15 12 9 18" {...stroke} />,
  chevL: <polyline points="15 6 9 12 15 18" {...stroke} />,
  star: <polygon points="12 3 14.5 9.5 21 10 16 14.5 17.5 21 12 17.5 6.5 21 8 14.5 3 10 9.5 9.5" {...stroke} fill="currentColor" />,
  lock: (<><rect x="4" y="11" width="16" height="10" rx="2" {...stroke} /><path d="M8 11V7a4 4 0 018 0v4" {...stroke} /></>),
  code: (<><polyline points="9 8 4 12 9 16" {...stroke} /><polyline points="15 8 20 12 15 16" {...stroke} /></>),
  grid: (<><rect x="4" y="4" width="7" height="7" rx="1" {...stroke} /><rect x="13" y="4" width="7" height="7" rx="1" {...stroke} /><rect x="4" y="13" width="7" height="7" rx="1" {...stroke} /><rect x="13" y="13" width="7" height="7" rx="1" {...stroke} /></>),
  book: (<><path d="M4 4h6a3 3 0 013 3v13a2 2 0 00-2-2H4V4z" {...stroke} /><path d="M20 4h-6a3 3 0 00-3 3v13a2 2 0 012-2h7V4z" {...stroke} /></>),
  target: (<><circle cx="12" cy="12" r="9" {...stroke} /><circle cx="12" cy="12" r="5" {...stroke} /><circle cx="12" cy="12" r="1.5" fill="currentColor" /></>),
  search: (<><circle cx="11" cy="11" r="7" {...stroke} /><path d="m21 21-4.3-4.3" {...stroke} /></>),
  plus: <path d="M12 5v14M5 12h14" {...stroke} />,
  arrowR: <path d="M5 12h14M13 6l6 6-6 6" {...stroke} />,
  refresh: (<><path d="M3 12a9 9 0 0115-6.7L21 8M21 12a9 9 0 01-15 6.7L3 16" {...stroke} /><polyline points="21 3 21 8 16 8" {...stroke} /><polyline points="3 21 3 16 8 16" {...stroke} /></>),
  drag: (<><circle cx="9" cy="6" r="1.4" fill="currentColor" /><circle cx="15" cy="6" r="1.4" fill="currentColor" /><circle cx="9" cy="12" r="1.4" fill="currentColor" /><circle cx="15" cy="12" r="1.4" fill="currentColor" /><circle cx="9" cy="18" r="1.4" fill="currentColor" /><circle cx="15" cy="18" r="1.4" fill="currentColor" /></>),
  dots: (<><circle cx="12" cy="6" r="1.5" fill="currentColor" /><circle cx="12" cy="12" r="1.5" fill="currentColor" /><circle cx="12" cy="18" r="1.5" fill="currentColor" /></>),
  x: <path d="M6 6l12 12M18 6L6 18" {...stroke} />,
  pencil: (<><path d="M4 20h4l11-11-4-4L4 16v4z" {...stroke} /><path d="M14 6l4 4" {...stroke} /></>),
  trash: (<><path d="M5 7h14" {...stroke} /><path d="M9 7V4h6v3" {...stroke} /><path d="M7 7l1 13a2 2 0 002 2h4a2 2 0 002-2l1-13" {...stroke} /></>),
  eye: (<><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" {...stroke} /><circle cx="12" cy="12" r="3" {...stroke} /></>),
  duplicate: (<><rect x="8" y="8" width="12" height="12" rx="2" {...stroke} /><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2" {...stroke} /></>),
  video: (<><rect x="3" y="6" width="13" height="12" rx="2" {...stroke} /><path d="M16 10l5-3v10l-5-3" {...stroke} /></>),
  text: (<><path d="M5 6h14" {...stroke} /><path d="M5 12h14" {...stroke} /><path d="M5 18h9" {...stroke} /></>),
  puzzle: (<><path d="M10 4h4v3a2 2 0 104 0V7h3v4h-1a2 2 0 100 4h1v4h-3v-1a2 2 0 10-4 0v1h-4v-3a2 2 0 11-4 0h-1V7h1a2 2 0 014 0V4z" {...stroke} /></>),
};

export function Icon({ name, size = 18, className, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={style}>
      {paths[name]}
    </svg>
  );
}
