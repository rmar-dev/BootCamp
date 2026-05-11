import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Badge, BadgeCriteriaKind, BadgeScopeKind, Prisma, StudentBadge } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { newId } from '../shared/ids';

export type CreateBadgeInput = {
  code: string;
  name: string;
  description: string;
  icon: string;
  criteriaKind: BadgeCriteriaKind;
  thresholdValue?: number | null;
  scopeKind: BadgeScopeKind;
  scopeId?: string | null;
  authorUserId: string;
};

export type UpdateBadgeInput = Partial<{
  name: string;
  description: string;
  icon: string;
  thresholdValue: number | null;
  scopeKind: BadgeScopeKind;
  scopeId: string | null;
}>;

@Injectable()
export class BadgeRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ── StudentBadge (awards) ────────────────────────────────────────────────

  async findByStudent(studentId: string): Promise<StudentBadge[]> {
    return this.prisma.studentBadge.findMany({ where: { studentId } });
  }

  async hasBadge(studentId: string, badgeCode: string): Promise<boolean> {
    const badge = await this.prisma.studentBadge.findUnique({
      where: { studentId_badgeId: { studentId, badgeId: badgeCode } },
    });
    return badge !== null;
  }

  async award(
    studentId: string,
    badgeCode: string,
    awardedBy: string | null = null,
  ): Promise<StudentBadge> {
    return this.prisma.studentBadge.upsert({
      where: { studentId_badgeId: { studentId, badgeId: badgeCode } },
      create: {
        id: newId(),
        studentId,
        badgeId: badgeCode,
        awardedBy: awardedBy ?? null,
      },
      update: {},
    });
  }

  // ── Badge definitions ────────────────────────────────────────────────────

  async findAllVisibleToStudent(student: {
    id: string;
    cohortId: string | null;
    enrolledTrackIds: string[];
  }): Promise<Badge[]> {
    // Caller (DashboardController) may pass `id: ''` to mean "no Student row
    // yet — surface all public badges as locked." Including a `scopeId: ''`
    // clause makes Postgres fail with "Error creating UUID, invalid length 0".
    // Drop it when the id is empty.
    return this.prisma.badge.findMany({
      where: {
        OR: [
          { scopeKind: 'public' },
          ...(student.id.length > 0
            ? [{ scopeKind: 'private_to_student' as const, scopeId: student.id }]
            : []),
          ...(student.cohortId
            ? [{ scopeKind: 'cohort' as const, scopeId: student.cohortId }]
            : []),
          ...(student.enrolledTrackIds.length > 0
            ? [{ scopeKind: 'track' as const, scopeId: { in: student.enrolledTrackIds } }]
            : []),
        ],
      },
      orderBy: [{ system: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async findById(id: string): Promise<Badge | null> {
    return this.prisma.badge.findUnique({ where: { id } });
  }

  async findByCode(code: string): Promise<Badge | null> {
    return this.prisma.badge.findUnique({ where: { code } });
  }

  async findAuthoredBy(authorUserId: string): Promise<Badge[]> {
    return this.prisma.badge.findMany({
      where: { authorUserId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(input: CreateBadgeInput): Promise<Badge> {
    try {
      return await this.prisma.badge.create({
        data: {
          id: newId(),
          code: input.code,
          name: input.name,
          description: input.description,
          icon: input.icon,
          criteriaKind: input.criteriaKind,
          thresholdValue: input.thresholdValue ?? null,
          scopeKind: input.scopeKind,
          scopeId: input.scopeId ?? null,
          authorUserId: input.authorUserId,
          system: false,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ForbiddenException(`Badge code "${input.code}" already exists`);
      }
      throw err;
    }
  }

  async update(id: string, callerUserId: string, isAdmin: boolean, patch: UpdateBadgeInput): Promise<Badge> {
    const existing = await this.assertEditable(id, callerUserId, isAdmin);
    return this.prisma.badge.update({
      where: { id: existing.id },
      data: patch,
    });
  }

  async delete(id: string, callerUserId: string, isAdmin: boolean): Promise<void> {
    const existing = await this.assertEditable(id, callerUserId, isAdmin);
    // Drop the definition AND the orphaned awards in one transaction so the
    // /api/dashboard/me badges list does not show a "ghost" badge with no
    // matching definition.
    await this.prisma.$transaction([
      this.prisma.studentBadge.deleteMany({ where: { badgeId: existing.code } }),
      this.prisma.badge.delete({ where: { id: existing.id } }),
    ]);
  }

  private async assertEditable(
    id: string,
    callerUserId: string,
    isAdmin: boolean,
  ): Promise<Badge> {
    const existing = await this.prisma.badge.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Badge not found');
    if (existing.system) {
      throw new ForbiddenException('System badges are read-only');
    }
    if (!isAdmin && existing.authorUserId !== callerUserId) {
      throw new ForbiddenException('Only the author or an admin can modify this badge');
    }
    return existing;
  }
}
