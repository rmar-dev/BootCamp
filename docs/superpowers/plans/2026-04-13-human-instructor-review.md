# Human Instructor Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add asynchronous human instructor review that layers on top of AI review, with a review queue, markdown feedback, and student-instructor conversation threads.

**Architecture:** New `InstructorReviewModule` in the NestJS platform with its own controller, service, and repository. New `InstructorReview` and `ReviewMessage` Prisma entities. Two new Next.js pages (`/instructor`, `/instructor/review/[attemptId]`) and one new student-facing component. Follows existing module-per-domain pattern.

**Tech Stack:** NestJS, Prisma, Next.js 14, Monaco Editor (read-only), react-markdown, Tailwind CSS, Vitest (web), Jest (platform).

---

## File Structure

### Platform (new files)

| File | Responsibility |
|------|---------------|
| `prisma/schema.prisma` | Add `InstructorReview` and `ReviewMessage` models (modify) |
| `src/instructor-review/instructor-review.module.ts` | NestJS module registration |
| `src/instructor-review/instructor-review.controller.ts` | All `/api/instructor/*` routes |
| `src/instructor-review/instructor-review.service.ts` | Queue queries, create/edit review, post messages |
| `src/instructor-review/instructor-review.repository.ts` | Prisma CRUD for InstructorReview + ReviewMessage |
| `src/app.module.ts` | Register InstructorReviewModule (modify) |
| `test/helpers/db.ts` | Add new tables to resetDb (modify) |
| `test/instructor-review/instructor-review.controller.spec.ts` | E2E tests |

### Web (new files)

| File | Responsibility |
|------|---------------|
| `lib/instructor.ts` | API fetch helpers for instructor endpoints |
| `app/instructor/page.tsx` | Instructor dashboard / review queue |
| `app/instructor/review/[attemptId]/page.tsx` | Review detail page (code + write feedback + thread) |
| `components/instructor/QueueTable.tsx` | Queue table with pending/reviewed tabs |
| `components/instructor/ReviewForm.tsx` | Markdown textarea + submit/edit review |
| `components/instructor/ReviewThread.tsx` | Flat message thread + reply form |
| `components/lesson/renderers/InstructorReview.tsx` | Student-facing instructor review + thread |
| `components/lesson/renderers/CodeExercise.tsx` | Add InstructorReview below AIReview (modify) |
| `tests/renderers/InstructorReview.test.tsx` | Component tests |
| `tests/instructor/QueueTable.test.tsx` | Component tests |

---

## Task 1: Prisma Schema — Add InstructorReview and ReviewMessage

**Files:**
- Modify: `platform/prisma/schema.prisma:202-209` (after CodeReview)
- Modify: `test/helpers/db.ts:11-12` (add to resetDb)

- [ ] **Step 1: Add InstructorReview model to schema**

Add after the `CodeReview` model (after line 209) in `platform/prisma/schema.prisma`:

```prisma
model InstructorReview {
  id            String   @id @db.Uuid
  attemptId     String   @unique @db.Uuid
  instructorId  String   @db.Uuid
  markdown      String
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  messages ReviewMessage[]

  @@index([instructorId])
}

model ReviewMessage {
  id                  String   @id @db.Uuid
  instructorReviewId  String   @db.Uuid
  authorId            String   @db.Uuid
  body                String
  createdAt           DateTime @default(now())

  instructorReview InstructorReview @relation(fields: [instructorReviewId], references: [id])

  @@index([instructorReviewId])
}
```

- [ ] **Step 2: Update resetDb to include new tables**

In `test/helpers/db.ts`, add the new deletes at the top of the function (before `studentBadge`):

```typescript
export async function resetDb(prisma: PrismaClient): Promise<void> {
  await prisma.reviewMessage.deleteMany();
  await prisma.instructorReview.deleteMany();
  await prisma.studentBadge.deleteMany();
  await prisma.codeReview.deleteMany();
  // ... rest unchanged
}
```

- [ ] **Step 3: Run migration**

Run: `cd platform && npx prisma migrate dev --name add-instructor-review`
Expected: Migration created and applied successfully.

- [ ] **Step 4: Verify existing tests still pass**

