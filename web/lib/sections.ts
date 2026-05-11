import type { LessonSummary } from '@/lib/tracks';
import type { TrackProgress, LessonProgress } from '@/lib/progress';
import type { SkillNodeState } from '@/components/ui/SkillNode';

export const DEFAULT_SECTION_SIZE = 6;

const MINUTES_PER_LEVEL: Record<string, number> = {
  foundation: 4,
  intermediate: 6,
  advanced: 8,
};
const FALLBACK_MINUTES_PER_LESSON = 5;

function parseAttemptMs(s: string | null): number {
  if (!s) return -Infinity;
  const ms = Date.parse(s);
  return Number.isNaN(ms) ? -Infinity : ms;
}

export type TreeNode = {
  lessonId: string;
  title: string;
  level: string;
  state: SkillNodeState;
  meta: string;
};

export type TreeSection = {
  index: number;
  title: string;
  meta: string;
  progressPct: number;
  done: boolean;
  locked: boolean;
  nodes: TreeNode[];
};

function pickCurrentLessonId(
  lessons: LessonSummary[],
  progressByLessonId: Map<string, LessonProgress>,
): string | null {
  const inProgress = lessons
    .map((l) => progressByLessonId.get(l.id))
    .filter((p): p is LessonProgress => !!p && p.state === 'in_progress');
  if (inProgress.length === 0) return null;
  inProgress.sort((a, b) => {
    const ta = parseAttemptMs(a.lastAttemptAt);
    const tb = parseAttemptMs(b.lastAttemptAt);
    if (tb !== ta) return tb - ta;
    return a.lessonId < b.lessonId ? -1 : a.lessonId > b.lessonId ? 1 : 0;
  });
  return inProgress[0].lessonId;
}

function metaForLesson(state: SkillNodeState, lp: LessonProgress | undefined): string {
  switch (state) {
    case 'completed':
      return 'Mastered';
    case 'current':
      return `In progress · ${lp?.passedExercises ?? 0} of ${lp?.totalExercises ?? 0}`;
    case 'available':
      return 'Tap to start';
    case 'locked':
      return 'Locked';
  }
}

export function chunkLessonsIntoSections(
  trackTitle: string,
  lessons: LessonSummary[],
  progress: TrackProgress | null,
  size: number = DEFAULT_SECTION_SIZE,
): TreeSection[] {
  if (lessons.length === 0) return [];

  const progressByLessonId = new Map<string, LessonProgress>();
  for (const lp of progress?.lessons ?? []) progressByLessonId.set(lp.lessonId, lp);

  const currentLessonId = pickCurrentLessonId(lessons, progressByLessonId);

  const chunks: LessonSummary[][] = [];
  for (let i = 0; i < lessons.length; i += size) {
    chunks.push(lessons.slice(i, i + size));
  }

  const sections: TreeSection[] = chunks.map((chunk, index) => {
    const completedCount = chunk.filter(
      (l) => progressByLessonId.get(l.id)?.state === 'complete',
    ).length;
    const progressPct = Math.round((100 * completedCount) / chunk.length);
    const done = progressPct === 100;
    const firstLevel = chunk[0]?.level ?? 'foundation';
    const minutesPerLesson = MINUTES_PER_LEVEL[firstLevel] ?? FALLBACK_MINUTES_PER_LESSON;
    const minutes = chunk.length * minutesPerLesson;
    return {
      index,
      title: `${trackTitle} · Part ${index + 1}`,
      meta: `${chunk.length} lessons · ~${minutes} min`,
      progressPct,
      done,
      locked: false,
      nodes: [],
    };
  });

  for (let i = 1; i < sections.length; i++) {
    sections[i].locked = sections.slice(0, i).some((s) => s.progressPct < 100);
  }

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const chunk = chunks[i];
    section.nodes = chunk.map((l) => {
      const lp = progressByLessonId.get(l.id);
      let state: SkillNodeState;
      if (section.locked) {
        state = 'locked';
      } else if (lp?.state === 'complete') {
        state = 'completed';
      } else if (lp?.state === 'in_progress' && l.id === currentLessonId) {
        state = 'current';
      } else {
        state = 'available';
      }
      return {
        lessonId: l.id,
        title: l.title,
        level: l.level ?? 'foundation',
        state,
        meta: metaForLesson(state, lp),
      };
    });
  }

  return sections;
}
