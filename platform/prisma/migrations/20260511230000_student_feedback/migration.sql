-- Student feedback. Two flavours, distinguished by `lessonId IS NULL`:
--   * lessonId set       → per-lesson feedback (rating 1–5 + optional comment)
--   * lessonId NULL      → general platform feedback
-- Instructors see the feedback from their assigned students in
-- /instructor/feedback; admin sees all.

CREATE TYPE "FeedbackStatus" AS ENUM ('new', 'seen', 'resolved');

CREATE TABLE "StudentFeedback" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "studentId" UUID NOT NULL,
    "lessonId" UUID,
    "rating" INTEGER,
    "comment" TEXT NOT NULL,
    "status" "FeedbackStatus" NOT NULL DEFAULT 'new',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seenAt" TIMESTAMP(3),
    "instructorReply" TEXT,
    "instructorReplyAt" TIMESTAMP(3),
    "instructorReplyBy" UUID,

    CONSTRAINT "StudentFeedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StudentFeedback_studentId_idx" ON "StudentFeedback"("studentId");
CREATE INDEX "StudentFeedback_lessonId_idx" ON "StudentFeedback"("lessonId");
CREATE INDEX "StudentFeedback_status_createdAt_idx" ON "StudentFeedback"("status", "createdAt");

-- Rating is bounded at the application layer (1–5). The DB check just guards
-- against obviously bogus values that would leak through a programming bug.
ALTER TABLE "StudentFeedback"
  ADD CONSTRAINT "StudentFeedback_rating_range"
  CHECK ("rating" IS NULL OR ("rating" >= 1 AND "rating" <= 5));
