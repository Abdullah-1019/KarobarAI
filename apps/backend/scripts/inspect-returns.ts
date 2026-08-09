// One-off inspection script — not part of the app.
import '../src/core/config'; // side effect: loads .env before prisma needs DATABASE_URL
import { prisma } from '../src/core/prisma';

async function main() {
  const returns = await prisma.return.findMany({
    include: { images: true, order: { select: { publicId: true, status: true } } },
    orderBy: { createdAt: 'desc' },
  });

  for (const r of returns) {
    console.log({
      returnId: r.returnId.toString(),
      orderPublicId: r.order.publicId,
      orderStatus: r.order.status,
      returnStatus: r.status,
      reason: r.reason,
      imageCount: r.images.length,
      decision: r.decision,
      createdAt: r.createdAt.toISOString(),
    });
  }
  console.log(`Total returns: ${returns.length}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
