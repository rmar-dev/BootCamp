# Auth + Cohorts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add user accounts (email+password + Google OAuth), JWT sessions via httpOnly cookies, role-based access, and wire the login/register UI so `POST /api/run` requires authentication.

**Architecture:** New `AuthModule` in NestJS using Passport.js with three strategies (local, jwt, google). JWTs stored in httpOnly cookies. New `User` Prisma entity linked to existing `Student`. Web gets login/register pages, an AuthProvider context, and the Settings menu becomes functional.

**Tech Stack:** Backend: NestJS 10, Passport.js, `bcryptjs`, `cookie-parser`, `@nestjs/passport`, Prisma 5. Frontend: Next.js 14, React context for auth state.

**Repo state at start:** Platform `master` at `f9018f8`. Web master at `6d348c4` (or later). 81 platform tests + 39 web tests.

---

## Task 0: Branch setup + install dependencies

**Files:** `platform/package.json`

- [ ] **Step 1: Create branch**

```bash
cd c:/Users/ricma/BootCamp/platform
git checkout master
git checkout -b feat/auth
```

- [ ] **Step 2: Install auth dependencies**

```bash
npm install @nestjs/passport passport passport-local passport-google-oauth20 passport-jwt bcryptjs cookie-parser jsonwebtoken
npm install --save-dev @types/passport-local @types/passport-google-oauth20 @types/passport-jwt @types/bcryptjs @types/cookie-parser @types/jsonwebtoken
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install auth dependencies"
```

---

## Task 1: Prisma migration — User entity + Student.userId

**Files:**
- Modify: `platform/prisma/schema.prisma`
- Create: migration file via `npx prisma migrate dev`

- [ ] **Step 1: Add User model and modify Student**

Add to `prisma/schema.prisma` after the existing enums, before the content models:

```prisma
enum UserRole {
  student
  instructor
  admin
}

model User {
  id            String    @id @db.Uuid
  email         String    @unique
  name          String
  passwordHash  String?
  role          UserRole  @default(student)
  googleId      String?   @unique
  createdAt     DateTime  @default(now())
  student       Student?
}
```

Modify the existing `Student` model to add the relation:

```prisma
model Student {
  id        String   @id @db.Uuid
  userId    String?  @unique @db.Uuid
  user      User?    @relation(fields: [userId], references: [id])
  name      String
  email     String   @unique
  cohortId  String?  @db.Uuid
  createdAt DateTime @default(now())
}
```

Note: `userId` is `String?` (optional) because existing seed Student rows have no User.

- [ ] **Step 2: Generate and run migration**

```bash
cd c:/Users/ricma/BootCamp/platform
docker compose up -d postgres
npx prisma migrate dev --name add-user-model
npx prisma generate
```

- [ ] **Step 3: Verify existing tests still pass**

```bash
npm test
```

Expected: all existing tests pass (the migration is additive — no breaking changes).

- [ ] **Step 4: Commit**

```bash
git add prisma/
git commit -m "feat: add user entity and student.userId relation"
```

---

## Task 2: UserRepository + tests

**Files:**
- Create: `platform/src/auth/user.repository.ts`
- Create: `platform/test/auth/user.repository.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `platform/test/auth/user.repository.spec.ts`:

```ts
import { PrismaClient } from '@prisma/client';
import { UserRepository } from '../../src/auth/user.repository';
import { makeTestPrisma, resetDb } from '../helpers/db';
import { newId } from '../../src/shared/ids';

