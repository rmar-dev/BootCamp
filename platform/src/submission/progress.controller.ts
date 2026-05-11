import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { StudentRepository } from '../state/repositories/student.repository';
import { ExerciseResultRepository } from '../state/repositories/exercise-result.repository';

@Controller('api/progress')
export class ProgressController {
  constructor(
    private readonly studentRepository: StudentRepository,
    private readonly results: ExerciseResultRepository,
  ) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProgress(
    @CurrentUser() user: { userId: string; email: string; role: string },
  ) {
    const student = await this.studentRepository.findByUserId(user.userId);

    if (!student) {
      return { studentId: null, results: [], totalPoints: 0 };
    }

    const exerciseResults = await this.results.listByStudent(student.id);
    const totalPoints = exerciseResults.reduce(
      (sum, r) => sum + r.pointsEarned,
      0,
    );

    return {
      studentId: student.id,
      results: exerciseResults.map((r) => ({
        exerciseId: r.exerciseId,
        passed: r.passed,
        pointsEarned: r.pointsEarned,
        attemptsCount: r.attemptsCount,
        firstPassedAt: r.firstPassedAt,
      })),
      totalPoints,
    };
  }
}
