import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { EnsureStudentService } from '../submission/ensure-student';
import { ProfileService, ProfileResponse } from './profile.service';

@Controller('api/profile')
export class ProfileController {
  constructor(
    private readonly ensureStudent: EnsureStudentService,
    private readonly profile: ProfileService,
  ) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMyProfile(@CurrentUser() user: { userId: string }): Promise<ProfileResponse> {
    const student = await this.ensureStudent.ensureStudent(user.userId);
    return this.profile.composeProfile(student.id);
  }
}
