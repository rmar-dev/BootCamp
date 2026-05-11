import {
  Controller,
  Get,
  Param,
  NotFoundException,
  UseGuards,
  Query,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TrackRepository } from './repositories/track.repository';
import { LessonRepository } from './repositories/lesson.repository';
import { CohortRepository } from '../state/repositories/cohort.repository';
import { CohortTrackAssignmentRepository } from '../skill-tree/cohort-track-assignment.repository';
import { StudentTrackAssignmentRepository } from '../skill-tree/student-track-assignment.repository';
import { EnsureStudentService } from '../submission/ensure-student';

export type TrackSummary = {
  id: string;
  version: number;
  title: string;
  language: string;
  kind: string;
  description: string;
  lessonCount: number;
  starterRepoUrl: string | null;
};

export type TrackDetail = TrackSummary & {
  lessons: Array<{
    id: string;
    version: number;
    title: string;
    level: string;
    summary: string;
    position: number;
  }>;
};

@Controller('api/tracks')
export class TrackController {
  constructor(
    private readonly tracks: TrackRepository,
    private readonly lessons: LessonRepository,
    private readonly cohorts: CohortRepository,
    private readonly ensureStudent: EnsureStudentService,
    private readonly skillTreeAssignments: CohortTrackAssignmentRepository,
    private readonly studentSkillTreeAssignments: StudentTrackAssignmentRepository,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async list(
    @Req() req: { user: { userId: string; role: string } },
  ): Promise<TrackSummary[]> {
    const tracks = await this.tracks.findAllLatestPublished();
    // The instructor-decided language gate only applies to students. Instructors
    // and admins always see the full catalogue (their tracks switcher doubles as
    // a preview tool).
    const studentLanguage =
      req.user.role === 'student'
        ? (await this.ensureStudent.ensureStudent(req.user.userId)).language
        : null;
    const visible = studentLanguage
      ? tracks.filter((t) => t.language === studentLanguage)
      : tracks;
    return visible.map((t) => ({
      id: t.id,
      version: t.version,
      title: t.title,
      language: t.language,
      kind: t.kind,
      description: t.description,
      lessonCount: t.lessonIds.length,
      starterRepoUrl: t.starterRepoUrl,
    }));
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async detail(
    @Param('id') id: string,
    @Query('mode') mode: string | undefined,
    @Req() req: { user: { userId: string } },
  ): Promise<TrackDetail> {
    const track = await this.tracks.findLatestPublished(id);
    if (!track) throw new NotFoundException(`Track ${id} not found`);

    const previewMode = mode === 'preview';
    const studentRecord = previewMode
      ? null
      : await this.ensureStudent.ensureStudent(req.user.userId);
    const cohort = !previewMode && studentRecord
      ? await this.cohorts.findByStudentId(studentRecord.id)
      : null;

    // Skill-tree resolution order (highest wins):
    //   1. Per-student override (StudentTrackAssignment) — a tree the
    //      instructor assigned to this individual student via the
    //      /instructor/students/[id] page.
    //   2. Cohort assignment (CohortTrackAssignment) — sub-project G's
    //      per-cohort override.
    //   3. Canonical Track.lessonIds.
    // Versions resolve to "latest published" per lesson whenever a tree is
    // active so the assignment survives unrelated lesson re-versioning.
    const studentOverride = !previewMode && studentRecord
      ? await this.studentSkillTreeAssignments.findOneWithTree(studentRecord.id, track.id)
      : null;
    const cohortAssignment = !previewMode && cohort && !studentOverride
      ? await this.skillTreeAssignments.findOneWithTree(cohort.id, track.id)
      : null;
    const activeAssignment = studentOverride ?? cohortAssignment;

    const sourceLessonIds: string[] = activeAssignment?.skillTree.lessonIds ?? track.lessonIds;
    const sourceLessonVersions: number[] | null = activeAssignment ? null : track.lessonVersions;

    const lessonRecords = await Promise.all(
      sourceLessonIds.map(async (lessonId: string, idx: number) => {
        if (sourceLessonVersions) {
          return this.lessons.findByVersion(lessonId, sourceLessonVersions[idx]);
        }
        return this.lessons.findLatestPublished(lessonId);
      }),
    );

    const visible = lessonRecords.filter((lesson): lesson is NonNullable<typeof lesson> => {
      if (!lesson) return false;
      if (previewMode) return true;
      if (lesson.cohortGate == null) return true;
      if (lesson.cohortGate === 'four_week') return true;
      if (lesson.cohortGate === 'twelve_week') return cohort?.cohortLength === 'twelve_week';
      return false;
    });

    return {
      id: track.id,
      version: track.version,
      title: track.title,
      language: track.language,
      kind: track.kind,
      description: track.description,
      lessonCount: visible.length,
      starterRepoUrl: track.starterRepoUrl,
      lessons: visible.map((l) => ({
        id: l.id,
        version: l.version,
        title: l.title,
        level: l.level,
        summary: l.summary,
        position: l.position,
      })),
    };
  }
}
