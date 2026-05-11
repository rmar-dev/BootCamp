import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import {
  SEED_TRACK_ID,
  SEED_LESSON_ID,
  SEED_EX_MC_ID,
  SEED_EX_FILL_ID,
  SEED_EX_PREDICT_ID,
  SEED_EX_CODE_ID,
  SEED_EX_FIXBUG_ID,
  SEED_BLOCK_INTRO_ID,
  SEED_BLOCK_MC_ID,
  SEED_BLOCK_VARIABLES_ID,
  SEED_BLOCK_FILL_ID,
  SEED_BLOCK_PREDICT_ID,
  SEED_BLOCK_CODE_ID,
  SEED_BLOCK_FIXBUG_ID,
  SEED_EX_KOTLIN_CODE_ID,
  SEED_BLOCK_KOTLIN_CODE_ID,
} from './seed-ids';

const prisma = new PrismaClient();

async function main() {
  const now = new Date();

  // ---------------------------------------------------------------------------
  // Test users (dev-only — email/password shown on the login page)
  // ---------------------------------------------------------------------------

  const studentHash = await bcrypt.hash('test1234', 10);
  await prisma.user.upsert({
    where: { email: 'student@bootcamp.dev' },
    update: {},
    create: {
      id: '99999999-9999-4999-8999-999999999999',
      email: 'student@bootcamp.dev',
      name: 'Test Student',
      passwordHash: studentHash,
      role: 'student',
    },
  });

  const instructorHash = await bcrypt.hash('test1234', 10);
  await prisma.user.upsert({
    where: { email: 'instructor@bootcamp.dev' },
    update: {},
    create: {
      id: '88888888-8888-4888-8888-888888888888',
      email: 'instructor@bootcamp.dev',
      name: 'Test Instructor',
      passwordHash: instructorHash,
      role: 'instructor',
    },
  });

  // Test Admin — needed to demo admin-only paths (reassigning students across
  // instructors, editing/deleting other instructors' skill trees, seeing
  // every cohort in the picker instead of just the caller's, deleting
  // anyone's project ratings, etc.). Password matches the other test users.
  const adminHash = await bcrypt.hash('test1234', 10);
  await prisma.user.upsert({
    where: { email: 'admin@bootcamp.dev' },
    update: {},
    create: {
      id: '11111111-1111-4111-8111-111111111111',
      email: 'admin@bootcamp.dev',
      name: 'Test Admin',
      passwordHash: adminHash,
      role: 'admin',
    },
  });

  // ---------------------------------------------------------------------------
  // Dev cohort + student enrollment so the instructor pages have something
  // to render. Without this, /instructor/students is empty and the skill-
  // tree composer's cohort picker shows "no cohorts available".
  // ---------------------------------------------------------------------------

  const TEST_COHORT_ID = '77777777-7777-4777-8777-777777777777';
  await prisma.cohort.upsert({
    where: { id: TEST_COHORT_ID },
    update: {},
    create: {
      id: TEST_COHORT_ID,
      name: 'Dev Cohort (Spring 2026)',
      instructorId: '88888888-8888-4888-8888-888888888888', // Test Instructor
      startDate: now,
      cohortLength: 'four_week',
      exercisesPerLessonTarget: 4,
    },
  });

  // Test Student joins the dev cohort and is assigned to the test
  // instructor. Both fields are independent: cohortId is the cohort the
  // student belongs to; instructorId is their personal mentor (defaults to
  // the cohort lead but is a separate per-student assignment).
  await prisma.student.upsert({
    where: { id: '99999999-9999-4999-8999-999999999999' },
    update: { cohortId: TEST_COHORT_ID, instructorId: '88888888-8888-4888-8888-888888888888' },
    create: {
      id: '99999999-9999-4999-8999-999999999999',
      userId: '99999999-9999-4999-8999-999999999999',
      name: 'Test Student',
      email: 'student@bootcamp.dev',
      cohortId: TEST_COHORT_ID,
      instructorId: '88888888-8888-4888-8888-888888888888',
    },
  });

  // Enroll the test student in the Kotlin placeholder track so the
  // instructor-side student detail page has a track row to render. Without
  // an enrollment, composeTrackContext returns [] and the skill-tree section
  // shows only the "Not enrolled in any tracks" empty state — so the cohort
  // and per-student override pickers never appear. The placeholder track is
  // already published below and has zero lessons, which is fine for
  // exercising the assignment UI.
  const KOTLIN_PLACEHOLDER_TRACK_ID = '33333333-3333-4333-8333-333333333333';
  const TEST_ENROLLMENT_ID = '66666666-6666-4666-8666-666666666666';
  await prisma.enrollment.upsert({
    where: {
      studentId_trackId: {
        studentId: '99999999-9999-4999-8999-999999999999',
        trackId: KOTLIN_PLACEHOLDER_TRACK_ID,
      },
    },
    update: {},
    create: {
      id: TEST_ENROLLMENT_ID,
      studentId: '99999999-9999-4999-8999-999999999999',
      trackId: KOTLIN_PLACEHOLDER_TRACK_ID,
      trackVersion: 1,
      assignedLevel: 'beginner',
      status: 'active',
    },
  });

  // ---------------------------------------------------------------------------
  // Exercises (upsert by composite PK id + version)
  // ---------------------------------------------------------------------------

  // 1. multiple_choice
  await prisma.exercise.upsert({
    where: { id_version: { id: SEED_EX_MC_ID, version: 1 } },
    update: {},
    create: {
      id: SEED_EX_MC_ID,
      version: 1,
      lessonId: SEED_LESSON_ID,
      promptMarkdown: 'Which language are you learning?',
      type: 'multiple_choice',
      payload: {
        type: 'multiple_choice',
        questionMarkdown: 'Which language are you learning?',
        options: [
          { id: 'swift',   text: 'Swift' },
          { id: 'kotlin',  text: 'Kotlin' },
          { id: 'both',    text: 'Both' },
          { id: 'neither', text: 'Neither' },
        ],
        correctOptionIds: ['swift', 'kotlin', 'both'],
        multiSelect: false,
      },
      pointsMax: 10,
      hints: [],
      concepts: ['languages'],
      publishedAt: now,
    },
  });

  // 2. fill_blank
  await prisma.exercise.upsert({
    where: { id_version: { id: SEED_EX_FILL_ID, version: 1 } },
    update: {},
    create: {
      id: SEED_EX_FILL_ID,
      version: 1,
      lessonId: SEED_LESSON_ID,
      promptMarkdown: 'Fill in the blank to declare a variable named `x`.',
      type: 'fill_blank',
      payload: {
        type: 'fill_blank',
        language: 'swift',
        template: 'let {{name}} = 42',
        blanks: [
          { id: 'name', expected: ['x'] },
        ],
      },
      pointsMax: 10,
      hints: ['Use a short variable name.'],
      concepts: ['variables'],
      publishedAt: now,
    },
  });

  // 3. predict_output (multiple-choice variant — see options below)
  // Re-seeding refreshes the payload so the new options-based rendering
  // takes effect for already-seeded environments without a manual delete.
  const predictPayload = {
    type: 'predict_output' as const,
    displayedLanguage: 'swift' as const,
    displayedCode: 'let a = 2\nlet b = 3\nprint(a + b)',
    expectedOutput: '5',
    // When `options` is present (length ≥ 2), the renderer shows pickable
    // Choice cards instead of a free-text textarea. Tests the concept
    // (arithmetic, output format) without testing exact-match typing of the
    // output string — useful for cases like Swift's `print(optional)`
    // wrapping the value as `Optional("Ada")`, which beginners type wrong.
    options: ['5', '6', '23', 'undefined'],
  };
  await prisma.exercise.upsert({
    where: { id_version: { id: SEED_EX_PREDICT_ID, version: 1 } },
    update: { payload: predictPayload },
    create: {
      id: SEED_EX_PREDICT_ID,
      version: 1,
      lessonId: SEED_LESSON_ID,
      promptMarkdown: 'What does this code print?',
      type: 'predict_output',
      payload: predictPayload,
      pointsMax: 10,
      hints: [],
      concepts: ['arithmetic'],
      publishedAt: now,
    },
  });

  // 4. code
  await prisma.exercise.upsert({
    where: { id_version: { id: SEED_EX_CODE_ID, version: 1 } },
    update: {},
    create: {
      id: SEED_EX_CODE_ID,
      version: 1,
      lessonId: SEED_LESSON_ID,
      promptMarkdown: 'Write a `greet` function that returns `"Hello, BootCamp!"`.',
      type: 'code',
      payload: {
        type: 'code',
        language: 'swift',
        starterCode: 'func greet() -> String {\n    // your code here\n}',
        testCode: 'bootcampAssertEqual(greet(), "Hello, BootCamp!", "greet() should return \\"Hello, BootCamp!\\"")',
        testEntryPoint: 'greet',
      },
      pointsMax: 20,
      hints: ['Return a string literal.'],
      concepts: ['functions', 'strings'],
      publishedAt: now,
    },
  });

  // 5. fix_bug
  await prisma.exercise.upsert({
    where: { id_version: { id: SEED_EX_FIXBUG_ID, version: 1 } },
    update: {},
    create: {
      id: SEED_EX_FIXBUG_ID,
      version: 1,
      lessonId: SEED_LESSON_ID,
      promptMarkdown: 'Fix the bug in this `add` function.',
      type: 'fix_bug',
      payload: {
        type: 'fix_bug',
        language: 'swift',
        brokenCode: 'func add(_ a: Int, _ b: Int) -> Int {\n    return a - b\n}',
        testCode: 'bootcampAssertEqual(add(2, 3), 5, "add(2, 3) should return 5")',
        testEntryPoint: 'add',
      },
      pointsMax: 15,
      hints: ['Check the operator.'],
      concepts: ['functions', 'arithmetic'],
      publishedAt: now,
    },
  });

  // 6. kotlin code
  await prisma.exercise.upsert({
    where: { id_version: { id: SEED_EX_KOTLIN_CODE_ID, version: 1 } },
    create: {
      id: SEED_EX_KOTLIN_CODE_ID, version: 1, lessonId: SEED_LESSON_ID,
      promptMarkdown: 'Write a Kotlin function that returns "hello".',
      type: 'code', pointsMax: 100, hints: [], concepts: [],
      payload: {
        type: 'code',
        language: 'kotlin',
        starterCode: 'fun greet(): String {\n  // your code here\n  return ""\n}\n',
        testCode: 'check(greet() == "hello") { "expected \\"hello\\", got \\"${greet()}\\"" }',
        testEntryPoint: 'greet',
      },
      publishedAt: new Date(),
    },
    update: { publishedAt: new Date() },
  });

  const blockIds = [
    SEED_BLOCK_INTRO_ID,
    SEED_BLOCK_MC_ID,
    SEED_BLOCK_VARIABLES_ID,
    SEED_BLOCK_FILL_ID,
    SEED_BLOCK_PREDICT_ID,
    SEED_BLOCK_CODE_ID,
    SEED_BLOCK_FIXBUG_ID,
    SEED_BLOCK_KOTLIN_CODE_ID,
  ];

  // ---------------------------------------------------------------------------
  // Lesson must exist before blocks (FK constraint)
  // ---------------------------------------------------------------------------

  await prisma.lesson.upsert({
    where: { id_version: { id: SEED_LESSON_ID, version: 1 } },
    update: {
      blockIds,
    },
    create: {
      id: SEED_LESSON_ID,
      version: 1,
      trackId: SEED_TRACK_ID,
      position: 0,
      title: 'Hello BootCamp',
      level: 'beginner',
      summary: 'A first taste of every exercise type.',
      blockIds,
      publishedAt: now,
    },
  });

  // ---------------------------------------------------------------------------
  // Lesson blocks: delete existing, then recreate in order
  // ---------------------------------------------------------------------------

  await prisma.block.deleteMany({
    where: { lessonId: SEED_LESSON_ID, lessonVersion: 1 },
  });

  await prisma.block.createMany({
    data: [
      // Block 1: explanation — intro
      {
        id: SEED_BLOCK_INTRO_ID,
        lessonId: SEED_LESSON_ID,
        lessonVersion: 1,
        position: 0,
        kind: 'explanation',
        explanationMarkdown:
          '# Welcome to BootCamp\n\nIn this lesson you will get a taste of every exercise type the platform supports.',
        exerciseId: null,
        exerciseVersion: null,
      },
      // Block 2: exercise — multiple_choice
      {
        id: SEED_BLOCK_MC_ID,
        lessonId: SEED_LESSON_ID,
        lessonVersion: 1,
        position: 1,
        kind: 'exercise',
        explanationMarkdown: null,
        exerciseId: SEED_EX_MC_ID,
        exerciseVersion: 1,
      },
      // Block 3: explanation — variables
      {
        id: SEED_BLOCK_VARIABLES_ID,
        lessonId: SEED_LESSON_ID,
        lessonVersion: 1,
        position: 2,
        kind: 'explanation',
        explanationMarkdown:
          '## Variables\n\nIn Swift you declare a constant with `let` and a variable with `var`.',
        exerciseId: null,
        exerciseVersion: null,
      },
      // Block 4: exercise — fill_blank
      {
        id: SEED_BLOCK_FILL_ID,
        lessonId: SEED_LESSON_ID,
        lessonVersion: 1,
        position: 3,
        kind: 'exercise',
        explanationMarkdown: null,
        exerciseId: SEED_EX_FILL_ID,
        exerciseVersion: 1,
      },
      // Block 5: exercise — predict_output
      {
        id: SEED_BLOCK_PREDICT_ID,
        lessonId: SEED_LESSON_ID,
        lessonVersion: 1,
        position: 4,
        kind: 'exercise',
        explanationMarkdown: null,
        exerciseId: SEED_EX_PREDICT_ID,
        exerciseVersion: 1,
      },
      // Block 6: exercise — code
      {
        id: SEED_BLOCK_CODE_ID,
        lessonId: SEED_LESSON_ID,
        lessonVersion: 1,
        position: 5,
        kind: 'exercise',
        explanationMarkdown: null,
        exerciseId: SEED_EX_CODE_ID,
        exerciseVersion: 1,
      },
      // Block 7: exercise — fix_bug
      {
        id: SEED_BLOCK_FIXBUG_ID,
        lessonId: SEED_LESSON_ID,
        lessonVersion: 1,
        position: 6,
        kind: 'exercise',
        explanationMarkdown: null,
        exerciseId: SEED_EX_FIXBUG_ID,
        exerciseVersion: 1,
      },
      // Block 8: exercise — kotlin code
      {
        id: SEED_BLOCK_KOTLIN_CODE_ID, lessonId: SEED_LESSON_ID, lessonVersion: 1,
        position: 7, kind: 'exercise',
        explanationMarkdown: null,
        exerciseId: SEED_EX_KOTLIN_CODE_ID, exerciseVersion: 1,
      },
    ],
  });

  // ---------------------------------------------------------------------------
  // Track (upsert)
  // ---------------------------------------------------------------------------

  // Track stays as a draft (publishedAt: null) so it does not appear in
  // /api/tracks listings alongside the curriculum-tooling-published
  // "Swift Fundamentals" track. The lesson + blocks below remain published
  // so direct /lesson/<SEED_LESSON_ID> requests still resolve — that path
  // is exercised by web/tests/e2e/lesson.spec.ts and web/tests/contract.test.ts.
  await prisma.track.upsert({
    where: { id_version: { id: SEED_TRACK_ID, version: 1 } },
    update: { publishedAt: null },
    create: {
      id: SEED_TRACK_ID,
      version: 1,
      language: 'swift',
      kind: 'fundamentals',
      title: 'Swift Fundamentals',
      description: 'A complete introduction to Swift for beginners.',
      lessonIds: [SEED_LESSON_ID],
      lessonVersions: [1],
      publishedAt: null,
    },
  });

  // ---------------------------------------------------------------------------
  // Kotlin placeholder track — published so the topbar's Swift/Kotlin toggle
  // shows both languages even before the Kotlin curriculum is authored. Has
  // zero lessons; /tracks renders an empty-state when this is selected.
  // ---------------------------------------------------------------------------
  await prisma.track.upsert({
    where: { id_version: { id: KOTLIN_PLACEHOLDER_TRACK_ID, version: 1 } },
    update: { publishedAt: now },
    create: {
      id: KOTLIN_PLACEHOLDER_TRACK_ID,
      version: 1,
      language: 'kotlin',
      kind: 'fundamentals',
      title: 'Kotlin Fundamentals',
      description: 'Coming soon — Kotlin curriculum is in authoring.',
      lessonIds: [],
      lessonVersions: [],
      publishedAt: now,
    },
  });

  console.log(`Seed complete: lesson id = ${SEED_LESSON_ID}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
