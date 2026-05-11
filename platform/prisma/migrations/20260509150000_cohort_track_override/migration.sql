-- CreateTable
CREATE TABLE "CohortTrackOverride" (
    "cohortId" UUID NOT NULL,
    "trackId" UUID NOT NULL,
    "lessonIds" UUID[],
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" UUID NOT NULL,

    CONSTRAINT "CohortTrackOverride_pkey" PRIMARY KEY ("cohortId","trackId")
);

-- CreateIndex
CREATE INDEX "CohortTrackOverride_trackId_idx" ON "CohortTrackOverride"("trackId");
