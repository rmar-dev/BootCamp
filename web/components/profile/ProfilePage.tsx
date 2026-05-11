import type { ProfileResponse } from '@/lib/profile';
import { ProfileHead } from './ProfileHead';
import { HeatStrip } from './HeatStrip';
import { SkillsList } from './SkillsList';
import { BadgesGrid } from './BadgesGrid';

export function ProfilePage({ data }: { data: ProfileResponse }) {
  return (
    <div className="main">
      <ProfileHead account={data.account} trackBadges={data.trackBadges} kpis={data.kpis} />
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 24 }}>
        <div className="stack">
          <div className="card card-elevated">
            <div className="row-between" style={{ marginBottom: 16 }}>
              <div>
                <h3 className="h3">Practice activity</h3>
                <p className="muted" style={{ fontSize: 'var(--t-sm)', marginTop: 4 }}>
                  {data.heatStrip.filter((c) => c > 0).length} active days over the past 26 weeks
                </p>
              </div>
            </div>
            <HeatStrip cells={data.heatStrip} />
          </div>
          <SkillsList skills={data.skills} />
        </div>
        <BadgesGrid badges={data.badges} />
      </div>
    </div>
  );
}
