import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  CohortTrackAssignment,
  SkillTree,
  SkillTreeVisibility,
} from '@prisma/client';
import { SkillTreeRepository } from './skill-tree.repository';
import {
  CohortTrackAssignmentRepository,
  type AssignmentWithTree,
} from './cohort-track-assignment.repository';
import { CohortRepository } from '../state/repositories/cohort.repository';

const MAX_NAME = 120;
const MAX_DESCRIPTION = 2000;

function isAdmin(role: string): boolean {
  return role === 'admin';
}

@Injectable()
export class SkillTreeService {
  constructor(
    private readonly trees: SkillTreeRepository,
    private readonly assignments: CohortTrackAssignmentRepository,
    private readonly cohorts: CohortRepository,
  ) {}

  /**
   * Cohort-scope guard for assignment writes. The composer's GET /cohorts
   * scopes the picker, but the assign/unassign URLs were previously
   * accepting any cohortId. Without this check an instructor with a known
   * UUID could mutate another instructor's cohort assignment.
   */
  private async assertCanTargetCohort(
    cohortId: string,
    callerUserId: string,
    callerRole: string,
  ): Promise<void> {
    if (callerRole === 'admin') return;
    const cohort = await this.cohorts.findById(cohortId);
    if (!cohort || cohort.instructorId !== callerUserId) {
      throw new ForbiddenException(
        'You do not lead this cohort — only its instructor (or an admin) can change its skill tree assignment',
      );
    }
  }

  // ── Tree CRUD ──────────────────────────────────────────────────────────

  async listVisibleForUser(input: {
    trackId: string;
    callerUserId: string;
    callerRole: string;
  }): Promise<SkillTree[]> {
    return this.trees.findVisibleForUser({
      trackId: input.trackId,
      userUserId: input.callerUserId,
      isAdmin: isAdmin(input.callerRole),
    });
  }

  async getTree(
    id: string,
    callerUserId: string,
    callerRole: string,
  ): Promise<SkillTree> {
    const tree = await this.trees.findById(id);
    if (!tree) throw new NotFoundException('SkillTree not found');
    if (
      isAdmin(callerRole) ||
      tree.authorUserId === callerUserId ||
      tree.visibility === SkillTreeVisibility.public
    ) {
      return tree;
    }
    throw new ForbiddenException('You do not have access to this skill tree');
  }

  async createTree(input: {
    trackId: string;
    name: string;
    description?: string | null;
    visibility: SkillTreeVisibility;
    lessonIds: string[];
    authorUserId: string;
  }): Promise<SkillTree> {
    this.validateBody(input);
    return this.trees.create({
      trackId: input.trackId,
      name: input.name.trim(),
      description: input.description?.trim() ? input.description.trim() : null,
      authorUserId: input.authorUserId,
      visibility: input.visibility,
      lessonIds: input.lessonIds,
    });
  }

  /**
   * Update an existing tree. Only the author (or admin) may edit. Unsupplied
   * fields are left as-is. To clear `description`, pass `''` or null.
   */
  async updateTree(
    id: string,
    callerUserId: string,
    callerRole: string,
    patch: {
      name?: string;
      description?: string | null;
      visibility?: SkillTreeVisibility;
      lessonIds?: string[];
    },
  ): Promise<SkillTree> {
    const tree = await this.trees.findById(id);
    if (!tree) throw new NotFoundException('SkillTree not found');
    if (!isAdmin(callerRole) && tree.authorUserId !== callerUserId) {
      throw new ForbiddenException('Only the author (or admin) can edit this tree');
    }
    if (patch.lessonIds || patch.name || patch.description !== undefined) {
      this.validateBody({
        name: patch.name ?? tree.name,
        description: patch.description ?? tree.description,
        lessonIds: patch.lessonIds ?? tree.lessonIds,
      });
    }
    return this.trees.update(id, {
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      ...(patch.description !== undefined
        ? { description: patch.description?.trim() ? patch.description.trim() : null }
        : {}),
      ...(patch.visibility !== undefined ? { visibility: patch.visibility } : {}),
      ...(patch.lessonIds !== undefined ? { lessonIds: patch.lessonIds } : {}),
    });
  }

