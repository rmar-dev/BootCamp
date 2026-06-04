import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { User, UserRole } from '@prisma/client';
import { UserRepository } from '../auth/user.repository';

export type AdminUserView = {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  createdAt: Date;
};

function toView(u: User): AdminUserView {
  return { id: u.id, email: u.email, name: u.name, role: u.role, status: u.status, createdAt: u.createdAt };
}

@Injectable()
export class AdminService {
  constructor(private readonly users: UserRepository) {}

  async listUsers(): Promise<AdminUserView[]> {
    const all = await this.users.findAll();
    return all.map(toView);
  }

  /**
   * Change a user's role. An admin may NOT change their own role — that guards
   * against accidentally removing the last/only admin's access. Cross-user
   * role changes (including granting admin) are allowed for an admin caller;
   * the controller's @Roles('admin') is what restricts this to admins.
   */
  async changeRole(targetUserId: string, role: UserRole, callerUserId: string): Promise<AdminUserView> {
    if (targetUserId === callerUserId) {
      throw new ForbiddenException('You cannot change your own role');
    }
    const target = await this.users.findById(targetUserId);
    if (!target) throw new NotFoundException('User not found');
    const updated = await this.users.setRole(targetUserId, role);
    return toView(updated);
  }
}
