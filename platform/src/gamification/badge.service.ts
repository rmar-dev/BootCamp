import { ForbiddenException, Injectable } from '@nestjs/common';
import { Attempt, Badge, ExerciseResult } from '@prisma/client';
import { BadgeRepository } from './badge.repository';
import { StreakService } from './streak.service';
import { ExerciseResultRepository } from '../state/repositories/exercise-result.repository';
import { ExerciseRepository } from '../content/repositories/exercise.repository';
import { ProgressService } from '../state/services/progress.service';
import { StudentRepository } from '../state/repositories/student.repository';
import { EnrollmentRepository } from '../state/repositories/enrollment.repository';
import { PrismaService } from '../prisma/prisma.service';

export type BadgeStatus = {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  earned: boolean;
  earnedAt?: Date;
};

export type BadgeCheckContext = {
  attempt: Attempt;
  exerciseResult: ExerciseResult;
  totalPoints: number;
  exerciseType: string;
  exerciseId: string;
  lessonId: string;
  lessonVersion: number;
};

// "All 5 types" deliberately excludes capstone_submission (instructor-graded
// only, not earnable through normal practice) and visual_playground (free
// exploration, no pass/fail signal). The "Versatile" badge text and these
// exclusions move together — change one, change the other.
const ALL_EXERCISE_TYPES = new Set([
  'code',
  'fix_bug',
  'fill_blank',
  'predict_output',
  'multiple_choice',
]);

@Injectable()
export class BadgeService {
  constructor(
    private readonly badgeRepo: BadgeRepository,
    private readonly streakSvc: StreakService,
    private readonly results: ExerciseResultRepository,
    private readonly exercises: ExerciseRepository,
    private readonly progress: ProgressService,
    private readonly students: StudentRepository,
    private readonly enrollments: EnrollmentRepository,
    private readonly prisma: PrismaService,
  ) {}

  async listForStudent(studentId: string): Promise<BadgeStatus[]> {
    const visible = await this.loadVisibleBadges(studentId);
    const earned = await this.badgeRepo.findByStudent(studentId);
    const earnedMap = new Map(earned.map((b) => [b.badgeId, b]));
    return visible.map((b) => {
      const e = earnedMap.get(b.code);
      return {
        id: b.id,
        code: b.code,
        name: b.name,
        description: b.description,
        icon: b.icon,
        earned: !!e,
        earnedAt: e?.earnedAt,
      };
    });
  }

  /**
   * Manual award path — used by /api/instructor/badges/:id/award. The badge
   * MUST have criteriaKind === 'manual_award' (so we never overwrite an
   * auto-evaluated criterion by hand).
   *
   * Authorization is split: the controller verifies the caller can act on
   * this student (assigned instructor or admin); this method enforces the
   * criteria-kind invariant and that the badge is in the student's visible
   * scope (you can't award a cohort badge to a student in another cohort).
   */
  async manualAward(
    badgeId: string,
    studentId: string,
    awardedByUserId: string,
  ): Promise<{ awarded: boolean }> {
    const badge = await this.badgeRepo.findById(badgeId);
    if (!badge) throw new ForbiddenException('Badge not found');
    if (badge.criteriaKind !== 'manual_award') {
      throw new ForbiddenException(
        'Only badges with criteriaKind=manual_award can be granted by hand',
      );
    }
    const visible = await this.loadVisibleBadges(studentId);
    if (!visible.some((b) => b.id === badge.id)) {
      throw new ForbiddenException('Badge is not in this student\'s visible scope');
    }
    if (await this.badgeRepo.hasBadge(studentId, badge.code)) {
      return { awarded: false };
    }
    await this.badgeRepo.award(studentId, badge.code, awardedByUserId);
    return { awarded: true };
  }

