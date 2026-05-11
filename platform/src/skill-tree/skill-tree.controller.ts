import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SkillTreeVisibility } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SkillTreeService } from './skill-tree.service';
import { CohortRepository } from '../state/repositories/cohort.repository';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertUuid(value: string, label: string): void {
  if (!UUID_RE.test(value)) {
    throw new BadRequestException(`${label} must be a UUID — got '${value}'`);
  }
}

// All endpoints under /api/instructor/skill-tree are instructor-only. Students
// never call these — the student-facing TrackController applies the active
// assignment server-side based on the calling student's cohort, so the student
// UI never has to know skill-trees exist.
@Controller('api/instructor/skill-tree')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('instructor', 'admin')
export class SkillTreeInstructorController {
  constructor(
    private readonly service: SkillTreeService,
    private readonly cohorts: CohortRepository,
  ) {}

  // ── Cohort picker ─────────────────────────────────────────────────────
  @Get('cohorts')
  async listCohorts(@CurrentUser() user: { userId: string; role: string }) {
    if (user.role === 'admin') return this.cohorts.findAll();
    return this.cohorts.findByInstructor(user.userId);
  }

  // ── Tree CRUD ─────────────────────────────────────────────────────────
  @Get('trees')
  async listTrees(
    @Query('trackId') trackId: string | undefined,
    @CurrentUser() user: { userId: string; role: string },
  ) {
    if (!trackId) throw new BadRequestException('trackId query param is required');
    assertUuid(trackId, 'trackId');
    return this.service.listVisibleForUser({
      trackId,
      callerUserId: user.userId,
      callerRole: user.role,
    });
  }

  @Get('trees/:id')
  async getTree(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; role: string },
  ) {
    return this.service.getTree(id, user.userId, user.role);
  }

  @Post('trees')
  async createTree(
    @Body() body: {
      trackId: string;
      name: string;
      description?: string | null;
      visibility?: SkillTreeVisibility;
      lessonIds: string[];
    },
    @CurrentUser() user: { userId: string },
  ) {
    assertUuid(body.trackId, 'trackId');
    return this.service.createTree({
      trackId: body.trackId,
      name: body.name,
      description: body.description ?? null,
      visibility: body.visibility ?? SkillTreeVisibility.private,
      lessonIds: body.lessonIds,
      authorUserId: user.userId,
    });
  }

  @Put('trees/:id')
  async updateTree(
    @Param('id') id: string,
    @Body() body: {
      name?: string;
      description?: string | null;
      visibility?: SkillTreeVisibility;
      lessonIds?: string[];
    },
    @CurrentUser() user: { userId: string; role: string },
  ) {
    return this.service.updateTree(id, user.userId, user.role, body);
  }

  @Delete('trees/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTree(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; role: string },
  ): Promise<void> {
    await this.service.deleteTree(id, user.userId, user.role);
  }

  // ── Assignments (which tree is active for which cohort+track) ─────────
  @Get('assignments')
  async listAssignments() {
    return this.service.listAllAssignments();
  }

  @Get('assignments/:cohortId/:trackId')
  async getAssignment(
    @Param('cohortId') cohortId: string,
    @Param('trackId') trackId: string,
  ) {
    assertUuid(cohortId, 'cohortId');
    assertUuid(trackId, 'trackId');
    return this.service.getAssignmentWithTree(cohortId, trackId);
  }

  @Put('assignments/:cohortId/:trackId')
  async setAssignment(
    @Param('cohortId') cohortId: string,
    @Param('trackId') trackId: string,
    @Body() body: { skillTreeId: string },
    @CurrentUser() user: { userId: string; role: string },
  ) {
    assertUuid(cohortId, 'cohortId');
    assertUuid(trackId, 'trackId');
    assertUuid(body.skillTreeId, 'skillTreeId');
    return this.service.assign({
      cohortId,
      trackId,
      skillTreeId: body.skillTreeId,
      callerUserId: user.userId,
      callerRole: user.role,
    });
  }

  @Delete('assignments/:cohortId/:trackId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async clearAssignment(
    @Param('cohortId') cohortId: string,
    @Param('trackId') trackId: string,
    @CurrentUser() user: { userId: string; role: string },
  ): Promise<void> {
    assertUuid(cohortId, 'cohortId');
    assertUuid(trackId, 'trackId');
    await this.service.unassign(cohortId, trackId, user.userId, user.role);
  }

  // ── Per-student override ──────────────────────────────────────────────
  // Shadows the cohort assignment for one student. Resolution order in the
  // student-facing TrackController.detail() becomes:
  //   StudentTrackAssignment > CohortTrackAssignment > canonical Track
  // The caller must be the student's assigned instructor (or admin).

  @Get('student-assignments/:studentId/:trackId')
  async getStudentAssignment(
    @Param('studentId') studentId: string,
    @Param('trackId') trackId: string,
  ) {
    assertUuid(studentId, 'studentId');
    assertUuid(trackId, 'trackId');
    return this.service.getStudentOverride(studentId, trackId);
  }

  @Put('student-assignments/:studentId/:trackId')
  async setStudentAssignment(
    @Param('studentId') studentId: string,
    @Param('trackId') trackId: string,
    @Body() body: { skillTreeId: string },
    @CurrentUser() user: { userId: string; role: string },
  ): Promise<void> {
    assertUuid(studentId, 'studentId');
    assertUuid(trackId, 'trackId');
    assertUuid(body.skillTreeId, 'skillTreeId');
    await this.service.assignToStudent({
      studentId,
      trackId,
      skillTreeId: body.skillTreeId,
      callerUserId: user.userId,
      callerRole: user.role,
    });
  }

  @Delete('student-assignments/:studentId/:trackId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async clearStudentAssignment(
    @Param('studentId') studentId: string,
    @Param('trackId') trackId: string,
    @CurrentUser() user: { userId: string; role: string },
  ): Promise<void> {
    assertUuid(studentId, 'studentId');
    assertUuid(trackId, 'trackId');
    await this.service.unassignFromStudent(studentId, trackId, user.userId, user.role);
  }
}
