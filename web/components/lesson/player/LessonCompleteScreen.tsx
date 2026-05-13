import { Button, Callout, Eyebrow, Heading, HexBar, Row, Stack } from '@/components/ui';
import type { ExerciseAttemptStatus } from '@/lib/exercise-payloads';

type Props = {
  variant: 'regular' | 'pool_complete';
  hexStates: ReadonlyArray<ExerciseAttemptStatus>;
  nextLessonId?: string | null;
  onNextLesson?: () => void;
  onFreshExercises?: () => void;
  onBackToTrack: () => void;
  freshErrorMessage?: string | null;
};

export function LessonCompleteScreen(props: Props) {
  const earned = props.hexStates.filter((s) => s === 'first_try').length;
  const heading = props.variant === 'pool_complete' ? 'Pool complete' : 'Lesson complete';
  const subtitle =
    props.variant === 'pool_complete'
      ? 'You have seen every exercise in this lesson’s current pool.'
      : 'Nice work.';

  return (
    <Stack
      gap="loose"
      style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center', alignItems: 'center' }}
      data-testid={props.variant === 'pool_complete' ? 'pool-complete-view' : 'lesson-complete-view'}
    >
      <Stack gap="tight" style={{ alignItems: 'center' }}>
        <Heading level="display" style={{ fontSize: 'var(--t-4xl)' }}>{heading}</Heading>
        <p className="muted" style={{ fontSize: 'var(--t-lg)', margin: 0 }}>{subtitle}</p>
      </Stack>

      {props.hexStates.length > 0 && (
        <Stack gap="tight" style={{ alignItems: 'center' }}>
          <Eyebrow>You earned {earned} of {props.hexStates.length}</Eyebrow>
          <HexBar states={props.hexStates} size="lg" />
        </Stack>
      )}

      <Row style={{ gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        {props.variant === 'pool_complete' && props.onFreshExercises && (
          <Button
            variant="primary"
            onClick={props.onFreshExercises}
            data-testid="fresh-exercises-btn"
          >
            Fresh exercises
          </Button>
        )}
        {props.variant === 'regular' && props.nextLessonId && props.onNextLesson && (
          <Button variant="iridescent" onClick={props.onNextLesson}>
            Next lesson →
          </Button>
        )}
        <Button variant="ghost" onClick={props.onBackToTrack}>
          Back to track
        </Button>
      </Row>

      {props.freshErrorMessage && (
        <Callout tone="danger" title="Could not refresh exercises">
          {props.freshErrorMessage}
        </Callout>
      )}
    </Stack>
  );
}