describe('UserRepository', () => {
  let prisma: PrismaClient;
  let repo: UserRepository;

  beforeAll(() => {
    prisma = makeTestPrisma();
    repo = new UserRepository(prisma as any);
  });

  beforeEach(async () => {
    await resetDb(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates a user and finds by email', async () => {
    const user = await repo.create({
      id: newId(),
      email: 'test@example.com',
      name: 'Test User',
      passwordHash: 'hashed',
      role: 'student',
    });
    expect(user.email).toBe('test@example.com');
    const found = await repo.findByEmail('test@example.com');
    expect(found).not.toBeNull();
    expect(found!.id).toBe(user.id);
  });

  it('returns null for unknown email', async () => {
    expect(await repo.findByEmail('nobody@example.com')).toBeNull();
  });

  it('finds by googleId', async () => {
    const user = await repo.create({
      id: newId(),
      email: 'g@example.com',
      name: 'G User',
      role: 'student',
      googleId: 'google-123',
    });
    const found = await repo.findByGoogleId('google-123');
    expect(found).not.toBeNull();
    expect(found!.id).toBe(user.id);
  });

  it('updates googleId on existing user', async () => {
    const user = await repo.create({
      id: newId(),
      email: 'link@example.com',
      name: 'Link',
      passwordHash: 'h',
      role: 'student',
    });
    const updated = await repo.update(user.id, { googleId: 'google-456' });
    expect(updated.googleId).toBe('google-456');
  });

  it('finds by id', async () => {
    const user = await repo.create({
      id: newId(),
      email: 'byid@example.com',
      name: 'ById',
      role: 'student',
    });
    const found = await repo.findById(user.id);
    expect(found).not.toBeNull();
    expect(found!.email).toBe('byid@example.com');
  });
});
```

- [ ] **Step 2: Implement UserRepository**

Create `platform/src/auth/user.repository.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { User, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type CreateUserInput = {
  id: string;
  email: string;
  name: string;
  passwordHash?: string;
  role: UserRole | string;
  googleId?: string;
};

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateUserInput): Promise<User> {
    return this.prisma.user.create({
      data: {
        id: input.id,
        email: input.email,
        name: input.name,
        passwordHash: input.passwordHash ?? null,
        role: input.role as UserRole,
        googleId: input.googleId ?? null,
      },
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findByGoogleId(googleId: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { googleId } });
  }

  async update(id: string, data: Partial<Pick<User, 'googleId' | 'passwordHash' | 'name'>>): Promise<User> {
    return this.prisma.user.update({ where: { id }, data });
  }
}
```

- [ ] **Step 3: Run tests**

```bash
npx jest user.repository -i
```

Expected: 5 PASS.

- [ ] **Step 4: Commit**

```bash
git add src/auth/user.repository.ts test/auth/user.repository.spec.ts
git commit -m "feat: add user repository"
```

---

## Task 3: AuthService — register, login, tokens, Google

**Files:**
- Create: `platform/src/auth/auth.service.ts`
- Create: `platform/test/auth/auth.service.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `platform/test/auth/auth.service.spec.ts`:

```ts
import { ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../../src/auth/auth.service';
import { UserRepository } from '../../src/auth/user.repository';
import * as bcrypt from 'bcryptjs';

function mockUserRepo(users: Map<string, any> = new Map()): UserRepository {
  return {
    create: jest.fn().mockImplementation(async (input: any) => {
      if (users.has(input.email)) throw { code: 'P2002' };
      const user = { ...input, createdAt: new Date() };
      users.set(input.email, user);
      return user;
    }),
    findByEmail: jest.fn().mockImplementation(async (email: string) => users.get(email) ?? null),
    findById: jest.fn().mockImplementation(async (id: string) => {
      for (const u of users.values()) if (u.id === id) return u;
      return null;
    }),
    findByGoogleId: jest.fn().mockImplementation(async (gid: string) => {
      for (const u of users.values()) if (u.googleId === gid) return u;
      return null;
    }),
    update: jest.fn().mockImplementation(async (id: string, data: any) => {
      for (const u of users.values()) {
        if (u.id === id) { Object.assign(u, data); return u; }
      }
      return null;
    }),
  } as unknown as UserRepository;
}

describe('AuthService', () => {
  const JWT_SECRET = 'test-secret';
  const JWT_REFRESH_SECRET = 'test-refresh-secret';

  function makeService(repo?: UserRepository) {
    return new AuthService(
      repo ?? mockUserRepo(),
      JWT_SECRET,
      JWT_REFRESH_SECRET,
      '',
    );
  }

  describe('register', () => {
    it('creates a user with hashed password', async () => {
      const svc = makeService();
      const result = await svc.register('a@b.com', 'Alice', 'password123');
      expect(result.user.email).toBe('a@b.com');
      expect(result.accessToken).toBeTruthy();
      expect(result.refreshToken).toBeTruthy();
    });

    it('rejects duplicate email', async () => {
      const svc = makeService();
      await svc.register('dup@b.com', 'A', 'password1');
      await expect(svc.register('dup@b.com', 'B', 'password2')).rejects.toBeInstanceOf(ConflictException);
    });

    it('enforces email domain restriction', async () => {
      const svc = new AuthService(mockUserRepo(), JWT_SECRET, JWT_REFRESH_SECRET, 'company.com');
      await expect(svc.register('user@other.com', 'X', 'pass1234')).rejects.toBeInstanceOf(ForbiddenException);
      const result = await svc.register('user@company.com', 'X', 'pass1234');
      expect(result.user.email).toBe('user@company.com');
    });
  });

  describe('login', () => {
    it('returns tokens for valid credentials', async () => {
      const svc = makeService();
      await svc.register('login@b.com', 'L', 'mypass123');
      const result = await svc.login('login@b.com', 'mypass123');
      expect(result.user.email).toBe('login@b.com');
      expect(result.accessToken).toBeTruthy();
    });

    it('rejects wrong password', async () => {
      const svc = makeService();
      await svc.register('wp@b.com', 'W', 'correct1');
      await expect(svc.login('wp@b.com', 'wrong123')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects non-existent email', async () => {
      const svc = makeService();
      await expect(svc.login('nobody@b.com', 'pass1234')).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('issues a new access token from valid refresh token', async () => {
      const svc = makeService();
      const reg = await svc.register('ref@b.com', 'R', 'pass1234');
      const result = await svc.refresh(reg.refreshToken);
      expect(result.accessToken).toBeTruthy();
      expect(result.accessToken).not.toBe(reg.accessToken);
    });

    it('rejects invalid refresh token', async () => {
      const svc = makeService();
      await expect(svc.refresh('garbage')).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('findOrCreateGoogleUser', () => {
    it('creates new user on first Google login', async () => {
      const svc = makeService();
      const result = await svc.findOrCreateGoogleUser('g-1', 'new@g.com', 'New G');
      expect(result.user.googleId).toBe('g-1');
      expect(result.user.email).toBe('new@g.com');
    });

    it('returns existing user by googleId', async () => {
      const repo = mockUserRepo();
      const svc = new AuthService(repo, JWT_SECRET, JWT_REFRESH_SECRET, '');
      const first = await svc.findOrCreateGoogleUser('g-2', 'exist@g.com', 'E');
      const second = await svc.findOrCreateGoogleUser('g-2', 'exist@g.com', 'E');
      expect(second.user.id).toBe(first.user.id);
    });

    it('links Google to existing password account by email', async () => {
      const repo = mockUserRepo();
      const svc = new AuthService(repo, JWT_SECRET, JWT_REFRESH_SECRET, '');
      await svc.register('link@g.com', 'Link', 'pass1234');
      const result = await svc.findOrCreateGoogleUser('g-3', 'link@g.com', 'Link');
      expect(result.user.googleId).toBe('g-3');
      expect(result.user.email).toBe('link@g.com');
    });
  });
});
```

- [ ] **Step 2: Implement AuthService**

Create `platform/src/auth/auth.service.ts`:

```ts
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { UserRepository } from './user.repository';
import { User } from '@prisma/client';
import { newId } from '../shared/ids';

export type UserResponse = {
  id: string;
  email: string;
  name: string;
  role: string;
  googleId: string | null;
  createdAt: Date;
};

export type AuthResult = {
  user: UserResponse;
  accessToken: string;
  refreshToken: string;
};

function toUserResponse(u: User): UserResponse {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    googleId: u.googleId,
    createdAt: u.createdAt,
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly jwtSecret: string,
    private readonly jwtRefreshSecret: string,
    private readonly allowedEmailDomain: string,
  ) {}

  async register(email: string, name: string, password: string): Promise<AuthResult> {
    this.checkDomain(email);
    const passwordHash = await bcrypt.hash(password, 10);
    let user: User;
    try {
      user = await this.users.create({
        id: newId(),
        email,
        name,
        passwordHash,
        role: 'student',
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new ConflictException({ error: 'email_taken' });
      }
      throw err;
    }
    return { user: toUserResponse(user), ...this.issueTokens(user) };
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const user = await this.users.findByEmail(email);
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException({ error: 'invalid_credentials' });
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException({ error: 'invalid_credentials' });
    }
    return { user: toUserResponse(user), ...this.issueTokens(user) };
  }

  async refresh(refreshToken: string): Promise<{ user: UserResponse; accessToken: string }> {
    let payload: any;
    try {
      payload = jwt.verify(refreshToken, this.jwtRefreshSecret);
    } catch {
      throw new UnauthorizedException({ error: 'invalid_refresh_token' });
    }
    const user = await this.users.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException({ error: 'invalid_refresh_token' });
    }
    const accessToken = this.signAccess(user);
    return { user: toUserResponse(user), accessToken };
  }

  async findOrCreateGoogleUser(
    googleId: string,
    email: string,
    name: string,
  ): Promise<AuthResult> {
    let user = await this.users.findByGoogleId(googleId);
    if (user) {
      return { user: toUserResponse(user), ...this.issueTokens(user) };
    }
    user = await this.users.findByEmail(email);
    if (user) {
      user = await this.users.update(user.id, { googleId });
      return { user: toUserResponse(user), ...this.issueTokens(user) };
    }
    user = await this.users.create({
      id: newId(),
      email,
      name,
      role: 'student',
      googleId,
    });
    return { user: toUserResponse(user), ...this.issueTokens(user) };
  }

  async findById(id: string): Promise<UserResponse | null> {
    const user = await this.users.findById(id);
    return user ? toUserResponse(user) : null;
  }

  private checkDomain(email: string): void {
    if (!this.allowedEmailDomain) return;
    const domain = email.split('@')[1];
    if (domain !== this.allowedEmailDomain) {
      throw new ForbiddenException({ error: 'email_domain_not_allowed' });
    }
  }

  private issueTokens(user: User): { accessToken: string; refreshToken: string } {
    return {
      accessToken: this.signAccess(user),
      refreshToken: jwt.sign(
        { sub: user.id, email: user.email },
        this.jwtRefreshSecret,
        { expiresIn: '7d' },
      ),
    };
  }

  private signAccess(user: User): string {
    return jwt.sign(
      { sub: user.id, email: user.email, role: user.role },
      this.jwtSecret,
      { expiresIn: '15m' },
    );
  }
}
```

Note: `AuthService` takes `jwtSecret`, `jwtRefreshSecret`, and `allowedEmailDomain` as constructor args (injected via the module's `providers` config using `@Inject` tokens). This avoids importing `ConfigModule` — env vars are read once in `AuthModule`.

- [ ] **Step 3: Run tests**

```bash
npx jest auth.service -i
```

Expected: 9 PASS.

- [ ] **Step 4: Commit**

```bash
git add src/auth/auth.service.ts test/auth/auth.service.spec.ts
git commit -m "feat: add auth service with register, login, refresh, google"
```

---

## Task 4: Passport strategies + guards + decorators

**Files:**
- Create: `platform/src/auth/strategies/jwt.strategy.ts`
- Create: `platform/src/auth/strategies/local.strategy.ts`
- Create: `platform/src/auth/strategies/google.strategy.ts`
- Create: `platform/src/auth/guards/jwt-auth.guard.ts`
- Create: `platform/src/auth/guards/roles.guard.ts`
- Create: `platform/src/auth/decorators/current-user.decorator.ts`
- Create: `platform/src/auth/decorators/roles.decorator.ts`
- Create: `platform/test/auth/guards.spec.ts`

- [ ] **Step 1: Create JWT strategy**

Create `platform/src/auth/strategies/jwt.strategy.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { Request } from 'express';

function extractFromCookie(req: Request): string | null {
  return req?.cookies?.['bc.access'] ?? null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(jwtSecret: string) {
    super({
      jwtFromRequest: extractFromCookie,
      secretOrKey: jwtSecret,
      ignoreExpiration: false,
    });
  }

  async validate(payload: { sub: string; email: string; role: string }) {
    return { userId: payload.sub, email: payload.email, role: payload.role };
  }
}
```

- [ ] **Step 2: Create Local strategy**

Create `platform/src/auth/strategies/local.strategy.ts`:

```ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, 'local') {
  constructor(private readonly authService: AuthService) {
    super({ usernameField: 'email' });
  }

  async validate(email: string, password: string) {
    try {
      const result = await this.authService.login(email, password);
      return result;
    } catch {
      throw new UnauthorizedException({ error: 'invalid_credentials' });
    }
  }
}
```

- [ ] **Step 3: Create Google strategy**

Create `platform/src/auth/strategies/google.strategy.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { AuthService } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private readonly authService: AuthService,
    clientID: string,
    clientSecret: string,
    callbackURL: string,
  ) {
    super({
      clientID,
      clientSecret,
      callbackURL,
      scope: ['email', 'profile'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ) {
    const email = profile.emails?.[0]?.value;
    const name = profile.displayName ?? email;
    const googleId = profile.id;
    try {
      const result = await this.authService.findOrCreateGoogleUser(googleId, email, name);
      done(null, result);
    } catch (err) {
      done(err as Error, undefined);
    }
  }
}
```

- [ ] **Step 4: Create JwtAuthGuard**

Create `platform/src/auth/guards/jwt-auth.guard.ts`:

```ts
import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any, _info: any, _context: ExecutionContext) {
    if (err || !user) {
      throw err || new UnauthorizedException({ error: 'unauthorized' });
    }
    return user;
  }
}
```

- [ ] **Step 5: Create RolesGuard + decorators**

Create `platform/src/auth/guards/roles.guard.ts`:

```ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;
    const { role } = context.switchToHttp().getRequest().user ?? {};
    if (!role || !requiredRoles.includes(role)) {
      throw new ForbiddenException({ error: 'forbidden' });
    }
    return true;
  }
}
```

Create `platform/src/auth/decorators/roles.decorator.ts`:

```ts
import { SetMetadata } from '@nestjs/common';
export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
```

Create `platform/src/auth/decorators/current-user.decorator.ts`:

```ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    return ctx.switchToHttp().getRequest().user;
  },
);
```

- [ ] **Step 6: Write guard tests**

Create `platform/test/auth/guards.spec.ts`:

```ts
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../../src/auth/guards/roles.guard';

function mockContext(role?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user: role ? { role } : undefined }),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  it('allows when no roles required', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(undefined) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(mockContext('student'))).toBe(true);
  });

  it('allows matching role', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['instructor']) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(mockContext('instructor'))).toBe(true);
  });

  it('rejects non-matching role', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['admin']) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(mockContext('student'))).toThrow(ForbiddenException);
  });

  it('rejects when no user', () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['student']) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(mockContext())).toThrow(ForbiddenException);
  });
});
```

- [ ] **Step 7: Run tests**

```bash
npx jest guards -i
```

Expected: 4 PASS.

- [ ] **Step 8: Commit**

```bash
git add src/auth/strategies/ src/auth/guards/ src/auth/decorators/ test/auth/guards.spec.ts
git commit -m "feat: add passport strategies, guards, and decorators"
```

---

## Task 5: AuthController + AuthModule + AppModule wiring

**Files:**
- Create: `platform/src/auth/auth.controller.ts`
- Create: `platform/src/auth/auth.module.ts`
- Modify: `platform/src/app.module.ts`
- Modify: `platform/src/main.ts` (add cookie-parser)
- Create: `platform/test/auth/auth.controller.spec.ts`

- [ ] **Step 1: Create AuthController**

Create `platform/src/auth/auth.controller.ts`:

```ts
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { AuthService, AuthResult, UserResponse } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';

class RegisterDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(1) name!: string;
  @IsString() @MinLength(8) password!: string;
}

class LoginDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(1) password!: string;
}

function setCookies(res: Response, result: AuthResult | { accessToken: string; refreshToken?: string }) {
  res.cookie('bc.access', result.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 15 * 60 * 1000,
  });
  if ('refreshToken' in result && result.refreshToken) {
    res.cookie('bc.refresh', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/auth/refresh',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }
}

@Controller('api/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.register(dto.email, dto.name, dto.password);
    setCookies(res, result);
    return { user: result.user };
  }

  @Post('login')
  @HttpCode(200)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.login(dto.email, dto.password);
    setCookies(res, result);
    return { user: result.user };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('bc.access', { path: '/' });
    res.clearCookie('bc.refresh', { path: '/api/auth/refresh' });
    return {};
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.['bc.refresh'];
    if (!refreshToken) {
      return { error: 'no_refresh_token' };
    }
    const result = await this.auth.refresh(refreshToken);
    setCookies(res, { accessToken: result.accessToken });
    return { user: result.user };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: { userId: string }) {
    const found = await this.auth.findById(user.userId);
    if (!found) return { error: 'not_found' };
    return { user: found };
  }

  @Get('providers')
  providers() {
    return {
      google: !!(process.env.GOOGLE_CLIENT_ID),
    };
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleLogin() {
    // Passport redirects to Google — this never executes
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const result = req.user as AuthResult;
    setCookies(res, result);
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3001';
    res.redirect(frontendUrl);
  }
}
```

- [ ] **Step 2: Create AuthModule**

Create `platform/src/auth/auth.module.ts`:

```ts
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

@Module({
  imports: [PassportModule],
  controllers: [AuthController],
  providers: [
    UserRepository,
    {
      provide: AuthService,
      useFactory: (users: UserRepository) =>
        new AuthService(
          users,
          process.env.JWT_SECRET ?? 'dev-secret-change-me',
          process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-me',
          process.env.ALLOWED_EMAIL_DOMAIN ?? '',
        ),
      inject: [UserRepository],
    },
    {
      provide: JwtStrategy,
      useFactory: () =>
        new JwtStrategy(process.env.JWT_SECRET ?? 'dev-secret-change-me'),
    },
    LocalStrategy,
    // Only register Google strategy if credentials are configured
    ...(process.env.GOOGLE_CLIENT_ID
      ? [
          {
            provide: GoogleStrategy,
            useFactory: (auth: AuthService) =>
              new GoogleStrategy(
                auth,
                process.env.GOOGLE_CLIENT_ID!,
                process.env.GOOGLE_CLIENT_SECRET!,
                process.env.GOOGLE_CALLBACK_URL ?? 'http://localhost:3000/api/auth/google/callback',
              ),
            inject: [AuthService],
          },
        ]
      : []),
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [AuthService, UserRepository, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
```

- [ ] **Step 3: Wire into AppModule**

Modify `platform/src/app.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { ContentModule } from './content/content.module';
import { StateModule } from './state/state.module';
import { ExecutionModule } from './execution/execution.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [PrismaModule, ContentModule, StateModule, ExecutionModule, AuthModule],
})
export class AppModule {}
```

- [ ] **Step 4: Add cookie-parser to main.ts**

Modify `platform/src/main.ts` — add `import * as cookieParser from 'cookie-parser';` and `app.use(cookieParser());` before `app.enableCors(...)`:

```ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:3001',
    credentials: true,
  });
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

IMPORTANT: change `credentials: false` to `credentials: true` in the CORS config — cookies won't be sent cross-origin without this.

- [ ] **Step 5: Create .env.template**

Create `platform/.env.template`:

```env
DATABASE_URL="postgresql://bootcamp:bootcamp@localhost:5433/bootcamp?schema=public"
JWT_SECRET=dev-secret-change-me-in-production
JWT_REFRESH_SECRET=dev-refresh-secret-change-me-in-production
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback
FRONTEND_URL=http://localhost:3001
ALLOWED_EMAIL_DOMAIN=
WEB_ORIGIN=http://localhost:3001
```

Also add these vars to the existing `.env` file (or create it if missing — copy from template).

- [ ] **Step 6: Write e2e controller test**

Create `platform/test/auth/auth.controller.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { resetDb } from '../helpers/db';
import { DockerRunner } from '../../src/execution/docker-runner';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DockerRunner)
      .useValue({ run: jest.fn() })
      .compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();
    prisma = moduleRef.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDb(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/auth/register creates user and sets cookies', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'new@test.com', name: 'New', password: 'password123' });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('new@test.com');
    expect(res.body.user.role).toBe('student');
    const cookies = res.headers['set-cookie'] as string[];
    expect(cookies.some((c: string) => c.startsWith('bc.access='))).toBe(true);
    expect(cookies.some((c: string) => c.startsWith('bc.refresh='))).toBe(true);
  });

  it('POST /api/auth/register returns 409 on duplicate email', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'dup@test.com', name: 'A', password: 'password123' });
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'dup@test.com', name: 'B', password: 'password456' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('email_taken');
  });

  it('POST /api/auth/login returns 200 with valid credentials', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'login@test.com', name: 'L', password: 'password123' });
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'login@test.com', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('login@test.com');
  });

  it('POST /api/auth/login returns 401 on wrong password', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'bad@test.com', name: 'B', password: 'password123' });
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'bad@test.com', password: 'wrong12345' });
    expect(res.status).toBe(401);
  });

  it('GET /api/auth/me returns user when authenticated', async () => {
    const reg = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'me@test.com', name: 'Me', password: 'password123' });
    const cookies = reg.headers['set-cookie'];
    const res = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', cookies);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('me@test.com');
  });

  it('GET /api/auth/me returns 401 without token', async () => {
    const res = await request(app.getHttpServer()).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('POST /api/auth/logout clears cookies', async () => {
    const res = await request(app.getHttpServer()).post('/api/auth/logout');
    expect(res.status).toBe(200);
    const cookies = res.headers['set-cookie'] as string[];
    expect(cookies.some((c: string) => c.includes('bc.access=;'))).toBe(true);
  });

  it('GET /api/auth/providers returns google availability', async () => {
    const res = await request(app.getHttpServer()).get('/api/auth/providers');
    expect(res.status).toBe(200);
    expect(typeof res.body.google).toBe('boolean');
  });
});
```

- [ ] **Step 7: Run the test**

```bash
npx jest auth.controller -i
```

Expected: 8 PASS.

- [ ] **Step 8: Run full suite**

```bash
npm test
```

Expected: all prior tests pass + new auth tests. Total should be ~100.

- [ ] **Step 9: Commit**

```bash
git add src/auth/auth.controller.ts src/auth/auth.module.ts src/app.module.ts src/main.ts .env.template test/auth/auth.controller.spec.ts
git commit -m "feat: add auth controller, module, and cookie-parser wiring"
```

---

## Task 6: Protect POST /api/run

**Files:**
- Modify: `platform/src/execution/run.controller.ts`
- Modify: `platform/test/execution/run.controller.spec.ts`

- [ ] **Step 1: Add JwtAuthGuard to RunController**

Read `platform/src/execution/run.controller.ts`. Add `@UseGuards(JwtAuthGuard)` to the `run` method (or the class). Import `JwtAuthGuard` and `UseGuards`.

```ts
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

