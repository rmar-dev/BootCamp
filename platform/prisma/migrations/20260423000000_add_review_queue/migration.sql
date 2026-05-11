-- CreateTable
CREATE TABLE "ReviewCard" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "exerciseId" UUID NOT NULL,
    "step" INTEGER NOT NULL,
    "nextDueAt" TIMESTAMP(3) NOT NULL,
    "lastReviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retiredAt" TIMESTAMP(3),

    CONSTRAINT "ReviewCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewAttempt" (
    "id" UUID NOT NULL,
    "reviewCardId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "exerciseId" UUID NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "passed" BOOLEAN NOT NULL,

    CONSTRAINT "ReviewAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReviewCard_studentId_nextDueAt_idx" ON "ReviewCard"("studentId", "nextDueAt");

-- CreateIndex
CREATE INDEX "ReviewCard_studentId_retiredAt_idx" ON "ReviewCard"("studentId", "retiredAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewCard_studentId_exerciseId_key" ON "ReviewCard"("studentId", "exerciseId");

-- CreateIndex
CREATE INDEX "ReviewAttempt_studentId_submittedAt_idx" ON "ReviewAttempt"("studentId", "submittedAt");

-- CreateIndex
CREATE INDEX "ReviewAttempt_reviewCardId_idx" ON "ReviewAttempt"("reviewCardId");
