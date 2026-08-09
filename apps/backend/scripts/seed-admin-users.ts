// One-off dev fixture — creates an ADMIN and a SUPPORT account so the Feature 12 Admin Console
// can actually be logged into. No public registration path creates these roles (register's own
// Zod schema only accepts BUYER/SELLER, deliberately — see packages/shared/src/schemas/auth.ts),
// so this mirrors tests/helpers/factories.ts's createUserRow(): a plain User row with the target
// role, ACTIVE status, no buyerProfile/sellerProfile (those are BUYER/SELLER-only extensions).
// Not part of the app — run once, then delete.
import bcrypt from 'bcrypt';

import { config } from '../src/core/config';
import { blindIndex, encryptField, normalizeEmail } from '../src/core/crypto/fieldCipher';
import { prisma } from '../src/core/prisma';

async function ensureUser(role: 'ADMIN' | 'SUPPORT', email: string, password: string) {
  const normalized = normalizeEmail(email);
  const bidx = blindIndex(normalized);

  // emailBidx has only a partial-unique index (WHERE deleted_at IS NULL) — not a Prisma-
  // recognized unique field, so this is find-then-create, same as seed-return-test.ts.
  const existing = await prisma.user.findFirst({ where: { emailBidx: bidx, deletedAt: null } });
  if (existing) return existing;

  const passwordHash = await bcrypt.hash(password, config.bcryptCost);
  return prisma.user.create({
    data: {
      email: encryptField(normalized),
      emailBidx: bidx,
      passwordHash,
      role,
      status: 'ACTIVE',
      preferredLanguage: 'EN',
    },
  });
}

async function main() {
  const password = 'Test1234!';

  const admin = await ensureUser('ADMIN', 'test-admin@karobarai.test', password);
  const support = await ensureUser('SUPPORT', 'test-support@karobarai.test', password);

  console.log('--- Feature 12 admin/support fixtures ready ---');
  console.log('Admin login:   test-admin@karobarai.test / Test1234!  (publicId:', admin.publicId, ')');
  console.log('Support login: test-support@karobarai.test / Test1234!  (publicId:', support.publicId, ')');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