  /**
   * Delete a tree. Only the author (or admin) may delete. Refuses if the
   * tree is currently assigned anywhere — the caller must clear the
   * assignment first to avoid orphaning a cohort's lesson plan.
   */
  async deleteTree(
    id: string,
    callerUserId: string,
    callerRole: string,
  ): Promise<void> {
    const tree = await this.trees.findById(id);
    if (!tree) throw new NotFoundException('SkillTree not found');
    if (!isAdmin(callerRole) && tree.authorUserId !== callerUserId) {
      throw new ForbiddenException('Only the author (or admin) can delete this tree');
    }
    const active = await this.assignments.findByTree(id);
    if (active.length > 0) {
      throw new BadRequestException(
        `Cannot delete: tree is currently assigned to ${active.length} cohort(s). Clear the assignments first.`,
      );
    }
    await this.trees.remove(id);
  }

  // ── Assignment ─────────────────────────────────────────────────────────

  async getAssignmentWithTree(
    cohortId: string,
    trackId: string,
  ): Promise<AssignmentWithTree | null> {
    return this.assignments.findOneWithTree(cohortId, trackId);
  }

  async listAllAssignments(): Promise<CohortTrackAssignment[]> {
    return this.assignments.findAll();
  }

  /**
   * Activate a SkillTree on a (cohort, track). The caller must:
   *   - lead the cohort (or be admin) — enforced via assertCanTargetCohort
   *   - be able to SEE the tree (own / public / admin) — enforced via getTree
   */
  async assign(input: {
    cohortId: string;
    trackId: string;
    skillTreeId: string;
    callerUserId: string;
    callerRole: string;
  }): Promise<CohortTrackAssignment> {
    await this.assertCanTargetCohort(input.cohortId, input.callerUserId, input.callerRole);
    // Authorization: the caller must be able to see the tree.
    await this.getTree(input.skillTreeId, input.callerUserId, input.callerRole);

    const tree = await this.trees.findById(input.skillTreeId);
    if (!tree) throw new NotFoundException('SkillTree not found');
    if (tree.trackId !== input.trackId) {
      throw new BadRequestException(
        `Tree belongs to a different track (tree.trackId=${tree.trackId}, requested=${input.trackId})`,
      );
    }
    return this.assignments.upsert({
      cohortId: input.cohortId,
      trackId: input.trackId,
      skillTreeId: input.skillTreeId,
      assignedBy: input.callerUserId,
    });
  }

  /**
   * Revert a (cohort, track) to the canonical Track sequence. Idempotent on
   * "row not found" (Prisma P2025); other failures propagate so the caller
   * sees a real error instead of a misleading 204.
   */
  async unassign(
    cohortId: string,
    trackId: string,
    callerUserId: string,
    callerRole: string,
  ): Promise<void> {
    await this.assertCanTargetCohort(cohortId, callerUserId, callerRole);
    try {
      await this.assignments.remove(cohortId, trackId);
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2025'
      ) {
        // Row didn't exist — idempotent success.
        return;
      }
      throw err;
    }
  }

  // ── Validation ─────────────────────────────────────────────────────────

  private validateBody(input: {
    name: string;
    description?: string | null;
    lessonIds: string[];
  }): void {
    const name = input.name.trim();
    if (name.length === 0) throw new BadRequestException('name cannot be empty');
    if (name.length > MAX_NAME) {
      throw new BadRequestException(`name cannot exceed ${MAX_NAME} characters`);
    }
    if (input.description != null && input.description.length > MAX_DESCRIPTION) {
      throw new BadRequestException(
        `description cannot exceed ${MAX_DESCRIPTION} characters`,
      );
    }
    if (input.lessonIds.length === 0) {
      throw new BadRequestException('lessonIds cannot be empty');
    }
    const seen = new Set<string>();
    for (const id of input.lessonIds) {
      if (seen.has(id)) {
        throw new BadRequestException(`lessonIds contains duplicate: ${id}`);
      }
      seen.add(id);
    }
  }
}
