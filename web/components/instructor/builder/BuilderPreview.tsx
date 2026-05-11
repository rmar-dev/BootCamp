'use client';
import type { LessonBlock } from '@/lib/exercise-payloads';
import { ExerciseBlock } from '@/components/lesson/ExerciseBlock';
import { ExplanationBlock } from '@/components/lesson/ExplanationBlock';
import { VideoBlock } from '@/components/lesson/VideoBlock';
import { Eyebrow, EmptyState } from '@/components/ui';
import { blockMeta } from './blockMeta';

interface Props {
  block: LessonBlock | null;
}

export function BuilderPreview({ block }: Props) {
  if (!block) {
    return (
      <EmptyState
        icon="eye"
        title="Nothing to preview"
        description="Select a block on the left to see how it renders to a student."
      />
    );
  }
  const meta = blockMeta(block);
  return (
    <div className="builder-preview">
      <Eyebrow style={{ marginBottom: 10 }}>Live preview · {meta.label}</Eyebrow>
      {block.kind === 'explanation' && <ExplanationBlock markdown={block.markdown || '*Empty explanation*'} />}
      {block.kind === 'video' && <VideoBlock video={block.video} />}
      {block.kind === 'exercise' && (
        <>
          {block.exercise.promptMarkdown && (
            <div className="mb-4 prose prose-sm max-w-none dark:prose-invert">
              <ExplanationBlock markdown={block.exercise.promptMarkdown} />
            </div>
          )}
          <ExerciseBlock exercise={block.exercise} />
        </>
      )}
    </div>
  );
}
