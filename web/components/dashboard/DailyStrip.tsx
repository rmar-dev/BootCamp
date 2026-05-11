import Link from 'next/link';
import { Heading } from '@/components/ui/Heading';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Badge } from '@/components/ui/Badge';
import { Row } from '@/components/ui/Row';
import { KPI } from '@/components/ui/KPI';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Icon } from '@/components/ui/Icon';
import type { DashboardData } from '@/lib/gamification';

type Props = { dash: DashboardData };

export function DailyStrip({ dash }: Props) {
  const dailyPct = Math.min(100, (dash.dailyXp.earned / dash.dailyXp.target) * 100);
  return (
    <div className="daily">
      <div className="daily-grid">
        {dash.todayPlan ? <PlanHero dash={dash} /> : <ExhaustedHero />}
        <KPI
          label="Streak"
          value={
            <>
              <Icon name="flame" size={24} style={{ color: 'var(--amber-400)', marginRight: 8 }} />
              {dash.streak}
            </>
          }
          delta={dash.streakIncrementedToday ? '+1 today' : 'Keep going'}
        />
        <KPI
          label="Daily XP"
          value={`${dash.dailyXp.earned} / ${dash.dailyXp.target}`}
          peacock
          delta={<ProgressBar value={dailyPct} thickness="thin" />}
        />
        <KPI
          label="Mastery"
          value={`L${dash.mastery.level}`}
          delta={<span className="muted">{dash.mastery.xpForNextLevel} XP to L{dash.mastery.level + 1}</span>}
        />
      </div>
    </div>
  );
}

function PlanHero({ dash }: Props) {
  const plan = dash.todayPlan!;
  return (
    <div>
      <Eyebrow style={{ marginBottom: 10, color: 'var(--peacock-200)' }}>
        Today&apos;s plan · {plan.estimatedMinutes} min
      </Eyebrow>
      <Heading level="h2" style={{ marginBottom: 10 }}>{plan.title}</Heading>
      <Row style={{ gap: 8, flexWrap: 'wrap' }}>
        <Badge mono>L{plan.position}</Badge>
        <Badge>{plan.typeLabel}</Badge>
        <Badge dot>{plan.estimatedMinutes} min</Badge>
      </Row>
    </div>
  );
}

function ExhaustedHero() {
  return (
    <div>
      <Eyebrow style={{ marginBottom: 10, color: 'var(--peacock-200)' }}>Today</Eyebrow>
      <Heading level="h2" style={{ marginBottom: 10 }}>All caught up</Heading>
      <Row style={{ gap: 8, flexWrap: 'wrap' }}>
        <Link href="/review" className="btn btn-ghost btn-sm">Review queue</Link>
      </Row>
    </div>
  );
}
