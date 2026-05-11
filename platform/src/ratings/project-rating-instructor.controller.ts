import { Body, Controller, Delete, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ProjectRatingService } from './project-rating.service';

// Write surface: any instructor (or admin) can create / update / delete
// their own rating. Multi-rater means a different instructor's rating on
// the same attempt is unaffected by a delete here.
@Controller('api/instructor/ratings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('instructor', 'admin')
export class ProjectRatingInstructorController {
  constructor(private readonly service: ProjectRatingService) {}

  @Post()
  async upsert(
    @CurrentUser() user: { userId: string },
    @Body() body: { attemptId: string; score: number; comment: string },
  ) {
    return this.service.upsert({
      raterUserId: user.userId,
      attemptId: body.attemptId,
      score: body.score,
      comment: body.comment,
    });
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; role: string },
  ): Promise<{ ok: true }> {
    await this.service.remove(id, user.userId, user.role);
    return { ok: true };
  }
}
