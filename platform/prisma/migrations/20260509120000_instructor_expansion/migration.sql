-- CreateEnum
CREATE TYPE "DifficultyBaseline" AS ENUM ('easy', 'standard', 'challenging');

-- CreateEnum
CREATE TYPE "ExerciseVisibility" AS ENUM ('private_to_student', 'cohort', 'track', 'public');

-- CreateEnum
CREATE TYPE "HelpAnchorKind" AS ENUM ('lesson', 'exercise', 'attempt');

-- CreateEnum
CREATE TYPE "HelpRequestStatus" AS ENUM ('open', 'answered', 'resolved');

-- AlterTable
ALTER TABLE "Exercise" ADD COLUMN     "authorId" UUID,
ADD COLUMN     "scopeId" UUID,
ADD COLUMN     "visibility" "ExerciseVisibility" NOT NULL DEFAULT 'public';

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "instructorId" UUID;

-- CreateTable
CREATE TABLE "StudentDifficulty" (
    "studentId" UUID NOT NULL,
    "baseline" "DifficultyBaseline" NOT NULL DEFAULT 'standard',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" UUID NOT NULL,

    CONSTRAINT "StudentDifficulty_pkey" PRIMARY KEY ("studentId")
);

-- CreateTable
CREATE TABLE "ExamDifficultyOverride" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "exerciseId" UUID NOT NULL,
    "exerciseVersion" INTEGER NOT NULL,
    "extendTimeMs" INTEGER,
    "optional" BOOLEAN NOT NULL DEFAULT false,
    "swapToExerciseId" UUID,
    "swapToExerciseVersion" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" UUID NOT NULL,

    CONSTRAINT "ExamDifficultyOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HelpRequest" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "instructorId" UUID NOT NULL,
    "anchorKind" "HelpAnchorKind" NOT NULL,
    "anchorId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "status" "HelpRequestStatus" NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "HelpRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HelpMessage" (
    "id" UUID NOT NULL,
    "helpRequestId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HelpMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectRating" (
    "id" UUID NOT NULL,
    "attemptId" UUID NOT NULL,
    "raterUserId" UUID NOT NULL,
    "score" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectRating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Exercise_visibility_scopeId_idx" ON "Exercise"("visibility", "scopeId");

-- CreateIndex
CREATE INDEX "Exercise_authorId_idx" ON "Exercise"("authorId");

-- CreateIndex
CREATE INDEX "Student_instructorId_idx" ON "Student"("instructorId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamDifficultyOverride_studentId_exerciseId_key" ON "ExamDifficultyOverride"("studentId", "exerciseId");

-- CreateIndex
CREATE INDEX "ExamDifficultyOverride_studentId_idx" ON "ExamDifficultyOverride"("studentId");

-- CreateIndex
CREATE INDEX "HelpRequest_instructorId_status_idx" ON "HelpRequest"("instructorId", "status");

-- CreateIndex
CREATE INDEX "HelpRequest_studentId_status_idx" ON "HelpRequest"("studentId", "status");

-- CreateIndex
CREATE INDEX "HelpMessage_helpRequestId_idx" ON "HelpMessage"("helpRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectRating_attemptId_raterUserId_key" ON "ProjectRating"("attemptId", "raterUserId");

-- CreateIndex
CREATE INDEX "ProjectRating_attemptId_idx" ON "ProjectRating"("attemptId");

-- AddForeignKey
ALTER TABLE "HelpMessage" ADD CONSTRAINT "HelpMessage_helpRequestId_fkey" FOREIGN KEY ("helpRequestId") REFERENCES "HelpRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