// ... existing code ...

@Post()
@UseGuards(JwtAuthGuard)
@HttpCode(200)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
async run(@Body() dto: RunDto): Promise<RunResponse> {
  return this.runner.run({ ... });
}
```

- [ ] **Step 2: Add auth tests to the run controller test**

Add to the existing `test/execution/run.controller.spec.ts`:

```ts
it('POST /api/run returns 401 without auth token', async () => {
  const id = await seedCodeExercise();
  const res = await request(app.getHttpServer())
    .post('/api/run')
    .send({ exerciseId: id, exerciseVersion: 1, code: 'x' });
  expect(res.status).toBe(401);
});

it('POST /api/run returns 200 with valid auth token', async () => {
  // Register a user to get cookies
  const reg = await request(app.getHttpServer())
    .post('/api/auth/register')
    .send({ email: 'runner@test.com', name: 'R', password: 'password123' });
  const cookies = reg.headers['set-cookie'];
  const id = await seedCodeExercise();
  const res = await request(app.getHttpServer())
    .post('/api/run')
    .set('Cookie', cookies)
    .send({ exerciseId: id, exerciseVersion: 1, code: 'func greet() -> String { return "hello" }' });
  expect(res.status).toBe(200);
  expect(res.body.outcome).toBe('passed');
});
```

Note: The existing `run.controller.spec.ts` needs `app.use(cookieParser())` added to its `beforeAll` after `app = moduleRef.createNestApplication()`. And import `cookieParser`.

- [ ] **Step 3: Update existing run controller tests that don't send auth**

Existing happy-path tests that previously worked without auth will now return 401. They need to register a user first and send cookies with each request. Update the `beforeAll` or add a helper `registerAndGetCookies()` that all tests use.

- [ ] **Step 4: Run tests**

```bash
npx jest run.controller -i
```

Expected: all pass (existing + 2 new).

- [ ] **Step 5: Commit**

```bash
git add src/execution/run.controller.ts test/execution/run.controller.spec.ts
git commit -m "feat: protect POST /api/run with jwt auth"
```

---

## Task 7: Web — lib/auth.ts client + tests

**Files:**
- Create: `web/lib/auth.ts`
- Create: `web/tests/auth.test.ts`

- [ ] **Step 1: Write the failing test**

Create `web/tests/auth.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchMe, login, register, logout } from '@/lib/auth';

