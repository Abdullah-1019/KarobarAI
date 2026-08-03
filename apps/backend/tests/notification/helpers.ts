import { prisma } from '../../src/core/prisma';

export async function setNotificationPreferences(
  userId: bigint,
  prefs: Partial<{ smsEnabled: boolean; whatsappEnabled: boolean; emailEnabled: boolean; inappEnabled: boolean }>,
) {
  return prisma.notificationPreference.upsert({
    where: { userId },
    update: prefs,
    create: {
      userId,
      smsEnabled: true,
      whatsappEnabled: true,
      emailEnabled: true,
      inappEnabled: true,
      ...prefs,
    },
  });
}
