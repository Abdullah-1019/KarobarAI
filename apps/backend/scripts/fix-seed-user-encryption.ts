// One-off data patch — not part of the app. The original seed-return-test.ts stored `email` as
// plaintext instead of encryptField(email) (auth.service.ts's real registration does encrypt it),
// which made decryptField() throw "Invalid encrypted field payload" every time
// notification.service.ts's resolveRecipient() tried to read these two users' email — silently
// failing every notification job for both the seed buyer and seller. Re-encrypts in place so the
// existing login credentials keep working.
import '../src/core/config';
import { encryptField, normalizeEmail } from '../src/core/crypto/fieldCipher';
import { prisma } from '../src/core/prisma';

async function main() {
  for (const rawEmail of ['test-seller@karobarai.test', 'test-buyer@karobarai.test']) {
    const email = normalizeEmail(rawEmail);
    const user = await prisma.user.findFirst({ where: { email }, select: { userId: true, email: true } });
    if (!user) {
      console.log(`No user found with plaintext email ${email} (already fixed or never existed) — skipping.`);
      continue;
    }
    await prisma.user.update({ where: { userId: user.userId }, data: { email: encryptField(email) } });
    console.log(`Re-encrypted email for user ${user.userId} (${email}).`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
