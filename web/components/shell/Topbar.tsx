'use client';
import { Icon } from '@/components/ui/Icon';
import { Row } from '@/components/ui/Row';
import { SearchInput } from '@/components/ui/Input';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useAuth } from '@/components/layout/AuthProvider';
import { useActiveTrack } from '@/lib/track-context';

export function Topbar() {
  const { streak, totalPoints } = useAuth();
  const { trackId, setTrackId, tracks, loading } = useActiveTrack();
  // Group by language — the topbar chip is a "switch between my languages"
  // toggle, NOT a per-track tab list. Without this, every additional Swift
  // track (Hello BootCamp, Swift Fundamentals, etc.) added a redundant
  // "Swift" chip to the bar. Pick the currently-active track per language
  // if the user is in one, otherwise the first.
  const byLanguage = new Map<string, typeof tracks[number]>();
  for (const t of tracks) {
    if (t.language !== 'swift' && t.language !== 'kotlin') continue;
    if (t.id === trackId) {
      byLanguage.set(t.language, t);
      continue;
    }
    if (!byLanguage.has(t.language)) byLanguage.set(t.language, t);
  }
  const swiftKotlin = Array.from(byLanguage.values());
  const value = trackId ?? swiftKotlin[0]?.id ?? '';
  return (
    <div className="topbar">
      <SearchInput
        placeholder="Search lessons coming soon"
        disabled
        wrapperClassName="search"
        style={{ flex: 1, maxWidth: 480 }}
      />
      {swiftKotlin.length > 0 && (
        <SegmentedControl
          value={value}
          onChange={setTrackId}
          options={swiftKotlin.map((t) => ({
            value: t.id,
            label: t.language === 'swift' ? 'Swift' : 'Kotlin',
            activeClassName: t.language,
          }))}
          aria-disabled={loading}
        />
      )}
      <Row style={{ gap: 14, marginLeft: 'auto' }}>
        <Row style={{ gap: 6 }}>
          <Icon name="flame" size={16} style={{ color: 'var(--amber-400)' }} />
          <span className="mono" style={{ fontWeight: 700 }}>{streak}</span>
        </Row>
        <Row style={{ gap: 6 }}>
          <Icon name="bolt" size={16} style={{ color: 'var(--peacock-300)' }} />
          <span className="mono" style={{ fontWeight: 700 }}>{totalPoints.toLocaleString()}</span>
        </Row>
      </Row>
    </div>
  );
}
