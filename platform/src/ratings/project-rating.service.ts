import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProjectRating } from '@prisma/client';
import { ProjectRatingRepository } from './project-rating.repository';

const MAX_COMMENT_LENGTH = 4000;

@Injectable()
export class ProjectRatingService {
  constructor(private readonly repo: ProjectRatingRepository) {}

  /**
   * Create or update a rating. Multi-rater: any instructor can rate any
   * attempt; the (attemptId, raterUserId) uniqueness means a second call by
   * the same rater updates the prior row rather than adding a duplicate.
   *
   * Score is constrained to 1..5 inclusive. Comment is required (no empty
   * comments) and capped at 4000 chars to keep the multi-rater list compact.
   *
   * Orthogonal to Attempt.approvedByInstructorId — this service does NOT
   * touch the attempt's pass/fail or capstone approval state.
   */
  async upsert(input: {
    raterUserId: string;
    attemptId: string;
    score: number;
    comment: string;
  }): Promise<ProjectRating> {
    if (!Number.isInteger(input.score) || input.score < 1 || input.score > 5) {
      throw new BadRequestException('score must be an integer between 1 and 5 (inclusive)');
    }
    const comment = input.comment.trim();
    if (comment.length === 0) throw new BadRequestException('comment cannot be empty');
    if (comment.length > MAX_COMMENT_LENGTH) {
      throw new BadRequestException(
        `comment cannot exceed ${MAX_COMMENT_LENGTH} characters`,
      );
    }
    return this.repo.upsert({
      attemptId: input.attemptId,
      raterUserId: input.raterUserId,
      score: input.score,
      comment,
    });
  }

  /**
   * Public read — every rating on an attempt. Caller authorization is
   * handled at the controller level (any authenticated user may read).
   */
  async getForAttempt(attemptId: string): Promise<ProjectRating[]> {
    return this.repo.findByAttempt(attemptId);
  }

  /**
   * Delete a single rating. Only the rater (or admin) can remove it; an
   * instructor cannot delete another instructor's rating. Returns 404 if
   * the rating does not exist; 403 if the caller is not the rater and not
   * an admin.
   */
  async remove(ratingId: string, callerUserId: string, callerRole: string): Promise<void> {
    const rating = await this.repo.findById(ratingId);
    if (!rating) throw new NotFoundException('Rating not found');
    if (callerRole !== 'admin' && rating.raterUserId !== callerUserId) {
      throw new ForbiddenException('Only the rater (or an admin) can delete this rating');
    }
    await this.repo.remove(ratingId);
  }
}
