import {
  Controller, Get, Post, HttpException, HttpStatus,
  Param, ParseIntPipe, Query, UseGuards, Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LessonAssemblerService, LessonResponseDTO } from './services/lesson-assembler.service';
import { LessonRepository } from './repositories/lesson.repository';
import { AssignmentService } from '../state/services/assignment.service';
import { CohortRepository } from '../state/repositories/cohort.repository';
import { EnsureStudentService } from '../submission/ensure-student';

type AuthedRequest = { user: { userId: string } };

@Controller('api/lessons')
export class LessonController {
  constructor(
    private readonly assembler: LessonAssemblerService,
    private readonly lessons: LessonRepository,
    private readonly assignments: AssignmentService,
    private readonly ensureStudent: EnsureStudentService,
    private readonly cohorts: CohortRepository,
  ) {}

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getLatest(
    @Param('id') id: string,
    @Query('mode') mode: string | undefined,
    @Req() req: AuthedRequest,
  ): Promise<LessonResponseDTO> {
    if (mode === 'preview') {
      const result = await this.assembler.assembleLatestPreview(id);
      if (!result) throw new HttpException({ error: 'not_found' }, HttpStatus.NOT_FOUND);
      return result;
    }
    const { id: studentId } = await this.ensureStudent.ensureStudent(req.user.userId);
    const lesson = await this.lessons.findLatestPublishedWithBlocks(id);
    if (!lesson) throw new HttpException({ error: 'not_found' }, HttpStatus.NOT_FOUND);
    const cohort = await this.cohorts.findByStudentId(studentId);
    const poolExerciseIds = lesson.blocks
      .filter((b) => b.kind === 'exercise' && b.exerciseId)
      .map((b) => b.exerciseId!);
    const assignmentState = await this.assignments.resolve({
      studentId,
      lessonId: id,
      lessonVersion: lesson.version,
      poolExerciseIds,
    });
    const dtoState = assignmentState.status === 'active'
      ? { status: 'active' as const, id: assignmentState.assignmentId, selectedExerciseIds: assignmentState.selectedExerciseIds }
      : { status: 'pool_complete' as const, allExerciseIds: assignmentState.allExerciseIds };
    const result = await this.assembler.assembleLatestForStudent(id, dtoState, studentId, cohort?.id ?? null);
    if (!result) throw new HttpException({ error: 'not_found' }, HttpStatus.NOT_FOUND);
    return result;
  }

  @Get(':id/v/:version')
  @UseGuards(JwtAuthGuard)
  async getByVersion(
    @Param('id') id: string,
    @Param('version', ParseIntPipe) version: number,
  ): Promise<LessonResponseDTO> {
    // Versioned lookup is always preview-shaped (no per-student assignment).
    const result = await this.assembler.assembleByVersion(id, version);
    if (!result) throw new HttpException({ error: 'not_found' }, HttpStatus.NOT_FOUND);
    return result;
  }

  @Post(':id/revisit')
  @UseGuards(JwtAuthGuard)
  async revisit(
    @Param('id') id: string,
    @Req() req: AuthedRequest,
  ): Promise<LessonResponseDTO> {
    const { id: studentId } = await this.ensureStudent.ensureStudent(req.user.userId);
    const lesson = await this.lessons.findLatestPublishedWithBlocks(id);
    if (!lesson) throw new HttpException({ error: 'not_found' }, HttpStatus.NOT_FOUND);
    const poolExerciseIds = lesson.blocks
      .filter((b) => b.kind === 'exercise' && b.exerciseId)
      .map((b) => b.exerciseId!);
    // Revisit throws PoolCompleteException (409) if no unseen exercises remain — let it propagate.
    const result = await this.assignments.revisit({
      studentId, lessonId: id, lessonVersion: lesson.version, poolExerciseIds,
    });
    if (result.status !== 'active') {
      // Defensive: revisit should throw PoolCompleteException before reaching here.
      throw new HttpException({ error: 'pool_complete' }, HttpStatus.CONFLICT);
    }
    const cohort = await this.cohorts.findByStudentId(studentId);
    const dto = await this.assembler.assembleLatestForStudent(id, {
      status: 'active', id: result.assignmentId, selectedExerciseIds: result.selectedExerciseIds,
    }, studentId, cohort?.id ?? null);
    if (!dto) throw new HttpException({ error: 'not_found' }, HttpStatus.NOT_FOUND);
    return dto;
  }

  @Get(':id/pool-status')
  @UseGuards(JwtAuthGuard)
  async poolStatus(
    @Param('id') id: string,
    @Req() req: AuthedRequest,
  ): Promise<{ poolSize: number; seenCount: number; currentAssignmentIds: string[]; poolComplete: boolean }> {
    const { id: studentId } = await this.ensureStudent.ensureStudent(req.user.userId);
    const lesson = await this.lessons.findLatestPublishedWithBlocks(id);
    if (!lesson) throw new HttpException({ error: 'not_found' }, HttpStatus.NOT_FOUND);
    const poolExerciseIds = lesson.blocks
      .filter((b) => b.kind === 'exercise' && b.exerciseId)
      .map((b) => b.exerciseId!);
    return this.assignments.poolStatus(studentId, id, poolExerciseIds);
  }
}
