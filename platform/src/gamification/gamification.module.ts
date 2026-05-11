import { Module } from '@nestjs/common';
import { StateModule } from '../state/state.module';
import { ContentModule } from '../content/content.module';
import { AuthModule } from '../auth/auth.module';
import { ProgressModule } from '../progress/progress.module';
import { BadgeRepository } from './badge.repository';
import { BadgeService } from './badge.service';
import { StreakService } from './streak.service';
import { LeaderboardController } from './leaderboard.controller';
import { DashboardController } from './dashboard.controller';
import { ProfileController } from './profile.controller';
import { InstructorBadgesController } from './instructor-badges.controller';
import { MasteryService } from './mastery.service';
import { DailyXpService } from './daily-xp.service';
import { TodayPlanService } from './today-plan.service';
import { ProfileService } from './profile.service';
import { EnsureStudentService } from '../submission/ensure-student';

@Module({
  imports: [StateModule, ContentModule, AuthModule, ProgressModule],
  controllers: [LeaderboardController, DashboardController, ProfileController, InstructorBadgesController],
  providers: [BadgeRepository, BadgeService, StreakService, MasteryService, DailyXpService, TodayPlanService, ProfileService, EnsureStudentService],
  exports: [BadgeService, StreakService, BadgeRepository, MasteryService, DailyXpService, TodayPlanService, ProfileService],
})
export class GamificationModule {}
