import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProjectRatingService } from './project-rating.service';

// Public read of all ratings on an attempt. Auth required (any logged-in
// user) but no role gating — students see the same rows the instructor
// queue does. The student-facing review UI displays the assigned
// instructor's rating as primary, then "Other instructor reviews".
@Controller('api/attempts')
@UseGuards(JwtAuthGuard)
export class ProjectRatingPublicController {
  constructor(private readonly service: ProjectRatingService) {}

  @Get(':attemptId/ratings')
  async getForAttempt(@Param('attemptId') attemptId: string) {
    return this.service.getForAttempt(attemptId);
  }
}
