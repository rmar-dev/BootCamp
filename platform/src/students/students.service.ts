import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Language, SkillTree, Student } from '@prisma/client';
import { StudentRepository } from '../state/repositories/student.repository';
import { StudentDifficultyRepository } from '../state/repositories/student-difficulty.repository';
import { ExamDifficultyOverrideRepository } from '../state/repositories/exam-difficulty-override.repository';
import { EnrollmentRepository } from '../state/repositories/enrollment.repository';
import { TrackRepository } from '../content/repositories/track.repository';
import { HelpRequestRepository } from '../help/help-request.repository';
import { UserRepository } from '../auth/user.repository';
import { SkillTreeService } from '../skill-tree/skill-tree.service';
import { HelpRequestStatus, UserRole } from '@prisma/client';

export type RosterEntry = Student & {
  openHelpRequestCount: number;
};

export type StudentTrackContext = {
  trackId: string;
  trackVersion: number;
  trackTitle: string;
  language: string;
  // null when the student's cohort hasn't been given a custom skill tree —
  // students fall back to the canonical Track.lessonIds in that case.
  activeSkillTree: { id: string; name: string } | null;
  // Trees the calling instructor can pick from when switching. Filtered by
  // SkillTreeService.listVisibleForUser so we never leak another instructor's
  // private trees.
  availableTrees: Array<Pick<SkillTree, 'id' | 'name' | 'visibility' | 'authorUserId'>>;
};

export type StudentDetail = {
  student: Student;
  cohortId: string | null;
  difficultyBaseline: string;
  examOverrides: Awaited<ReturnType<ExamDifficultyOverrideRepository['findByStudent']>>;
  openHelpRequestCount: number;
  // Per-enrolled-track view: which skill tree is active for the student's
  // cohort and what other trees the caller could swap to. Empty when:
  //   - student has no cohort (skill trees are cohort-scoped)
  //   - student is enrolled in zero tracks
  tracks: StudentTrackContext[];
};

@Injectable()
export class StudentsService {
  constructor(
    private readonly students: StudentRepository,
    private readonly difficulty: StudentDifficultyRepository,
    private readonly overrides: ExamDifficultyOverrideRepository,
    private readonly enrollments: EnrollmentRepository,
    private readonly tracks: TrackRepository,
    private readonly skillTrees: SkillTreeService,
    private readonly helpRequests: HelpRequestRepository,
    private readonly users: UserRepository,
  ) {}

  /**
   * The instructor's roster — every student assigned to them, with the count
   * of open + answered help requests as a per-row badge.
   */
  async getRoster(instructorUserId: string): Promise<RosterEntry[]> {
    const students = await this.students.findByInstructor(instructorUserId);
    return Promise.all(
      students.map(async (s) => {
        const inbox = await this.helpRequests.findInbox(instructorUserId, {
          // We want this student's open + answered count specifically. The
          // generic findInbox returns instructor-wide; filter inline since
          // the per-student count is rarely the bottleneck.
        });
        const count = inbox.filter(
          (r) => r.studentId === s.id && r.status !== HelpRequestStatus.resolved,
        ).length;
        return { ...s, openHelpRequestCount: count };
      }),
    );
  }

  async getUnassigned(): Promise<Student[]> {
    return this.students.findUnassigned();
  }

  /**
   * Claim or reassign a student. The caller can:
   *   - claim themselves (instructor sets instructorId = self)
   *   - admin can assign anyone to anyone (or null = unassign)
   *   - instructor can release their OWN students (set null)
   * Other transitions require admin.
   */
  async assign(
    studentId: string,
    targetInstructorUserId: string | null,
    callerUserId: string,
    callerRole: string,
  ): Promise<Student> {
    if (targetInstructorUserId !== null) {
      // Validate target user exists and is an instructor (or admin).
      const target = await this.users.findById(targetInstructorUserId);
      if (!target) throw new BadRequestException('Target instructor not found');
      if (target.role !== UserRole.instructor && target.role !== UserRole.admin) {
        throw new BadRequestException('Target user is not an instructor or admin');
      }
    }

    const student = await this.students.findById(studentId);
    if (!student) throw new NotFoundException('Student not found');

    if (callerRole === 'admin') {
      return this.students.assignInstructor(studentId, targetInstructorUserId);
    }
    // Instructor:
    //   - May claim themselves IF the student is currently unassigned.
    //   - May release (target=null) IF they are currently the assigned one.
    //   - Anything else needs admin.
    if (
      targetInstructorUserId === callerUserId &&
      student.instructorId === null
    ) {
      return this.students.assignInstructor(studentId, callerUserId);
    }
    if (targetInstructorUserId === null && student.instructorId === callerUserId) {
      return this.students.assignInstructor(studentId, null);
    }
    throw new ForbiddenException(
      'Only an admin can reassign a student to a different instructor',
    );
  }

