import { Button, Eyebrow, HexBar, Icon, ProgressBar } from '@/components/ui';
import type { ExerciseAttemptStatus } from '@/lib/exercise-payloads';

export function PlayerHead({
  title,
  stepCurrent,
  stepTotal,
  hexStates,
  onBackToTrack,
}: {
  title: string;
  stepCurrent: number;
  stepTotal: number;
  hexStates?: ReadonlyArray<ExerciseAttemptStatus>;
  onBackToTrack: () => void;
}) {
  const pct = stepTotal === 0 ? 0 : (stepCurrent / stepTotal) * 100;
  return (
    <div className="player-head">
      <Button
        variant="ghost"
        size="sm"
        onClick={onBackToTrack}
        leadingIcon={<Icon name="chevL" size={14} />}
      >
        Back to track
      </Button>
      <div className="player-progress">
        <div className="row-between" style={{ marginBottom: 6 }}>
          <Eyebrow>{title}</Eyebrow>
          {/* "X/N" badge doubles as the pool-status indicator the adaptive
              content e2e relies on. data-pool-total/data-pool-seen let the
              test assert both numbers without parsing the visible text. */}
          <span
            className="mono muted"
            data-testid="pool-status-chip"
            data-pool-seen={stepCurrent}
            data-pool-total={stepTotal}
          >
            {stepCurrent}/{stepTotal}
          </span>
        </div>
        <ProgressBar value={pct} thickness="thin" />
      </div>
      {hexStates ? <HexBar states={hexStates} /> : null}
    </div>
  );
}