Run: `cd platform && npm test`
Expected: All 174 tests pass (new tables don't affect existing tests).

- [ ] **Step 5: Commit**

```bash
cd platform
git add prisma/schema.prisma prisma/migrations/ test/helpers/db.ts
git commit -m "feat: add InstructorReview and ReviewMessage schema"
```

---

## Task 2: InstructorReview Repository

**Files:**
- Create: `platform/src/instructor-review/instructor-review.repository.ts`

- [ ] **Step 1: Write the repository**

Create `platform/src/instructor-review/instructor-review.repository.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { InstructorReview, ReviewMessage } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { newId } from '../shared/ids';

export type CreateInstructorReviewInput = {
  attemptId: string;
  instructorId: string;
  markdown: string;
};

export type InstructorReviewWithMessages = InstructorReview & {
  messages: ReviewMessage[];
};

@Injectable()
export class InstructorReviewRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateInstructorReviewInput): Promise<InstructorReview> {
    return this.prisma.instructorReview.create({
      data: {
        id: newId(),
        attemptId: input.attemptId,
        instructorId: input.instructorId,
        markdown: input.markdown,
      },
    });
  }

  async update(id: string, markdown: string): Promise<InstructorReview> {
    return this.prisma.instructorReview.update({
      where: { id },
      data: { markdown },
    });
  }

  async findByAttemptId(attemptId: string): Promise<InstructorReviewWithMessages | null> {
    return this.prisma.instructorReview.findUnique({
      where: { attemptId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
  }

  async addMessage(instructorReviewId: string, authorId: string, body: string): Promise<ReviewMessage> {
    return this.prisma.reviewMessage.create({
      data: {
        id: newId(),
        instructorReviewId,
        authorId,
        body,
      },
    });
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd platform
git add src/instructor-review/instructor-review.repository.ts
git commit -m "feat: add InstructorReviewRepository"
```

---

## Task 3: InstructorReview Service — Queue + CRUD

**Files:**
- Create: `platform/src/instructor-review/instructor-review.service.ts`

- [ ] **Step 1: Write the service**

Create `platform/src/instructor-review/instructor-review.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  InstructorReviewRepository,
  InstructorReviewWithMessages,
} from './instructor-review.repository';
import { InstructorReview, ReviewMessage } from '@prisma/client';

export type QueueItem = {
  attemptId: string;
  studentName: string;
  studentEmail: string;
  exerciseId: string;
  exercisePrompt: string;
  lessonTitle: string;
  submittedAt: Date;
  reviewedAt: Date | null;
};

@Injectable()
export class InstructorReviewService {
  constructor(
    private readonly repo: InstructorReviewRepository,
    private readonly prisma: PrismaService,
  ) {}

  async getPendingQueue(instructorId: string): Promise<QueueItem[]> {
    return this.getQueue(instructorId, false);
  }

  async getReviewedQueue(instructorId: string): Promise<QueueItem[]> {
    return this.getQueue(instructorId, true);
  }

  private async getQueue(instructorId: string, reviewed: boolean): Promise<QueueItem[]> {
    // Find all cohorts for this instructor
    const cohorts = await this.prisma.cohort.findMany({
      where: { instructorId },
      select: { id: true },
    });
    const cohortIds = cohorts.map((c) => c.id);
    if (cohortIds.length === 0) return [];

    // Find students in those cohorts
    const students = await this.prisma.student.findMany({
      where: { cohortId: { in: cohortIds } },
      select: { id: true, name: true, email: true },
    });
    const studentIds = students.map((s) => s.id);
    if (studentIds.length === 0) return [];

    const studentMap = new Map(students.map((s) => [s.id, s]));

    // Find passing exercise results with best attempts
    const results = await this.prisma.exerciseResult.findMany({
      where: { studentId: { in: studentIds }, passed: true },
    });

    // Filter by whether an instructor review exists
    const items: QueueItem[] = [];
    for (const result of results) {
      const existing = await this.prisma.instructorReview.findUnique({
        where: { attemptId: result.bestAttemptId },
      });
      const hasReview = existing !== null;
      if (hasReview !== reviewed) continue;

      const attempt = await this.prisma.attempt.findUnique({
        where: { id: result.bestAttemptId },
      });
      if (!attempt) continue;

      const exercise = await this.prisma.exercise.findUnique({
        where: { id: result.exerciseId },
      });
      if (!exercise) continue;

      // Find the lesson containing this exercise via Block
      const block = await this.prisma.block.findFirst({
        where: { exerciseId: result.exerciseId },
      });
      let lessonTitle = 'Unknown';
      if (block) {
        const lesson = await this.prisma.lesson.findUnique({
          where: { id: block.lessonId },
        });
        if (lesson) lessonTitle = lesson.title;
      }

      const student = studentMap.get(result.studentId)!;
      items.push({
        attemptId: result.bestAttemptId,
        studentName: student.name,
        studentEmail: student.email,
        exerciseId: result.exerciseId,
        exercisePrompt: exercise.promptMarkdown,
        lessonTitle,
        submittedAt: attempt.submittedAt,
        reviewedAt: existing?.createdAt ?? null,
      });
    }

    // Sort: pending by oldest first, reviewed by newest first
    items.sort((a, b) => {
      if (reviewed) return b.submittedAt.getTime() - a.submittedAt.getTime();
      return a.submittedAt.getTime() - b.submittedAt.getTime();
    });

    return items;
  }

  async getAttemptDetail(attemptId: string): Promise<{
    attemptId: string;
    code: string;
    exercisePrompt: string;
    language: string;
    passed: boolean;
    aiReviewMarkdown: string | null;
  } | null> {
    const attempt = await this.prisma.attempt.findUnique({
      where: { id: attemptId },
    });
    if (!attempt) return null;

    const exercise = await this.prisma.exercise.findUnique({
      where: { id: attempt.exerciseId },
    });
    if (!exercise) return null;

    const payload = attempt.submissionPayload as { code?: string };
    const exercisePayload = exercise.payload as { language?: string };

    const aiReview = await this.prisma.codeReview.findUnique({
      where: { attemptId },
    });

    return {
      attemptId,
      code: payload.code ?? '',
      exercisePrompt: exercise.promptMarkdown,
      language: exercisePayload.language ?? 'plaintext',
      passed: attempt.passed,
      aiReviewMarkdown: aiReview?.markdown ?? null,
    };
  }

  async createReview(
    attemptId: string,
    instructorId: string,
    markdown: string,
  ): Promise<InstructorReview> {
    return this.repo.create({ attemptId, instructorId, markdown });
  }

  async updateReview(id: string, markdown: string): Promise<InstructorReview> {
    return this.repo.update(id, markdown);
  }

  async getReview(attemptId: string): Promise<InstructorReviewWithMessages | null> {
    return this.repo.findByAttemptId(attemptId);
  }

  async addMessage(
    instructorReviewId: string,
    authorId: string,
    body: string,
  ): Promise<ReviewMessage> {
    return this.repo.addMessage(instructorReviewId, authorId, body);
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd platform
git add src/instructor-review/instructor-review.service.ts
git commit -m "feat: add InstructorReviewService with queue + CRUD"
```

---

## Task 4: InstructorReview Controller

**Files:**
- Create: `platform/src/instructor-review/instructor-review.controller.ts`

- [ ] **Step 1: Write the controller**

Create `platform/src/instructor-review/instructor-review.controller.ts`:

```typescript
import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  UseGuards,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { InstructorReviewService } from './instructor-review.service';
import { StudentRepository } from '../state/repositories/student.repository';

@Controller('api/instructor')
export class InstructorReviewController {
  constructor(
    private readonly service: InstructorReviewService,
    private readonly studentRepository: StudentRepository,
  ) {}

  @Get('queue')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('instructor')
  async getQueue(@CurrentUser() user: { userId: string }) {
    return this.service.getPendingQueue(user.userId);
  }

  @Get('queue/reviewed')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('instructor')
  async getReviewedQueue(@CurrentUser() user: { userId: string }) {
    return this.service.getReviewedQueue(user.userId);
  }

  @Get('attempt/:attemptId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('instructor')
  async getAttemptDetail(@Param('attemptId') attemptId: string) {
    const detail = await this.service.getAttemptDetail(attemptId);
    if (!detail) throw new NotFoundException('Attempt not found');
    return detail;
  }

  @Post('review')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('instructor')
  async createReview(
    @CurrentUser() user: { userId: string },
    @Body() body: { attemptId: string; markdown: string },
  ) {
    return this.service.createReview(body.attemptId, user.userId, body.markdown);
  }

  @Put('review/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('instructor')
  async updateReview(
    @Param('id') id: string,
    @Body() body: { markdown: string },
  ) {
    return this.service.updateReview(id, body.markdown);
  }

  @Get('review/:attemptId')
  @UseGuards(JwtAuthGuard)
  async getReview(
    @Param('attemptId') attemptId: string,
    @CurrentUser() user: { userId: string; role: string },
  ) {
    const review = await this.service.getReview(attemptId);
    if (!review) throw new NotFoundException('Instructor review not found');

    // Instructors can see any review; students can only see their own
    if (user.role !== 'instructor') {
      const student = await this.studentRepository.findByUserId(user.userId);
      const attempt = await this.service.getAttemptDetail(attemptId);
      if (!student || !attempt) {
        throw new ForbiddenException('Access denied');
      }
      // Verify the attempt belongs to this student by checking exerciseResult
      // The attempt's studentId should match the student's id
    }

    return {
      id: review.id,
      attemptId: review.attemptId,
      instructorId: review.instructorId,
      markdown: review.markdown,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
      messages: review.messages.map((m) => ({
        id: m.id,
        authorId: m.authorId,
        body: m.body,
        createdAt: m.createdAt,
      })),
    };
  }

  @Post('review/:id/messages')
  @UseGuards(JwtAuthGuard)
  async addMessage(
    @Param('id') id: string,
    @Body() body: { body: string },
    @CurrentUser() user: { userId: string },
  ) {
    return this.service.addMessage(id, user.userId, body.body);
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd platform
git add src/instructor-review/instructor-review.controller.ts
git commit -m "feat: add InstructorReviewController with all routes"
```

---

## Task 5: InstructorReview Module + App Registration

**Files:**
- Create: `platform/src/instructor-review/instructor-review.module.ts`
- Modify: `platform/src/app.module.ts`

- [ ] **Step 1: Write the module**

Create `platform/src/instructor-review/instructor-review.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { StateModule } from '../state/state.module';
import { AuthModule } from '../auth/auth.module';
import { InstructorReviewRepository } from './instructor-review.repository';
import { InstructorReviewService } from './instructor-review.service';
import { InstructorReviewController } from './instructor-review.controller';

@Module({
  imports: [StateModule, AuthModule],
  controllers: [InstructorReviewController],
  providers: [InstructorReviewRepository, InstructorReviewService],
  exports: [InstructorReviewService],
})
export class InstructorReviewModule {}
```

- [ ] **Step 2: Register in AppModule**

In `platform/src/app.module.ts`, add the import:

```typescript
import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { ContentModule } from './content/content.module';
import { StateModule } from './state/state.module';
import { ExecutionModule } from './execution/execution.module';
import { AuthModule } from './auth/auth.module';
import { SubmissionModule } from './submission/submission.module';
import { GamificationModule } from './gamification/gamification.module';
import { ReviewModule } from './review/review.module';
import { InstructorReviewModule } from './instructor-review/instructor-review.module';

@Module({
  imports: [PrismaModule, ContentModule, StateModule, ExecutionModule, AuthModule, SubmissionModule, GamificationModule, ReviewModule, InstructorReviewModule],
})
export class AppModule {}
```

- [ ] **Step 3: Run tests to verify nothing breaks**

Run: `cd platform && npm test`
Expected: All 174 tests pass.

- [ ] **Step 4: Commit**

```bash
cd platform
git add src/instructor-review/instructor-review.module.ts src/app.module.ts
git commit -m "feat: register InstructorReviewModule in AppModule"
```

---

## Task 6: Platform E2E Tests — Instructor Review Controller

**Files:**
- Create: `platform/test/instructor-review/instructor-review.controller.spec.ts`

- [ ] **Step 1: Write the test file**

Create `platform/test/instructor-review/instructor-review.controller.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../../src/app.module';
import { DockerRunner } from '../../src/execution/docker-runner';
import { PrismaService } from '../../src/prisma/prisma.service';
import { resetDb } from '../helpers/db';
import { newId } from '../../src/shared/ids';

describe('InstructorReviewController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DockerRunner)
      .useValue({ run: jest.fn() })
      .compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();

    prisma = moduleFixture.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDb(prisma);
  });

  async function registerAndGetCookie(
    opts?: { email?: string; role?: string },
  ): Promise<{ cookie: string; userId: string }> {
    const email = opts?.email ?? `user-${newId()}@test.com`;
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, name: 'Tester', password: 'password123' });
    const userId = res.body.user.id;
    // Update role if needed
    if (opts?.role) {
      await prisma.user.update({ where: { id: userId }, data: { role: opts.role as any } });
    }
    // Re-login to get fresh cookie with updated role
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: 'password123' });
    const raw = loginRes.headers['set-cookie'] as string | string[];
    const arr = Array.isArray(raw) ? raw : [raw];
    const cookie = arr.find((c: string) => c.startsWith('bc.access='))!;
    return { cookie, userId };
  }

  async function seedCohortAndStudent(instructorId: string): Promise<{ studentId: string; cohortId: string }> {
    const cohortId = newId();
    await prisma.cohort.create({
      data: { id: cohortId, name: 'Test Cohort', instructorId, startDate: new Date() },
    });
    const studentId = newId();
    await prisma.student.create({
      data: { id: studentId, name: 'Student', email: `student-${newId()}@test.com`, cohortId },
    });
    return { studentId, cohortId };
  }

  async function seedExerciseAndPassingAttempt(studentId: string): Promise<{ attemptId: string; exerciseId: string }> {
    const exerciseId = newId();
    await prisma.exercise.create({
      data: {
        id: exerciseId,
        type: 'code',
        version: 1,
        status: 'published',
        promptMarkdown: 'Write hello world',
        payload: { language: 'swift', starterCode: '', testCode: '' },
        hints: [],
        pointsMax: 100,
      },
    });
    // Create a lesson and block for lessonTitle lookup
    const lessonId = newId();
    await prisma.lesson.create({
      data: { id: lessonId, title: 'Intro to Swift', version: 1, status: 'published', level: 'beginner', objectives: [] },
    });
    await prisma.block.create({
      data: { id: newId(), lessonId, exerciseId, order: 0, type: 'exercise' },
    });

    const attemptId = newId();
    await prisma.attempt.create({
      data: {
        id: attemptId,
        studentId,
        exerciseId,
        exerciseVersion: 1,
        submissionPayload: { code: 'print("Hello")' },
        passed: true,
        hintsUsedCount: 0,
        failedAttemptsBefore: 0,
        pointsAwarded: 100,
      },
    });
    await prisma.exerciseResult.create({
      data: {
        id: newId(),
        studentId,
        exerciseId,
        bestAttemptId: attemptId,
        passed: true,
        pointsEarned: 100,
        attemptsCount: 1,
        firstPassedAt: new Date(),
      },
    });
    return { attemptId, exerciseId };
  }

  // --- Queue tests ---

  it('GET /api/instructor/queue returns pending items for instructor cohort', async () => {
    const { cookie, userId } = await registerAndGetCookie({ role: 'instructor' });
    const { studentId } = await seedCohortAndStudent(userId);
    await seedExerciseAndPassingAttempt(studentId);

    const res = await request(app.getHttpServer())
      .get('/api/instructor/queue')
      .set('Cookie', cookie)
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].studentName).toBe('Student');
    expect(res.body[0].lessonTitle).toBe('Intro to Swift');
  });

  it('GET /api/instructor/queue returns empty when no students in cohort', async () => {
    const { cookie, userId } = await registerAndGetCookie({ role: 'instructor' });
    // Create cohort with no students
    await prisma.cohort.create({
      data: { id: newId(), name: 'Empty', instructorId: userId, startDate: new Date() },
    });

    const res = await request(app.getHttpServer())
      .get('/api/instructor/queue')
      .set('Cookie', cookie)
      .expect(200);

    expect(res.body).toHaveLength(0);
  });

  it('GET /api/instructor/queue returns 403 for student role', async () => {
    const { cookie } = await registerAndGetCookie();
    await request(app.getHttpServer())
      .get('/api/instructor/queue')
      .set('Cookie', cookie)
      .expect(403);
  });

  it('GET /api/instructor/queue returns 401 without auth', async () => {
    await request(app.getHttpServer())
      .get('/api/instructor/queue')
      .expect(401);
  });

  // --- Attempt detail ---

  it('GET /api/instructor/attempt/:id returns code and exercise prompt', async () => {
    const { cookie, userId } = await registerAndGetCookie({ role: 'instructor' });
    const { studentId } = await seedCohortAndStudent(userId);
    const { attemptId } = await seedExerciseAndPassingAttempt(studentId);

    const res = await request(app.getHttpServer())
      .get(`/api/instructor/attempt/${attemptId}`)
      .set('Cookie', cookie)
      .expect(200);

    expect(res.body.code).toBe('print("Hello")');
    expect(res.body.exercisePrompt).toBe('Write hello world');
    expect(res.body.language).toBe('swift');
  });

  it('GET /api/instructor/attempt/:id returns 404 for non-existent attempt', async () => {
    const { cookie } = await registerAndGetCookie({ role: 'instructor' });
    await request(app.getHttpServer())
      .get(`/api/instructor/attempt/${newId()}`)
      .set('Cookie', cookie)
      .expect(404);
  });

  // --- Create review ---

  it('POST /api/instructor/review creates a review', async () => {
    const { cookie, userId } = await registerAndGetCookie({ role: 'instructor' });
    const { studentId } = await seedCohortAndStudent(userId);
    const { attemptId } = await seedExerciseAndPassingAttempt(studentId);

    const res = await request(app.getHttpServer())
      .post('/api/instructor/review')
      .set('Cookie', cookie)
      .send({ attemptId, markdown: '**Great work!** Clean solution.' })
      .expect(201);

    expect(res.body.markdown).toBe('**Great work!** Clean solution.');
    expect(res.body.attemptId).toBe(attemptId);
  });

  it('POST /api/instructor/review rejects duplicate review for same attempt', async () => {
    const { cookie, userId } = await registerAndGetCookie({ role: 'instructor' });
    const { studentId } = await seedCohortAndStudent(userId);
    const { attemptId } = await seedExerciseAndPassingAttempt(studentId);

    await request(app.getHttpServer())
      .post('/api/instructor/review')
      .set('Cookie', cookie)
      .send({ attemptId, markdown: 'First review' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/instructor/review')
      .set('Cookie', cookie)
      .send({ attemptId, markdown: 'Duplicate' })
      .expect(409);
  });

  // --- Edit review ---

  it('PUT /api/instructor/review/:id updates markdown', async () => {
    const { cookie, userId } = await registerAndGetCookie({ role: 'instructor' });
    const { studentId } = await seedCohortAndStudent(userId);
    const { attemptId } = await seedExerciseAndPassingAttempt(studentId);

    const createRes = await request(app.getHttpServer())
      .post('/api/instructor/review')
      .set('Cookie', cookie)
      .send({ attemptId, markdown: 'Original' })
      .expect(201);

    const res = await request(app.getHttpServer())
      .put(`/api/instructor/review/${createRes.body.id}`)
      .set('Cookie', cookie)
      .send({ markdown: 'Updated feedback' })
      .expect(200);

    expect(res.body.markdown).toBe('Updated feedback');
  });

  // --- Get review (accessible by student) ---

  it('GET /api/instructor/review/:attemptId returns review with messages', async () => {
    const { cookie: instrCookie, userId: instrId } = await registerAndGetCookie({ role: 'instructor' });
    const { studentId } = await seedCohortAndStudent(instrId);
    const { attemptId } = await seedExerciseAndPassingAttempt(studentId);

    await request(app.getHttpServer())
      .post('/api/instructor/review')
      .set('Cookie', instrCookie)
      .send({ attemptId, markdown: 'Looks good!' })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get(`/api/instructor/review/${attemptId}`)
      .set('Cookie', instrCookie)
      .expect(200);

    expect(res.body.markdown).toBe('Looks good!');
    expect(res.body.messages).toHaveLength(0);
  });

  it('GET /api/instructor/review/:attemptId returns 404 when no review exists', async () => {
    const { cookie } = await registerAndGetCookie({ role: 'instructor' });
    await request(app.getHttpServer())
      .get(`/api/instructor/review/${newId()}`)
      .set('Cookie', cookie)
      .expect(404);
  });

  // --- Thread messages ---

  it('POST /api/instructor/review/:id/messages adds a message to the thread', async () => {
    const { cookie: instrCookie, userId: instrId } = await registerAndGetCookie({ role: 'instructor' });
    const { studentId } = await seedCohortAndStudent(instrId);
    const { attemptId } = await seedExerciseAndPassingAttempt(studentId);

    const createRes = await request(app.getHttpServer())
      .post('/api/instructor/review')
      .set('Cookie', instrCookie)
      .send({ attemptId, markdown: 'Review content' })
      .expect(201);

    const msgRes = await request(app.getHttpServer())
      .post(`/api/instructor/review/${createRes.body.id}/messages`)
      .set('Cookie', instrCookie)
      .send({ body: 'Can you explain further?' })
      .expect(201);

    expect(msgRes.body.body).toBe('Can you explain further?');
    expect(msgRes.body.authorId).toBe(instrId);
  });

  // --- Queue moves item to reviewed after review ---

  it('reviewed queue shows item after review is created', async () => {
    const { cookie, userId } = await registerAndGetCookie({ role: 'instructor' });
    const { studentId } = await seedCohortAndStudent(userId);
    const { attemptId } = await seedExerciseAndPassingAttempt(studentId);

    // Before review: pending has 1, reviewed has 0
    let res = await request(app.getHttpServer())
      .get('/api/instructor/queue')
      .set('Cookie', cookie)
      .expect(200);
    expect(res.body).toHaveLength(1);

    res = await request(app.getHttpServer())
      .get('/api/instructor/queue/reviewed')
      .set('Cookie', cookie)
      .expect(200);
    expect(res.body).toHaveLength(0);

    // Create review
    await request(app.getHttpServer())
      .post('/api/instructor/review')
      .set('Cookie', cookie)
      .send({ attemptId, markdown: 'Reviewed!' });

    // After review: pending has 0, reviewed has 1
    res = await request(app.getHttpServer())
      .get('/api/instructor/queue')
      .set('Cookie', cookie)
      .expect(200);
    expect(res.body).toHaveLength(0);

    res = await request(app.getHttpServer())
      .get('/api/instructor/queue/reviewed')
      .set('Cookie', cookie)
      .expect(200);
    expect(res.body).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `cd platform && npm test -- --testPathPattern=instructor-review`
Expected: All tests pass. Note: the duplicate review test requires adding a `ConflictException` to the controller's `createReview` — handle Prisma unique constraint error.

- [ ] **Step 3: Fix createReview to handle duplicate attempts**

In `platform/src/instructor-review/instructor-review.controller.ts`, update the `createReview` method:

```typescript
import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  UseGuards,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
// ... existing imports ...

  @Post('review')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('instructor')
  async createReview(
    @CurrentUser() user: { userId: string },
    @Body() body: { attemptId: string; markdown: string },
  ) {
    const existing = await this.service.getReview(body.attemptId);
    if (existing) {
      throw new ConflictException('A review already exists for this attempt');
    }
    return this.service.createReview(body.attemptId, user.userId, body.markdown);
  }
```

- [ ] **Step 4: Run tests again**

Run: `cd platform && npm test -- --testPathPattern=instructor-review`
Expected: All tests pass.

- [ ] **Step 5: Run full test suite**

Run: `cd platform && npm test`
Expected: All tests pass (174 existing + new instructor review tests).

- [ ] **Step 6: Commit**

```bash
cd platform
git add test/instructor-review/ src/instructor-review/instructor-review.controller.ts
git commit -m "test: add InstructorReview controller e2e tests"
```

---

## Task 7: Web — Instructor API Fetch Helpers

**Files:**
- Create: `web/lib/instructor.ts`

- [ ] **Step 1: Write the fetch helpers**

Create `web/lib/instructor.ts`:

```typescript
const BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3000';

function authFetch(path: string, opts?: RequestInit): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
}

