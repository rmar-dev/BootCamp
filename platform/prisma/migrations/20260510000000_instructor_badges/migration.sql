-- CreateEnum
CREATE TYPE "BadgeCriteriaKind" AS ENUM (
  'system_first_submit',
  'system_first_pass',
  'system_streak_3',
  'system_streak_7',
  'system_all_types',
  'system_points_100',
  'system_points_500',
  'system_perfect_lesson',
  'manual_award',
  'points_threshold',
  'streak_threshold',
  'exercises_passed'
);

-- CreateEnum
CREATE TYPE "BadgeScopeKind" AS ENUM ('public', 'cohort', 'track', 'private_to_student');

-- AlterTable: track who manually granted a badge (null for auto-awards)
ALTER TABLE "StudentBadge" ADD COLUMN "awardedBy" UUID;

-- CreateTable
CREATE TABLE "Badge" (
    "id"             UUID         NOT NULL,
    "code"           TEXT         NOT NULL,
    "name"           TEXT         NOT NULL,
    "description"    TEXT         NOT NULL,
    "icon"           TEXT         NOT NULL,
    "criteriaKind"   "BadgeCriteriaKind" NOT NULL,
    "thresholdValue" INTEGER,
    "scopeKind"      "BadgeScopeKind"    NOT NULL DEFAULT 'public',
    "scopeId"        UUID,
    "authorUserId"   UUID,
    "system"         BOOLEAN      NOT NULL DEFAULT false,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Badge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Badge_code_key" ON "Badge"("code");
CREATE INDEX "Badge_scopeKind_scopeId_idx" ON "Badge"("scopeKind", "scopeId");
CREATE INDEX "Badge_authorUserId_idx" ON "Badge"("authorUserId");

-- Seed the 8 system badges. UUIDs are deterministic (v4 syntax with a fixed
-- "ba" prefix) so re-running the migration is idempotent in dev environments
-- that drop/recreate, and so seed.ts can ON CONFLICT DO NOTHING.
INSERT INTO "Badge" ("id", "code", "name", "description", "icon", "criteriaKind", "scopeKind", "system", "updatedAt") VALUES
  ('ba000001-0000-4000-8000-000000000001', 'first_submit',    'First Submission',  'Submitted an exercise for the first time.',         '🚀', 'system_first_submit',    'public', true, CURRENT_TIMESTAMP),
  ('ba000001-0000-4000-8000-000000000002', 'first_pass',      'First Pass',        'Passed an exercise on the first attempt.',          '🎯', 'system_first_pass',      'public', true, CURRENT_TIMESTAMP),
  ('ba000001-0000-4000-8000-000000000003', 'streak_3',        '3-Day Streak',      'Submitted exercises on 3 consecutive days.',        '🔥', 'system_streak_3',        'public', true, CURRENT_TIMESTAMP),
  ('ba000001-0000-4000-8000-000000000004', 'streak_7',        '7-Day Streak',      'Submitted exercises on 7 consecutive days.',        '⚡', 'system_streak_7',        'public', true, CURRENT_TIMESTAMP),
  ('ba000001-0000-4000-8000-000000000005', 'all_types',       'Versatile',         'Passed exercises of all 5 types.',                  '🎨', 'system_all_types',       'public', true, CURRENT_TIMESTAMP),
  ('ba000001-0000-4000-8000-000000000006', 'points_100',      'Century',           'Earned 100 total points.',                          '💯', 'system_points_100',      'public', true, CURRENT_TIMESTAMP),
  ('ba000001-0000-4000-8000-000000000007', 'points_500',      'High Scorer',       'Earned 500 total points.',                          '🏆', 'system_points_500',      'public', true, CURRENT_TIMESTAMP),
  ('ba000001-0000-4000-8000-000000000008', 'perfect_lesson',  'Perfect Lesson',    'Completed all exercises in a lesson.',              '⭐', 'system_perfect_lesson',  'public', true, CURRENT_TIMESTAMP);
