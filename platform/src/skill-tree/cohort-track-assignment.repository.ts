import { Injectable } from '@nestjs/common';
import { CohortTrackAssignment, SkillTree } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type UpsertAssignmentInput = {
  cohortId: string;
  trackId: string;
  skillTreeId: string;
  assignedBy: string;
};

export type AssignmentWithTree = CohortTrackAssignment & { skillTree: SkillTree };

@Injectable()
export class CohortTrackAssignmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Hot path — called from the student-facing TrackController on every
   * track read. Includes the SkillTree so the controller has lessonIds in
   * one round-trip.
   */
  async findOneWithTree(cohortId: string, trackId: string): Promise<AssignmentWithTree | null> {
    return this.prisma.cohortTrackAssignment.findUnique({
      where: { cohortId_trackId: { cohortId, trackId } },
      include: { skillTree: true },
    });
  }

  async findOne(cohortId: string, trackId: string): Promise<CohortTrackAssignment | null> {
    return this.prisma.cohortTrackAssignment.findUnique({
      where: { cohortId_trackId: { cohortId, trackId } },
    });
  }

  /**
   * Every active assignment — used by the composer's "where this tree is
   * active" badge / list. Cheap query (one row per cohort+track pair).
   */
  async findAll(): Promise<CohortTrackAssignment[]> {
    return this.prisma.cohortTrackAssignment.findMany({
      orderBy: { assignedAt: 'desc' },
    });
  }

  async findByTree(skillTreeId: string): Promise<CohortTrackAssignment[]> {
    return this.prisma.cohortTrackAssignment.findMany({
      where: { skillTreeId },
    });
  }

  /**
   * Upsert keyed by (cohortId, trackId). Activating a different tree on the
   * same cohort+track replaces the prior assignment in place.
   */
  async upsert(input: UpsertAssignmentInput): Promise<CohortTrackAssignment> {
    return this.prisma.cohortTrackAssignment.upsert({
      where: {
        cohortId_trackId: { cohortId: input.cohortId, trackId: input.trackId },
      },
      update: { skillTreeId: input.skillTreeId, assignedBy: input.assignedBy },
      create: {
        cohortId: input.cohortId,
        trackId: input.trackId,
        skillTreeId: input.skillTreeId,
        assignedBy: input.assignedBy,
      },
    });
  }

  /**
   * Clearing an assignment reverts the cohort+track to the canonical
   * Track.lessonIds. The underlying SkillTree is preserved.
   */
  async remove(cohortId: string, trackId: string): Promise<void> {
    await this.prisma.cohortTrackAssignment.delete({
      where: { cohortId_trackId: { cohortId, trackId } },
    });
  }
}
