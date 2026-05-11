import { Injectable, NotFoundException } from '@nestjs/common';
import { Student } from '@prisma/client';
import { StudentRepository } from '../state/repositories/student.repository';
import { UserRepository } from '../auth/user.repository';
import { newId } from '../shared/ids';

@Injectable()
export class EnsureStudentService {
  constructor(
    private readonly studentRepository: StudentRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async ensureStudent(userId: string): Promise<Student> {
    const existing = await this.studentRepository.findByUserId(userId);
    if (existing) {
      return existing;
    }

    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    return this.studentRepository.create({
      id: newId(),
      name: user.name,
      email: user.email,
      userId: user.id,
    });
  }
}