  /**
   * Set (or clear) the language an instructor has decided this student is
   * learning. The caller must be the student's assigned instructor or an
   * admin. Null clears the assignment, which restores the un-filtered track
   * listing for the student.
   */
  async setLanguage(
    studentId: string,
    language: Language | null,
    caller: { userId: string; role: string },
  ): Promise<Student> {
    const student = await this.students.findById(studentId);
    if (!student) throw new NotFoundException('Student not found');
    if (caller.role !== UserRole.admin && student.instructorId !== caller.userId) {
      throw new ForbiddenException('Not assigned to this student');
    }
    return this.students.setLanguage(studentId, language);
  }

  /**
   * Detail page payload: roster KPIs + difficulty + recent activity + the
   * cohort's per-track skill-tree assignments. Caller authorization is
   * enforced at the controller level (must be the student's assigned
   * instructor or admin); the caller is also passed in so the
   * `availableTrees` listing respects skill-tree visibility (private trees
   * authored by other instructors are hidden).
   */
  async getDetail(
    studentId: string,
    caller: { userId: string; role: string },
  ): Promise<StudentDetail> {
    const student = await this.students.findById(studentId);
    if (!student) throw new NotFoundException('Student not found');
    // Ownership gate runs FIRST so unauthorized callers don't trigger the
    // (potentially expensive) per-track skill-tree composition below. The
    // controller still re-checks for a defense-in-depth match against
    // student.instructorId.
    if (caller.role !== UserRole.admin && student.instructorId !== caller.userId) {
      throw new ForbiddenException('Not assigned to this student');
    }
    const baseline = await this.difficulty.getOrDefault(studentId);
    const overrides = await this.overrides.findByStudent(studentId);
    const helpRequests = await this.helpRequests.findByStudent(studentId);
    const openHelpRequestCount = helpRequests.filter(
      (r) => r.status !== HelpRequestStatus.resolved,
    ).length;
    const tracks = await this.composeTrackContext(student.cohortId, studentId, caller);
    return {
      student,
      cohortId: student.cohortId,
      difficultyBaseline: baseline,
      examOverrides: overrides,
      openHelpRequestCount,
      tracks,
    };
  }

  private async composeTrackContext(
    cohortId: string | null,
    studentId: string,
    caller: { userId: string; role: string },
  ): Promise<StudentTrackContext[]> {
    const enrollments = await this.enrollments.listByStudent(studentId);
    if (enrollments.length === 0) return [];
    const out: StudentTrackContext[] = [];
    for (const e of enrollments) {
      const track = await this.tracks.findByVersion(e.trackId, e.trackVersion);
      if (!track) continue;
      // Skill trees are cohort-scoped — without a cohort, the student is
      // always on the canonical Track.lessonIds and there's nothing to swap.
      // Still surface the track so the UI can show "no cohort, no override".
      let activeSkillTree: StudentTrackContext['activeSkillTree'] = null;
      let availableTrees: StudentTrackContext['availableTrees'] = [];
      if (cohortId) {
        const assignment = await this.skillTrees.getAssignmentWithTree(
          cohortId,
          track.id,
        );
        activeSkillTree = assignment
          ? { id: assignment.skillTree.id, name: assignment.skillTree.name }
          : null;
        const visible = await this.skillTrees.listVisibleForUser({
          trackId: track.id,
          callerUserId: caller.userId,
          callerRole: caller.role,
        });
        availableTrees = visible.map((t) => ({
          id: t.id,
          name: t.name,
          visibility: t.visibility,
          authorUserId: t.authorUserId,
        }));
      }
      out.push({
        trackId: track.id,
        trackVersion: track.version,
        trackTitle: track.title,
        language: track.language,
        activeSkillTree,
        availableTrees,
      });
    }
    return out;
  }
}
