import { Injectable } from '@nestjs/common';
import { SkillTree, SkillTreeVisibility } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type CreateTreeInput = {
  trackId: string;
  name: string;
  description?: string | null;
  authorUserId: string;
  visibility: SkillTreeVisibility;
  lessonIds: string[];
};

export type UpdateTreeInput = {
  name?: string;
  description?: string | null;
  visibility?: SkillTreeVisibility;
  lessonIds?: string[];
};

@Injectable()
export class SkillTreeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateTreeInput): Promise<SkillTree> {
    return this.prisma.skillTree.create({ data: input });
  }

  async findById(id: string): Promise<SkillTree | null> {
    return this.prisma.skillTree.findUnique({ where: { id } });
  }

  /**
   * Visibility-aware list for the composer's picker. Returns:
   *   - all SkillTrees authored by the caller for this track (any visibility)
   *   - plus all PUBLIC SkillTrees authored by anyone else for this track
   * Sorted updatedAt desc so the most-recently-edited surfaces first.
   */
  async findVisibleForUser(input: {
    trackId: string;
    userUserId: string;
    isAdmin: boolean;
  }): Promise<SkillTree[]> {
    return this.prisma.skillTree.findMany({
      where: {
        trackId: input.trackId,
        OR: input.isAdmin
          ? undefined // admin sees everything
          : [
              { authorUserId: input.userUserId }, // own (any visibility)
              { visibility: SkillTreeVisibility.public }, // public from others
            ],
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * All trees authored by a given user, across tracks. Used by the "my
   * trees" view (out of scope for V1; kept for symmetry with the other
   * findByAuthor helpers).
   */
  async findByAuthor(authorUserId: string): Promise<SkillTree[]> {
    return this.prisma.skillTree.findMany({
      where: { authorUserId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async update(id: string, input: UpdateTreeInput): Promise<SkillTree> {
    return this.prisma.skillTree.update({
      where: { id },
      data: input,
    });
  }

  async remove(id: string): Promise<void> {
    await this.prisma.skillTree.delete({ where: { id } });
  }
}
