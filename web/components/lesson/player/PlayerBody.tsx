import type { ReactNode } from 'react';

export function PlayerBody({ children }: { children: ReactNode }) {
  return <div className="player-body">{children}</div>;
}
