import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProjectRatingRepository } from './project-rating.repository';
import { ProjectRatingService } from './project-rating.service';
import { ProjectRatingInstructorController } from './project-rating-instructor.controller';
import { ProjectRatingPublicController } from './project-rating-public.controller';

// Single module owns both the write surface (POST/DELETE under
// /api/instructor/ratings) and the public read surface
// (GET /api/attempts/:id/ratings).
@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [ProjectRatingInstructorController, ProjectRatingPublicController],
  providers: [ProjectRatingRepository, ProjectRatingService],
  exports: [ProjectRatingService],
})
export class RatingsModule {}
