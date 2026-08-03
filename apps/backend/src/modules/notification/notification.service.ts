import { CRITICAL_EVENT_TYPES } from '@karobarai/shared';
import type { NotificationDTO, NotificationEventType, NotificationListDTO, UnreadCountDTO } from '@karobarai/shared';
import type { Language } from '@prisma/client';

import { getEmailAdapter } from '../../adapters/email';
import { getSmsAdapter } from '../../adapters/sms';
import { getWhatsAppAdapter } from '../../adapters/whatsapp';
import { decryptField } from '../../core/crypto/fieldCipher';
import { ForbiddenError, NotFoundError, ValidationError } from '../../core/errors/AppError';
import { logger } from '../../core/logger';
import { prisma } from '../../core/prisma';
import { getTemplate, renderTemplate } from './templates';
import * as repo from './notification.repository';
import type { NotificationRow } from './notification.repository';
import { notificationJobSchema } from './notification.dto';

// Feature 9 — the consumer/dispatch side of every notification job Features 1/6/7/8 enqueue (or,
// per FEATURE_9_EVENT_INVENTORY.md, were SUPPOSED to enqueue — see that doc for the discrepancies
// found and flagged, not silently patched, in Features 6/7's actual code).

const CRITICAL_SET = new Set<string>(CRITICAL_EVENT_TYPES);

function isCritical(eventType: NotificationEventType): boolean {
  return CRITICAL_SET.has(eventType);
}

function langKey(lang: Language): 'en' | 'ur' {
  return lang === 'UR' ? 'ur' : 'en';
}

interface ResolvedRecipient {
  userId: bigint;
  publicId: string;
  phone: string | null;
  email: string | null;
  preferredLanguage: Language;
}

async function resolveRecipient(userId: bigint): Promise<ResolvedRecipient | null> {
  const user = await prisma.user.findUnique({ where: { userId } });
  if (!user) return null;
  return {
    userId: user.userId,
    publicId: user.publicId,
    phone: user.phone ? decryptField(user.phone) : null,
    email: user.email ? decryptField(user.email) : null,
    preferredLanguage: user.preferredLanguage,
  };
}

async function resolveOrderInternalId(orderPublicId: string): Promise<bigint | null> {
  const order = await prisma.order.findUnique({ where: { publicId: orderPublicId }, select: { orderId: true } });
  return order?.orderId ?? null;
}

interface DispatchContext {
  recipient: ResolvedRecipient;
  orderInternalId: bigint | null;
  eventType: NotificationEventType;
  vars: Record<string, unknown>;
}

function renderForRecipient(ctx: DispatchContext): string | null {
  const template = getTemplate(ctx.eventType);
  if (!template) {
    logger.warn({ eventType: ctx.eventType }, '[notification] no template registered for this event type — skipping');
    return null;
  }
  return renderTemplate(template[langKey(ctx.recipient.preferredLanguage)], ctx.vars);
}

// Task 3.2 — Gap #4: in-app never reaches DELIVERED, just QUEUED→SENT immediately, then READ
// when the user opens/dismisses it (Task 3.4).
async function dispatchInApp(ctx: DispatchContext): Promise<void> {
  try {
    const prefs = await repo.findPreferences(ctx.recipient.userId);
    if (prefs?.inappEnabled === false && !isCritical(ctx.eventType)) return;

    const message = renderForRecipient(ctx);
    if (!message) return;

    await repo.createNotification({
      userId: ctx.recipient.userId,
      orderId: ctx.orderInternalId,
      channel: 'IN_APP',
      eventType: ctx.eventType,
      message,
      language: ctx.recipient.preferredLanguage,
      status: 'SENT',
    });
  } catch (err) {
    // Task 3.3/5.4/7.3 — one channel's failure must never block another.
    logger.error({ err, eventType: ctx.eventType }, '[notification] in-app dispatch failed');
  }
}

// Task 5.2/5.3 — full QUEUED→SENT→DELIVERED/FAILED lifecycle for an external channel (unlike
// in-app's simplified SENT→READ, per Gap #4).
async function dispatchEmail(ctx: DispatchContext): Promise<void> {
  try {
    const prefs = await repo.findPreferences(ctx.recipient.userId);
    if (prefs?.emailEnabled === false && !isCritical(ctx.eventType)) return;
    if (!ctx.recipient.email) return; // nothing to send to — not a failure, just no channel available

    const message = renderForRecipient(ctx);
    if (!message) return;

    const row = await repo.createNotification({
      userId: ctx.recipient.userId,
      orderId: ctx.orderInternalId,
      channel: 'EMAIL',
      eventType: ctx.eventType,
      message,
      language: ctx.recipient.preferredLanguage,
      status: 'QUEUED',
    });

    try {
      await getEmailAdapter().sendEmail(ctx.recipient.email, ctx.eventType, ctx.vars, ctx.recipient.preferredLanguage);
      await repo.updateNotificationStatus(row.notificationId, 'DELIVERED');
    } catch (err) {
      await repo.updateNotificationStatus(row.notificationId, 'FAILED');
      logger.warn({ err, eventType: ctx.eventType }, '[notification] email adapter failed');
    }
  } catch (err) {
    logger.error({ err, eventType: ctx.eventType }, '[notification] email dispatch failed');
  }
}

