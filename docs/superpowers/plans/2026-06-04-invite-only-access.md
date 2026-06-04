# Invite-Only Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace open self-registration with an invite-only system where a master admin invites instructors and instructors invite students, each via a copyable magic-link card that activates the account on first password set.

**Architecture:** Approach A — the `User` row is created up-front in an `invited` state when an invite is issued; an `Invitation` row holds a hashed, single-use, 7-day magic-link token. Accepting the link sets the password and flips the user to `active`. Inviting a student also creates the linked `Student` row so the instructor sees them as pending. Google OAuth and `POST /api/auth/register` are removed.

**Tech Stack:** NestJS 10 + Prisma 5 + PostgreSQL, bcryptjs, jsonwebtoken, class-validator (backend, `platform/`); Next.js 14 App Router + Tailwind + vitest + Playwright (frontend, `web/`). Both live in the one BootCamp git repo. Tests: `cd platform && npm test -- <path>` (Jest, `--runInBand`); `cd web && npx vitest run <path>`.

**Key reference files (read before starting):**
- `platform/prisma/schema.prisma` — `User` (180-189), `Student` (191-211), `UserRole` enum (143-147)
- `platform/src/auth/auth.service.ts`, `auth.controller.ts`, `auth.module.ts`, `user.repository.ts`
- `platform/src/students/students.{controller,service,module}.ts` — module/guard/role pattern to mirror
- `platform/src/state/repositories/student.repository.ts` — `create({ id, name, email, userId })`
- `platform/test/auth/auth.controller.spec.ts` — e2e harness + `resetDb` pattern
- `platform/test/helpers/db.ts` — `resetDb` (must add `invitation`)
- `platform/src/shared/ids.ts` — `newId()` for UUIDs
- `web/lib/auth.ts`, `web/lib/instructor.ts` — frontend API client pattern
- `web/app/register/page.tsx`, `web/middleware.ts`, `web/app/(authed)/(shell)/instructor/students/`

---

## File Structure

**Backend — new files:**
- `platform/src/invitations/invitation.token.ts` — token generate/hash helpers (pure, unit-tested)
- `platform/src/invitations/invitation.repository.ts` — Prisma access for `Invitation`
- `platform/src/invitations/invitations.service.ts` — issue / list / revoke logic + role rules
- `platform/src/invitations/invitations.controller.ts` — `/api/invitations` surface
- `platform/src/invitations/invitations.module.ts` — wires the above
- `platform/prisma/migrations/20260604000000_invite_only_access/migration.sql` — enums, `User.status`, `Invitation` table, backfill
- `platform/prisma/promote-admin.ts` — one-off bootstrap script (promote existing user → admin)
- Tests: `platform/test/invitations/invitation.token.spec.ts`, `invitations.service.spec.ts`, `invitations.controller.spec.ts`, and additions to `platform/test/auth/auth.controller.spec.ts`

**Backend — modified files:**
- `platform/prisma/schema.prisma` — enums, `User.status`, `Invitation` model
- `platform/src/auth/user.repository.ts` — `status` in create + `activate()` helper
- `platform/src/auth/auth.service.ts` — `acceptInvite()`, `login` status check, drop `register`/google
- `platform/src/auth/auth.controller.ts` — `accept-invite` route, drop `register`/google routes
- `platform/src/auth/auth.module.ts` — drop `GoogleStrategy` wiring
- `platform/src/app.module.ts` — import `InvitationsModule`
- `platform/test/helpers/db.ts` — `resetDb` clears `invitation` before `user`

**Frontend — new files:**
- `web/lib/invitations.ts` — invitations API client
- `web/components/invitations/InvitationCard.tsx` — copyable card (shared)
- `web/app/(authed)/(shell)/admin/page.tsx` — admin "invite instructor" page
- `web/app/accept-invite/page.tsx` — public set-password page
- Tests: `web/tests/InvitationCard.test.tsx`

**Frontend — modified files:**
- `web/lib/auth.ts` — add `acceptInvite()`, remove `register()`/`googleLoginUrl()`
- `web/app/(authed)/(shell)/instructor/students/page.tsx` — add "invite student" UI
- `web/app/login/page.tsx` — remove Google button + "create account" link
- `web/middleware.ts` — add `/admin/:path*` to matcher
- Delete `web/app/register/page.tsx`

---

## Task 1: Schema + migration (enums, User.status, Invitation)

**Files:**
- Modify: `platform/prisma/schema.prisma`
- Create: `platform/prisma/migrations/20260604000000_invite_only_access/migration.sql`

- [ ] **Step 1: Add enums and `status` to `User` in schema.prisma**

After the `UserRole` enum (line ~147) add:

```prisma
enum UserStatus {
  invited
  active
  disabled
}

enum InvitationStatus {
  pending
  accepted
  revoked
  expired
}
```

In `model User` (after `googleId`), add:

```prisma
  status       UserStatus @default(active)
  invitations  Invitation[]
```

After `model User`, add the `Invitation` model:

```prisma
model Invitation {
  id          String           @id @db.Uuid
  email       String
  userId      String           @db.Uuid
  user        User             @relation(fields: [userId], references: [id])
  invitedById String           @db.Uuid
  role        UserRole
  tokenHash   String           @unique
  status      InvitationStatus @default(pending)
  expiresAt   DateTime
  acceptedAt  DateTime?
  createdAt   DateTime         @default(now())

  @@index([userId])
  @@index([invitedById])
}
```

- [ ] **Step 2: Write the migration SQL by hand** (mirrors the additive style of `20260510120000_student_language/migration.sql`)

Create `platform/prisma/migrations/20260604000000_invite_only_access/migration.sql`:

```sql
-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('invited', 'active', 'disabled');
CREATE TYPE "InvitationStatus" AS ENUM ('pending', 'accepted', 'revoked', 'expired');

-- AlterTable: new column defaults to 'active'; existing rows backfill to 'active'
ALTER TABLE "User" ADD COLUMN "status" "UserStatus" NOT NULL DEFAULT 'active';

-- CreateTable
CREATE TABLE "Invitation" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "invitedById" UUID NOT NULL,
    "role" "UserRole" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation"("tokenHash");
CREATE INDEX "Invitation_userId_idx" ON "Invitation"("userId");
CREATE INDEX "Invitation_invitedById_idx" ON "Invitation"("invitedById");

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

- [ ] **Step 3: Regenerate the Prisma client and verify the migration applies**

Run: `cd platform && npx prisma migrate dev --name invite_only_access --skip-seed`
Expected: "Your database is now in sync with your schema." and `@prisma/client` regenerated. If prompted that the migration already exists, run `npx prisma migrate deploy` then `npx prisma generate`.

- [ ] **Step 4: Confirm the client typechecks the new model**

Run: `cd platform && npx tsc --noEmit`
Expected: no errors referencing `Invitation`, `UserStatus`, or `InvitationStatus`.

- [ ] **Step 5: Commit**

```bash
git add platform/prisma/schema.prisma platform/prisma/migrations/20260604000000_invite_only_access
git commit -m "feat(auth): add UserStatus + Invitation schema for invite-only access"
```

---

## Task 2: Token helpers (generate + hash)

**Files:**
- Create: `platform/src/invitations/invitation.token.ts`
- Test: `platform/test/invitations/invitation.token.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { generateInviteToken, hashInviteToken } from '../../src/invitations/invitation.token';

