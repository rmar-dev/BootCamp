import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserRepository } from './user.repository';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

const providers: any[] = [
  UserRepository,
  {
    provide: AuthService,
    useFactory: (userRepo: UserRepository) => {
      return new AuthService(
        userRepo,
        process.env.JWT_SECRET ?? 'dev-secret-change-me-in-production',
        process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-me-in-production',
        process.env.ALLOWED_EMAIL_DOMAIN ?? '',
      );
    },
    inject: [UserRepository],
  },
  {
    provide: JwtStrategy,
    useFactory: () => {
      return new JwtStrategy(process.env.JWT_SECRET ?? 'dev-secret-change-me-in-production');
    },
  },
  LocalStrategy,
  JwtAuthGuard,
  RolesGuard,
];

if (process.env.GOOGLE_CLIENT_ID) {
  providers.push({
    provide: GoogleStrategy,
    useFactory: (authService: AuthService) => {
      return new GoogleStrategy(
        authService,
        process.env.GOOGLE_CLIENT_ID!,
        process.env.GOOGLE_CLIENT_SECRET ?? '',
        process.env.GOOGLE_CALLBACK_URL ?? 'http://localhost:3000/api/auth/google/callback',
      );
    },
    inject: [AuthService],
  });
}

@Module({
  imports: [PassportModule],
  controllers: [AuthController],
  providers,
  exports: [AuthService, UserRepository, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
