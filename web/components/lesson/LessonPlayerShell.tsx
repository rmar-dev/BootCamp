'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { LessonResponse } from '@/lib/api';
import type { ExerciseAttemptStatus } from '@/lib/exercise-payloads';
import { fetchTrack } from '@/lib/tracks';
import { revisitLesson, PoolCompleteError } from '@/lib/revisit';
import { PlayerHead } from './player/PlayerHead';
import { PlayerFoot, AUTO_ADVANCE_MS } from './player/PlayerFoot';
import { PlayerBody } from './player/PlayerBody';
import { LessonCompleteScreen } from './player/LessonCompleteScreen';
import { ExerciseBlock } from './ExerciseBlock';
import { ExplanationBlock } from './ExplanationBlock';
import { VideoBlock } from './VideoBlock';

export function LessonPlayerShell({ lesson }: { lesson: LessonResponse }) {
  const router = useRouter();
  const params = useSearchParams();
  const step = clampStep(Number(params.get('step') ?? 0), lesson.blocks.length);

  const [nextLessonId, setNextLessonId] = useState<string | null>(null);
  const [freshError, setFreshError] = useState<string | null>(null);
  const [autoAdvanceFromStep, setAutoAdvanceFromStep] = useState<number | null>(null);

  useEffect(() => {
    if (!lesson.trackId) return;
    let cancelled = false;
    fetchTrack(lesson.trackId)
      .then((track) => {
        if (cancelled || !track) return;
        const idx = track.lessons.findIndex((l) => l.id === lesson.id);
        if (idx >= 0 && idx < track.lessons.length - 1) {
          setNextLessonId(track.lessons[idx + 1].id);
        }
      })
      .catch(() => {
        // Best effort — if track fetch fails, just hide the next-lesson button.
      });
    return () => {
      cancelled = true;
    };
  }, [lesson.trackId, lesson.id]);

  // Hex map: hydrate from payload, overlay session updates
  const initialMap = useMemo(() => {
    const m = new Map<string, ExerciseAttemptStatus>();
    for (const b of lesson.blocks)
      if (b.kind === 'exercise') m.set(b.exercise.id, b.exercise.attemptStatus);
    return m;
  }, [lesson]);
  const [hexMap, setHexMap] = useState<Map<string, ExerciseAttemptStatus>>(initialMap);

  const isCapstoneOnly =
    lesson.blocks.length === 1 &&
    lesson.blocks[0].kind === 'exercise' &&
    lesson.blocks[0].exercise.type === 'capstone_submission';

  // Capstone exercises are instructor-graded and never receive a hex slot —
  // server returns passed=false so they would always read as 'unattempted'.
  // Filter them out here so a future lesson mixing capstone + auto-graded
  // exercises doesn't leak an always-empty hex into the bar.
  const exerciseOrdering = lesson.blocks.filter(
    (b) => b.kind === 'exercise' && b.exercise.type !== 'capstone_submission',
  );
  const hexStates: ExerciseAttemptStatus[] = exerciseOrdering.map((b) =>
    b.kind === 'exercise' ? (hexMap.get(b.exercise.id) ?? 'unattempted') : 'unattempted',
  );

  const isComplete = step === lesson.blocks.length;

  const goToStep = (next: number) => {
    const url = `?step=${clampStep(next, lesson.blocks.length)}`;
    router.replace(url, { scroll: false });
  };

  const onAttempt = (exerciseId: string, status: ExerciseAttemptStatus) => {
    setHexMap((m) => {
      const next = new Map(m);
      const prior = next.get(exerciseId);
      if (prior === 'first_try') return next; // no-downgrade invariant
      next.set(exerciseId, status);
      return next;
    });
    // Trigger auto-advance only if the passing attempt is for the block on
    // screen and this isn't the last block (last → "Finish lesson" stays manual).
    const currentBlock = lesson.blocks[step];
    const isLast = step >= lesson.blocks.length - 1;
    if (
      !isLast &&
      currentBlock?.kind === 'exercise' &&
      currentBlock.exercise.id === exerciseId
    ) {
      setAutoAdvanceFromStep(step);
    }
  };

  useEffect(() => {
    if (autoAdvanceFromStep !== step) return;
    const id = setTimeout(() => goToStep(step + 1), AUTO_ADVANCE_MS);
    return () => clearTimeout(id);
    // goToStep is stable (router.replace + clamped value) — depend only on
    // the trigger and the current step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAdvanceFromStep, step]);

  const onBackToTrack = () => {
    if (lesson.trackId) router.push(`/tracks/${lesson.trackId}`);
    else router.push('/dashboard');
  };

  const onNextLesson = nextLessonId
    ? () => router.push(`/lesson/${nextLessonId}`)
    : undefined;

  const onFreshExercises = async () => {
    setFreshError(null);
    try {
      await revisitLesson(lesson.id);
      router.refresh();
    } catch (err) {
      if (err instanceof PoolCompleteError) {
        // Pool genuinely empty — no fresh exercises to draw. Stay on the celebration.
        return;
      }
      // Network / 500 / unknown — surface inline so the student sees the failure.
      setFreshError(
        err instanceof Error ? err.message : 'Could not refresh exercises. Please try again.',
      );
    }
  };

  return (
    <div className="player">
      <PlayerHead
        title={isComplete ? `${lesson.title} · Complete` : lesson.title}
        stepCurrent={Math.min(step + 1, lesson.blocks.length)}
        stepTotal={lesson.blocks.length}
        hexStates={isCapstoneOnly ? undefined : hexStates}
        onBackToTrack={onBackToTrack}
      />
      <PlayerBody>
        {isComplete ? (
          <LessonCompleteScreen
            variant={
              lesson.assignment?.status === 'pool_complete' ? 'pool_complete' : 'regular'
            }
            hexStates={hexStates}
            nextLessonId={nextLessonId}
            onNextLesson={onNextLesson}
            onFreshExercises={onFreshExercises}
            onBackToTrack={onBackToTrack}
            freshErrorMessage={freshError}
          />
        ) : (
          <BlockRenderer block={lesson.blocks[step]} onAttempt={onAttempt} />
        )}
      </PlayerBody>
      {!isComplete ? (
        <PlayerFoot
          stepCurrent={step}
          stepTotal={lesson.blocks.length}
          onPrev={() => goToStep(step - 1)}
          onNext={() => goToStep(step + 1)}
          autoAdvancing={autoAdvanceFromStep === step}
        />
      ) : (
        <PlayerFoot
          stepCurrent={lesson.blocks.length}
          stepTotal={lesson.blocks.length}
          onPrev={() => goToStep(step - 1)}
          onNext={onBackToTrack}
        />
      )}
    </div>
  );
}

function BlockRenderer({
  block,
  onAttempt,
}: {
  block: LessonResponse['blocks'][number];
  onAttempt: (exerciseId: string, status: ExerciseAttemptStatus) => void;
}) {
  if (block.kind === 'explanation') return <ExplanationBlock markdown={block.markdown} />;
  if (block.kind === 'video') return <VideoBlock video={block.video} />;
  // multiple_choice exercises ship the question (and often the options as
  // markdown task lists) inside `promptMarkdown` AND a structured copy
  // inside `payload.questionMarkdown`. Rendering both produces a duplicate
  // question — the markdown task-list options even render as inert
  // checkboxes alongside the real interactive Choice cards. Suppress the
  // upstream prompt for MC; the MultipleChoiceExercise renderer shows its
  // own questionMarkdown via ExplanationBlock.
  const showUpstreamPrompt =
    block.exercise.promptMarkdown && block.exercise.type !== 'multiple_choice';
  return (
    <div>
      {showUpstreamPrompt && (
        <div className="mb-4 prose prose-sm max-w-none dark:prose-invert">
          <ExplanationBlock markdown={block.exercise.promptMarkdown} />
        </div>
      )}
      <ExerciseBlock
        // key forces a remount when the rendered exercise changes (when the
        // student presses Continue and the next step is also an exercise).
        // Without it, React reuses the same component instance across
        // exercises and the renderers' internal state (editor source code,
        // selected option, filled blanks, etc.) survives the transition —
        // visible as "Continue keeps showing the previous exercise's code
        // until I click Reset". Keying on (id, version) covers both the
        // "different exercise" case and the rarer "same exercise, new
        // version" case.
        key={`${block.exercise.id}:${block.exercise.version}`}
        exercise={block.exercise}
        onAttempt={(status) => onAttempt(block.exercise.id, status)}
      />
    </div>
  );
}

function clampStep(n: number, totalBlocks: number): number {
  if (Number.isNaN(n) || n < 0) return 0;
  if (n > totalBlocks) return totalBlocks;
  return n;
}
