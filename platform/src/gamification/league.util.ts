export type LeagueName = 'Bronze' | 'Silver' | 'Gold' | 'Sapphire' | 'Peacock';

export type LeagueDerivation = {
  name: LeagueName;
  xpToNext: number;
  nextLeague: LeagueName | null;
};

const TIERS: ReadonlyArray<{ name: LeagueName; minLevel: number; minXP: number }> = [
  { name: 'Peacock',  minLevel: 10, minXP: 4500 },
  { name: 'Sapphire', minLevel: 7,  minXP: 2100 },
  { name: 'Gold',     minLevel: 5,  minXP: 1000 },
  { name: 'Silver',   minLevel: 3,  minXP:  300 },
  { name: 'Bronze',   minLevel: 1,  minXP:    0 },
];

export function deriveLeague(level: number, totalPoints: number): LeagueDerivation {
  // Find the highest tier the student qualifies for by level.
  const idx = TIERS.findIndex((t) => level >= t.minLevel);
  const current = TIERS[idx] ?? TIERS[TIERS.length - 1];
  const next = idx > 0 ? TIERS[idx - 1] : null;
  return {
    name: current.name,
    xpToNext: next ? Math.max(0, next.minXP - totalPoints) : 0,
    nextLeague: next?.name ?? null,
  };
}
