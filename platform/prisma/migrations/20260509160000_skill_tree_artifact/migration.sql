-- DropTable
DROP TABLE "CohortTrackOverride";

-- CreateEnum
CREATE TYPE "SkillTreeVisibility" AS ENUM ('private', 'public');

-- CreateTable
CREATE TABLE "SkillTree" (
    "id" UUID NOT NULL,
    "trackId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "authorUserId" UUID NOT NULL,
    "visibility" "SkillTreeVisibility" NOT NULL DEFAULT 'private',
    "lessonIds" UUID[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkillTree_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CohortTrackAssignment" (
    "cohortId" UUID NOT NULL,
    "trackId" UUID NOT NULL,
    "skillTreeId" UUID NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedBy" UUID NOT NULL,

    CONSTRAINT "CohortTrackAssignment_pkey" PRIMARY KEY ("cohortId","trackId")
);

-- CreateIndex
CREATE INDEX "SkillTree_trackId_idx" ON "SkillTree"("trackId");

-- CreateIndex
CREATE INDEX "SkillTree_authorUserId_idx" ON "SkillTree"("authorUserId");

-- CreateIndex
CREATE INDEX "SkillTree_visibility_trackId_idx" ON "SkillTree"("visibility", "trackId");

-- CreateIndex
CREATE INDEX "CohortTrackAssignment_skillTreeId_idx" ON "CohortTrackAssignment"("skillTreeId");

-- AddForeignKey
ALTER TABLE "CohortTrackAssignment" ADD CONSTRAINT "CohortTrackAssignment_skillTreeId_fkey" FOREIGN KEY ("skillTreeId") REFERENCES "SkillTree"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
