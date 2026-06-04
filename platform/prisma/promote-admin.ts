/**
 * One-off bootstrap: promote an existing user to the master admin role.
 * Usage: cd platform && npx ts-node prisma/promote-admin.ts you@example.com
 *
 * Idempotent — re-running on an already-admin user is a no-op. Does NOT create
 * a user (invite-only system has no open signup); the account must already
 * exist. Also flips status to active so the promoted account can log in.
 */
import { PrismaClient } from '@prisma/client';

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: npx ts-node prisma/promote-admin.ts <email>');
    process.exit(1);
  }
  const prisma = new PrismaClient();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No user with email ${email}. Create the account first.`);
    await prisma.$disconnect();
    process.exit(1);
  }
  const updated = await prisma.user.update({
    where: { email },
    data: { role: 'admin', status: 'active' },
  });
  console.log(`Promoted ${updated.email} -> role=admin, status=active`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
