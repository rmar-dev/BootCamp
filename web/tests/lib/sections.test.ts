import { describe, it, expect } from 'vitest';
import {
  chunkLessonsIntoSections,
  DEFAULT_SECTION_SIZE,
  type TreeSection,
} from '@/lib/sections';
import type { LessonSummary } from '@/lib/tracks';
import type { TrackProgress, LessonProgress } from '@/lib/progress';

function lesson(id: string, position: number, level: 'foundation' | 'intermediate' | 'advanced' | string = 'foundation'): LessonSummary {
  return {
    id,
    version: 1,
    title: `Lesson ${id}`,
    summary: '',
    position,
    level,
  };
}

function progress(entries: Array<Partial<LessonProgress> & { lessonId: string }>): TrackProgress {
  return {
    trackId: 't1',
    lessons: entries.map((e) => ({
      lessonId: e.lessonId,
      lessonVersion: e.lessonVersion ?? 1,
      totalExercises: e.totalExercises ?? 6,
      passedExercises: e.passedExercises ?? 0,
      attemptedExercises: e.attemptedExercises ?? 0,
      state: e.state ?? 'not_started',
      lastAttemptAt: e.lastAttemptAt ?? null,
    })),
  };
}

describe('chunkLessonsIntoSections', () => {
  it('returns [] for an empty lesson list', () => {
    expect(chunkLessonsIntoSections('Swift', [], null)).toEqual([]);
  });

  it('exposes DEFAULT_SECTION_SIZE = 6', () => {
    expect(DEFAULT_SECTION_SIZE).toBe(6);
  });

  it('all lessons no progress → section 0 unlocked, sections >= 1 locked', () => {
    const lessons = Array.from({ length: 18 }, (_, i) => lesson(`L${i + 1}`, i + 1));
    const sections = chunkLessonsIntoSections('Swift', lessons, null);
    expect(sections).toHaveLength(3);
    expect(sections[0].locked).toBe(false);
    expect(sections[0].nodes.every((n) => n.state === 'available')).toBe(true);
    expect(sections[1].locked).toBe(true);
    expect(sections[1].nodes.every((n) => n.state === 'locked')).toBe(true);
    expect(sections[2].locked).toBe(true);
  });

  it('unlockAll=true (preview): no progress but every section unlocked + available', () => {
    const lessons = Array.from({ length: 18 }, (_, i) => lesson(`L${i + 1}`, i + 1));
    const sections = chunkLessonsIntoSections('Swift', lessons, null, DEFAULT_SECTION_SIZE, true);
    expect(sections).toHaveLength(3);
    expect(sections.every((s) => s.locked === false)).toBe(true);
    expect(
      sections.every((s) => s.nodes.every((n) => n.state === 'available')),
    ).toBe(true);
  });

  it('mid-section progress: 3 complete + 1 in_progress + 2 not_started in section 0', () => {
    const lessons = Array.from({ length: 12 }, (_, i) => lesson(`L${i + 1}`, i + 1));
    const p = progress([
      { lessonId: 'L1', state: 'complete', passedExercises: 6, totalExercises: 6 },
      { lessonId: 'L2', state: 'complete', passedExercises: 6, totalExercises: 6 },
      { lessonId: 'L3', state: 'complete', passedExercises: 6, totalExercises: 6 },
      { lessonId: 'L4', state: 'in_progress', passedExercises: 4, totalExercises: 6, lastAttemptAt: '2026-05-03T10:00:00Z' },
    ]);
    const sections = chunkLessonsIntoSections('Swift', lessons, p);
    const states = sections[0].nodes.map((n) => n.state);
    expect(states).toEqual(['completed', 'completed', 'completed', 'current', 'available', 'available']);
    expect(sections[0].nodes[3].meta).toBe('In progress · 4 of 6');
    expect(sections[0].progressPct).toBe(50);
    expect(sections[0].locked).toBe(false);
    expect(sections[1].locked).toBe(true);
  });

  it('full-section completion (progressPct === 100) unlocks the next section', () => {
    const lessons = Array.from({ length: 12 }, (_, i) => lesson(`L${i + 1}`, i + 1));
    const p = progress(
      Array.from({ length: 6 }, (_, i) => ({
        lessonId: `L${i + 1}`,
        state: 'complete' as const,
        passedExercises: 6,
        totalExercises: 6,
      })),
    );
    const sections = chunkLessonsIntoSections('Swift', lessons, p);
    expect(sections[0].progressPct).toBe(100);
    expect(sections[0].done).toBe(true);
    expect(sections[1].locked).toBe(false);
    expect(sections[1].nodes.every((n) => n.state === 'available')).toBe(true);
  });

  it('locked section: every lesson `locked`, no `current`, meta `Locked`', () => {
    const lessons = Array.from({ length: 12 }, (_, i) => lesson(`L${i + 1}`, i + 1));
    const p = progress([
      { lessonId: 'L1', state: 'in_progress', lastAttemptAt: '2026-05-03T10:00:00Z' },
    ]);
    const sections = chunkLessonsIntoSections('Swift', lessons, p);
    expect(sections[1].locked).toBe(true);
    sections[1].nodes.forEach((n) => {
      expect(n.state).toBe('locked');
      expect(n.meta).toBe('Locked');
    });
  });

  it('single current node: most-recent lastAttemptAt wins; others render as available', () => {
    const lessons = Array.from({ length: 6 }, (_, i) => lesson(`L${i + 1}`, i + 1));
    const p = progress([
      { lessonId: 'L1', state: 'in_progress', lastAttemptAt: '2026-05-01T10:00:00Z' },
      { lessonId: 'L3', state: 'in_progress', lastAttemptAt: '2026-05-03T10:00:00Z' },
      { lessonId: 'L5', state: 'in_progress', lastAttemptAt: '2026-05-02T10:00:00Z' },
    ]);
    const sections = chunkLessonsIntoSections('Swift', lessons, p);
    const currentNodes = sections[0].nodes.filter((n) => n.state === 'current');
    expect(currentNodes).toHaveLength(1);
    expect(currentNodes[0].lessonId).toBe('L3');
    expect(sections[0].nodes.find((n) => n.lessonId === 'L1')?.state).toBe('available');
    expect(sections[0].nodes.find((n) => n.lessonId === 'L5')?.state).toBe('available');
  });

  it('single current node: ties on lastAttemptAt broken by lessonId ASC', () => {
    const lessons = Array.from({ length: 6 }, (_, i) => lesson(`L${i + 1}`, i + 1));
    const p = progress([
      { lessonId: 'L3', state: 'in_progress', lastAttemptAt: '2026-05-03T10:00:00Z' },
      { lessonId: 'L1', state: 'in_progress', lastAttemptAt: '2026-05-03T10:00:00Z' },
    ]);
    const sections = chunkLessonsIntoSections('Swift', lessons, p);
    const current = sections[0].nodes.find((n) => n.state === 'current');
    expect(current?.lessonId).toBe('L1');
  });

  it('null lastAttemptAt sorts last (treated as oldest)', () => {
    const lessons = Array.from({ length: 6 }, (_, i) => lesson(`L${i + 1}`, i + 1));
    const p = progress([
      { lessonId: 'L1', state: 'in_progress', lastAttemptAt: null },
      { lessonId: 'L2', state: 'in_progress', lastAttemptAt: '2026-05-03T10:00:00Z' },
    ]);
    const sections = chunkLessonsIntoSections('Swift', lessons, p);
    const current = sections[0].nodes.find((n) => n.state === 'current');
    expect(current?.lessonId).toBe('L2');
  });

  it('malformed lastAttemptAt is treated as oldest (same as null)', () => {
    const lessons = Array.from({ length: 6 }, (_, i) => lesson(`L${i + 1}`, i + 1));
    const p = progress([
      { lessonId: 'L1', state: 'in_progress', lastAttemptAt: 'not-a-date' },
      { lessonId: 'L2', state: 'in_progress', lastAttemptAt: '2026-05-03T10:00:00Z' },
    ]);
    const sections = chunkLessonsIntoSections('Swift', lessons, p);
    const current = sections[0].nodes.find((n) => n.state === 'current');
    expect(current?.lessonId).toBe('L2');
  });

  it('custom size parameter: size=4 chunks 12 lessons into 3 sections of 4', () => {
    const lessons = Array.from({ length: 12 }, (_, i) => lesson(`L${i + 1}`, i + 1));
    const sections = chunkLessonsIntoSections('Swift', lessons, null, 4);
    expect(sections).toHaveLength(3);
    sections.forEach((s) => expect(s.nodes).toHaveLength(4));
  });

  it('section title and meta copy: foundation', () => {
    const lessons = Array.from({ length: 6 }, (_, i) => lesson(`L${i + 1}`, i + 1, 'foundation'));
    const sections = chunkLessonsIntoSections('Swift', lessons, null);
    expect(sections[0].title).toBe('Swift · Part 1');
    expect(sections[0].meta).toBe('6 lessons · ~24 min');
  });

  it('section meta copy: intermediate uses 6 min/lesson', () => {
    const lessons = Array.from({ length: 6 }, (_, i) => lesson(`L${i + 1}`, i + 1, 'intermediate'));
    const sections = chunkLessonsIntoSections('Kotlin', lessons, null);
    expect(sections[0].title).toBe('Kotlin · Part 1');
    expect(sections[0].meta).toBe('6 lessons · ~36 min');
  });

  it('section meta copy: advanced uses 8 min/lesson', () => {
    const lessons = Array.from({ length: 6 }, (_, i) => lesson(`L${i + 1}`, i + 1, 'advanced'));
    const sections = chunkLessonsIntoSections('Swift', lessons, null);
    expect(sections[0].meta).toBe('6 lessons · ~48 min');
  });

  it('section meta copy: unknown level falls back to 5 min PER LESSON (not total)', () => {
    const lessons = Array.from({ length: 6 }, (_, i) => lesson(`L${i + 1}`, i + 1, 'mystery'));
    const sections = chunkLessonsIntoSections('Swift', lessons, null);
    expect(sections[0].meta).toBe('6 lessons · ~30 min');
  });

  it('completed lesson meta is "Mastered"', () => {
    const lessons = [lesson('L1', 1)];
    const p = progress([{ lessonId: 'L1', state: 'complete', passedExercises: 6, totalExercises: 6 }]);
    const sections = chunkLessonsIntoSections('Swift', lessons, p);
    expect(sections[0].nodes[0].meta).toBe('Mastered');
  });

  it('available lesson meta is "Tap to start"', () => {
    const lessons = [lesson('L1', 1)];
    const sections = chunkLessonsIntoSections('Swift', lessons, null);
    expect(sections[0].nodes[0].meta).toBe('Tap to start');
  });
});
