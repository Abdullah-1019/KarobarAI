import { Router } from 'express';
import { z } from 'zod';

import { asyncHandler } from '../../core/http/asyncHandler';
import { ok } from '../../core/http/envelope';
import { authenticate } from '../../core/middleware/authenticate';
import { authorize } from '../../core/middleware/authorize';
import { validateBody, validateQuery } from '../../core/middleware/validate';
import { arrayImageUpload } from '../../core/upload/imageValidation';
import { ValidationError } from '../../core/errors/AppError';
import { getUnreadCount, listConversations, listMessages, markRead, openConversation, readAttachment, reportConversation, resolveActor, sendMessage, setBlocked } from './human-chat.service';
import { publishHumanConversationChanged, publishHumanMessage, publishHumanRead } from './human-chat.socket';

export const humanChatRouter = Router();
humanChatRouter.use(authenticate, authorize('BUYER', 'SELLER'));

const listSchema = z.object({ page: z.coerce.number().int().min(1).max(100000).default(1), limit: z.coerce.number().int().min(1).max(30).default(20) }).strict();
const messagesSchema = z.object({ cursor: z.string().cuid().optional(), limit: z.coerce.number().int().min(1).max(50).default(30) }).strict();
const openSchema = z.object({ storeSlug: z.string().trim().min(1).max(180), productPublicId: z.string().uuid().optional() }).strict();
const sendSchema = z.object({ clientId: z.string().uuid(), content: z.string().trim().max(2000).default('') }).strict();
const reportSchema = z.object({ reason: z.string().trim().min(10).max(500), messageId: z.string().cuid().optional() }).strict();
const blockSchema = z.object({ blocked: z.boolean() }).strict();

async function actor(req: { user?: { sub: string } }) {
  return resolveActor(req.user!.sub);
}
function required(value: string | undefined): string {
  if (!value) throw new ValidationError('Missing conversation identifier');
  return value;
}

humanChatRouter.get('/unread-count', asyncHandler(async (req, res) => {
  res.json(ok(await getUnreadCount(await actor(req))));
}));
humanChatRouter.get('/conversations', validateQuery(listSchema), asyncHandler(async (req, res) => {
  const query = listSchema.parse(req.query);
  res.json(ok(await listConversations(await actor(req), query.page, query.limit)));
}));
humanChatRouter.post('/conversations', authorize('BUYER'), validateBody(openSchema), asyncHandler(async (req, res) => {
  res.status(201).json(ok(await openConversation(await actor(req), req.body.storeSlug, req.body.productPublicId)));
}));
humanChatRouter.get('/conversations/:id/messages', validateQuery(messagesSchema), asyncHandler(async (req, res) => {
  const query = messagesSchema.parse(req.query);
  res.json(ok(await listMessages(await actor(req), required(req.params.id), query.cursor, query.limit)));
}));
humanChatRouter.post('/conversations/:id/messages', arrayImageUpload('images', 3, 'CHAT_IMAGE_TOO_LARGE'), asyncHandler(async (req, res) => {
  const parsed = sendSchema.safeParse(req.body);
  if (!parsed.success) throw new ValidationError('Invalid message', parsed.error.flatten());
  const id = required(req.params.id);
  const result = await sendMessage(await actor(req), id, parsed.data.clientId, parsed.data.content, (req.files as Express.Multer.File[] | undefined) ?? []);
  if (result.created) publishHumanMessage(id, result.message.id, result.participantIds);
  res.status(201).json(ok(result.message));
}));
humanChatRouter.get('/conversations/:id/attachments/:attachmentId', asyncHandler(async (req, res) => {
  const image = await readAttachment(await actor(req), required(req.params.id), required(req.params.attachmentId));
  res.setHeader('Content-Type', image.mimeType);
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.send(image.buffer);
}));
humanChatRouter.post('/conversations/:id/read', asyncHandler(async (req, res) => {
  const id = required(req.params.id);
  const parsed = z.object({ lastSeenMessageId: z.string().cuid().optional() }).strict().safeParse(req.body ?? {});
  if (!parsed.success) throw new ValidationError('Invalid read position');
  const result = await markRead(await actor(req), id, parsed.data.lastSeenMessageId);
  if (result.changed && result.readAt) publishHumanRead(id, result.readAt, result.participantIds);
  res.json(ok({ readAt: result.readAt }));
}));
humanChatRouter.post('/conversations/:id/reports', validateBody(reportSchema), asyncHandler(async (req, res) => {
  res.status(201).json(ok(await reportConversation(await actor(req), required(req.params.id), req.body.reason, req.body.messageId)));
}));
humanChatRouter.put('/conversations/:id/block', validateBody(blockSchema), asyncHandler(async (req, res) => {
  const id = required(req.params.id);
  const result = await setBlocked(await actor(req), id, req.body.blocked);
  publishHumanConversationChanged(id, result.participantIds);
  res.json(ok({ blocked: result.blocked }));
}));