  async checkAndAward(
    studentId: string,
    ctx: BadgeCheckContext,
  ): Promise<Badge[]> {
    const awarded: Badge[] = [];
    const visible = await this.loadVisibleBadges(studentId);

    // Streak is shared by streak_3, streak_7, and any instructor-defined
    // streak_threshold badge. Cache once per call.
    let streakCache: { current: number; activeToday: boolean } | null = null;
    const getStreak = async () => {
      if (streakCache === null) {
        streakCache = await this.streakSvc.getCurrentStreak(studentId);
      }
      return streakCache;
    };

    let passedCountCache: number | null = null;
    const getPassedCount = async () => {
      if (passedCountCache === null) {
        const all = await this.results.listByStudent(studentId);
        passedCountCache = all.filter((r) => r.passed).length;
      }
      return passedCountCache;
    };

    let allTypesCache: boolean | null = null;
    const getAllTypes = async () => {
      if (allTypesCache === null) {
        const allResults = await this.results.listByStudent(studentId);
        const passedResults = allResults.filter((r) => r.passed);
        const exerciseIds = passedResults.map((r) => r.exerciseId);
        const exercises = await this.prisma.exercise.findMany({
          where: { id: { in: exerciseIds } },
          distinct: ['id'],
          orderBy: { version: 'desc' },
        });
        const exerciseMap = new Map(exercises.map((e) => [e.id, e]));
        const typesFound = new Set<string>();
        for (const result of passedResults) {
          const ex = exerciseMap.get(result.exerciseId);
          if (ex) typesFound.add(ex.type);
        }
        allTypesCache =
          ALL_EXERCISE_TYPES.size === typesFound.size &&
          [...ALL_EXERCISE_TYPES].every((t) => typesFound.has(t));
      }
      return allTypesCache;
    };

    for (const badge of visible) {
      if (await this.badgeRepo.hasBadge(studentId, badge.code)) continue;

      let shouldAward = false;
      // Note on system_* arms: the thresholds (3, 7, 100, 500, ...) are
      // intentionally hardcoded here rather than read from badge.thresholdValue.
      // The system badges are part of the platform's contract — their meaning
      // and cutoffs don't change at runtime, and copy in the seeded
      // description text (e.g. "Earned 100 total points.") would drift if a
      // DB row could override the value.
      switch (badge.criteriaKind) {
        case 'system_first_submit':
          shouldAward = true;
          break;
        case 'system_first_pass':
          shouldAward = ctx.attempt.passed && ctx.attempt.failedAttemptsBefore === 0;
          break;
        case 'system_streak_3': {
          const s = await getStreak();
          shouldAward = s.current >= 3;
          break;
        }
        case 'system_streak_7': {
          const s = await getStreak();
          shouldAward = s.current >= 7;
          break;
        }
        case 'system_all_types':
          shouldAward = await getAllTypes();
          break;
        case 'system_points_100':
          shouldAward = ctx.totalPoints >= 100;
          break;
        case 'system_points_500':
          shouldAward = ctx.totalPoints >= 500;
          break;
        case 'system_perfect_lesson':
          try {
            shouldAward = await this.progress.isLessonCompleted(
              studentId,
              ctx.lessonId,
              ctx.lessonVersion,
            );
          } catch {
            shouldAward = false;
          }
          break;
        case 'points_threshold':
          shouldAward =
            badge.thresholdValue != null && ctx.totalPoints >= badge.thresholdValue;
          break;
        case 'streak_threshold': {
          if (badge.thresholdValue == null) break;
          const s = await getStreak();
          shouldAward = s.current >= badge.thresholdValue;
          break;
        }
        case 'exercises_passed': {
          if (badge.thresholdValue == null) break;
          const n = await getPassedCount();
          shouldAward = n >= badge.thresholdValue;
          break;
        }
        case 'manual_award':
          // Never auto-awarded — granted via manualAward() only.
          shouldAward = false;
          break;
      }

      if (shouldAward) {
        await this.badgeRepo.award(studentId, badge.code, null);
        awarded.push(badge);
      }
    }

    return awarded;
  }

  // ── Internal: scope resolution ───────────────────────────────────────────

  private async loadVisibleBadges(studentId: string): Promise<Badge[]> {
    const student = await this.students.findById(studentId);
    if (!student) return [];
    const trackIds = await this.enrollmentTrackIds(studentId);
    return this.badgeRepo.findAllVisibleToStudent({
      id: student.id,
      cohortId: student.cohortId,
      enrolledTrackIds: trackIds,
    });
  }

  private async enrollmentTrackIds(studentId: string): Promise<string[]> {
    const list = await this.enrollments.listByStudent(studentId);
    return Array.from(new Set(list.map((e) => e.trackId)));
  }
}
