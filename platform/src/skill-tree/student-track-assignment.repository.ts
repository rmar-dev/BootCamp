import { Injectable } from '@nestjs/common';
import { SkillTree, StudentTrackAssignment } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type UpsertStudentAssignmentInput = {
  studentId: string;
  trackId: string;
  skillTreeId: string;
  assignedBy: string;
};

export type StudentAssignmentWithTree = StudentTrackAssignment & { skillTree: SkillTree };

@Injectable()
export class StudentTrackAssignmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Hot path — called from TrackController on every student-facing track
   * read so a per-student override can shadow the cohort assignment. Returns
   * the SkillTree alongside so the caller doesn't pay a second round-trip.
   */
  async findOneWithTree(studentId: string, trackId: string): Promise<StudentAssignmentWithTree | null> {
    return this.prisma.studentTrackAssignment.findUnique({
      where: { studentId_trackId: { studentId, trackId } },
      include: { skillTree: true },
    });
  }

  async findAllForStudent(studentId: string): Promise<StudentAssignmentWithTree[]> {
    return this.prisma.studentTrackAssignment.findMany({
      where: { studentId },
      include: { skillTree: true },
    });
  }

  /**
   * Upsert keyed by (studentId, trackId). Re-activating a different tree on
   * the same pair replaces the prior override in place.
   */
  async upsert(input: UpsertStudentAssignmentInput): Promise<StudentTrackAssignment> {
    return this.prisma.studentTrackAssignment.upsert({
      where: {
        studentId_trackId: { studentId: input.studentId, trackId: input.trackId },
      },
      update: { skillTreeId: input.skillTreeId, assignedBy: input.assignedBy },
      create: {
        studentId: input.studentId,
        trackId: input.trackId,
        skillTreeId: input.skillTreeId,
        assignedBy: input.assignedBy,
      },
    });
  }

  /**
   * Clearing reverts the student to whatever the cohort sees (or the
   * canonical sequence if the cohort has no assignment either). The
   * underlying SkillTree is preserved.
   */
  async remove(studentId: string, trackId: string): Promise<void> {
    await this.prisma.studentTrackAssignment.delete({
      where: { studentId_trackId: { studentId, trackId } },
    });
  }
}
