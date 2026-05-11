-- CreateTable
CREATE TABLE "InstructorReview" (
    "id" UUID NOT NULL,
    "attemptId" UUID NOT NULL,
    "instructorId" UUID NOT NULL,
    "markdown" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstructorReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewMessage" (
    "id" UUID NOT NULL,
    "instructorReviewId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InstructorReview_attemptId_key" ON "InstructorReview"("attemptId");

-- CreateIndex
CREATE INDEX "InstructorReview_instructorId_idx" ON "InstructorReview"("instructorId");

-- CreateIndex
CREATE INDEX "ReviewMessage_instructorReviewId_idx" ON "ReviewMessage"("instructorReviewId");

-- AddForeignKey
ALTER TABLE "ReviewMessage" ADD CONSTRAINT "ReviewMessage_instructorReviewId_fkey" FOREIGN KEY ("instructorReviewId") REFERENCES "InstructorReview"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
