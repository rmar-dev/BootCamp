import Link from 'next/link';
import type { TrackDetail } from '@/lib/tracks';
import type { DashboardData } from '@/lib/gamification';
import { Heading } from '@/components/ui/Heading';
import { Eyebrow } from '@/components/ui/Eyebrow';
import { Row } from '@/components/ui/Row';
import { Icon } from '@/components/ui/Icon';

type Props = {
  user: { id: string; name?: string | null };
  dash: DashboardData;
  track: TrackDetail;
};

export function PageHead({ user, dash, track }: Props) {
  const firstName = user.name?.split(/\s+/)[0] ?? '';
  const greeting = firstName ? `Welcome back, ${firstName}.` : 'Welcome back.';
  const nudge = nextBadgeNudge(dash) ?? `Keep up the ${dash.streak}-day streak.`;
  return (
    <div className="page-head">
      <div>
        <Eyebrow style={{ marginBottom: 10 }}>{track.title}</Eyebrow>
        <Heading level="display" className="h-display">{greeting}</Heading>
        <p className="muted" style={{ marginTop: 8, fontSize: 'var(--t-lg)' }}>{nudge}</p>
      </div>
      <Row style={{ gap: 12 }}>
        <button
          type="button"
          className="btn btn-ghost"
          disabled
          aria-disabled="true"
          title="Coming soon"
        >
          <Icon name="refresh" size={14} />Restart streak insurance
        </button>
        <PrimaryCta dash={dash} />
      </Row>
    </div>
  );
}

function PrimaryCta({ dash }: { dash: DashboardData }) {
  const plan = dash.todayPlan;
  if (!plan) {
    return (
      <Link href="/review" className="btn btn-iridescent btn-lg">
        <Icon name="play" size={14} />All caught up — review queue
      </Link>
    );
  }
  let label: string;
  switch (plan.recommendationKind) {
    case 'continue':    label = `Continue lesson ${plan.position}`; break;
    case 'concept_gap': label = `Practice ${plan.conceptHint ?? 'concept'}`; break;
    case 'first_timer': label = 'Start lesson 01'; break;
  }
  return (
    <Link href={`/lesson/${plan.lessonId}`} className="btn btn-iridescent btn-lg">
      <Icon name="play" size={14} />{label}
    </Link>
  );
}

function nextBadgeNudge(dash: DashboardData): string | null {
  const unearned = dash.badges.filter((b) => !b.earned).length;
  if (unearned === 0) return null;
  return `You're ${unearned} achievement${unearned === 1 ? '' : 's'} away from your next badge.`;
}
