import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TrackRepository } from '../content/repositories/track.repository';
import { StudentRepository } from '../state/repositories/student.repository';

export type LessonProgress = {
  lessonId: string;
  lessonVersion: number;
  totalExercises: number;
  passedExercises: number;
  attemptedExercises: number;
  state: 'not_started' | 'in_progress' | 'complete';
  lastAttemptAt: string | null;
};

export type TrackProgress = {
  trackId: string;
  lessons: LessonProgress[];
};

export type ConceptProgress = {
  concept: string;
  totalExercises: number;
  passedExercises: number;
};

export type ConceptsProgress = {
  concepts: ConceptProgress[];
};

export type LessonSummary = {
  id: string;
  version: number;
  title: string;
  trackId: string;
  trackTitle: string;
};

export type RecommendationResponse =
  | { kind: 'continue';    lesson: LessonSummary; reason: { message: string } }
  | { kind: 'concept_gap'; lesson: LessonSummary; reason: { message: string; concept: string; passed: number; total: number } }
  | { kind: 'first_timer'; lesson: LessonSummary; reason: { message: string } }
  | { kind: 'exhausted';                          reason: { message: string } };

@Injectable()
export class ProgressAggregatorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tracks: TrackRepository,
    private readonly students: StudentRepository,
  ) {}

  async getTrackProgress(
    studentId: string | null,
    trackId: string,
  ): Promise<TrackProgress | null> {
    const track = await this.tracks.findLatestPublished(trackId);
    if (!track) return null;

    if (track.lessonIds.length === 0) {
      return { trackId, lessons: [] };
    }

    const lessonKeys = track.lessonIds.map((id, i) => ({
      id,
      version: track.lessonVersions[i],
    }));

    const blocks = await this.prisma.block.findMany({
      where: {
        OR: lessonKeys.map((k) => ({ lessonId: k.id, lessonVersion: k.version })),
      },
    });

    const exerciseIdsByLesson = new Map<string, string[]>();
    for (const key of lessonKeys) exerciseIdsByLesson.set(`${key.id}:${key.version}`, []);
    const allExerciseIds: string[] = [];
    for (const b of blocks) {
      if (b.kind !== 'exercise' || !b.exerciseId) continue;
      const key = `${b.lessonId}:${b.lessonVersion}`;
      const list = exerciseIdsByLesson.get(key);
      if (list) {
        list.push(b.exerciseId);
        allExerciseIds.push(b.exerciseId);
      }
    }

    if (allExerciseIds.length === 0) {
      return {
        trackId,
        lessons: lessonKeys.map((k) => ({
          lessonId: k.id,
          lessonVersion: k.version,
          totalExercises: 0,
          passedExercises: 0,
          attemptedExercises: 0,
          state: 'not_started' as const,
          lastAttemptAt: null,
        })),
      };
    }

    const [passedResults, attemptGroups, assignments] = studentId
      ? await Promise.all([
          this.prisma.exerciseResult.findMany({
            where: { studentId, passed: true, exerciseId: { in: allExerciseIds } },
            select: { exerciseId: true },
          }),
          this.prisma.attempt.groupBy({
            by: ['exerciseId'],
            where: { studentId, exerciseId: { in: allExerciseIds } },
            _max: { submittedAt: true },
          }),
          // Match assignments by lessonId only (not lessonVersion) so that
          // republishing the curriculum (which bumps lesson versions) doesn't
          // orphan an in-flight assignment from v1 against a now-published
          // v2 lesson. Exercise IDs are path-derived and version-agnostic, so
          // the selectedExerciseIds stay valid across lesson versions.
          this.prisma.lessonAssignment.findMany({
            where: {
              studentId,
              lessonId: { in: lessonKeys.map((k) => k.id) },
            },
            select: { lessonId: true, lessonVersion: true, selectedExerciseIds: true },
          }),
        ])
      : [
          [] as { exerciseId: string }[],
          [] as Array<{ exerciseId: string; _max: { submittedAt: Date | null } }>,
          [] as Array<{ lessonId: string; lessonVersion: number; selectedExerciseIds: string[] }>,
        ];

    const passedSet = new Set(passedResults.map((r) => r.exerciseId));
    const lastAttemptByExercise = new Map<string, Date>();
    for (const g of attemptGroups) {
      if (g._max.submittedAt) lastAttemptByExercise.set(g.exerciseId, g._max.submittedAt);
    }
    // Per-student assignment: progress counts against selectedExerciseIds, not
    // the full pool. This matches what the student actually sees in the lesson
    // player — passing all assigned exercises = lesson complete.
    // Key by lessonId only — assignments survive lesson-version bumps because
    // selectedExerciseIds are path-derived and version-agnostic. If multiple
    // assignment rows exist for the same lessonId across versions, prefer the
    // most recent (last write wins after sort by lessonVersion asc).
    const assignedByLesson = new Map<string, string[]>();
    const sortedAssignments = [...assignments].sort((a, b) => a.lessonVersion - b.lessonVersion);
    for (const a of sortedAssignments) {
      assignedByLesson.set(a.lessonId, a.selectedExerciseIds);
    }

    const lessons: LessonProgress[] = lessonKeys.map((k) => {
      const poolIds = exerciseIdsByLesson.get(`${k.id}:${k.version}`) ?? [];
      const assignedIds = assignedByLesson.get(k.id);
      // If the student has an active assignment, intersect it with the current
      // pool (filters out stale ids if the lesson got versioned mid-flight).
      // No assignment yet → fall back to the full pool so the lesson still
      // reports a sensible total.
      const exerciseIds =
        assignedIds && assignedIds.length > 0
          ? assignedIds.filter((id) => poolIds.includes(id))
          : poolIds;
      const totalExercises = exerciseIds.length;
      let passedExercises = 0;
      let attemptedExercises = 0;
      let lastAttemptAt: Date | null = null;
      for (const exId of exerciseIds) {
        if (passedSet.has(exId)) passedExercises++;
        const last = lastAttemptByExercise.get(exId);
        if (last) {
          attemptedExercises++;
          if (!lastAttemptAt || last > lastAttemptAt) lastAttemptAt = last;
        }
      }
      let state: 'not_started' | 'in_progress' | 'complete';
      if (attemptedExercises === 0) state = 'not_started';
      else if (totalExercises > 0 && passedExercises === totalExercises) state = 'complete';
      else state = 'in_progress';
      return {
        lessonId: k.id,
        lessonVersion: k.version,
        totalExercises,
        passedExercises,
        attemptedExercises,
        state,
        lastAttemptAt: lastAttemptAt ? lastAttemptAt.toISOString() : null,
      };
    });

    return { trackId, lessons };
  }

  async getConceptProgress(studentId: string | null): Promise<ConceptsProgress> {
    const [publishedExercises, passedResults] = await Promise.all([
      this.prisma.exercise.findMany({
        where: { publishedAt: { not: null } },
        select: { id: true, version: true, concepts: true },
      }),
      studentId
        ? this.prisma.exerciseResult.findMany({
            where: { studentId, passed: true },
            select: { exerciseId: true },
          })
        : Promise.resolve([] as { exerciseId: string }[]),
    ]);

    // Collapse to latest version per exercise id
    type LatestEntry = { concepts: string[]; version: number };
    const latestByExercise = new Map<string, LatestEntry>();
    for (const ex of publishedExercises) {
      const existing = latestByExercise.get(ex.id);
      if (!existing || ex.version > existing.version) {
        latestByExercise.set(ex.id, { concepts: ex.concepts, version: ex.version });
      }
    }

    const passedSet = new Set(passedResults.map((r) => r.exerciseId));

    const counts = new Map<string, { total: number; passed: number }>();
    for (const [exerciseId, { concepts }] of latestByExercise.entries()) {
      for (const concept of concepts) {
        let c = counts.get(concept);
        if (!c) {
          c = { total: 0, passed: 0 };
          counts.set(concept, c);
        }
        c.total++;
        if (passedSet.has(exerciseId)) c.passed++;
      }
    }

    const list: ConceptProgress[] = [...counts.entries()].map(([concept, v]) => ({
      concept,
      totalExercises: v.total,
      passedExercises: v.passed,
    }));

    list.sort((a, b) => {
      if (b.passedExercises !== a.passedExercises) return b.passedExercises - a.passedExercises;
      return a.concept.localeCompare(b.concept);
    });

    return { concepts: list };
  }

  private lessonKey(id: string, version: number): string {
    return `${id}:${version}`;
  }

  private async aggregateForRecommendation(studentId: string | null): Promise<{
    tracksByLessonKey: Map<string, { trackId: string; trackTitle: string; trackPublishedAt: Date; lessonPosition: number }>;
    lessonRows: Map<string, { id: string; version: number; title: string; trackId: string; position: number }>;
    perLessonState: Map<string, { state: 'not_started' | 'in_progress' | 'complete'; lastAttemptAt: Date | null }>;
    conceptCounts: Map<string, { passed: number; total: number }>;
    lessonConcepts: Map<string, Set<string>>;
    hasAnyAttempt: boolean;
    hasAnyPublishedTrack: boolean;
  }> {
    const publishedTracks = await this.tracks.findAllLatestPublished();
    if (publishedTracks.length === 0) {
      return {
        tracksByLessonKey: new Map(),
        lessonRows: new Map(),
        perLessonState: new Map(),
        conceptCounts: new Map(),
        lessonConcepts: new Map(),
        hasAnyAttempt: false,
        hasAnyPublishedTrack: false,
      };
    }

    // Re-sort to enforce catalog order: publishedAt ASC, id ASC
    const sortedTracks = [...publishedTracks].sort((a, b) => {
      const ap = a.publishedAt!.getTime();
      const bp = b.publishedAt!.getTime();
      if (ap !== bp) return ap - bp;
      return a.id.localeCompare(b.id);
    });

    const tracksByLessonKey = new Map<string, {
      trackId: string; trackTitle: string; trackPublishedAt: Date; lessonPosition: number;
    }>();
    const lessonKeys: { id: string; version: number }[] = [];
    for (const t of sortedTracks) {
      for (let i = 0; i < t.lessonIds.length; i++) {
        const lid = t.lessonIds[i];
        const lver = t.lessonVersions[i];
        const key = this.lessonKey(lid, lver);
        // Tiebreak by first-occurrence: if a lesson is referenced by multiple tracks, the
        // earlier-sorted track wins. Skip duplicates.
        if (!tracksByLessonKey.has(key)) {
          tracksByLessonKey.set(key, {
            trackId: t.id,
            trackTitle: t.title,
            trackPublishedAt: t.publishedAt!,
            lessonPosition: i,
          });
          lessonKeys.push({ id: lid, version: lver });
        }
      }
    }

    if (lessonKeys.length === 0) {
      return {
        tracksByLessonKey,
        lessonRows: new Map(),
        perLessonState: new Map(),
        conceptCounts: new Map(),
        lessonConcepts: new Map(),
        hasAnyAttempt: false,
        hasAnyPublishedTrack: true,
      };
    }

    const lessonFetched = await this.prisma.lesson.findMany({
      where: { OR: lessonKeys.map((k) => ({ id: k.id, version: k.version })) },
      select: { id: true, version: true, title: true, trackId: true, position: true },
    });
    const lessonRows = new Map<string, { id: string; version: number; title: string; trackId: string; position: number }>();
    for (const l of lessonFetched) lessonRows.set(this.lessonKey(l.id, l.version), l);

    const blocks = await this.prisma.block.findMany({
      where: { OR: lessonKeys.map((k) => ({ lessonId: k.id, lessonVersion: k.version })) },
      select: { lessonId: true, lessonVersion: true, kind: true, exerciseId: true },
    });

    const exerciseIdsByLesson = new Map<string, string[]>();
    for (const k of lessonKeys) exerciseIdsByLesson.set(this.lessonKey(k.id, k.version), []);
    const allExerciseIds: string[] = [];
    for (const b of blocks) {
      if (b.kind !== 'exercise' || !b.exerciseId) continue;
      const key = this.lessonKey(b.lessonId, b.lessonVersion);
      const list = exerciseIdsByLesson.get(key);
      if (list) {
        list.push(b.exerciseId);
        allExerciseIds.push(b.exerciseId);
      }
    }

    const publishedExercises = allExerciseIds.length === 0
      ? []
      : await this.prisma.exercise.findMany({
          where: { id: { in: allExerciseIds }, publishedAt: { not: null } },
          select: { id: true, version: true, concepts: true },
        });

    // Collapse to latest published version per exercise id
    const latestByExercise = new Map<string, { version: number; concepts: string[] }>();
    for (const ex of publishedExercises) {
      const existing = latestByExercise.get(ex.id);
      if (!existing || ex.version > existing.version) {
        latestByExercise.set(ex.id, { version: ex.version, concepts: ex.concepts });
      }
    }

    const [passedResults, attemptGroups, assignments] = studentId
      ? await Promise.all([
          this.prisma.exerciseResult.findMany({
            where: { studentId, passed: true, exerciseId: { in: allExerciseIds } },
            select: { exerciseId: true },
          }),
          this.prisma.attempt.groupBy({
            by: ['exerciseId'],
            where: { studentId, exerciseId: { in: allExerciseIds } },
            _max: { submittedAt: true },
          }),
          // Match assignments by lessonId only (not lessonVersion) so that
          // republishing the curriculum (which bumps lesson versions) doesn't
          // orphan an in-flight assignment from v1 against a now-published
          // v2 lesson. Exercise IDs are path-derived and version-agnostic, so
          // the selectedExerciseIds stay valid across lesson versions.
          this.prisma.lessonAssignment.findMany({
            where: {
              studentId,
              lessonId: { in: lessonKeys.map((k) => k.id) },
            },
            select: { lessonId: true, lessonVersion: true, selectedExerciseIds: true },
          }),
        ])
      : [
          [] as { exerciseId: string }[],
          [] as Array<{ exerciseId: string; _max: { submittedAt: Date | null } }>,
          [] as Array<{ lessonId: string; lessonVersion: number; selectedExerciseIds: string[] }>,
        ];

    const passedSet = new Set(passedResults.map((r) => r.exerciseId));
    const lastAttemptByExercise = new Map<string, Date>();
    for (const g of attemptGroups) {
      if (g._max.submittedAt) lastAttemptByExercise.set(g.exerciseId, g._max.submittedAt);
    }
    // Per-student assignment, mirrors getTrackProgress. Key by lessonId only
    // so a v1 assignment continues to apply after the lesson is republished
    // as v2. If multiple versions exist, last write (highest version) wins.
    const assignedByLesson = new Map<string, string[]>();
    const sortedAssignments = [...assignments].sort((a, b) => a.lessonVersion - b.lessonVersion);
    for (const a of sortedAssignments) {
      assignedByLesson.set(a.lessonId, a.selectedExerciseIds);
    }

    const perLessonState = new Map<string, { state: 'not_started' | 'in_progress' | 'complete'; lastAttemptAt: Date | null }>();
    const lessonConcepts = new Map<string, Set<string>>();
    for (const k of lessonKeys) {
      const key = this.lessonKey(k.id, k.version);
      const poolIds = exerciseIdsByLesson.get(key) ?? [];
      const assignedIds = assignedByLesson.get(k.id);
      const exerciseIds =
        assignedIds && assignedIds.length > 0
          ? assignedIds.filter((id) => poolIds.includes(id))
          : poolIds;
      let passed = 0;
      let attempted = 0;
      let lastAttemptAt: Date | null = null;
      const conceptSet = new Set<string>();
      for (const exId of exerciseIds) {
        const latest = latestByExercise.get(exId);
        if (latest) for (const c of latest.concepts) conceptSet.add(c);
        if (passedSet.has(exId)) passed++;
        const last = lastAttemptByExercise.get(exId);
        if (last) {
          attempted++;
          if (!lastAttemptAt || last > lastAttemptAt) lastAttemptAt = last;
        }
      }
      let state: 'not_started' | 'in_progress' | 'complete';
      if (attempted === 0) state = 'not_started';
      else if (exerciseIds.length > 0 && passed === exerciseIds.length) state = 'complete';
      else state = 'in_progress';
      perLessonState.set(key, { state, lastAttemptAt });
      lessonConcepts.set(key, conceptSet);
    }

    // Concept counts from latest-version exercises (reused by Tier 2)
    const conceptCounts = new Map<string, { passed: number; total: number }>();
    for (const [exerciseId, { concepts }] of latestByExercise.entries()) {
      for (const concept of concepts) {
        let c = conceptCounts.get(concept);
        if (!c) {
          c = { passed: 0, total: 0 };
          conceptCounts.set(concept, c);
        }
        c.total++;
        if (passedSet.has(exerciseId)) c.passed++;
      }
    }

    return {
      tracksByLessonKey,
      lessonRows,
      perLessonState,
      conceptCounts,
      lessonConcepts,
      hasAnyAttempt: lastAttemptByExercise.size > 0,
      hasAnyPublishedTrack: true,
    };
  }

  private buildLessonSummary(
    lessonKey: string,
    lessonRows: Map<string, { id: string; version: number; title: string; trackId: string; position: number }>,
    tracksByLessonKey: Map<string, { trackId: string; trackTitle: string; trackPublishedAt: Date; lessonPosition: number }>,
  ): LessonSummary {
    const row = lessonRows.get(lessonKey)!;
    const tr = tracksByLessonKey.get(lessonKey)!;
    return {
      id: row.id,
      version: row.version,
      title: row.title,
      trackId: tr.trackId,
      trackTitle: tr.trackTitle,
    };
  }

  async getRecommendation(studentId: string | null, trackId?: string): Promise<RecommendationResponse> {
    const ctx = await this.aggregateForRecommendation(studentId);
    if (!ctx.hasAnyPublishedTrack) {
      return { kind: 'exhausted', reason: { message: 'No curriculum published yet.' } };
    }

    let catalogOrdered = [...ctx.tracksByLessonKey.keys()].sort((a, b) => {
      const ta = ctx.tracksByLessonKey.get(a)!;
      const tb = ctx.tracksByLessonKey.get(b)!;
      if (ta.trackPublishedAt.getTime() !== tb.trackPublishedAt.getTime()) {
        return ta.trackPublishedAt.getTime() - tb.trackPublishedAt.getTime();
      }
      if (ta.trackId !== tb.trackId) return ta.trackId.localeCompare(tb.trackId);
      return ta.lessonPosition - tb.lessonPosition;
    });

    if (trackId !== undefined) {
      catalogOrdered = catalogOrdered.filter(
        (k) => ctx.tracksByLessonKey.get(k)!.trackId === trackId,
      );
      if (catalogOrdered.length === 0) {
        return { kind: 'exhausted', reason: { message: 'No lessons in the requested track.' } };
      }
    }

    // Tier 1 — in-progress continuation
    // `inProgressKeys` is already in catalog order (filter preserves order).
    // The reduce uses strict `>` so earlier keys win on exact lastAttemptAt ties.
    const inProgressKeys = catalogOrdered.filter((k) => ctx.perLessonState.get(k)?.state === 'in_progress');
    if (inProgressKeys.length > 0) {
      let winner = inProgressKeys[0];
      let winnerLa = ctx.perLessonState.get(winner)!.lastAttemptAt;
      for (const k of inProgressKeys.slice(1)) {
        const la = ctx.perLessonState.get(k)!.lastAttemptAt;
        if (la && (!winnerLa || la > winnerLa)) {
          winner = k;
          winnerLa = la;
        }
      }
      const lesson = this.buildLessonSummary(winner, ctx.lessonRows, ctx.tracksByLessonKey);
      return { kind: 'continue', lesson, reason: { message: 'Continue where you left off.' } };
    }

    // Tier 2 — weakest-concept gap
    type ConceptStat = { concept: string; passed: number; total: number };
    const gapConcepts: ConceptStat[] = [];
    for (const [concept, v] of ctx.conceptCounts.entries()) {
      if (v.total > 0 && v.passed < v.total) gapConcepts.push({ concept, passed: v.passed, total: v.total });
    }
    if (gapConcepts.length > 0) {
      gapConcepts.sort((a, b) => {
        const ra = a.passed / a.total;
        const rb = b.passed / b.total;
        if (ra !== rb) return ra - rb;
        const gapA = a.total - a.passed;
        const gapB = b.total - b.passed;
        if (gapA !== gapB) return gapB - gapA;
        return a.concept.localeCompare(b.concept);
      });
      for (const stat of gapConcepts) {
        const eligibleKey = catalogOrdered.find((k) => {
          const st = ctx.perLessonState.get(k);
          if (!st || st.state === 'complete') return false;
          return ctx.lessonConcepts.get(k)?.has(stat.concept);
        });
        if (eligibleKey) {
          const lesson = this.buildLessonSummary(eligibleKey, ctx.lessonRows, ctx.tracksByLessonKey);
          const message = stat.passed === 0
            ? `Start on ${stat.concept} — 0/${stat.total} passed.`
            : `Practice ${stat.concept} — you've passed ${stat.passed}/${stat.total} so far.`;
          return {
            kind: 'concept_gap',
            lesson,
            reason: { message, concept: stat.concept, passed: stat.passed, total: stat.total },
          };
        }
      }
    }

    // Tier 3 — first-timer / no-gap fallback
    const tier3Keys = catalogOrdered.filter((k) => ctx.perLessonState.get(k)?.state !== 'complete');
    if (tier3Keys.length === 0) {
      return { kind: 'exhausted', reason: { message: "You've finished the published curriculum." } };
    }
    const firstKey = tier3Keys[0];
    const lesson = this.buildLessonSummary(firstKey, ctx.lessonRows, ctx.tracksByLessonKey);
    const message = ctx.hasAnyAttempt ? `Next up: ${lesson.trackTitle}.` : 'Start here.';
    return { kind: 'first_timer', lesson, reason: { message } };
  }
}
