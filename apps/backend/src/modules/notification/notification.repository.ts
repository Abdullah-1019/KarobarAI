import type { Language, NotificationChannel, NotificationStatus, Prisma } from '@prisma/client';

import { prisma } from '../../core/prisma';

// Task 1.1 — Prisma-backed methods for notifications/notification_preferences only.

const NOTIFICATION_INCLUDE = { order: { select: { publicId: true } } } satisfies Prisma.NotificationInclude;
export type NotificationRow = Prisma.NotificationGetPayload<{ include: typeof NOTIFICATION_INCLUDE }>;

export interface CreateNotificationInput {
  userId: bigint;
  orderId?: bigint | null;
  channel: NotificationChannel;
  eventType: string;
  message: string;
  language: Language;
  status: NotificationStatus;
}

export async function createNotification(input: CreateNotificationInput): Promise<NotificationRow> {
  return prisma.notification.create({
    data: {
      userId: input.userId,
      orderId: input.orderId ?? null,
      channel: input.channel,
      eventType: input.eventType,
      message: input.message,
      language: input.language,
      status: input.status,
      sentAt: input.status === 'SENT' || input.status === 'DELIVERED' ? new Date() : null,
    },
    include: NOTIFICATION_INCLUDE,
  });
}

export async function updateNotificationStatus(notificationId: bigint, status: NotificationStatus): Promise<void> {
  await prisma.notification.update({
    where: { notificationId },
    data: {
      status,
      ...(status === 'SENT' || status === 'DELIVERED' ? { sentAt: new Date() } : {}),
    },
  });
}

export async function findNotificationsByUser(
  userId: bigint,
  cursor: string | undefined,
  limit: number,
): Promise<{ items: NotificationRow[]; hasMore: boolean }> {
  const items = await prisma.notification.findMany({
    where: {
      userId,
      channel: 'IN_APP', // Task 4.4 — only IN_APP rows render in the Notification Center; Email/SMS/WhatsApp are external
      ...(cursor && { notificationId: { lt: BigInt(cursor) } }),
    },
    orderBy: { notificationId: 'desc' },
    take: limit + 1,
    include: NOTIFICATION_INCLUDE,
  });
  const hasMore = items.length > limit;
  return { items: hasMore ? items.slice(0, limit) : items, hasMore };
}

export async function findNotificationById(notificationId: bigint): Promise<NotificationRow | null> {
  return prisma.notification.findUnique({ where: { notificationId }, include: NOTIFICATION_INCLUDE });
}

export async function markAsRead(notificationId: bigint): Promise<void> {
  await prisma.notification.update({
    where: { notificationId },
    data: { status: 'READ', readAt: new Date() },
  });
}

export async function getUnreadCount(userId: bigint): Promise<number> {
  return prisma.notification.count({
    where: { userId, channel: 'IN_APP', status: { not: 'READ' } },
  });
}

export async function findPreferences(userId: bigint) {
  return prisma.notificationPreference.findUnique({ where: { userId } });
}
