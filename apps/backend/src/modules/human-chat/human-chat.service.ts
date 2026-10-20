import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { Express } from 'express';

import { AuthError, ConflictError, ForbiddenError, NotFoundError, RateLimitError, ValidationError } from '../../core/errors/AppError';
import { prisma } from '../../core/prisma';
import { redis } from '../../core/redis';
import { validateImageFile } from '../../core/upload/imageValidation';
import { deletePrivateEvidence, readPrivateEvidence, savePrivateEvidence } from '../returns/private-evidence.storage';
import { buyerDisplayName, buyerDisplayNames } from '../profile/buyer-display-name';

type Actor = { userId: bigint; role: 'BUYER' | 'SELLER'; preferredLanguage: 'EN' | 'UR' };
const messageInclude = { attachments: { orderBy: { position: 'asc' as const } } };

async function enforceRate(key: string, seconds: number, maximum: number) {
  const count = Number(await redis.eval("local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]); end; return n", 1, key, seconds));
  if (count > maximum) throw new RateLimitError('Too many requests; try again later');
}

export async function resolveActor(publicId: string): Promise<Actor> {
  const user = await prisma.user.findUnique({ where: { publicId }, select: { userId: true, role: true, status: true, deletedAt: true, preferredLanguage: true,
    sellerProfile: { select: { onboardingCompletedAt: true, deletedAt: true } } } });
  if (!user || user.deletedAt || user.status !== 'ACTIVE') throw new AuthError('Active account required');
  if (user.role !== 'BUYER' && user.role !== 'SELLER') throw new ForbiddenError('Buyer or seller account required');
  if (user.role === 'SELLER' && (!user.sellerProfile?.onboardingCompletedAt || user.sellerProfile.deletedAt)) throw new ForbiddenError('Active store required');
  return { userId: user.userId, role: user.role, preferredLanguage: user.preferredLanguage };
}

async function conversationFor(actor: Actor, id: string) {
  const row = await prisma.humanConversation.findFirst({ where: {
    id,
    ...(actor.role === 'BUYER' ? { buyerId: actor.userId } : { sellerId: actor.userId }),
  }, include: { seller: { select: { storeName: true, storeSlug: true } } } });
  if (!row) throw new NotFoundError('Conversation not found');
  return row;
}

export async function assertConversationParticipant(actor: Actor, id: string): Promise<void> {
  await conversationFor(actor, id);
}

export async function assertConversationCanType(actor: Actor, id: string): Promise<void> {
  const conversation = await conversationFor(actor, id);
  if (conversation.buyerBlockedAt || conversation.sellerBlockedAt) throw new ForbiddenError('Conversation is blocked');
}

function participantIds(conversation: { buyerId: bigint; sellerId: bigint }): string[] {
  return [conversation.buyerId.toString(), conversation.sellerId.toString()];
}

let deliveryTableMissingUntil = 0;
function deliveryTableMissing(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021'
    && String(error.meta?.table).includes('human_message_deliveries');
}

async function deliveryDates(messageIds: string[]): Promise<Map<string, Date>> {
  if (!messageIds.length || Date.now() < deliveryTableMissingUntil) return new Map();
  try {
    const rows = await prisma.humanMessageDelivery.findMany({ where: { messageId: { in: messageIds } },
      select: { messageId: true, deliveredAt: true } });
    return new Map(rows.map((row) => [row.messageId, row.deliveredAt]));
  } catch (error) {
    if (deliveryTableMissing(error)) { deliveryTableMissingUntil = Date.now() + 30_000; return new Map(); }
    throw error;
  }
}

function serializeMessage(message: { id: string; senderId: bigint; content: string; createdAt: Date; attachments: { id: string; mimeType: string; byteSize: number }[] }, actor: Actor, otherReadAt?: Date | null, deliveredAt?: Date) {
  const seen = message.senderId === actor.userId && Boolean(otherReadAt && message.createdAt <= otherReadAt);
  return { id: message.id, mine: message.senderId === actor.userId, content: message.content, createdAt: message.createdAt.toISOString(),
    seen, status: seen ? 'SEEN' : deliveredAt ? 'DELIVERED' : 'SENT', deliveredAt: deliveredAt?.toISOString() ?? null,
    attachments: message.attachments.map((item) => ({ id: item.id, mimeType: item.mimeType, byteSize: item.byteSize })) };
}

