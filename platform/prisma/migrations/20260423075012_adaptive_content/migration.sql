-- CreateEnum
CREATE TYPE "CohortLength" AS ENUM ('four_week', 'twelve_week');

-- AlterTable
ALTER TABLE "Cohort" ADD COLUMN     "cohortLength" "CohortLength" NOT NULL DEFAULT 'four_week',
ADD COLUMN     "exercisesPerLessonTarget" INTEGER NOT NULL DEFAULT 4;

-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "cohortGate" "CohortLength";

-- CreateTable
CREATE TABLE "LessonAssignment" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "lessonId" UUID NOT NULL,
    "lessonVersion" INTEGER NOT NULL,
    "selectedExerciseIds" UUID[],
    "selectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "LessonAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LessonAssignment_studentId_lessonId_idx" ON "LessonAssignment"("studentId", "lessonId");

-- CreateIndex
CREATE INDEX "LessonAssignment_studentId_completedAt_idx" ON "LessonAssignment"("studentId", "completedAt");
