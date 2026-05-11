-- AlterEnum
ALTER TYPE "ExerciseType" ADD VALUE 'capstone_submission';

-- AlterTable
ALTER TABLE "Attempt" ADD COLUMN     "approvedByInstructorId" UUID;

-- AlterTable
ALTER TABLE "Track" ADD COLUMN     "starterRepoUrl" TEXT;