describe('invitation.token', () => {
  it('generates a 64-char hex token', () => {
    const t = generateInviteToken();
    expect(t).toMatch(/^[0-9a-f]{64}$/);
  });

  it('generates a different token each call', () => {
    expect(generateInviteToken()).not.toBe(generateInviteToken());
  });

  it('hashes deterministically (same input -> same hash)', () => {
    expect(hashInviteToken('abc')).toBe(hashInviteToken('abc'));
  });

  it('produces a 64-char hex sha256 hash that differs from the raw token', () => {
    const t = generateInviteToken();
    const h = hashInviteToken(t);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toBe(t);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd platform && npm test -- test/invitations/invitation.token.spec.ts`
Expected: FAIL — `Cannot find module '../../src/invitations/invitation.token'`.

- [ ] **Step 3: Implement the helpers**

```ts
import { createHash, randomBytes } from 'crypto';

/** 32 random bytes as lowercase hex (64 chars). This is the raw magic-link token. */
export function generateInviteToken(): string {
  return randomBytes(32).toString('hex');
}

/** SHA-256 of the raw token, lowercase hex. Only this is stored at rest. */
export function hashInviteToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd platform && npm test -- test/invitations/invitation.token.spec.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add platform/src/invitations/invitation.token.ts platform/test/invitations/invitation.token.spec.ts
git commit -m "feat(auth): invite token generate + sha256 hash helpers"
```

---

## Task 3: Invitation repository

**Files:**
- Create: `platform/src/invitations/invitation.repository.ts`
- (No standalone test — exercised via the service + e2e tests in later tasks.)

- [ ] **Step 1: Implement the repository**

```ts
import { Injectable } from '@nestjs/common';
import { Invitation, InvitationStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type CreateInvitationInput = {
  id: string;
  email: string;
  userId: string;
  invitedById: string;
  role: UserRole;
  tokenHash: string;
  expiresAt: Date;
};

@Injectable()
export class InvitationRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(input: CreateInvitationInput): Promise<Invitation> {
    return this.prisma.invitation.create({ data: { ...input, status: 'pending' } });
  }

  findByTokenHash(tokenHash: string): Promise<Invitation | null> {
    return this.prisma.invitation.findUnique({ where: { tokenHash } });
  }

  findById(id: string): Promise<Invitation | null> {
    return this.prisma.invitation.findUnique({ where: { id } });
  }

  /** Admin sees all; instructor sees only invites they issued. */
  findForInviter(invitedById: string | null): Promise<Invitation[]> {
    return this.prisma.invitation.findMany({
      where: invitedById ? { invitedById } : {},
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Pending invitation for an email that hasn't expired/been used. */
  findPendingByEmail(email: string): Promise<Invitation | null> {
    return this.prisma.invitation.findFirst({
      where: { email, status: 'pending' },
      orderBy: { createdAt: 'desc' },
    });
  }

  setStatus(id: string, status: InvitationStatus, acceptedAt?: Date): Promise<Invitation> {
    return this.prisma.invitation.update({
      where: { id },
      data: { status, ...(acceptedAt ? { acceptedAt } : {}) },
    });
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `cd platform && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add platform/src/invitations/invitation.repository.ts
git commit -m "feat(auth): invitation repository"
```

---

## Task 4: Extend UserRepository for status + activation

**Files:**
- Modify: `platform/src/auth/user.repository.ts`

- [ ] **Step 1: Add `status` to `CreateUserInput` and an `activate()` helper**

In `CreateUserInput`, add the optional field:

```ts
import { User, UserRole, UserStatus } from '@prisma/client';

export interface CreateUserInput {
  id: string;
  email: string;
  name: string;
  passwordHash?: string;
  role: UserRole;
  googleId?: string;
  status?: UserStatus;
}
```

In `create()`, pass it through (default `active` preserves today's behaviour for any other caller):

```ts
  create(input: CreateUserInput): Promise<User> {
    return this.prisma.user.create({
      data: {
        id: input.id,
        email: input.email,
        name: input.name,
        passwordHash: input.passwordHash ?? null,
        role: input.role,
        googleId: input.googleId ?? null,
        status: input.status ?? 'active',
      },
    });
  }
```

Add an activation helper at the end of the class:

```ts
  /** Set the password hash and flip an invited user to active. */
  activate(id: string, passwordHash: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { passwordHash, status: 'active' },
    });
  }

  setStatus(id: string, status: UserStatus): Promise<User> {
    return this.prisma.user.update({ where: { id }, data: { status } });
  }
```

- [ ] **Step 2: Typecheck**

Run: `cd platform && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add platform/src/auth/user.repository.ts
git commit -m "feat(auth): user repo status field + activate/setStatus helpers"
```

---

## Task 5: InvitationsService — issue / list / revoke

**Files:**
- Create: `platform/src/invitations/invitations.service.ts`
- Test: `platform/test/invitations/invitations.service.spec.ts`

- [ ] **Step 1: Write the failing test** (mirrors `students.service.spec.ts` plain-`new` + jest mock style)

```ts
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InvitationsService } from '../../src/invitations/invitations.service';

function build() {
  const invitations = {
    create: jest.fn(),
    findForInviter: jest.fn(),
    findById: jest.fn(),
    findPendingByEmail: jest.fn(),
    setStatus: jest.fn(),
  };
  const users = {
    findByEmail: jest.fn(),
    create: jest.fn(),
    setStatus: jest.fn(),
  };
  const students = { create: jest.fn() };
  const svc = new InvitationsService(invitations as any, users as any, students as any);
  return { svc, invitations, users, students };
}

const ADMIN = { userId: 'admin-1', role: 'admin' };
const INSTRUCTOR = { userId: 'inst-1', role: 'instructor' };

describe('InvitationsService.issue', () => {
  it('admin can invite an instructor; returns the raw token once', async () => {
    const { svc, users, invitations } = build();
    users.findByEmail.mockResolvedValue(null);
    users.create.mockResolvedValue({ id: 'u-new', email: 'i@x.com', role: 'instructor' });
    invitations.create.mockImplementation(async (i: any) => i);

    const res = await svc.issue({ email: 'i@x.com', name: 'Ivy', role: 'instructor' }, ADMIN);

    expect(users.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'i@x.com', role: 'instructor', status: 'invited' }),
    );
    expect(res.token).toMatch(/^[0-9a-f]{64}$/);
    expect(res.acceptUrlPath).toBe(`/accept-invite?token=${res.token}`);
  });

  it('instructor inviting forces role=student and links the student to themselves', async () => {
    const { svc, users, students } = build();
    users.findByEmail.mockResolvedValue(null);
    users.create.mockResolvedValue({ id: 'u-stu', email: 's@x.com', role: 'student' });

    await svc.issue({ email: 's@x.com', name: 'Sam', role: 'instructor' /* spoofed */ }, INSTRUCTOR);

    expect(users.create).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'student', status: 'invited' }),
    );
    expect(students.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u-stu', email: 's@x.com' }),
    );
  });

  it('instructor cannot mint an instructor (role is forced, never elevated)', async () => {
    const { svc, users } = build();
    users.findByEmail.mockResolvedValue(null);
    users.create.mockResolvedValue({ id: 'u', email: 's@x.com', role: 'student' });
    await svc.issue({ email: 's@x.com', name: 'S', role: 'admin' }, INSTRUCTOR);
    expect(users.create).toHaveBeenCalledWith(expect.objectContaining({ role: 'student' }));
  });

  it('rejects inviting an already-active email with 409-style conflict', async () => {
    const { svc, users } = build();
    users.findByEmail.mockResolvedValue({ id: 'u', email: 'a@x.com', status: 'active' });
    await expect(svc.issue({ email: 'a@x.com', name: 'A', role: 'instructor' }, ADMIN))
      .rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('InvitationsService.revoke', () => {
  it('instructor can revoke only their own invite', async () => {
    const { svc, invitations, users } = build();
    invitations.findById.mockResolvedValue({ id: 'inv', invitedById: 'someone-else', userId: 'u', status: 'pending' });
    await expect(svc.revoke('inv', INSTRUCTOR)).rejects.toBeInstanceOf(ForbiddenException);
    expect(users.setStatus).not.toHaveBeenCalled();
  });

  it('revoking disables the pending user and marks the invite revoked', async () => {
    const { svc, invitations, users } = build();
    invitations.findById.mockResolvedValue({ id: 'inv', invitedById: 'inst-1', userId: 'u', status: 'pending' });
    await svc.revoke('inv', INSTRUCTOR);
    expect(users.setStatus).toHaveBeenCalledWith('u', 'disabled');
    expect(invitations.setStatus).toHaveBeenCalledWith('inv', 'revoked');
  });

  it('revoke throws NotFound for a missing invite', async () => {
    const { svc, invitations } = build();
    invitations.findById.mockResolvedValue(null);
    await expect(svc.revoke('nope', ADMIN)).rejects.toBeInstanceOf(NotFoundException);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd platform && npm test -- test/invitations/invitations.service.spec.ts`
Expected: FAIL — cannot find `invitations.service`.

- [ ] **Step 3: Implement the service**

```ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Invitation, UserRole } from '@prisma/client';
import { newId } from '../shared/ids';
import { UserRepository } from '../auth/user.repository';
import { StudentRepository } from '../state/repositories/student.repository';
import { InvitationRepository } from './invitation.repository';
import { generateInviteToken, hashInviteToken } from './invitation.token';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export type Caller = { userId: string; role: string };
export type IssueInput = { email: string; name: string; role: UserRole };
export type IssueResult = {
  invitation: Invitation;
  token: string; // raw token — returned ONCE, never persisted
  acceptUrlPath: string;
};

@Injectable()
export class InvitationsService {
  constructor(
    private readonly invitations: InvitationRepository,
    private readonly users: UserRepository,
    private readonly students: StudentRepository,
  ) {}

  /**
   * Issue an invite. The granted role is decided by the CALLER's role, never
   * by client input: an instructor can only ever mint a `student` (linked to
   * themselves); only an admin may mint `instructor`/`admin`.
   */
  async issue(input: IssueInput, caller: Caller): Promise<IssueResult> {
    const grantedRole: UserRole =
      caller.role === 'admin' ? input.role : UserRole.student;

    const existing = await this.users.findByEmail(input.email);
    if (existing && existing.status === 'active') {
      throw new BadRequestException('A user with this email already exists');
    }
    if (existing) {
      // An invited-but-not-accepted user already holds this email (unique).
      // Re-inviting is out of scope here; revoke the old invite first.
      throw new BadRequestException(
        'This email already has a pending invitation; revoke it first',
      );
    }

    const user = await this.users.create({
      id: newId(),
      email: input.email,
      name: input.name,
      role: grantedRole,
      status: 'invited',
    });

    // A student invite auto-links the new student to the inviting instructor
    // (or to nobody when an admin issues it — admins aren't instructors of record).
    if (grantedRole === UserRole.student) {
      await this.students.create({
        id: newId(),
        name: input.name,
        email: input.email,
        userId: user.id,
        instructorId: caller.role === 'instructor' ? caller.userId : null,
      } as any);
    }

    const token = generateInviteToken();
    const invitation = await this.invitations.create({
      id: newId(),
      email: input.email,
      userId: user.id,
      invitedById: caller.userId,
      role: grantedRole,
      tokenHash: hashInviteToken(token),
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    });

    return { invitation, token, acceptUrlPath: `/accept-invite?token=${token}` };
  }

  async list(caller: Caller): Promise<Invitation[]> {
    return this.invitations.findForInviter(caller.role === 'admin' ? null : caller.userId);
  }

  async revoke(id: string, caller: Caller): Promise<void> {
    const invitation = await this.invitations.findById(id);
    if (!invitation) throw new NotFoundException('Invitation not found');
    if (caller.role !== 'admin' && invitation.invitedById !== caller.userId) {
      throw new ForbiddenException('You can only revoke invitations you issued');
    }
    if (invitation.status !== 'pending') {
      throw new BadRequestException('Only a pending invitation can be revoked');
    }
    await this.users.setStatus(invitation.userId, 'disabled');
    await this.invitations.setStatus(id, 'revoked');
  }
}
```

> NOTE for the implementer: `StudentRepository.create` currently accepts `{ id, name, email, cohortId?, userId? }` but NOT `instructorId`. **Add `instructorId?: string | null` to `CreateStudentInput` and pass it through in `student.repository.ts`** (it maps to the existing `Student.instructorId` column). That is why the call above is cast `as any` in the test but must be real in the repo. Make that one-line repo change as part of this task and drop the `as any`.

- [ ] **Step 3: Update `StudentRepository.create` to accept `instructorId`**

In `platform/src/state/repositories/student.repository.ts`, extend `CreateStudentInput` and `create`:

```ts
export type CreateStudentInput = {
  id: string;
  name: string;
  email: string;
  cohortId?: string | null;
  userId?: string | null;
  instructorId?: string | null;
};
```
```ts
  async create(input: CreateStudentInput): Promise<Student> {
    return this.prisma.student.create({
      data: {
        id: input.id,
        name: input.name,
        email: input.email,
        cohortId: input.cohortId ?? null,
        userId: input.userId ?? null,
        instructorId: input.instructorId ?? null,
      },
    });
  }
```

Then remove the `as any` from the `students.create({...})` call in the service.

- [ ] **Step 4: Run it to verify it passes**

Run: `cd platform && npm test -- test/invitations/invitations.service.spec.ts`
Expected: PASS (all describe blocks green).

- [ ] **Step 5: Commit**

```bash
git add platform/src/invitations/invitations.service.ts platform/test/invitations/invitations.service.spec.ts platform/src/state/repositories/student.repository.ts
git commit -m "feat(auth): invitations service (issue/list/revoke) with role rules"
```

---

## Task 6: AuthService.acceptInvite + login status gate + remove register/google

**Files:**
- Modify: `platform/src/auth/auth.service.ts`
- Test: `platform/test/auth/auth.service.spec.ts` (add cases)

- [ ] **Step 1: Add failing tests to `auth.service.spec.ts`**

Add an `acceptInvite`/`login`-status block. Use the existing test's construction style (check the top of `auth.service.spec.ts` for how `AuthService` is built and how `userRepo`/`invitationRepo` mocks are passed — match it). The behaviours to assert:

```ts
describe('acceptInvite', () => {
  it('rejects an unknown token', async () => {
    // invitationRepo.findByTokenHash -> null
    await expect(service.acceptInvite('badtoken', 'password123'))
      .rejects.toThrow('Invalid or expired invitation');
  });

  it('rejects an expired invitation', async () => {
    // findByTokenHash -> { status: 'pending', expiresAt: <past> }
    await expect(service.acceptInvite('t', 'password123'))
      .rejects.toThrow('Invalid or expired invitation');
  });

  it('rejects a non-pending (revoked/accepted) invitation', async () => {
    // findByTokenHash -> { status: 'revoked', expiresAt: <future> }
    await expect(service.acceptInvite('t', 'password123'))
      .rejects.toThrow('Invalid or expired invitation');
  });

  it('activates the user, marks invite accepted, and returns tokens', async () => {
    // findByTokenHash -> { id:'inv', userId:'u', status:'pending', expiresAt:<future> }
    // userRepo.activate -> active user
    const res = await service.acceptInvite('t', 'password123');
    expect(res.user.id).toBe('u');
    expect(res.accessToken).toBeTruthy();
    // invitationRepo.setStatus called with ('inv','accepted', <Date>)
  });
});

describe('login status gate', () => {
  it('rejects an invited (not yet activated) user', async () => {
    // userRepo.findByEmail -> { passwordHash:'h', status:'invited' }
    await expect(service.login('a@x.com', 'password123'))
      .rejects.toThrow('Invalid credentials');
  });

  it('rejects a disabled user', async () => {
    // userRepo.findByEmail -> { passwordHash:'h', status:'disabled' }
    await expect(service.login('a@x.com', 'password123'))
      .rejects.toThrow('Invalid credentials');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd platform && npm test -- test/auth/auth.service.spec.ts`
Expected: FAIL — `acceptInvite` not a function / login allows non-active users.

- [ ] **Step 3: Implement the changes in `auth.service.ts`**

Inject the `InvitationRepository` and `hashInviteToken`. Update the constructor:

```ts
import { InvitationRepository } from '../invitations/invitation.repository';
import { hashInviteToken } from '../invitations/invitation.token';
```
```ts
  constructor(
    private readonly userRepo: UserRepository,
    private readonly invitationRepo: InvitationRepository,
    private readonly jwtSecret: string,
    private readonly jwtRefreshSecret: string,
  ) {}
```

> The `allowedEmailDomain` constructor arg is dropped along with `register`. Update `auth.module.ts` accordingly in Task 8.

Replace `register()` (delete it entirely) and `findOrCreateGoogleUser()` (delete it entirely). Add:

```ts
  async acceptInvite(token: string, password: string): Promise<AuthResult> {
    const invitation = await this.invitationRepo.findByTokenHash(hashInviteToken(token));
    const invalid = new UnauthorizedException('Invalid or expired invitation');
    if (!invitation) throw invalid;
    if (invitation.status !== 'pending') throw invalid;
    if (invitation.expiresAt.getTime() < Date.now()) {
      await this.invitationRepo.setStatus(invitation.id, 'expired');
      throw invalid;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.userRepo.activate(invitation.userId, passwordHash);
    await this.invitationRepo.setStatus(invitation.id, 'accepted', new Date());

    const tokens = this.signTokens(user);
    return { user: toUserResponse(user), ...tokens };
  }
```

Update `login()` to gate on status (add after the password-hash existence check, before/after `bcrypt.compare`):

```ts
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
```

Also remove the now-unused `ConflictException`/`ForbiddenException` imports and the `allowedEmailDomain` field. Add `status` to `UserResponse` and `toUserResponse`:

```ts
export interface UserResponse {
  id: string; email: string; name: string; role: string;
  status: string; googleId: string | null; createdAt: Date;
}
```
```ts
function toUserResponse(user: User): UserResponse {
  return {
    id: user.id, email: user.email, name: user.name, role: user.role,
    status: user.status, googleId: user.googleId, createdAt: user.createdAt,
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd platform && npm test -- test/auth/auth.service.spec.ts`
Expected: PASS. (If pre-existing `register`/google tests exist in this spec, delete them — those endpoints are gone.)

- [ ] **Step 5: Commit**

```bash
git add platform/src/auth/auth.service.ts platform/test/auth/auth.service.spec.ts
git commit -m "feat(auth): acceptInvite + login status gate; drop register/google from service"
```

---

## Task 7: AuthController — accept-invite route, remove register/google

**Files:**
- Modify: `platform/src/auth/auth.controller.ts`
- Test: `platform/test/auth/auth.controller.spec.ts`

- [ ] **Step 1: Update the e2e test** — the harness uses the real `AppModule` + `resetDb`.

Replace the `registerUser` helper and the register/google tests. Add an invite→accept→login flow. New/updated tests:

```ts
// helper: seed an admin directly, then create an invitation through the API
async function seedAdmin() {
  const id = '11111111-1111-4111-8111-111111111111';
  const bcrypt = await import('bcryptjs');
  await prisma.user.create({
    data: { id, email: 'admin@test.com', name: 'Admin',
      passwordHash: await bcrypt.hash('password123', 10), role: 'admin', status: 'active' },
  });
  const login = await request(app.getHttpServer())
    .post('/api/auth/login').send({ email: 'admin@test.com', password: 'password123' }).expect(200);
  const cookies = login.headers['set-cookie'] as string[];
  return (Array.isArray(cookies) ? cookies : [cookies]).find((c) => c.startsWith('bc.access='))!;
}

it('removed: POST /api/auth/register returns 404', async () => {
  await request(app.getHttpServer())
    .post('/api/auth/register')
    .send({ email: 'x@test.com', name: 'X', password: 'password123' })
    .expect(404);
});

it('removed: GET /api/auth/google returns 404', async () => {
  await request(app.getHttpServer()).get('/api/auth/google').expect(404);
});

it('invite -> accept -> login happy path', async () => {
  const adminCookie = await seedAdmin();
  const inv = await request(app.getHttpServer())
    .post('/api/invitations')
    .set('Cookie', adminCookie)
    .send({ email: 'ivy@test.com', name: 'Ivy', role: 'instructor' })
    .expect(201);
  const token = inv.body.token as string;
  expect(token).toMatch(/^[0-9a-f]{64}$/);

  // cannot log in before accepting (invited status)
  await request(app.getHttpServer())
    .post('/api/auth/login').send({ email: 'ivy@test.com', password: 'newpass123' }).expect(401);

  const accept = await request(app.getHttpServer())
    .post('/api/auth/accept-invite').send({ token, password: 'newpass123' }).expect(201);
  expect(accept.body.user.email).toBe('ivy@test.com');
  const setCookies = accept.headers['set-cookie'] as string[];
  expect((Array.isArray(setCookies) ? setCookies : [setCookies]).some((c) => c.startsWith('bc.access='))).toBe(true);

  // now login works
  await request(app.getHttpServer())
    .post('/api/auth/login').send({ email: 'ivy@test.com', password: 'newpass123' }).expect(200);
});

it('accept-invite with a bad token returns 400', async () => {
  await request(app.getHttpServer())
    .post('/api/auth/accept-invite').send({ token: 'deadbeef', password: 'newpass123' }).expect(400);
});
```

> `UnauthorizedException` maps to 401, but accept-invite should read as a bad request to the user. Use `BadRequestException('Invalid or expired invitation')` in `acceptInvite` instead of `UnauthorizedException` so the status is **400** (update Task 6's code to throw `BadRequestException` — adjust the auth.service test's expectation accordingly; the message stays the same). Keep `login` failures as 401.

- [ ] **Step 2: Run to verify failure**

Run: `cd platform && npm test -- test/auth/auth.controller.spec.ts`
Expected: FAIL — `register` still 201, no `accept-invite` route, `/api/invitations` 404.

- [ ] **Step 3: Edit the controller**

Remove the `register` route + `RegisterDto`, the `google`/`google/callback` routes, and the `AuthGuard`/passport `google` import. Update `providers()` to report no SSO. Add:

```ts
class AcceptInviteDto {
  @IsString()
  @MinLength(1)
  token: string;

  @IsString()
  @MinLength(8)
  password: string;
}
```
```ts
  @Post('accept-invite')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async acceptInvite(@Body() dto: AcceptInviteDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.acceptInvite(dto.token, dto.password);
    setAuthCookies(res, result.accessToken, result.refreshToken);
    return { user: result.user };
  }
```
```ts
  @Get('providers')
  providers() {
    return { google: false };
  }
```

Delete `googleAuth()` and `googleCallback()` and the `import { AuthGuard } from '@nestjs/passport';` line.

- [ ] **Step 4: Run to verify pass**

Run: `cd platform && npm test -- test/auth/auth.controller.spec.ts`
Expected: PASS. (Requires Tasks 9 + 10 done so `/api/invitations` and `resetDb` exist — implement those first if running standalone, or run the full suite at Task 10.)

- [ ] **Step 5: Commit**

```bash
git add platform/src/auth/auth.controller.ts platform/test/auth/auth.controller.spec.ts
git commit -m "feat(auth): accept-invite endpoint; remove register + google routes"
```

---

## Task 8: AuthModule — drop Google, drop allowedEmailDomain, inject InvitationRepository

**Files:**
- Modify: `platform/src/auth/auth.module.ts`

- [ ] **Step 1: Rewrite the module providers**

Remove the `GoogleStrategy` import and the `if (process.env.GOOGLE_CLIENT_ID)` block. Inject `InvitationRepository` into `AuthService` and drop the `allowedEmailDomain` arg:

```ts
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserRepository } from './user.repository';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { InvitationRepository } from '../invitations/invitation.repository';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PassportModule, PrismaModule],
  controllers: [AuthController],
  providers: [
    UserRepository,
    InvitationRepository,
    {
      provide: AuthService,
      useFactory: (userRepo: UserRepository, invitationRepo: InvitationRepository) =>
        new AuthService(
          userRepo,
          invitationRepo,
          process.env.JWT_SECRET ?? 'dev-secret-change-me-in-production',
          process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret-change-me-in-production',
        ),
      inject: [UserRepository, InvitationRepository],
    },
    {
      provide: JwtStrategy,
      useFactory: () =>
        new JwtStrategy(process.env.JWT_SECRET ?? 'dev-secret-change-me-in-production'),
    },
    LocalStrategy,
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [AuthService, UserRepository, InvitationRepository, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
```

> If `PrismaModule` isn't already global, `InvitationRepository` needs it for `PrismaService`. Check `platform/src/prisma/prisma.module.ts`: if it's `@Global()`, you can omit the explicit `PrismaModule` import. Match whatever `student.repository`'s module does.

- [ ] **Step 2: Optionally delete the now-unused Google strategy file**

Run: `git rm platform/src/auth/strategies/google.strategy.ts`
(Leave it if other code imports it — grep first: `grep -rn "google.strategy" platform/src` should return nothing after this.)

- [ ] **Step 3: Typecheck**

Run: `cd platform && npx tsc --noEmit`
Expected: no errors (no dangling `GoogleStrategy` or `allowedEmailDomain` references).

- [ ] **Step 4: Commit**

```bash
git add platform/src/auth/auth.module.ts platform/src/auth/strategies/google.strategy.ts
git commit -m "refactor(auth): remove Google strategy, wire InvitationRepository into AuthService"
```

---

## Task 9: InvitationsController + module, wire into AppModule

**Files:**
- Create: `platform/src/invitations/invitations.controller.ts`, `invitations.module.ts`
- Modify: `platform/src/app.module.ts`
- Test: `platform/test/invitations/invitations.controller.spec.ts`

- [ ] **Step 1: Write the controller**

```ts
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { IsEmail, IsIn, IsString, MinLength } from 'class-validator';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { InvitationsService } from './invitations.service';

class CreateInvitationDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(1)
  name: string;

  @IsIn(['student', 'instructor', 'admin'])
  role: UserRole;
}

@Controller('api/invitations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('instructor', 'admin')
export class InvitationsController {
  constructor(private readonly service: InvitationsService) {}

  @Post()
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async create(
    @Body() dto: CreateInvitationDto,
    @CurrentUser() user: { userId: string; role: string },
  ) {
    const { invitation, token, acceptUrlPath } = await this.service.issue(
      { email: dto.email, name: dto.name, role: dto.role },
      user,
    );
    // token is returned exactly once so the client can render the magic-link card.
    return { invitation, token, acceptUrlPath };
  }

  @Get()
  async list(@CurrentUser() user: { userId: string; role: string }) {
    return this.service.list(user);
  }

  @Post(':id/revoke')
  async revoke(
    @Param('id') id: string,
    @CurrentUser() user: { userId: string; role: string },
  ) {
    await this.service.revoke(id, user);
    return { ok: true };
  }
}
```

- [ ] **Step 2: Write the module**

```ts
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { StateModule } from '../state/state.module';
import { InvitationsService } from './invitations.service';
import { InvitationsController } from './invitations.controller';
import { InvitationRepository } from './invitation.repository';

@Module({
  imports: [AuthModule, PrismaModule, StateModule],
  controllers: [InvitationsController],
  providers: [InvitationsService, InvitationRepository],
  exports: [InvitationsService],
})
export class InvitationsModule {}
```

> `InvitationsService` needs `UserRepository` (exported by `AuthModule`) and `StudentRepository` (exported by `StateModule` — confirm via `student.repository`'s home module; mirror `students.module.ts`, which imports `StateModule` to get repositories).

- [ ] **Step 3: Register in `app.module.ts`**

Add `import { InvitationsModule } from './invitations/invitations.module';` and add `InvitationsModule` to the `imports` array.

- [ ] **Step 4: Write the controller permission test** (lightweight — auth/role matrix; the full flow is covered by Task 7's e2e)

```ts
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../../src/app.module';
import { DockerRunner } from '../../src/execution/docker-runner';
import { PrismaService } from '../../src/prisma/prisma.service';
import { resetDb } from '../helpers/db';
import * as bcrypt from 'bcryptjs';

describe('InvitationsController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DockerRunner).useValue({ run: jest.fn() }).compile();
    app = mod.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
    prisma = mod.get(PrismaService);
  });
  afterAll(async () => { await app.close(); });
  beforeEach(async () => { await resetDb(prisma); });

  async function loginAs(role: 'admin' | 'instructor') {
    const id = role === 'admin'
      ? '11111111-1111-4111-8111-111111111111'
      : '22222222-2222-4222-8222-222222222222';
    await prisma.user.create({ data: {
      id, email: `${role}@test.com`, name: role,
      passwordHash: await bcrypt.hash('password123', 10), role, status: 'active' } });
    const res = await request(app.getHttpServer())
      .post('/api/auth/login').send({ email: `${role}@test.com`, password: 'password123' }).expect(200);
    const c = res.headers['set-cookie'] as string[];
    return (Array.isArray(c) ? c : [c]).find((x) => x.startsWith('bc.access='))!;
  }

  it('rejects an unauthenticated invite with 401', async () => {
    await request(app.getHttpServer())
      .post('/api/invitations').send({ email: 'a@x.com', name: 'A', role: 'instructor' }).expect(401);
  });

  it('instructor inviting role=instructor is silently downgraded to student', async () => {
    const cookie = await loginAs('instructor');
    const res = await request(app.getHttpServer())
      .post('/api/invitations').set('Cookie', cookie)
      .send({ email: 'sam@x.com', name: 'Sam', role: 'instructor' }).expect(201);
    expect(res.body.invitation.role).toBe('student');
    const student = await prisma.student.findUnique({ where: { email: 'sam@x.com' } });
    expect(student?.instructorId).toBe('22222222-2222-4222-8222-222222222222');
  });

  it('admin can invite an instructor', async () => {
    const cookie = await loginAs('admin');
    const res = await request(app.getHttpServer())
      .post('/api/invitations').set('Cookie', cookie)
      .send({ email: 'ivy@x.com', name: 'Ivy', role: 'instructor' }).expect(201);
    expect(res.body.invitation.role).toBe('instructor');
  });

  it('revoke disables the pending user', async () => {
    const cookie = await loginAs('admin');
    const inv = await request(app.getHttpServer())
      .post('/api/invitations').set('Cookie', cookie)
      .send({ email: 'rev@x.com', name: 'Rev', role: 'instructor' }).expect(201);
    await request(app.getHttpServer())
      .post(`/api/invitations/${inv.body.invitation.id}/revoke`).set('Cookie', cookie).expect(201);
    const u = await prisma.user.findUnique({ where: { email: 'rev@x.com' } });
    expect(u?.status).toBe('disabled');
  });
});
```

- [ ] **Step 5: Run to verify pass** (after Task 10 adds `invitation` to `resetDb`)

Run: `cd platform && npm test -- test/invitations/invitations.controller.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add platform/src/invitations/invitations.controller.ts platform/src/invitations/invitations.module.ts platform/src/app.module.ts platform/test/invitations/invitations.controller.spec.ts
git commit -m "feat(auth): invitations controller + module wired into app"
```

---

## Task 10: resetDb cleanup + full backend suite green

**Files:**
- Modify: `platform/test/helpers/db.ts`

- [ ] **Step 1: Clear `invitation` before `user`** (FK: `Invitation.userId → User.id`)

In `resetDb`, add before `await prisma.student.deleteMany();`:

```ts
  await prisma.invitation.deleteMany();
```

- [ ] **Step 2: Run the whole backend suite**

Run: `cd platform && npm test`
Expected: PASS across all suites. Fix any spec that referenced the removed `register`/google paths (delete those obsolete cases — they are intentionally gone).

- [ ] **Step 3: Commit**

```bash
git add platform/test/helpers/db.ts
git commit -m "test(auth): clear invitations in resetDb; full suite green for invite-only"
```

---

## Task 11: Admin bootstrap script (promote an existing user)

**Files:**
- Create: `platform/prisma/promote-admin.ts`

- [ ] **Step 1: Write the script**

```ts
/**
 * One-off bootstrap: promote an existing user to the master admin role.
 * Usage: cd platform && npx ts-node prisma/promote-admin.ts you@example.com
 *
 * Idempotent — re-running on an already-admin user is a no-op. Does NOT create
 * a user (invite-only system has no open signup); the account must already exist.
 */
import { PrismaClient } from '@prisma/client';

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: npx ts-node prisma/promote-admin.ts <email>');
    process.exit(1);
  }
  const prisma = new PrismaClient();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No user with email ${email}. Create the account first.`);
    process.exit(1);
  }
  const updated = await prisma.user.update({
    where: { email },
    data: { role: 'admin', status: 'active' },
  });
  console.log(`Promoted ${updated.email} -> role=admin, status=active`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Smoke-test against the dev DB** (the seed already creates `admin@bootcamp.dev`; promote the dev student as a harmless check, then revert)

Run: `cd platform && npx ts-node prisma/promote-admin.ts student@bootcamp.dev`
Expected: `Promoted student@bootcamp.dev -> role=admin, status=active`. Revert: `npx ts-node prisma/promote-admin.ts` is N/A — restore via `npx prisma db seed` or manually set role back to `student`.

- [ ] **Step 3: Commit**

```bash
git add platform/prisma/promote-admin.ts
git commit -m "feat(auth): promote-admin bootstrap script"
```

---

## Task 12: Frontend API client (lib/invitations.ts + auth.ts changes)

**Files:**
- Create: `web/lib/invitations.ts`
- Modify: `web/lib/auth.ts`

- [ ] **Step 1: Create `web/lib/invitations.ts`**

```ts
import { getApiBase } from './api-base';
const BASE = getApiBase();

function authFetch(path: string, opts?: RequestInit): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
}

export type InvitationRole = 'student' | 'instructor' | 'admin';

export type Invitation = {
  id: string;
  email: string;
  userId: string;
  invitedById: string;
  role: InvitationRole;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
};

export type IssuedInvitation = {
  invitation: Invitation;
  token: string;          // raw token, shown once
  acceptUrlPath: string;  // e.g. /accept-invite?token=...
};

export async function createInvitation(
  email: string,
  name: string,
  role: InvitationRole,
): Promise<IssuedInvitation> {
  const res = await authFetch('/api/invitations', {
    method: 'POST',
    body: JSON.stringify({ email, name, role }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message ?? 'invite_failed');
  return json;
}

export async function listInvitations(): Promise<Invitation[]> {
  const res = await authFetch('/api/invitations');
  if (!res.ok) throw new Error(`list invitations failed: ${res.status}`);
  return res.json();
}

export async function revokeInvitation(id: string): Promise<void> {
  const res = await authFetch(`/api/invitations/${id}/revoke`, { method: 'POST' });
  if (!res.ok) throw new Error(`revoke failed: ${res.status}`);
}
```

- [ ] **Step 2: Update `web/lib/auth.ts`** — add `acceptInvite`, remove `register` + `googleLoginUrl`, add `status` to `UserResponse`

Add to `UserResponse`: `status: 'invited' | 'active' | 'disabled';`. Delete `register()` and `googleLoginUrl()`. Add:

```ts
export async function acceptInvite(token: string, password: string): Promise<UserResponse> {
  const res = await authFetch('/api/auth/accept-invite', {
    method: 'POST',
    body: JSON.stringify({ token, password }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message ?? 'accept_failed');
  return json.user;
}
```

- [ ] **Step 3: Typecheck**

Run: `cd web && npx tsc --noEmit`
Expected: errors ONLY in files that still import the removed `register`/`googleLoginUrl` (the register page + login page) — fixed in Tasks 14-17.

- [ ] **Step 4: Commit**

```bash
git add web/lib/invitations.ts web/lib/auth.ts
git commit -m "feat(web): invitations API client + acceptInvite; drop register/google client"
```

---

## Task 13: InvitationCard component

**Files:**
- Create: `web/components/invitations/InvitationCard.tsx`
- Test: `web/tests/InvitationCard.test.tsx`

- [ ] **Step 1: Write the failing test** (vitest + Testing Library — match existing `web/tests/*.test.tsx` setup in `vitest.setup.ts`)

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InvitationCard } from '../components/invitations/InvitationCard';

describe('InvitationCard', () => {
  beforeEach(() => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
  });

  it('shows the invitee email and the full magic link', () => {
    render(<InvitationCard email="ivy@x.com" name="Ivy" link="https://app/accept-invite?token=abc" expiresAt="2026-06-11T00:00:00.000Z" />);
    expect(screen.getByText('ivy@x.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('https://app/accept-invite?token=abc')).toBeInTheDocument();
  });

  it('copies the link to the clipboard when Copy is clicked', async () => {
    render(<InvitationCard email="ivy@x.com" name="Ivy" link="https://app/accept-invite?token=abc" expiresAt="2026-06-11T00:00:00.000Z" />);
    fireEvent.click(screen.getByRole('button', { name: /copy/i }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://app/accept-invite?token=abc');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd web && npx vitest run tests/InvitationCard.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the component**

```tsx
'use client';
import { useState } from 'react';

export function InvitationCard(props: {
  email: string;
  name: string;
  link: string;
  expiresAt: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(props.link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const expires = new Date(props.expiresAt).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
        Invitation for {props.name}
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400">{props.email}</p>
      <p className="mt-1 text-xs text-gray-400">Link expires {expires}</p>

      <div className="mt-3 flex gap-2">
        <input
          readOnly
          value={props.link}
          aria-label="Magic link"
          className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
        />
        <button
          type="button"
          onClick={copy}
          className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-blue-500"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-gray-400">
        Paste this link into an email to {props.name}. They'll set a password and their
        account becomes active. This link is shown only once.
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd web && npx vitest run tests/InvitationCard.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add web/components/invitations/InvitationCard.tsx web/tests/InvitationCard.test.tsx
git commit -m "feat(web): copyable InvitationCard component"
```

---

## Task 14: Admin "invite instructor" page

**Files:**
- Create: `web/app/(authed)/(shell)/admin/page.tsx`
- Modify: `web/middleware.ts` (add `/admin/:path*` to matcher)

- [ ] **Step 1: Add `/admin` to the middleware matcher**

In `web/middleware.ts`, add `'/admin/:path*',` to the `config.matcher` array (so SSR token refresh covers admin pages too).

- [ ] **Step 2: Build the admin page** (mirror `instructor` pages' shell usage; gate to admin via `lib/role-guard.ts` — open that file and follow its existing API, e.g. a server-side `requireRole('admin')` or client `useRole` guard, whichever the instructor pages use)

```tsx
'use client';
import { useEffect, useState, type FormEvent } from 'react';
import {
  createInvitation,
  listInvitations,
  revokeInvitation,
  type Invitation,
} from '@/lib/invitations';
import { getApiBase } from '@/lib/api-base';
import { InvitationCard } from '@/components/invitations/InvitationCard';

export default function AdminPage() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [issued, setIssued] = useState<{ link: string; email: string; name: string; expiresAt: string } | null>(null);
  const [invites, setInvites] = useState<Invitation[]>([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function refresh() {
    setInvites(await listInvitations());
  }
  useEffect(() => { refresh().catch(() => {}); }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await createInvitation(email, name, 'instructor');
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      // acceptUrlPath is a web path; build an absolute link the admin can paste.
      setIssued({ link: `${origin}${res.acceptUrlPath}`, email, name, expiresAt: res.invitation.expiresAt });
      setEmail(''); setName('');
      await refresh();
    } catch (err) {
      setError((err as Error).message ?? 'Could not create invitation');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRevoke(id: string) {
    await revokeInvitation(id);
    await refresh();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Invite an instructor</h1>

      <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
        <input type="text" required placeholder="Instructor name" value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
        <input type="email" required placeholder="instructor@example.com" value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
        {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
        <button type="submit" disabled={submitting}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:bg-gray-300">
          {submitting ? 'Creating…' : 'Create invitation'}
        </button>
      </form>

      {issued && (
        <InvitationCard email={issued.email} name={issued.name} link={issued.link} expiresAt={issued.expiresAt} />
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Invitations</h2>
        <ul className="space-y-2">
          {invites.map((inv) => (
            <li key={inv.id} className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-2 text-sm dark:border-gray-700">
              <span>{inv.email} · <span className="text-gray-500">{inv.role}</span> · <span className="text-gray-500">{inv.status}</span></span>
              {inv.status === 'pending' && (
                <button onClick={() => handleRevoke(inv.id)} className="text-xs text-red-600 hover:underline">Revoke</button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
```

> Role gating: the `(shell)` layout already requires auth. Add admin-only protection consistent with how instructor pages restrict to instructors — inspect `web/lib/role-guard.ts` and an instructor page (e.g. `instructor/page.tsx`) and apply the same mechanism so a student hitting `/admin` is redirected.

- [ ] **Step 3: Typecheck**

Run: `cd web && npx tsc --noEmit`
Expected: no errors in `admin/page.tsx`.

- [ ] **Step 4: Manual verification**

Start the stack (`./dev.ps1` from repo root — platform on :3002, web on :3001). Promote your dev user with the Task 11 script, log in as admin, visit `/admin`, create an invite, confirm the card appears with a copyable link and the invite shows in the list. Note: full click-through is covered by the Playwright task below.

- [ ] **Step 5: Commit**

```bash
git add web/app/(authed)/(shell)/admin/page.tsx web/middleware.ts
git commit -m "feat(web): admin invite-instructor page + admin route refresh"
```

---

## Task 15: Instructor "invite student" UI

**Files:**
- Modify: `web/app/(authed)/(shell)/instructor/students/page.tsx`

- [ ] **Step 1: Read the current students page** to match its data-loading + layout conventions

Run: `cat "web/app/(authed)/(shell)/instructor/students/page.tsx"`

- [ ] **Step 2: Add an "Invite student" form + card** reusing the same pieces as the admin page, but calling `createInvitation(email, name, 'student')`. The server forces role=student and links the student to the calling instructor, so no extra wiring is needed. Render the resulting `InvitationCard`, and after issuing, re-fetch the roster (the invited student appears as a pending row via existing roster logic — they have `instructorId` set).

Add near the top of the students page (inside the client component), following the exact form/card pattern from Task 14 but with `role='student'` and the page's existing styling. Reuse `InvitationCard` and `createInvitation` imports.

- [ ] **Step 3: Typecheck**

Run: `cd web && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual verification**

Log in as an instructor (seeded `instructor@bootcamp.dev` / `test1234`, promote/seed as needed), open `/instructor/students`, invite a student, confirm the card renders and the student appears in the roster as pending.

- [ ] **Step 5: Commit**

```bash
git add web/app/(authed)/(shell)/instructor/students/page.tsx
git commit -m "feat(web): instructor invite-student UI on roster page"
```

---

## Task 16: Public /accept-invite set-password page

**Files:**
- Create: `web/app/accept-invite/page.tsx`

- [ ] **Step 1: Build the page** (public route, outside `(authed)`; reads `?token=` from the URL)

```tsx
'use client';
import { Suspense, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { acceptInvite } from '@/lib/auth';
import { useAuth } from '@/components/layout/AuthProvider';

function AcceptInviteInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const { refresh } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setSubmitting(true);
    try {
      await acceptInvite(token, password);
      await refresh();
      router.push('/');
    } catch (err) {
      setError((err as Error).message === 'accept_failed'
        ? 'This invitation is invalid or has expired.'
        : (err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return <p className="p-8 text-center text-sm text-red-600">Missing invitation token.</p>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <h1 className="mb-6 text-center text-xl font-semibold text-gray-900 dark:text-gray-100">
          Set your password
        </h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="password" required autoComplete="new-password" placeholder="New password"
            value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
          <input type="password" required autoComplete="new-password" placeholder="Confirm password"
            value={confirm} onChange={(e) => setConfirm(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
          {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
          <button type="submit" disabled={submitting}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:bg-gray-300">
            {submitting ? 'Activating…' : 'Activate account'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  // useSearchParams requires a Suspense boundary in the App Router.
  return (
    <Suspense fallback={<p className="p-8 text-center text-sm">Loading…</p>}>
      <AcceptInviteInner />
    </Suspense>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd web && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual verification**

Paste a freshly-issued invite link into the browser, set a password, confirm you're logged in and redirected to `/`. Re-using the same link should now show "invalid or has expired".

- [ ] **Step 4: Commit**

```bash
git add web/app/accept-invite/page.tsx
git commit -m "feat(web): public accept-invite set-password page"
```

---

## Task 17: Remove register page + Google buttons + dead links

**Files:**
- Delete: `web/app/register/page.tsx`
- Modify: `web/app/login/page.tsx`

- [ ] **Step 1: Delete the register page**

Run: `git rm "web/app/register/page.tsx"`

- [ ] **Step 2: Scrub references** — remove the Google sign-in button + the "Create account / register" link from `web/app/login/page.tsx`, and any nav link pointing to `/register`.

Run: `grep -rn "register\|googleLoginUrl\|/register\|Sign up with Google" web/app web/components web/lib`
Remove each remaining reference (the login page's Google `<a>` and the "Don't have an account? Sign up" link). Login becomes email + password only.

- [ ] **Step 3: Typecheck + lint**

Run: `cd web && npx tsc --noEmit`
Expected: no errors, no remaining imports of `register`/`googleLoginUrl`.

- [ ] **Step 4: Manual verification**

Visit `/login` — only email/password remain; `/register` returns a 404; navigating the app shows no "sign up" affordance.

- [ ] **Step 5: Commit**

```bash
git add -A web/app/login/page.tsx
git rm "web/app/register/page.tsx"
git commit -m "feat(web): remove open registration + Google sign-in from login"
```

---

## Task 18: End-to-end Playwright flow

**Files:**
- Create: `web/tests/e2e/invite-flow.spec.ts` (match the existing Playwright config/location — check `web/playwright.config.ts` for `testDir`)

- [ ] **Step 1: Inspect existing Playwright tests** for the auth/login helper + base URL conventions

Run: `cat web/playwright.config.ts; ls web/tests` (find existing `*.spec.ts` e2e and reuse their login helper / storage-state pattern)

- [ ] **Step 2: Write the flow** — admin invites instructor → accept → instructor logs in → instructor invites student → accept → student lands on home. Capture the magic link from the rendered `InvitationCard` input value (`page.getByLabel('Magic link')`).

```ts
import { test, expect } from '@playwright/test';

// Assumes the dev stack is up and an admin account exists (seeded admin@bootcamp.dev
// promoted via prisma/promote-admin.ts, or seeded with role=admin). Adjust creds to
// match the project's e2e auth helper.
test('admin invites instructor, who activates and invites a student', async ({ page }) => {
  // 1. Log in as admin
  await page.goto('/login');
  await page.getByPlaceholder(/email/i).fill('admin@bootcamp.dev');
  await page.getByPlaceholder(/password/i).fill('test1234');
  await page.getByRole('button', { name: /sign in|log in/i }).click();

  // 2. Invite an instructor
  await page.goto('/admin');
  const email = `inst+${Date.now()}@test.com`;
  await page.getByPlaceholder(/instructor name/i).fill('E2E Instructor');
  await page.getByPlaceholder(/instructor@example/i).fill(email);
  await page.getByRole('button', { name: /create invitation/i }).click();

  const link = await page.getByLabel('Magic link').inputValue();
  expect(link).toContain('/accept-invite?token=');

  // 3. Activate the instructor account
  await page.context().clearCookies();
  await page.goto(link);
  await page.getByPlaceholder('New password').fill('newpass123');
  await page.getByPlaceholder('Confirm password').fill('newpass123');
  await page.getByRole('button', { name: /activate account/i }).click();
  await expect(page).toHaveURL(/\/$/);

  // 4. Instructor invites a student
  await page.goto('/instructor/students');
  const studentEmail = `stu+${Date.now()}@test.com`;
  // (selectors per the Task 15 form; adjust to its placeholders)
  await page.getByPlaceholder(/student name/i).fill('E2E Student');
  await page.getByPlaceholder(/student@example|email/i).first().fill(studentEmail);
  await page.getByRole('button', { name: /create invitation|invite student/i }).click();
  await expect(page.getByLabel('Magic link')).toBeVisible();
});
```

- [ ] **Step 3: Run it**

Run: `cd web && npx playwright test tests/e2e/invite-flow.spec.ts`
Expected: PASS (start the dev stack first; reset the DB / use unique emails to stay idempotent).

- [ ] **Step 4: Commit**

```bash
git add web/tests/e2e/invite-flow.spec.ts
git commit -m "test(web): e2e invite -> accept -> invite-student flow"
```

---

## Task 19: Security gate + final verification

Per `CLAUDE.md`, this touches auth + the `User` model, so it must pass the Security Gateway before the branch merges.

- [ ] **Step 1: Run the full backend suite**

Run: `cd platform && npm test`
Expected: all green.

- [ ] **Step 2: Run frontend unit + typecheck**

Run: `cd web && npx tsc --noEmit && npx vitest run`
Expected: all green.

- [ ] **Step 3: Run the agents audit on the diff**

Invoke the `agents-audit` skill (security scanner + architecture reviewer over the branch diff). Address any BLOCK findings (e.g. token handling, missing tenant/role scoping) before proceeding.

- [ ] **Step 4: Manual smoke of the whole flow** against `./dev.ps1`: promote admin → invite instructor → accept → login → invite student → accept → confirm student is linked to the instructor in the roster, revoke blocks login, expired/old links are rejected.

- [ ] **Step 5: Finish the branch**

Invoke `superpowers:finishing-a-development-branch` to choose merge/PR. Confirm the migration is included and `resetDb` + seed still work.

---

## Self-Review Notes (author)

- **Spec coverage:** data model (Task 1) ✓; up-front user creation + student link (Task 5) ✓; copy-card, no email (Tasks 13-15) ✓; magic-link accept/set-password (Tasks 6,16) ✓; close `/register` + remove Google (Tasks 6-8,17) ✓; status + revoke (Tasks 4,5,6) ✓; admin bootstrap by promotion (Task 11) ✓; role rules instructor↛instructor (Tasks 5,9) ✓; generic token errors + 7-day TTL + single-use (Tasks 5,6) ✓; tests unit+e2e (throughout) ✓.
- **Open item flagged inline:** Task 7 changes `acceptInvite` to throw `BadRequestException` (HTTP 400) rather than `UnauthorizedException` so the public accept endpoint reads as 400; Task 6's test expectation must match (message unchanged: "Invalid or expired invitation").
- **Type consistency:** `IssueResult.acceptUrlPath` (web path) is turned into an absolute link in the admin/instructor pages via `window.location.origin`. `UserResponse.status` added in both backend and `web/lib/auth.ts`.
- **Re-invite of a pending email** is intentionally rejected (revoke first) — token rotation was descoped from the original spec's "rotate token" to keep this plan single-pass; revoke-then-reinvite achieves the same outcome. (If you want true rotation, add an `issue`-time branch that updates the existing invitation's `tokenHash`/`expiresAt` instead of throwing.)
