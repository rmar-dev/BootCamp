// Lightweight DTO shape for badge metadata returned to clients. Used as the
// element type for SubmitResponse.newBadges (callers receive only enough to
// render a toast — full Prisma Badge rows are intentionally NOT leaked).
//
// Historical note: this module previously also exported a hardcoded BADGES
// constant. That constant was removed when badges moved into a Prisma table
// (migration 20260510000000_instructor_badges). The 8 originals now live as
// system=true rows seeded by the migration.
export type BadgeDefinition = {
  id: string;
  name: string;
  description: string;
  icon: string;
};
