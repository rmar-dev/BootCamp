import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Badge, BadgeCriteriaKind, BadgeScopeKind } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { BadgeRepository } from './badge.repository';
import { BadgeService } from './badge.service';
import { StudentRepository } from '../state/repositories/student.repository';

// Criteria kinds an instructor is allowed to author. System kinds are
// reserved for the 8 hardcoded evaluators wired into BadgeService and must
// not be hand-created.
const INSTRUCTOR_CRITERIA = new Set<BadgeCriteriaKind>([
  'manual_award',
  'points_threshold',
  'streak_threshold',
  'exercises_passed',
]);

const VALID_SCOPES = new Set<BadgeScopeKind>([
  'public',
  'cohort',
  'track',
  'private_to_student',
]);

type CreateBody = {
  name: string;
  description: string;
  icon: string;
  criteriaKind: BadgeCriteriaKind;
  thresholdValue?: number | null;
  scopeKind: BadgeScopeKind;
  scopeId?: string | null;
};

type UpdateBody = Partial<{
  name: string;
  description: string;
  icon: string;
  thresholdValue: number | null;
  scopeKind: BadgeScopeKind;
  scopeId: string | null;
}>;

@Controller('api/instructor/badges')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('instructor', 'admin')
export class InstructorBadgesController {
  constructor(
    private readonly badges: BadgeRepository,
    private readonly badgeService: BadgeService,
    private readonly students: StudentRepository,
  ) {}

  /**
   * Lists badges relevant to the calling instructor: every system badge
   * (read-only context) plus every badge they authored. Other instructors'
   * badges are intentionally hidden — there is no global "instructor badge
   * directory" yet.
   */
  @Get()
  async list(@CurrentUser() user: { userId: string }): Promise<Badge[]> {
    return this.badges.findAuthoredBy(user.userId);
  }

  @Post()
  async create(
    @Body() body: CreateBody,
    @CurrentUser() user: { userId: string },
  ): Promise<Badge> {
    this.assertValidPayload(body);
    const code = this.generateCode(body.name, user.userId);
    return this.badges.create({
      code,
      name: body.name.trim(),
      description: body.description.trim(),
      icon: body.icon.trim(),
      criteriaKind: body.criteriaKind,
      thresholdValue: body.thresholdValue ?? null,
      scopeKind: body.scopeKind,
      scopeId: body.scopeId ?? null,
      authorUserId: user.userId,
    });
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: UpdateBody,
    @CurrentUser() user: { userId: string; role: string },
  ): Promise<Badge> {
    if (body.scopeKind !== undefined && !VALID_SCOPES.has(body.scopeKind)) {
      throw new BadRequestException('Invalid scopeKind');
    }
    return this.badges.update(id, user.userId, user.role === 'admin', {
      name: body.name?.trim(),
      description: body.description?.trim(),
      icon: body.icon?.trim(),
      thresholdValue:
        body.thresholdValue === undefined ? undefined : body.thresholdValue,
      scopeKind: body.scopeKind,
      scopeId: body.scopeId === undefined ? undefined : body.scopeId ?? null,
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; role: string },
  ): Promise<void> {
    await this.badges.delete(id, user.userId, user.role === 'admin');
  }

  /**
   * Manually grant a badge to a student. The badge MUST be a manual_award
   * criteria (enforced in BadgeService.manualAward). The instructor must be
   * the student's assigned instructor or an admin (mirrors StudentsController
   * detail-edit policy so we don't introduce a different authority surface).
   */
  @Post(':id/award')
  async award(
    @Param('id') id: string,
    @Body() body: { studentId: string },
    @CurrentUser() user: { userId: string; role: string },
  ): Promise<{ awarded: boolean }> {
    if (!body?.studentId) {
      throw new BadRequestException('studentId is required');
    }
    await this.assertCanActOnStudent(body.studentId, user);
    return this.badgeService.manualAward(id, body.studentId, user.userId);
  }

  // ── Internals ────────────────────────────────────────────────────────────

  private assertValidPayload(body: CreateBody): void {
    if (!body?.name?.trim() || !body?.description?.trim() || !body?.icon?.trim()) {
      throw new BadRequestException('name, description, and icon are required');
    }
    if (!INSTRUCTOR_CRITERIA.has(body.criteriaKind)) {
      throw new BadRequestException(
        `criteriaKind must be one of: ${[...INSTRUCTOR_CRITERIA].join(', ')}`,
      );
    }
    if (!VALID_SCOPES.has(body.scopeKind)) {
      throw new BadRequestException('Invalid scopeKind');
    }
    const needsScopeId =
      body.scopeKind === 'cohort' ||
      body.scopeKind === 'track' ||
      body.scopeKind === 'private_to_student';
    if (needsScopeId && !body.scopeId) {
      throw new BadRequestException(
        `scopeKind=${body.scopeKind} requires scopeId`,
      );
    }
    if (body.scopeKind === 'public' && body.scopeId) {
      throw new BadRequestException('public scope must not carry scopeId');
    }
    const needsThreshold =
      body.criteriaKind === 'points_threshold' ||
      body.criteriaKind === 'streak_threshold' ||
      body.criteriaKind === 'exercises_passed';
    if (needsThreshold) {
      if (
        body.thresholdValue == null ||
        !Number.isInteger(body.thresholdValue) ||
        body.thresholdValue < 1
      ) {
        throw new BadRequestException(
          `criteriaKind=${body.criteriaKind} requires thresholdValue >= 1`,
        );
      }
    }
  }

  private generateCode(name: string, authorUserId: string): string {
    const slug = name
      .toLowerCase()
      .normalize('NFKD')
      // Strip Unicode combining diacritics (U+0300–U+036F) so "résumé" -> "resume".
      .replace(/[\u0300-\u036F]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40) || 'badge';
    // Suffix with author short + random so two instructors can both author a
    // "Hard Worker" badge without colliding on the unique code constraint.
    const authorShort = authorUserId.slice(0, 6);
    const rand = Math.random().toString(36).slice(2, 6);
    return `i_${slug}_${authorShort}_${rand}`;
  }

  private async assertCanActOnStudent(
    studentId: string,
    user: { userId: string; role: string },
  ): Promise<void> {
    if (user.role === 'admin') return;
    const student = await this.students.findById(studentId);
    if (!student) throw new NotFoundException('Student not found');
    if (student.instructorId !== user.userId) {
      throw new ForbiddenException('Not assigned to this student');
    }
  }
}
