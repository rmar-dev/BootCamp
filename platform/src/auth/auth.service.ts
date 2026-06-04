import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { User } from '@prisma/client';
import { UserRepository } from './user.repository';
import { InvitationRepository } from '../invitations/invitation.repository';
import { hashInviteToken } from '../invitations/invitation.token';

export interface UserResponse {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  googleId: string | null;
  createdAt: Date;
}

export interface AuthResult {
  user: UserResponse;
  accessToken: string;
  refreshToken: string;
}

function toUserResponse(user: User): UserResponse {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    status: user.status,
    googleId: user.googleId,
    createdAt: user.createdAt,
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly invitationRepo: InvitationRepository,
    private readonly jwtSecret: string,
    private readonly jwtRefreshSecret: string,
  ) {}

  private signTokens(user: User): { accessToken: string; refreshToken: string } {
    const accessToken = jwt.sign(
      { sub: user.id, email: user.email, role: user.role },
      this.jwtSecret,
      { expiresIn: '15m' },
    );
    const refreshToken = jwt.sign(
      { sub: user.id, email: user.email },
      this.jwtRefreshSecret,
      { expiresIn: '7d' },
    );
    return { accessToken, refreshToken };
  }

  /**
   * Activate an invited account: validate the magic-link token, set the
   * password, flip status to active, and mark the invitation accepted.
   * All failure modes return the same generic 400 so callers can't probe
   * which condition failed.
   */
  async acceptInvite(token: string, password: string): Promise<AuthResult> {
    const invitation = await this.invitationRepo.findByTokenHash(hashInviteToken(token));
    const invalid = new BadRequestException('Invalid or expired invitation');
    if (!invitation) throw invalid;
    if (invitation.status !== 'pending') throw invalid;
    if (invitation.expiresAt.getTime() < Date.now()) {
      await this.invitationRepo.setStatus(invitation.id, 'expired');
      throw invalid;
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Single-use: only one concurrent caller wins this atomic transition.
    const claimed = await this.invitationRepo.markAcceptedIfPending(invitation.id, new Date());
    if (!claimed) throw invalid;

    // Only activates a still-invited account; null => already activated/disabled.
    const user = await this.userRepo.activate(invitation.userId, passwordHash);
    if (!user) throw invalid;

    const tokens = this.signTokens(user);
    return { user: toUserResponse(user), ...tokens };
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const user = await this.userRepo.findByEmail(email);
    if (!user || !user.passwordHash || user.status !== 'active') {
      throw new UnauthorizedException('Invalid credentials');
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const tokens = this.signTokens(user);
    return { user: toUserResponse(user), ...tokens };
  }

  async refresh(refreshToken: string): Promise<AuthResult> {
    let payload: any;
    try {
      payload = jwt.verify(refreshToken, this.jwtRefreshSecret);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const user = await this.userRepo.findById(payload.sub);
    // A disabled/invited user must not be able to mint fresh access tokens.
    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('User not found');
    }
    const tokens = this.signTokens(user);
    return { user: toUserResponse(user), ...tokens };
  }

  async findById(id: string): Promise<UserResponse | null> {
    const user = await this.userRepo.findById(id);
    return user ? toUserResponse(user) : null;
  }
}
