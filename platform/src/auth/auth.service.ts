import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { User } from '@prisma/client';
import { UserRepository } from './user.repository';
import { newId } from '../shared/ids';

export interface UserResponse {
  id: string;
  email: string;
  name: string;
  role: string;
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
    googleId: user.googleId,
    createdAt: user.createdAt,
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly jwtSecret: string,
    private readonly jwtRefreshSecret: string,
    private readonly allowedEmailDomain: string,
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

  async register(email: string, name: string, password: string): Promise<AuthResult> {
    if (this.allowedEmailDomain) {
      const domain = email.split('@')[1];
      if (domain !== this.allowedEmailDomain) {
        throw new ForbiddenException('Email domain not allowed');
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);

    let user: User;
    try {
      user = await this.userRepo.create({
        id: newId(),
        email,
        name,
        passwordHash,
        role: 'student',
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new ConflictException('Email already in use');
      }
      throw err;
    }

    const tokens = this.signTokens(user);
    return { user: toUserResponse(user), ...tokens };
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const user = await this.userRepo.findByEmail(email);
    if (!user || !user.passwordHash) {
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
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const tokens = this.signTokens(user);
    return { user: toUserResponse(user), ...tokens };
  }

  async findOrCreateGoogleUser(
    googleId: string,
    email: string,
    name: string,
  ): Promise<AuthResult> {
    // Check by googleId first
    let user = await this.userRepo.findByGoogleId(googleId);
    if (user) {
      const tokens = this.signTokens(user);
      return { user: toUserResponse(user), ...tokens };
    }

    // Check by email, link googleId
    user = await this.userRepo.findByEmail(email);
    if (user) {
      user = await this.userRepo.update(user.id, { googleId });
      const tokens = this.signTokens(user);
      return { user: toUserResponse(user), ...tokens };
    }

    // Create new user
    user = await this.userRepo.create({
      id: newId(),
      email,
      name,
      role: 'student',
      googleId,
    });
    const tokens = this.signTokens(user);
    return { user: toUserResponse(user), ...tokens };
  }

  async findById(id: string): Promise<UserResponse | null> {
    const user = await this.userRepo.findById(id);
    return user ? toUserResponse(user) : null;
  }
}