// Task 6.1/6.2 — extends Feature 1's existing SmsAdapter (sendSms), no second SMS adapter.
async function dispatchSms(ctx: DispatchContext): Promise<void> {
  try {
    const prefs = await repo.findPreferences(ctx.recipient.userId);
    if (prefs?.smsEnabled === false && !isCritical(ctx.eventType)) return;
    if (!ctx.recipient.phone) return;

    const message = renderForRecipient(ctx);
    if (!message) return;

    const row = await repo.createNotification({
      userId: ctx.recipient.userId,
      orderId: ctx.orderInternalId,
      channel: 'SMS',
      eventType: ctx.eventType,
      message,
      language: ctx.recipient.preferredLanguage,
      status: 'QUEUED',
    });

    try {
      await getSmsAdapter().sendSms(ctx.recipient.phone, ctx.eventType, ctx.vars, ctx.recipient.preferredLanguage);
      await repo.updateNotificationStatus(row.notificationId, 'DELIVERED');
    } catch (err) {
      await repo.updateNotificationStatus(row.notificationId, 'FAILED');
      logger.warn({ err, eventType: ctx.eventType }, '[notification] sms adapter failed');
    }
  } catch (err) {
    logger.error({ err, eventType: ctx.eventType }, '[notification] sms dispatch failed');
  }
}

// Task 7.2/7.3 — pulled forward from PRD R1.1 (Gap #2), same gating shape as Email/SMS.
async function dispatchWhatsApp(ctx: DispatchContext): Promise<void> {
  try {
    const prefs = await repo.findPreferences(ctx.recipient.userId);
    if (prefs?.whatsappEnabled === false && !isCritical(ctx.eventType)) return;
    if (!ctx.recipient.phone) return;

    const message = renderForRecipient(ctx);
    if (!message) return;

    const row = await repo.createNotification({
      userId: ctx.recipient.userId,
      orderId: ctx.orderInternalId,
      channel: 'WHATSAPP',
      eventType: ctx.eventType,
      message,
      language: ctx.recipient.preferredLanguage,
      status: 'QUEUED',
    });

    try {
      await getWhatsAppAdapter().sendTemplate(ctx.recipient.phone, ctx.eventType, ctx.vars);
      await repo.updateNotificationStatus(row.notificationId, 'DELIVERED');
    } catch (err) {
      await repo.updateNotificationStatus(row.notificationId, 'FAILED');
      logger.warn({ err, eventType: ctx.eventType }, '[notification] whatsapp adapter failed');
    }
  } catch (err) {
    logger.error({ err, eventType: ctx.eventType }, '[notification] whatsapp dispatch failed');
  }
}

// The BullMQ consumer's single entry point (Task 1.3/2.2) — validates the envelope, resolves the
// recipient once, then fans out to all four channels independently (Promise.allSettled: one
// channel's rejection must never prevent the others from completing or from failing this whole
// job, which would otherwise cause a pointless BullMQ retry of already-succeeded channels).
export async function processNotificationEvent(rawPayload: unknown): Promise<void> {
  const payload = notificationJobSchema.parse(rawPayload);

  const recipient = await resolveRecipient(BigInt(payload.userId));
  if (!recipient) {
    logger.warn({ userId: payload.userId }, '[notification] unknown recipient user, dropping job');
    return;
  }
  const orderInternalId = payload.orderId ? await resolveOrderInternalId(payload.orderId) : null;

  const ctx: DispatchContext = {
    recipient,
    orderInternalId,
    eventType: payload.type,
    vars: payload.vars,
  };

  await Promise.allSettled([dispatchInApp(ctx), dispatchEmail(ctx), dispatchSms(ctx), dispatchWhatsApp(ctx)]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Task 3.4/3.5 + Task 4 — Notification Center
// ─────────────────────────────────────────────────────────────────────────────

function toDTO(row: NotificationRow): NotificationDTO {
  return {
    id: row.notificationId.toString(),
    orderId: row.order?.publicId ?? null,
    channel: row.channel,
    eventType: row.eventType,
    message: row.message,
    language: row.language,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    readAt: row.readAt ? row.readAt.toISOString() : null,
  };
}

export async function listNotificationsForUser(
  userId: bigint,
  filters: { cursor?: string; limit?: number },
): Promise<NotificationListDTO> {
  const limit = filters.limit ?? 20;
  const { items, hasMore } = await repo.findNotificationsByUser(userId, filters.cursor, limit);
  const last = items[items.length - 1];
  return {
    items: items.map(toDTO),
    nextCursor: hasMore && last ? last.notificationId.toString() : null,
  };
}

export async function getUnreadCountForUser(userId: bigint): Promise<UnreadCountDTO> {
  const count = await repo.getUnreadCount(userId);
  return { count };
}

export async function markNotificationRead(notificationId: bigint, userId: bigint): Promise<void> {
  const row = await repo.findNotificationById(notificationId);
  if (!row) throw new NotFoundError('Notification not found', undefined, 'NOTIFICATION_NOT_FOUND');
  if (row.userId !== userId) {
    throw new ForbiddenError('This notification does not belong to you', undefined, 'NOTIFICATION_NOT_OWNED');
  }
  await repo.markAsRead(notificationId);
}

export function parseNotificationId(raw: string): bigint {
  if (!/^\d+$/.test(raw)) throw new ValidationError('Invalid notification id', undefined, 'VALIDATION_ERROR');
  return BigInt(raw);
}