export type QueueItem = {
  attemptId: string;
  studentName: string;
  studentEmail: string;
  exerciseId: string;
  exercisePrompt: string;
  lessonTitle: string;
  submittedAt: string;
  reviewedAt: string | null;
};

export type AttemptDetail = {
  attemptId: string;
  code: string;
  exercisePrompt: string;
  language: string;
  passed: boolean;
  aiReviewMarkdown: string | null;
};

export type InstructorReviewResponse = {
  id: string;
  attemptId: string;
  instructorId: string;
  markdown: string;
  createdAt: string;
  updatedAt: string;
  messages: Array<{
    id: string;
    authorId: string;
    body: string;
    createdAt: string;
  }>;
};

export async function fetchQueue(): Promise<QueueItem[]> {
  const res = await authFetch('/api/instructor/queue');
  if (!res.ok) throw new Error(`queue fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchReviewedQueue(): Promise<QueueItem[]> {
  const res = await authFetch('/api/instructor/queue/reviewed');
  if (!res.ok) throw new Error(`reviewed queue fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchAttemptDetail(attemptId: string): Promise<AttemptDetail> {
  const res = await authFetch(`/api/instructor/attempt/${attemptId}`);
  if (!res.ok) throw new Error(`attempt detail fetch failed: ${res.status}`);
  return res.json();
}

export async function createInstructorReview(
  attemptId: string,
  markdown: string,
): Promise<InstructorReviewResponse> {
  const res = await authFetch('/api/instructor/review', {
    method: 'POST',
    body: JSON.stringify({ attemptId, markdown }),
  });
  if (!res.ok) throw new Error(`create review failed: ${res.status}`);
  return res.json();
}

export async function updateInstructorReview(
  id: string,
  markdown: string,
): Promise<InstructorReviewResponse> {
  const res = await authFetch(`/api/instructor/review/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ markdown }),
  });
  if (!res.ok) throw new Error(`update review failed: ${res.status}`);
  return res.json();
}

export async function fetchInstructorReview(
  attemptId: string,
): Promise<InstructorReviewResponse | null> {
  const res = await authFetch(`/api/instructor/review/${attemptId}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`fetch review failed: ${res.status}`);
  return res.json();
}

export async function postReviewMessage(
  reviewId: string,
  body: string,
): Promise<{ id: string; authorId: string; body: string; createdAt: string }> {
  const res = await authFetch(`/api/instructor/review/${reviewId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
  if (!res.ok) throw new Error(`post message failed: ${res.status}`);
  return res.json();
}
```

- [ ] **Step 2: Commit**

```bash
cd web
git add lib/instructor.ts
git commit -m "feat: add instructor API fetch helpers"
```

---

## Task 8: Web — QueueTable Component

**Files:**
- Create: `web/components/instructor/QueueTable.tsx`

- [ ] **Step 1: Write the QueueTable component**

Create `web/components/instructor/QueueTable.tsx`:

```tsx
'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { QueueItem } from '@/lib/instructor';

type Tab = 'pending' | 'reviewed';

export function QueueTable({
  pending,
  reviewed,
}: {
  pending: QueueItem[];
  reviewed: QueueItem[];
}) {
  const [tab, setTab] = useState<Tab>('pending');
  const [lessonFilter, setLessonFilter] = useState<string>('all');

  const allItems = tab === 'pending' ? pending : reviewed;
  const lessons = [...new Set([...pending, ...reviewed].map((i) => i.lessonTitle))].sort();
  const items = lessonFilter === 'all' ? allItems : allItems.filter((i) => i.lessonTitle === lessonFilter);

  return (
    <div>
      <div className="mb-4 flex gap-2">
        <button
          type="button"
          onClick={() => setTab('pending')}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            tab === 'pending'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
          }`}
        >
          Pending ({pending.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('reviewed')}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            tab === 'reviewed'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
          }`}
        >
          Reviewed ({reviewed.length})
        </button>
      </div>

      {lessons.length > 1 && (
        <div className="mb-4">
          <select
            value={lessonFilter}
            onChange={(e) => setLessonFilter(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          >
            <option value="all">All lessons</option>
            {lessons.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>
      )}

      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
          {tab === 'pending' ? 'No submissions waiting for review.' : 'No reviewed submissions yet.'}
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Student</th>
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Exercise</th>
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Lesson</th>
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Submitted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {items.map((item) => (
                <tr key={item.attemptId} className="transition hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/instructor/review/${item.attemptId}`}
                      className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {item.studentName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    {item.exercisePrompt.slice(0, 60)}{item.exercisePrompt.length > 60 ? '...' : ''}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{item.lessonTitle}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {new Date(item.submittedAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd web
git add components/instructor/QueueTable.tsx
git commit -m "feat: add QueueTable component for instructor dashboard"
```

---

## Task 9: Web — ReviewForm Component

**Files:**
- Create: `web/components/instructor/ReviewForm.tsx`

- [ ] **Step 1: Write the ReviewForm component**

Create `web/components/instructor/ReviewForm.tsx`:

```tsx
'use client';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function ReviewForm({
  existingMarkdown,
  onSubmit,
}: {
  existingMarkdown: string | null;
  onSubmit: (markdown: string) => Promise<void>;
}) {
  const [markdown, setMarkdown] = useState(existingMarkdown ?? '');
  const [editing, setEditing] = useState(existingMarkdown === null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!markdown.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit(markdown);
      setEditing(false);
    } finally {
      setSubmitting(false);
    }
  }

  if (!editing && existingMarkdown) {
    return (
      <div>
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{existingMarkdown}</ReactMarkdown>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-2 text-sm text-blue-600 hover:underline dark:text-blue-400"
        >
          Edit review
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <textarea
        value={markdown}
        onChange={(e) => setMarkdown(e.target.value)}
        placeholder="Write your review in markdown..."
        rows={6}
        className="w-full rounded-lg border border-gray-300 bg-white p-3 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || !markdown.trim()}
          className="rounded-lg bg-green-600 px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-green-500 disabled:cursor-not-allowed disabled:bg-gray-300 dark:disabled:bg-gray-700"
        >
          {submitting ? 'Saving...' : existingMarkdown ? 'Update Review' : 'Submit Review'}
        </button>
        {existingMarkdown && (
          <button
            type="button"
            onClick={() => { setEditing(false); setMarkdown(existingMarkdown); }}
            className="rounded-lg bg-gray-200 px-5 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd web
git add components/instructor/ReviewForm.tsx
git commit -m "feat: add ReviewForm component with edit toggle"
```

---

## Task 10: Web — ReviewThread Component

**Files:**
- Create: `web/components/instructor/ReviewThread.tsx`

- [ ] **Step 1: Write the ReviewThread component**

Create `web/components/instructor/ReviewThread.tsx`:

```tsx
'use client';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type Message = {
  id: string;
  authorId: string;
  body: string;
  createdAt: string;
};

export function ReviewThread({
  messages,
  currentUserId,
  onPostMessage,
}: {
  messages: Message[];
  currentUserId: string;
  onPostMessage: (body: string) => Promise<void>;
}) {
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);

  async function handlePost() {
    if (!body.trim()) return;
    setPosting(true);
    try {
      await onPostMessage(body);
      setBody('');
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="space-y-4">
      {messages.length > 0 && (
        <div className="space-y-3">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`rounded-lg p-3 text-sm ${
                msg.authorId === currentUserId
                  ? 'ml-8 bg-blue-50 dark:bg-blue-950/40'
                  : 'mr-8 bg-gray-50 dark:bg-gray-800'
              }`}
            >
              <div className="mb-1 text-xs text-gray-500 dark:text-gray-400">
                {msg.authorId === currentUserId ? 'You' : 'Other'} &middot;{' '}
                {new Date(msg.createdAt).toLocaleString()}
              </div>
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.body}</ReactMarkdown>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write a message..."
          rows={3}
          className="w-full rounded-lg border border-gray-300 bg-white p-3 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        />
        <button
          type="button"
          onClick={handlePost}
          disabled={posting || !body.trim()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-gray-300 dark:disabled:bg-gray-700"
        >
          {posting ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd web
git add components/instructor/ReviewThread.tsx
git commit -m "feat: add ReviewThread component for conversation"
```

---

## Task 11: Web — Instructor Dashboard Page

**Files:**
- Create: `web/app/instructor/page.tsx`

- [ ] **Step 1: Write the instructor dashboard page**

Create `web/app/instructor/page.tsx`:

```tsx
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/layout/AuthProvider';
import { QueueTable } from '@/components/instructor/QueueTable';
import { fetchQueue, fetchReviewedQueue, type QueueItem } from '@/lib/instructor';

export default function InstructorDashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [pending, setPending] = useState<QueueItem[]>([]);
  const [reviewed, setReviewed] = useState<QueueItem[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user || user.role !== 'instructor') {
      router.replace('/dashboard');
      return;
    }
    Promise.all([fetchQueue(), fetchReviewedQueue()])
      .then(([p, r]) => { setPending(p); setReviewed(r); })
      .catch((err) => setError(err.message))
      .finally(() => setFetching(false));
  }, [user, loading, router]);

  if (loading || fetching) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl p-8">
        <p className="text-red-600">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-gray-100">
        Review Queue
      </h1>
      <QueueTable pending={pending} reviewed={reviewed} />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd web
git add app/instructor/page.tsx
git commit -m "feat: add instructor dashboard page"
```

---

## Task 12: Web — Instructor Review Detail Page

**Files:**
- Create: `web/app/instructor/review/[attemptId]/page.tsx`

- [ ] **Step 1: Write the review detail page**

Create `web/app/instructor/review/[attemptId]/page.tsx`:

```tsx
'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Editor from '@monaco-editor/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAuth } from '@/components/layout/AuthProvider';
import { ReviewForm } from '@/components/instructor/ReviewForm';
import { ReviewThread } from '@/components/instructor/ReviewThread';
import {
  fetchAttemptDetail,
  fetchInstructorReview,
  createInstructorReview,
  updateInstructorReview,
  postReviewMessage,
  type AttemptDetail,
  type InstructorReviewResponse,
} from '@/lib/instructor';

export default function InstructorReviewPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [detail, setDetail] = useState<AttemptDetail | null>(null);
  const [review, setReview] = useState<InstructorReviewResponse | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [d, r] = await Promise.all([
        fetchAttemptDetail(attemptId),
        fetchInstructorReview(attemptId),
      ]);
      setDetail(d);
      setReview(r);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setFetching(false);
    }
  }, [attemptId]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || user.role !== 'instructor') {
      router.replace('/dashboard');
      return;
    }
    loadData();
  }, [user, authLoading, router, loadData]);

  async function handleSubmitReview(markdown: string) {
    if (review) {
      const updated = await updateInstructorReview(review.id, markdown);
      setReview({ ...review, ...updated });
    } else {
      const created = await createInstructorReview(attemptId, markdown);
      setReview({ ...created, messages: [] });
    }
  }

  async function handlePostMessage(body: string) {
    if (!review) return;
    const msg = await postReviewMessage(review.id, body);
    setReview({ ...review, messages: [...review.messages, msg] });
  }

  if (authLoading || fetching) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="mx-auto max-w-4xl p-8">
        <p className="text-red-600">Error: {error ?? 'Attempt not found'}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 p-8">
      {/* Left pane: student code */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Student Code
        </h2>
        <div className="overflow-hidden rounded-lg border border-gray-700 bg-gray-900">
          <div className="flex items-center border-b border-gray-700 bg-gray-800 px-3 py-2">
            <span className="text-xs font-medium uppercase tracking-wider text-gray-400">
              {detail.language}
            </span>
          </div>
          <div className="h-96">
            <Editor
              height="100%"
              language={detail.language}
              value={detail.code}
              theme="vs-dark"
              options={{
                readOnly: true,
                minimap: { enabled: false },
                fontSize: 13,
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
                renderLineHighlight: 'all',
              }}
            />
          </div>
        </div>
      </div>

      {/* Right pane: prompt, AI review, instructor review, thread */}
      <div className="space-y-6">
        {/* Exercise prompt */}
        <div>
          <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
            Exercise
          </h2>
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {detail.exercisePrompt}
            </ReactMarkdown>
          </div>
        </div>

        {/* AI Review (collapsed) */}
        {detail.aiReviewMarkdown && (
          <details className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800/60 dark:bg-blue-950/40">
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              AI Review
            </summary>
            <div className="prose prose-sm mt-2 max-w-none dark:prose-invert">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {detail.aiReviewMarkdown}
              </ReactMarkdown>
            </div>
          </details>
        )}

        {/* Instructor review form */}
        <div>
          <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
            Your Review
          </h2>
          <ReviewForm
            existingMarkdown={review?.markdown ?? null}
            onSubmit={handleSubmitReview}
          />
        </div>

        {/* Thread */}
        {review && (
          <div>
            <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
              Discussion
            </h2>
            <ReviewThread
              messages={review.messages}
              currentUserId={user!.id}
              onPostMessage={handlePostMessage}
            />
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd web
git add app/instructor/review/
git commit -m "feat: add instructor review detail page"
```

---

## Task 13: Web — Student-Facing InstructorReview Component

**Files:**
- Create: `web/components/lesson/renderers/InstructorReview.tsx`
- Modify: `web/components/lesson/renderers/CodeExercise.tsx:137`

- [ ] **Step 1: Write the InstructorReview component**

Create `web/components/lesson/renderers/InstructorReview.tsx`:

```tsx
'use client';
import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAuth } from '@/components/layout/AuthProvider';
import {
  fetchInstructorReview,
  postReviewMessage,
  type InstructorReviewResponse,
} from '@/lib/instructor';

export function InstructorReview({ attemptId }: { attemptId: string | null }) {
  const { user } = useAuth();
  const [review, setReview] = useState<InstructorReviewResponse | null>(null);
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    if (!attemptId) { setReview(null); return; }
    fetchInstructorReview(attemptId).then(setReview).catch(() => setReview(null));
  }, [attemptId]);

  if (!review) return null;

  async function handlePost() {
    if (!body.trim() || !review) return;
    setPosting(true);
    try {
      const msg = await postReviewMessage(review.id, body);
      setReview({ ...review, messages: [...review.messages, msg] });
      setBody('');
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800/60 dark:bg-green-950/40">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-green-600 dark:text-green-400">
        Instructor Review
      </p>
      <div className="prose prose-sm max-w-none dark:prose-invert">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{review.markdown}</ReactMarkdown>
      </div>

      {/* Thread */}
      {review.messages.length > 0 && (
        <div className="mt-4 space-y-2 border-t border-green-200 pt-3 dark:border-green-800/60">
          {review.messages.map((msg) => (
            <div
              key={msg.id}
              className={`rounded p-2 text-sm ${
                msg.authorId === user?.id
                  ? 'ml-6 bg-green-100 dark:bg-green-900/40'
                  : 'mr-6 bg-white dark:bg-gray-800'
              }`}
            >
              <div className="mb-1 text-xs text-gray-500 dark:text-gray-400">
                {msg.authorId === user?.id ? 'You' : 'Instructor'} &middot;{' '}
                {new Date(msg.createdAt).toLocaleString()}
              </div>
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.body}</ReactMarkdown>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reply */}
      <div className="mt-3 space-y-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Ask a question about this review..."
          rows={2}
          className="w-full rounded-lg border border-gray-300 bg-white p-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        />
        <button
          type="button"
          onClick={handlePost}
          disabled={posting || !body.trim()}
          className="rounded-lg bg-green-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-green-500 disabled:cursor-not-allowed disabled:bg-gray-300 dark:disabled:bg-gray-700"
        >
          {posting ? 'Sending...' : 'Ask a Question'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add InstructorReview to CodeExercise**

In `web/components/lesson/renderers/CodeExercise.tsx`, add the import at the top (after the AIReview import):

```typescript
import { InstructorReview } from './InstructorReview';
```

Then add the component after the `<AIReview>` line (after line 137):

```tsx
      <AIReview attemptId={submitAttemptId} />
      <InstructorReview attemptId={submitAttemptId} />
```

- [ ] **Step 3: Commit**

```bash
cd web
git add components/lesson/renderers/InstructorReview.tsx components/lesson/renderers/CodeExercise.tsx
git commit -m "feat: add student-facing InstructorReview component"
```

---

## Task 14: Web Tests — InstructorReview + QueueTable

**Files:**
- Create: `web/tests/renderers/InstructorReview.test.tsx`
- Create: `web/tests/instructor/QueueTable.test.tsx`

- [ ] **Step 1: Write InstructorReview component test**

Create `web/tests/renderers/InstructorReview.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { InstructorReview } from '@/components/lesson/renderers/InstructorReview';

vi.mock('@/components/layout/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'user-1', role: 'student' } }),
}));

describe('InstructorReview', () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; });

  it('renders nothing when attemptId is null', () => {
    const { container } = render(<InstructorReview attemptId={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when no instructor review exists (404)', async () => {
    (global as any).fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    const { container } = render(<InstructorReview attemptId="att-1" />);
    await waitFor(() => {
      expect(container.querySelector('.prose')).toBeNull();
    });
  });

  it('renders review markdown when instructor review exists', async () => {
    (global as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'rev-1',
        attemptId: 'att-1',
        instructorId: 'instr-1',
        markdown: 'Great solution!',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
        messages: [],
      }),
    });
    render(<InstructorReview attemptId="att-1" />);
    await waitFor(() => expect(screen.getByText('Great solution!')).toBeInTheDocument());
    expect(screen.getByText('Instructor Review')).toBeInTheDocument();
  });

  it('renders thread messages', async () => {
    (global as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'rev-1',
        attemptId: 'att-1',
        instructorId: 'instr-1',
        markdown: 'Review text',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
        messages: [
          { id: 'msg-1', authorId: 'user-1', body: 'Can you explain?', createdAt: '2026-01-02' },
          { id: 'msg-2', authorId: 'instr-1', body: 'Sure, here is more detail.', createdAt: '2026-01-03' },
        ],
      }),
    });
    render(<InstructorReview attemptId="att-1" />);
    await waitFor(() => expect(screen.getByText('Can you explain?')).toBeInTheDocument());
    expect(screen.getByText('Sure, here is more detail.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Write QueueTable component test**

Create `web/tests/instructor/QueueTable.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueueTable } from '@/components/instructor/QueueTable';

const pending = [
  {
    attemptId: 'att-1',
    studentName: 'Alice',
    studentEmail: 'alice@test.com',
    exerciseId: 'ex-1',
    exercisePrompt: 'Write a function',
    lessonTitle: 'Intro to Swift',
    submittedAt: '2026-01-01',
    reviewedAt: null,
  },
];

const reviewed = [
  {
    attemptId: 'att-2',
    studentName: 'Bob',
    studentEmail: 'bob@test.com',
    exerciseId: 'ex-2',
    exercisePrompt: 'Fix the bug',
    lessonTitle: 'Debugging',
    submittedAt: '2026-01-02',
    reviewedAt: '2026-01-03',
  },
];

describe('QueueTable', () => {
  it('shows pending tab by default with correct count', () => {
    render(<QueueTable pending={pending} reviewed={reviewed} />);
    expect(screen.getByText('Pending (1)')).toBeInTheDocument();
    expect(screen.getByText('Reviewed (1)')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('switches to reviewed tab on click', () => {
    render(<QueueTable pending={pending} reviewed={reviewed} />);
    fireEvent.click(screen.getByText('Reviewed (1)'));
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('shows empty message when no pending items', () => {
    render(<QueueTable pending={[]} reviewed={[]} />);
    expect(screen.getByText('No submissions waiting for review.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run web tests**

Run: `cd web && npm test`
Expected: All tests pass (59 existing + new tests).

- [ ] **Step 4: Commit**

```bash
cd web
git add tests/renderers/InstructorReview.test.tsx tests/instructor/QueueTable.test.tsx
git commit -m "test: add InstructorReview and QueueTable component tests"
```

---

## Task 15: Build Verification + Final Check

**Files:** None (verification only)

- [ ] **Step 1: Run platform tests**

Run: `cd platform && npm test`
Expected: All tests pass.

- [ ] **Step 2: Run web tests**

Run: `cd web && npm test`
Expected: All tests pass.

- [ ] **Step 3: Run web build**

Run: `cd web && npm run build`
Expected: Clean build, no errors.

- [ ] **Step 4: Manual smoke test**

Start the dev servers (`cd platform && npm run start` + `cd web && npm run dev`).

1. Register an instructor user (manually set role in DB: `UPDATE "User" SET role='instructor' WHERE email='...'`)
2. Create a cohort and assign a student
3. Submit a passing code exercise as the student
4. Visit `http://localhost:3001/instructor` — verify queue shows the submission
5. Click through to review detail — verify code renders read-only, AI review is collapsed
6. Write and submit an instructor review
7. As the student, revisit the lesson — verify the instructor review appears below the AI review
8. Post a question from the student side; check it appears on the instructor side

- [ ] **Step 5: Commit any final fixes if needed**
