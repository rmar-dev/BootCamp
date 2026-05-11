import { Button, Icon, StepDots } from '@/components/ui';
import { cn } from '@/components/ui/cn';

export const AUTO_ADVANCE_MS = 3000;

export function PlayerFoot({
  stepCurrent,
  stepTotal,
  onPrev,
  onNext,
  autoAdvancing = false,
}: {
  stepCurrent: number;
  stepTotal: number;
  onPrev: () => void;
  onNext: () => void;
  autoAdvancing?: boolean;
}) {
  const isLast = stepTotal > 0 && stepCurrent === stepTotal - 1;
  return (
    <div className="player-foot">
      <Button
        variant="ghost"
        onClick={onPrev}
        disabled={stepCurrent === 0}
        leadingIcon={<Icon name="chevL" size={14} />}
      >
        Previous
      </Button>
      <StepDots total={stepTotal} current={stepCurrent} />
      <Button
        variant="iridescent"
        className={cn(autoAdvancing && 'auto-advancing')}
        onClick={onNext}
      >
        <span className="auto-advance-fill" aria-hidden="true" />
        <span className="btn-iridescent-label">
          {isLast ? 'Finish lesson' : 'Continue'} →
        </span>
      </Button>
    </div>
  );
}
