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
          <span className="mono muted">
            {stepCurrent}/{stepTotal}
          </span>
        </div>
        <ProgressBar value={pct} thickness="thin" />
      </div>
      {hexStates ? <HexBar states={hexStates} /> : null}
    </div>
  );
}