describe('auth client', () => {
  const originalFetch = global.fetch;
  beforeEach(() => { (global as any).fetch = vi.fn(); });
  afterEach(() => { (global as any).fetch = originalFetch; });

  it('login posts credentials and returns user', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ user: { id: '1', email: 'a@b.com', name: 'A', role: 'student', googleId: null, createdAt: '2026-01-01' } }),
    });
    const user = await login('a@b.com', 'pass1234');
    expect(user.email).toBe('a@b.com');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/login'),
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
  });

  it('register posts and returns user', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true, status: 201,
      json: async () => ({ user: { id: '1', email: 'r@b.com', name: 'R', role: 'student', googleId: null, createdAt: '2026-01-01' } }),
    });
    const user = await register('r@b.com', 'R', 'pass1234');
    expect(user.email).toBe('r@b.com');
  });

  it('fetchMe returns user when authed', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ user: { id: '1', email: 'm@b.com', name: 'M', role: 'student', googleId: null, createdAt: '2026-01-01' } }),
    });
    const user = await fetchMe();
    expect(user).not.toBeNull();
    expect(user!.email).toBe('m@b.com');
  });

  it('fetchMe returns null on 401', async () => {
    (global.fetch as any).mockResolvedValue({ ok: false, status: 401 });
    const user = await fetchMe();
    expect(user).toBeNull();
  });

  it('login throws on 401', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false, status: 401,
      json: async () => ({ error: 'invalid_credentials' }),
    });
    await expect(login('a@b.com', 'wrong')).rejects.toThrow('invalid_credentials');
  });
});
```

- [ ] **Step 2: Implement lib/auth.ts**

Create `web/lib/auth.ts`:

```ts
export type UserResponse = {
  id: string;
  email: string;
  name: string;
  role: 'student' | 'instructor' | 'admin';
  googleId: string | null;
  createdAt: string;
};

const BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3000';

async function authFetch(path: string, opts?: RequestInit): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
}

export async function login(email: string, password: string): Promise<UserResponse> {
  const res = await authFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'login_failed');
  return json.user;
}

export async function register(email: string, name: string, password: string): Promise<UserResponse> {
  const res = await authFetch('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, name, password }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'register_failed');
  return json.user;
}

export async function fetchMe(): Promise<UserResponse | null> {
  try {
    const res = await authFetch('/api/auth/me');
    if (!res.ok) return null;
    const json = await res.json();
    return json.user ?? null;
  } catch {
    return null;
  }
}

export async function logout(): Promise<void> {
  await authFetch('/api/auth/logout', { method: 'POST' });
}

export function googleLoginUrl(): string {
  return `${BASE}/api/auth/google`;
}
```

- [ ] **Step 3: Run tests**

```bash
cd c:/Users/ricma/BootCamp/web && npx vitest run auth.test
```

Expected: 5 PASS.

- [ ] **Step 4: Commit in web repo**

```bash
cd c:/Users/ricma/BootCamp/web
git add lib/auth.ts tests/auth.test.ts
git commit -m "feat: add auth api client"
```

---

## Task 8: Web — AuthProvider + SettingsMenu update

**Files:**
- Create: `web/components/layout/AuthProvider.tsx`
- Modify: `web/components/layout/SettingsMenu.tsx`
- Modify: `web/app/layout.tsx`
- Create: `web/tests/AuthProvider.test.tsx`

- [ ] **Step 1: Create AuthProvider**

Create `web/components/layout/AuthProvider.tsx`:

```tsx
'use client';
import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { fetchMe, logout as apiLogout, type UserResponse } from '@/lib/auth';

type AuthContextType = {
  user: UserResponse | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  refresh: async () => {},
  logout: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const u = await fetchMe();
      setUser(u);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <AuthContext.Provider value={{ user, loading, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
```

- [ ] **Step 2: Wrap layout.tsx with AuthProvider**

Modify `web/app/layout.tsx` — import `AuthProvider` and wrap `{children}`:

```tsx
import { AuthProvider } from '@/components/layout/AuthProvider';

// ... existing code ...

<body className={`${geistSans.variable} ${geistMono.variable}`}>
  <AuthProvider>
    {children}
  </AuthProvider>
</body>
```

- [ ] **Step 3: Update SettingsMenu**

Read and modify `web/components/layout/SettingsMenu.tsx`:
- Import `useAuth` from `AuthProvider`
- When `user` is not null: show user name, email, role badge, and "Sign out" button (calls `logout()` then `window.location.href = '/login'`).
- When `user` is null: show "Sign in" button that navigates to `/login` (use `next/link` or `window.location`).
- Keep the existing Appearance (dark mode) section as-is.
- Remove the disabled "Sign in" button and the "Auth arrives in spec #4" copy.

- [ ] **Step 4: Write AuthProvider test**

Create `web/tests/AuthProvider.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '@/components/layout/AuthProvider';

function Consumer() {
  const { user, loading } = useAuth();
  if (loading) return <p>Loading</p>;
  return <p>{user ? user.email : 'not logged in'}</p>;
}

describe('AuthProvider', () => {
  const originalFetch = global.fetch;
  beforeEach(() => { (global as any).fetch = vi.fn(); });
  afterEach(() => { (global as any).fetch = originalFetch; });

  it('shows user email when fetchMe returns a user', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ user: { id: '1', email: 'a@b.com', name: 'A', role: 'student', googleId: null, createdAt: '' } }),
    });
    render(<AuthProvider><Consumer /></AuthProvider>);
    await waitFor(() => expect(screen.getByText('a@b.com')).toBeInTheDocument());
  });

  it('shows not logged in when fetchMe returns 401', async () => {
    (global.fetch as any).mockResolvedValue({ ok: false, status: 401 });
    render(<AuthProvider><Consumer /></AuthProvider>);
    await waitFor(() => expect(screen.getByText('not logged in')).toBeInTheDocument());
  });
});
```

- [ ] **Step 5: Run tests**

```bash
cd c:/Users/ricma/BootCamp/web && npm test
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add components/layout/AuthProvider.tsx components/layout/SettingsMenu.tsx app/layout.tsx tests/AuthProvider.test.tsx
git commit -m "feat: add auth provider and update settings menu"
```

---

## Task 9: Web — Login + Register pages

**Files:**
- Create: `web/app/login/page.tsx`
- Create: `web/app/register/page.tsx`
- Create: `web/tests/pages/login.test.tsx`
- Create: `web/tests/pages/register.test.tsx`

- [ ] **Step 1: Create Login page**

Create `web/app/login/page.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { login, googleLoginUrl } from '@/lib/auth';
import { useAuth } from '@/components/layout/AuthProvider';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const { refresh } = useAuth();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
      await refresh();
      router.push('/');
    } catch (err: any) {
      setError(err.message === 'invalid_credentials' ? 'Invalid email or password.' : err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="w-full max-w-sm space-y-6 rounded-xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Sign in to BootCamp</h1>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Email</span>
            <input
              type="email" required autoFocus value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Password</span>
            <input
              type="password" required minLength={8} value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
          </label>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <button
            type="submit" disabled={submitting}
            className="w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-500 disabled:bg-gray-300"
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <div className="relative">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200 dark:border-gray-700" /></div>
          <div className="relative flex justify-center text-xs"><span className="bg-white px-2 text-gray-500 dark:bg-gray-900 dark:text-gray-400">or</span></div>
        </div>
        <a
          href={googleLoginUrl()}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          Sign in with Google
        </a>
        <p className="text-center text-sm text-gray-500 dark:text-gray-400">
          No account? <Link href="/register" className="text-blue-600 hover:underline dark:text-blue-400">Create one</Link>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create Register page**

Create `web/app/register/page.tsx` — same structure as login but with a `name` field, calls `register()`, and the submit button says "Create account". Link goes to `/login`. Renders "Sign up with Google" instead of "Sign in with Google".

(Full code mirrors the login page with the additions — name field, different submit handler, different heading "Create your BootCamp account", different CTA text.)

- [ ] **Step 3: Write tests**

Create `web/tests/pages/login.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/lib/auth', () => ({
  login: vi.fn(),
  googleLoginUrl: () => '/api/auth/google',
}));

vi.mock('@/components/layout/AuthProvider', () => ({
  useAuth: () => ({ refresh: vi.fn() }),
}));

import LoginPage from '@/app/login/page';
import { login } from '@/lib/auth';

describe('LoginPage', () => {
  beforeEach(() => { vi.mocked(login).mockReset(); });

  it('renders email and password fields', () => {
    render(<LoginPage />);
    expect(screen.getByText(/sign in/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('shows error on invalid credentials', async () => {
    vi.mocked(login).mockRejectedValue(new Error('invalid_credentials'));
    const user = userEvent.setup();
    render(<LoginPage />);
    await user.type(screen.getByLabelText(/email/i), 'a@b.com');
    await user.type(screen.getByLabelText(/password/i), 'wrongpass');
    await user.click(screen.getByRole('button', { name: /sign in$/i }));
    await waitFor(() => expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument());
  });
});
```

Create a similar test for the register page.

- [ ] **Step 4: Run tests**

```bash
cd c:/Users/ricma/BootCamp/web && npm test
```

- [ ] **Step 5: Build check**

```bash
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add app/login/ app/register/ tests/pages/
git commit -m "feat: add login and register pages"
```

---

## Task 10: Web — Auth check in CodeExercise + FixBugExercise

**Files:**
- Modify: `web/components/lesson/renderers/CodeExercise.tsx`
- Modify: `web/components/lesson/renderers/FixBugExercise.tsx`

- [ ] **Step 1: Update CodeExercise**

Read `web/components/lesson/renderers/CodeExercise.tsx`. Add `useAuth` import. Before calling `runExercise`, check if `user` is null. If null, set a result with a "sign in to run code" message instead of calling the API.

```tsx
import { useAuth } from '@/components/layout/AuthProvider';

// Inside the component:
const { user } = useAuth();

async function onRun() {
  if (!user) {
    setResult({
      outcome: 'internal_error',
      passed: false,
      stdout: '',
      stderr: 'Sign in to run code.',
      durationMs: 0,
      timedOut: false,
    });
    return;
  }
  // ... existing run logic
}
```

- [ ] **Step 2: Same for FixBugExercise**

Same change as CodeExercise.

- [ ] **Step 3: Update tests**

Update `tests/renderers/CodeExercise.test.tsx` to mock `useAuth`:

```tsx
vi.mock('@/components/layout/AuthProvider', () => ({
  useAuth: () => ({ user: { id: '1', email: 'a@b.com', name: 'A', role: 'student' }, loading: false }),
}));
```

Add a test case where `useAuth` returns `{user: null}` and verify the "Sign in to run code" message appears.

- [ ] **Step 4: Run tests and build**

```bash
cd c:/Users/ricma/BootCamp/web && npm test && npm run build
```

- [ ] **Step 5: Commit**

```bash
git add components/lesson/renderers/CodeExercise.tsx components/lesson/renderers/FixBugExercise.tsx tests/renderers/
git commit -m "feat: require auth before running code exercises"
```

---

## Task 11: Playwright smoke + final verification

**Files:**
- Modify: `web/tests/e2e/lesson.spec.ts`

- [ ] **Step 1: Append an auth-flow Playwright test**

Add to `web/tests/e2e/lesson.spec.ts`:

```ts
test.skip('auth flow: register, run code, sign out, run blocked', async ({ page }) => {
  // Register
  await page.goto('/register');
  await page.getByLabel(/email/i).fill(`test${Date.now()}@test.com`);
  await page.getByLabel(/name/i).fill('Test User');
  await page.getByLabel(/password/i).fill('password123');
  await page.getByRole('button', { name: /create account/i }).click();
  await page.waitForURL('/');

  // Run code should work
  await page.goto('/lesson/22222222-2222-4222-8222-222222222222?ex=5');
  await page.getByRole('button', { name: /run tests/i }).click();
  await expect(page.getByText(/tests passed|tests failed|compile error|timed out/i)).toBeVisible({ timeout: 30_000 });

  // Sign out via settings
  await page.getByLabel(/settings/i).click();
  await page.getByRole('button', { name: /sign out/i }).click();

  // Run should be blocked
  await page.goto('/lesson/22222222-2222-4222-8222-222222222222?ex=5');
  await page.getByRole('button', { name: /run tests/i }).click();
  await expect(page.getByText(/sign in/i)).toBeVisible();
});
```

- [ ] **Step 2: Verify it's discovered**

```bash
npx playwright test --list
```

- [ ] **Step 3: Run full platform suite**

```bash
cd c:/Users/ricma/BootCamp/platform && npm test
```

Expected: ~100 tests passing.

- [ ] **Step 4: Run full web suite**

```bash
cd c:/Users/ricma/BootCamp/web && npm test && npm run build
```

Expected: all passing, clean build.

- [ ] **Step 5: Commit**

```bash
cd c:/Users/ricma/BootCamp/web
git add tests/e2e/lesson.spec.ts
git commit -m "test: add auth-flow playwright smoke"
```

- [ ] **Step 6: Update HANDOVER.md**

Update `docs/superpowers/HANDOVER.md` to reflect spec #4 complete: new AuthModule, User entity, login/register pages, protected `POST /api/run`, Passport.js strategy pattern ready for Microsoft + GitHub.

---

## Out of scope reminders

- Instructor dashboard / cohort management UI (spec #8)
- Password reset flow (follow-up)
- Microsoft OAuth + GitHub OAuth (architecture ready — add a new strategy file per provider)
- Email verification (not needed for internal bootcamp)
- Admin user management UI
- Rate limiting on login
