/**
 * Bootstrap the master admin account.
 *
 * Two modes, both idempotent:
 *
 *   1. Promote an EXISTING user to admin:
 *        npx ts-node prisma/promote-admin.ts you@example.com
 *
 *   2. CREATE an admin (invite-only system has no open signup) — set the
 *      password via the ADMIN_PASSWORD env var so it never lands in shell
 *      history or source control:
 *        ADMIN_PASSWORD=... npx ts-node prisma/promote-admin.ts you@example.com
 *
 * In both modes the account ends up role=admin, status=active. If the user
 * exists, the password is left untouched unless ADMIN_PASSWORD is provided
 * (in which case it is reset).
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

async function main() {
  const email = process.argv[2] ?? process.env.ADMIN_EMAIL;
  if (!email) {
    console.error('Usage: [ADMIN_PASSWORD=...] npx ts-node prisma/promote-admin.ts <email>');
    process.exit(1);
  }
  const password = process.env.ADMIN_PASSWORD;
  const prisma = new PrismaClient();

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    const updated = await prisma.user.update({
      where: { email },
      data: {
        role: 'admin',
        status: 'active',
        ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
      },
    });
    console.log(
      `Promoted ${updated.email} -> role=admin, status=active` +
        (password ? ' (password reset)' : ''),
    );
    await prisma.$disconnect();
    return;
  }

  if (!password) {
    console.error(
      `No user with email ${email}. To create one, set ADMIN_PASSWORD and re-run.`,
    );
    await prisma.$disconnect();
    process.exit(1);
  }

  const created = await prisma.user.create({
    data: {
      id: randomUUID(),
      email,
      name: 'Admin',
      passwordHash: await bcrypt.hash(password, 10),
      role: 'admin',
      status: 'active',
    },
  });
  console.log(`Created ${created.email} -> role=admin, status=active`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
