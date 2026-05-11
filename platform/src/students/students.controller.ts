import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import { DifficultyBaseline, Language, Prisma } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { StudentsService } from './students.service';
import { StudentRepository } from '../state/repositories/student.repository';
import { StudentDifficultyRepository } from '../state/repositories/student-difficulty.repository';
import { ExamDifficultyOverrideRepository } from '../state/repositories/exam-difficulty-override.repository';

@Controller('api/instructor/students')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('instructor', 'admin')
export class StudentsController {
  constructor(
    private readonly service: StudentsService,
    private readonly students: StudentRepository,
    private readonly difficulty: StudentDifficultyRepository,
    private readonly overrides: ExamDifficultyOverrideRepository,
  ) {}

  @Get()
  async getRoster(@CurrentUser() user: { userId: string }) {
    return this.service.getRoster(user.userId);
  }

  @Get('unassigned')
  async getUnassigned() {
    return this.service.getUnassigned();
  }

  @Get(':id')
  async getDetail(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; role: string },
  ) {
    const detail = await this.service.getDetail(id, user);
    // Authorization: assigned instructor (instructorId === me) or admin.
    if (user.role !== 'admin' && detail.student.instructorId !== user.userId) {
      throw new ForbiddenException('Not assigned to this student');
    }
    return detail;
  }

  @Put(':studentId/language')
  async setLanguage(
    @Param('studentId') studentId: string,
    @Body() body: { language: Language | null },
    @CurrentUser() user: { userId: string; role: string },
  ) {
    const value = body?.language ?? null;
    if (value !== null && value !== 'swift' && value !== 'kotlin') {
      throw new BadRequestException('language must be "swift", "kotlin", or null');
    }
    return this.service.setLanguage(studentId, value, user);
  }

  @Put(':studentId/assign')
  async assign(
    @Param('studentId') studentId: string,
    @Body() body: { instructorUserId: string | null },
    @CurrentUser() user: { userId: string; role: string },
  ) {
    return this.service.assign(
      studentId,
      body.instructorUserId,
      user.userId,
      user.role,
    );
  }

  // ── Difficulty controls ────────────────────────────────────────────────
  // Both endpoints require the caller to be the student's assigned
  // instructor (or admin) — enforced inline since the difficulty repos
  // don't carry that check on their own.

  @Put(':studentId/difficulty')
  async setDifficulty(
    @Param('studentId') studentId: string,
    @Body() body: { baseline: DifficultyBaseline },
    @CurrentUser() user: { userId: string; role: string },
  ) {
    await this.assertCanEditStudent(studentId, user);
    return this.difficulty.upsert(studentId, body.baseline, user.userId);
  }

  @Put(':studentId/exam-override')
  async setExamOverride(
    @Param('studentId') studentId: string,
    @Body() body: {
      exerciseId: string;
      exerciseVersion: number;
      extendTimeMs?: number | null;
      optional?: boolean;
      swapToExerciseId?: string | null;
      swapToExerciseVersion?: number | null;
    },
    @CurrentUser() user: { userId: string; role: string },
  ) {
    await this.assertCanEditStudent(studentId, user);
    return this.overrides.upsert({
      studentId,
      exerciseId: body.exerciseId,
      exerciseVersion: body.exerciseVersion,
      extendTimeMs: body.extendTimeMs ?? null,
      optional: body.optional,
      swapToExerciseId: body.swapToExerciseId ?? null,
      swapToExerciseVersion: body.swapToExerciseVersion ?? null,
      updatedBy: user.userId,
    });
  }

  @Delete(':studentId/exam-override/:exerciseId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeExamOverride(
    @Param('studentId') studentId: string,
    @Param('exerciseId') exerciseId: string,
    @CurrentUser() user: { userId: string; role: string },
  ): Promise<void> {
    await this.assertCanEditStudent(studentId, user);
    try {
      await this.overrides.remove(studentId, exerciseId);
    } catch (err) {
      // Idempotent on missing-row only (Prisma P2025). Other failures
      // (DB outage, FK violation, etc.) propagate so the caller sees a
      // real error instead of a misleading 204.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2025'
      ) {
        return;
      }
      throw err;
    }
  }

  // Shared check: the calling instructor must be the student's assigned
  // instructor, or an admin. Mirrors the getDetail authorization.
  private async assertCanEditStudent(
    studentId: string,
    user: { userId: string; role: string },
  ): Promise<void> {
    if (user.role === 'admin') return;
    const student = await this.students.findById(studentId);
    if (!student || student.instructorId !== user.userId) {
      throw new ForbiddenException('Not assigned to this student');
    }
  }
}