export async function openConversation(actor: Actor, storeSlug: string, productPublicId?: string) {
  if (actor.role !== 'BUYER') throw new ForbiddenError('Only buyers can start a conversation');
  await enforceRate(`rate:f21:human-open:${actor.userId}`, 3600, 20);
  const store = await prisma.sellerProfile.findFirst({ where: { storeSlug, deletedAt: null, onboardingCompletedAt: { not: null },
    user: { status: 'ACTIVE', role: 'SELLER', deletedAt: null }, products: { some: { status: 'LIVE', deletedAt: null } } },
    select: { userId: true } });
  if (!store) throw new NotFoundError('Store not found');
  let productId: bigint | undefined;
  if (productPublicId) {
    const product = await prisma.product.findFirst({ where: { publicId: productPublicId, sellerId: store.userId, status: 'LIVE', deletedAt: null }, select: { productId: true } });
    if (!product) throw new NotFoundError('Product not found');
    productId = product.productId;
  }
  const blocked = await prisma.humanConversation.findUnique({ where: { buyerId_sellerId: { buyerId: actor.userId, sellerId: store.userId } }, select: { buyerBlockedAt: true, sellerBlockedAt: true } });
  if (blocked?.buyerBlockedAt || blocked?.sellerBlockedAt) throw new ForbiddenError('Conversation is blocked');
  const row = await prisma.humanConversation.upsert({ where: { buyerId_sellerId: { buyerId: actor.userId, sellerId: store.userId } },
    create: { buyerId: actor.userId, sellerId: store.userId, productId }, update: {} });
  return { id: row.id };
}

export async function listConversations(actor: Actor, page: number, limit: number) {
  const where = actor.role === 'BUYER' ? { buyerId: actor.userId } : { sellerId: actor.userId };
  const [rows, total] = await prisma.$transaction([
    prisma.humanConversation.findMany({ where, orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * limit, take: limit,
      include: { seller: { select: { storeName: true, storeSlug: true } },
        messages: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 1, include: messageInclude } } }),
    prisma.humanConversation.count({ where }),
  ]);
  const names = actor.role === 'SELLER' ? await buyerDisplayNames(rows.map((row) => row.buyerId)) : new Map<bigint, string>();
  const deliveries = await deliveryDates(rows.flatMap((row) => row.messages.map((message) => message.id)));
  const items = await Promise.all(rows.map(async (row) => {
    const lastReadAt = actor.role === 'BUYER' ? row.buyerLastReadAt : row.sellerLastReadAt;
    const unreadCount = await prisma.humanMessage.count({ where: { conversationId: row.id, senderId: { not: actor.userId },
      ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}) } });
    const otherReadAt = actor.role === 'BUYER' ? row.sellerLastReadAt : row.buyerLastReadAt;
    return { id: row.id, storeName: row.seller.storeName, storeSlug: row.seller.storeSlug,
      buyerName: actor.role === 'SELLER' ? names.get(row.buyerId) ?? null : undefined,
      blocked: Boolean(row.buyerBlockedAt || row.sellerBlockedAt), unreadCount,
      lastMessage: row.messages[0] ? serializeMessage(row.messages[0], actor, otherReadAt, deliveries.get(row.messages[0].id)) : null,
      lastMessageAt: row.lastMessageAt.toISOString() };
  }));
  return { items, page, limit, total, hasMore: page * limit < total };
}

export async function listMessages(actor: Actor, id: string, cursor: string | undefined, limit: number) {
  const conversation = await conversationFor(actor, id);
  // Prisma's cursor is a unique message id; restrict it to this conversation before paging.
  if (cursor && !await prisma.humanMessage.findFirst({ where: { id: cursor, conversationId: id }, select: { id: true } })) throw new ValidationError('Invalid message cursor');
  const rows = await prisma.humanMessage.findMany({ where: { conversationId: id }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}), take: limit + 1, include: messageInclude });
  const items = rows.slice(0, limit);
  const deliveries = await deliveryDates(items.map((row) => row.id));
  const otherReadAt = actor.role === 'BUYER' ? conversation.sellerLastReadAt : conversation.buyerLastReadAt;
  return { conversation: { id: conversation.id, storeName: conversation.seller.storeName, storeSlug: conversation.seller.storeSlug,
    buyerName: actor.role === 'SELLER' ? await buyerDisplayName(conversation.buyerId) : undefined,
    blocked: Boolean(conversation.buyerBlockedAt || conversation.sellerBlockedAt),
    blockedByMe: Boolean(actor.role === 'BUYER' ? conversation.buyerBlockedAt : conversation.sellerBlockedAt) },
    items: items.map((row) => serializeMessage(row, actor, otherReadAt, deliveries.get(row.id))), nextCursor: rows.length > limit ? items[items.length - 1]?.id : null };
}

