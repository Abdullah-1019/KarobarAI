// One-off inspection script — not part of the app.
import '../src/core/config';
import { prisma } from '../src/core/prisma';

async function main() {
  const notifications = await prisma.notification.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: { user: { select: { email: true, role: true } } },
  });

  for (const n of notifications) {
    console.log({
      id: n.notificationId.toString(),
      user: n.user.email,
      role: n.user.role,
      channel: n.channel,
      eventType: n.eventType,
      status: n.status,
      message: n.message,
      createdAt: n.createdAt.toISOString(),
    });
  }
  console.log(`Total notifications: ${notifications.length}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
