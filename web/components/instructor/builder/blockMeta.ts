import type { LessonBlock } from '@/lib/exercise-payloads';
import type { IconName } from '@/components/ui';

export interface BlockMeta {
  label: string;
  icon: IconName;
  /** Tone class for the type chip — maps to existing badge variants. */
  tone: 'brand' | 'iris' | 'amber' | 'success' | 'default';
}

export function blockMeta(block: LessonBlock): BlockMeta {
  if (block.kind === 'explanation') {
    return { label: 'Explanation', icon: 'text', tone: 'brand' };
  }
  if (block.kind === 'video') {
    return { label: 'Video', icon: 'video', tone: 'iris' };
  }
  return exerciseMeta(block.exercise.type);
}

const EXERCISE_META: Record<string, BlockMeta> = {
  code: { label: 'Live code', icon: 'code', tone: 'amber' },
  fix_bug: { label: 'Fix the bug', icon: 'code', tone: 'amber' },
  fill_blank: { label: 'Fill the blanks', icon: 'puzzle', tone: 'amber' },
  predict_output: { label: 'Predict output', icon: 'eye', tone: 'amber' },
  multiple_choice: { label: 'Multiple choice', icon: 'check', tone: 'amber' },
  visual_playground: { label: 'Visual playground', icon: 'star', tone: 'iris' },
  capstone_submission: { label: 'Capstone submission', icon: 'trophy', tone: 'success' },
};

export function exerciseMeta(type: string): BlockMeta {
  return EXERCISE_META[type] ?? { label: type, icon: 'puzzle', tone: 'default' };
}

export function blockTitle(block: LessonBlock): string {
  if (block.kind === 'explanation') {
    const firstLine = block.markdown.trim().split('\n')[0]?.replace(/^#+\s*/, '').trim();
    return firstLine || 'Explanation';
  }
  if (block.kind === 'video') {
    return block.video.title?.trim() || block.video.url.trim() || 'Video';
  }
  const promptLine = block.exercise.promptMarkdown.trim().split('\n')[0]?.replace(/^#+\s*/, '').trim();
  return promptLine || exerciseMeta(block.exercise.type).label;
}
