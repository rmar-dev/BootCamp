-- Per-student skill-tree override. Stacks above CohortTrackAssignment in the
-- resolution order: student override > cohort assignment > canonical track.
-- Deleting the row reverts the student to whatever the cohort has (or the
-- canonical sequence if the cohort also has no assignment).
CREATE TABLE "StudentTrackAssignment" (
    "studentId" UUID NOT NULL,
    "trackId" UUID NOT NULL,
    "skillTreeId" UUID NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedBy" UUID NOT NULL,

    CONSTRAINT "StudentTrackAssignment_pkey" PRIMARY KEY ("studentId","trackId")
);

CREATE INDEX "StudentTrackAssignment_skillTreeId_idx" ON "StudentTrackAssignment"("skillTreeId");
CREATE INDEX "StudentTrackAssignment_trackId_idx" ON "StudentTrackAssignment"("trackId");

ALTER TABLE "StudentTrackAssignment"
  ADD CONSTRAINT "StudentTrackAssignment_skillTreeId_fkey"
  FOREIGN KEY ("skillTreeId") REFERENCES "SkillTree"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
