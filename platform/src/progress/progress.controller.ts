import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { StudentRepository } from '../state/repositories/student.repository';
import { ProgressAggregatorService, TrackProgress, ConceptsProgress, RecommendationResponse } from './progress.service';

@Controller('api/progress')
export class ProgressController {
  constructor(
    private readonly service: ProgressAggregatorService,
    private readonly students: StudentRepository,
  ) {}

  @Get('tracks/:trackId')
  @UseGuards(JwtAuthGuard)
  async getTrackProgress(
    @Param('trackId') trackId: string,
    @CurrentUser() user: { userId: string },
  ): Promise<TrackProgress> {
    const student = await this.students.findByUserId(user.userId);
    // If the user has no Student record yet, treat as zero-activity:
    // still return the track shape with all lessons as not_started.
    const studentId = student?.id ?? null;

    const progress = await this.service.getTrackProgress(studentId, trackId);
    if (!progress) throw new NotFoundException(`Track ${trackId} not found`);
    return progress;
  }

  @Get('concepts')
  @UseGuards(JwtAuthGuard)
  async getConceptProgress(
    @CurrentUser() user: { userId: string },
  ): Promise<ConceptsProgress> {
    const student = await this.students.findByUserId(user.userId);
    const studentId = student?.id ?? null;
    return this.service.getConceptProgress(studentId);
  }

  @Get('recommendation')
  @UseGuards(JwtAuthGuard)
  async getRecommendation(
    @CurrentUser() user: { userId: string },
    @Query('trackId') trackId?: string,
  ): Promise<RecommendationResponse> {
    const student = await this.students.findByUserId(user.userId);
    const studentId = student?.id ?? null;
    return this.service.getRecommendation(studentId, trackId);
  }
}
