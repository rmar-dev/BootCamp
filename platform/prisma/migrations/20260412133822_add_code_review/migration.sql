-- CreateTable
CREATE TABLE "CodeReview" (
    "id" UUID NOT NULL,
    "attemptId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "markdown" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CodeReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CodeReview_attemptId_key" ON "CodeReview"("attemptId");

-- CreateIndex
CREATE INDEX "CodeReview_studentId_idx" ON "CodeReview"("studentId");