export async function getUnreadCount(actor: Actor) {
  const rows = await prisma.humanConversation.findMany({ where: actor.role === 'BUYER' ? { buyerId: actor.userId } : { sellerId: actor.userId },
    select: { id: true, buyerLastReadAt: true, sellerLastReadAt: true } });
  const counts = await Promise.all(rows.map((row) => prisma.humanMessage.count({ where: { conversationId: row.id, senderId: { not: actor.userId },
    ...((actor.role === 'BUYER' ? row.buyerLastReadAt : row.sellerLastReadAt) ?
      { createdAt: { gt: (actor.role === 'BUYER' ? row.buyerLastReadAt : row.sellerLastReadAt)! } } : {}) } })));
  return { unreadCount: counts.reduce((sum, count) => sum + count, 0) };
}

export async function sendMessage(actor: Actor, id: string, clientId: string, content: string, files: Express.Multer.File[]) {
  const conversation = await conversationFor(actor, id);
  if (conversation.buyerBlockedAt || conversation.sellerBlockedAt) throw new ForbiddenError('Conversation is blocked');
  if (!content && files.length === 0) throw new ValidationError('Message or image required');
  if (files.length > 3) throw new ValidationError('Maximum three images per message');
  const existing = await prisma.humanMessage.findFirst({ where: { conversationId: id, senderId: actor.userId, clientId }, include: messageInclude });
  if (existing) return { message: serializeMessage(existing, actor, undefined, (await deliveryDates([existing.id])).get(existing.id)), created: false, participantIds: participantIds(conversation) };
  await enforceRate(`rate:f21:human-send:${actor.userId}`, 60, 20);
  const prepared = files.map((file, position) => ({ file, position, mimeType: validateImageFile(file, 'CHAT_IMAGE_TOO_LARGE', 'CHAT_IMAGE_INVALID') }));
  const buyerName = actor.role === 'BUYER' ? await buyerDisplayName(actor.userId) : null;
  const saved: string[] = [];
  try {
    for (const item of prepared) {
      const ext = item.mimeType === 'image/jpeg' ? 'jpg' : item.mimeType === 'image/png' ? 'png' : 'webp';
      const key = `human-chat/${id}/${randomUUID()}.${ext}`;
      await savePrivateEvidence(key, item.file.buffer, item.mimeType);
      saved.push(key);
    }
    const persist = () => prisma.$transaction(async (tx) => {
      const current = await tx.humanConversation.findUnique({ where: { id } });
      if (!current || current.buyerBlockedAt || current.sellerBlockedAt) throw new ForbiddenError('Conversation is blocked');
      const created = await tx.humanMessage.create({ data: { conversationId: id, senderId: actor.userId, clientId, content,
        attachments: { create: prepared.map((item, position) => ({ position, objectKey: saved[position]!, mimeType: item.mimeType, byteSize: item.file.size })) } }, include: messageInclude });
      await tx.humanConversation.updateMany({ where: { id, lastMessageAt: { lte: created.createdAt } }, data: { lastMessageAt: created.createdAt } });
      const recipientId = actor.role === 'BUYER' ? current.sellerId : current.buyerId;
      const recipient = await tx.user.findUnique({ where: { userId: recipientId }, select: { preferredLanguage: true } });
      if (recipient) await tx.notification.create({ data: { userId: recipientId, channel: 'IN_APP', eventType: 'HUMAN_CHAT_MESSAGE',
        message: buyerName
          ? recipient.preferredLanguage === 'UR' ? `${buyerName} نے آپ کو پیغام بھیجا ہے` : `${buyerName} sent you a message`
          : recipient.preferredLanguage === 'UR' ? 'آپ کو نیا پیغام موصول ہوا ہے' : 'You have a new message',
        language: recipient.preferredLanguage, status: 'SENT', sentAt: new Date() } });
      return created;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    let message: Awaited<ReturnType<typeof persist>> | undefined;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try { message = await persist(); break; }
      catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') || attempt === 2) throw error;
      }
    }
    if (!message) throw new ConflictError('Message was not saved; retry with the same client ID');
    return { message: serializeMessage(message, actor), created: true, participantIds: participantIds(conversation) };
  } catch (error) {
    await Promise.allSettled(saved.map((key) => deletePrivateEvidence(key)));
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const duplicate = await prisma.humanMessage.findFirst({ where: { conversationId: id, senderId: actor.userId, clientId }, include: messageInclude });
      if (duplicate) return { message: serializeMessage(duplicate, actor, undefined, (await deliveryDates([duplicate.id])).get(duplicate.id)), created: false, participantIds: participantIds(conversation) };
    }
    throw error;
  }
}

