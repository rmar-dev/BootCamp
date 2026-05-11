-- CreateTable
CREATE TABLE "StudentBadge" (
    "id" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "badgeId" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentBadge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentBadge_studentId_idx" ON "StudentBadge"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentBadge_studentId_badgeId_key" ON "StudentBadge"("studentId", "badgeId");
