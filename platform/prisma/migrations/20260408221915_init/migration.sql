-- CreateEnum
CREATE TYPE "Language" AS ENUM ('swift', 'kotlin');

-- CreateEnum
CREATE TYPE "TrackKind" AS ENUM ('placement', 'fundamentals', 'capstone');

-- CreateEnum
CREATE TYPE "LessonLevel" AS ENUM ('beginner', 'intermediate', 'advanced');

-- CreateEnum
CREATE TYPE "BlockKind" AS ENUM ('explanation', 'exercise');

-- CreateEnum
CREATE TYPE "ExerciseType" AS ENUM ('code', 'fix_bug', 'fill_blank', 'predict_output', 'multiple_choice');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('active', 'completed', 'paused');

-- CreateTable
CREATE TABLE "Track" (
    "id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "language" "Language" NOT NULL,
    "kind" "TrackKind" NOT NULL,
    "description" TEXT NOT NULL,
    "lessonIds" UUID[],
    "lessonVersions" INTEGER[],
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "Track_pkey" PRIMARY KEY ("id","version")
);

-- CreateTable
CREATE TABLE "Lesson" (
    "id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "trackId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "level" "LessonLevel" NOT NULL,
    "summary" TEXT NOT NULL,
    "blockIds" UUID[],
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id","version")
);

-- CreateTable
CREATE TABLE "Block" (
    "id" UUID NOT NULL,
    "lessonId" UUID NOT NULL,
    "lessonVersion" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "kind" "BlockKind" NOT NULL,
    "explanationMarkdown" TEXT,
    "exerciseId" UUID,
    "exerciseVersion" INTEGER,

    CONSTRAINT "Block_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exercise" (
    "id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "lessonId" UUID NOT NULL,
    "promptMarkdown" TEXT NOT NULL,
    "type" "ExerciseType" NOT NULL,
    "payload" JSONB NOT NULL,
    "pointsMax" INTEGER NOT NULL,
    "hints" TEXT[],
    "concepts" TEXT[],
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "Exercise_pkey" PRIMARY KEY ("id","version")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "cohortId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cohort" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "instructorId" UUID NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cohort_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "trackId" UUID NOT NULL,
    "trackVersion" INTEGER NOT NULL,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedLevel" "LessonLevel" NOT NULL,
    "currentLessonId" UUID,
    "currentLessonVersion" INTEGER,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'active',

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attempt" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "exerciseId" UUID NOT NULL,
    "exerciseVersion" INTEGER NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submissionPayload" JSONB NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "hintsUsedCount" INTEGER NOT NULL,
    "failedAttemptsBefore" INTEGER NOT NULL,
    "pointsAwarded" INTEGER NOT NULL,

    CONSTRAINT "Attempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExerciseResult" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "exerciseId" UUID NOT NULL,
    "bestAttemptId" UUID NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "pointsEarned" INTEGER NOT NULL,
    "attemptsCount" INTEGER NOT NULL,
    "firstPassedAt" TIMESTAMP(3),

    CONSTRAINT "ExerciseResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Lesson_trackId_idx" ON "Lesson"("trackId");

-- CreateIndex
CREATE INDEX "Block_lessonId_lessonVersion_idx" ON "Block"("lessonId", "lessonVersion");

-- CreateIndex
CREATE UNIQUE INDEX "Student_email_key" ON "Student"("email");

-- CreateIndex
CREATE INDEX "Enrollment_studentId_idx" ON "Enrollment"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_studentId_trackId_key" ON "Enrollment"("studentId", "trackId");

-- CreateIndex
CREATE INDEX "Attempt_studentId_exerciseId_idx" ON "Attempt"("studentId", "exerciseId");

-- CreateIndex
CREATE UNIQUE INDEX "ExerciseResult_studentId_exerciseId_key" ON "ExerciseResult"("studentId", "exerciseId");

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_lessonId_lessonVersion_fkey" FOREIGN KEY ("lessonId", "lessonVersion") REFERENCES "Lesson"("id", "version") ON DELETE RESTRICT ON UPDATE CASCADE;