/** One verified recipient device is sufficient. The unique message_id makes retries idempotent. */
export async function acknowledgeDelivery(actor: Actor, conversationId: string, messageIds: string[]) {
  const conversation = await conversationFor(actor, conversationId);
  const uniqueIds = [...new Set(messageIds)];
  if (!uniqueIds.length || uniqueIds.length > 50) throw new ValidationError('Invalid delivery acknowledgement');
  const messages = await prisma.humanMessage.findMany({ where: { conversationId, id: { in: uniqueIds } },
    select: { id: true, senderId: true } });
  const senderId = actor.role === 'BUYER' ? conversation.sellerId : conversation.buyerId;
  if (messages.length !== uniqueIds.length || messages.some((message) => message.senderId !== senderId)) {
    throw new ForbiddenError('Cannot acknowledge these messages');
  }
  if (Date.now() < deliveryTableMissingUntil) return { supported: false, changed: false, senderId: null, messageIds: [] as string[] };
  try {
    const result = await prisma.humanMessageDelivery.createMany({ data: messages.map((message) => ({ messageId: message.id })), skipDuplicates: true });
    return { supported: true, changed: result.count > 0,
      senderId: senderId.toString(), messageIds: uniqueIds };
  } catch (error) {
    if (deliveryTableMissing(error)) {
      deliveryTableMissingUntil = Date.now() + 30_000;
      return { supported: false, changed: false, senderId: null, messageIds: [] as string[] };
    }
    throw error;
  }
}

export async function readAttachment(actor: Actor, conversationId: string, attachmentId: string) {
  await conversationFor(actor, conversationId);
  const attachment = await prisma.humanMessageAttachment.findFirst({ where: { id: attachmentId, message: { conversationId } }, select: { objectKey: true, mimeType: true } });
  if (!attachment) throw new NotFoundError('Image not found');
  const result = await readPrivateEvidence(attachment.objectKey);
  return { buffer: result.buffer, mimeType: attachment.mimeType };
}

export async function markRead(actor: Actor, id: string, lastSeenMessageId?: string) {
  const conversation = await conversationFor(actor, id);
  const last = await prisma.humanMessage.findFirst({ where: {
    conversationId: id, senderId: { not: actor.userId }, ...(lastSeenMessageId ? { id: lastSeenMessageId } : {}),
  }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { createdAt: true } });
  if (lastSeenMessageId && !last) throw new ValidationError('Message is not in this conversation');
  if (!last) return { readAt: null, changed: false, participantIds: participantIds(conversation) };
  const field = actor.role === 'BUYER' ? 'buyerLastReadAt' : 'sellerLastReadAt';
  const updated = await prisma.humanConversation.updateMany({ where: { id, OR: [{ [field]: null }, { [field]: { lt: last.createdAt } }] }, data: { [field]: last.createdAt } });
  return { readAt: last.createdAt.toISOString(), changed: updated.count > 0, participantIds: participantIds(conversation) };
}

export async function setBlocked(actor: Actor, id: string, blocked: boolean) {
  const conversation = await conversationFor(actor, id);
  const field = actor.role === 'BUYER' ? 'buyerBlockedAt' : 'sellerBlockedAt';
  await prisma.humanConversation.update({ where: { id }, data: { [field]: blocked ? new Date() : null } });
  return { blocked, participantIds: participantIds(conversation) };
}

export async function reportConversation(actor: Actor, id: string, reason: string, messageId?: string) {
  await conversationFor(actor, id);
  await enforceRate(`rate:f21:human-report:${actor.userId}`, 3600, 3);
  if (messageId && !await prisma.humanMessage.findFirst({ where: { id: messageId, conversationId: id }, select: { id: true } })) throw new NotFoundError('Message not found');
  const report = await prisma.humanConversationReport.create({ data: { conversationId: id, reporterId: actor.userId, reason, messageId } });
  return { id: report.id, createdAt: report.createdAt.toISOString() };
}
