import type { Server as SocketIOServer, Namespace } from 'socket.io';
import { z } from 'zod';

import { verifyAccessToken } from '../../core/jwt';
import { redis } from '../../core/redis';
import { assertConversationCanType, assertConversationParticipant, resolveActor } from './human-chat.service';

const conversationIdSchema = z.string().cuid();
let namespace: Namespace | undefined;

function userRoom(userId: string): string { return `user:${userId}`; }
function conversationRoom(conversationId: string): string { return `conversation:${conversationId}`; }

async function authenticatedActor(token: string) {
  const claims = verifyAccessToken(token);
  const [jtiDenied, userDeniedSince] = await redis.mget(`denylist:jti:${claims.jti}`, `denylist:user:${claims.sub}`);
  if (jtiDenied || (userDeniedSince && claims.iatMs < Number(userDeniedSince))) throw new Error('Session revoked');
  const actor = await resolveActor(claims.sub);
  if (actor.role !== claims.role) throw new Error('Role changed');
  return { actor, expiresAt: claims.exp * 1000 };
}

export function registerHumanChatSocket(io: SocketIOServer): void {
  if (namespace) return;
  namespace = io.of('/human-chat');
  namespace.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (typeof token !== 'string' || !token) return next(new Error('Unauthorized'));
    try {
      const { actor, expiresAt } = await authenticatedActor(token);
      socket.data.humanChatToken = token;
      socket.data.humanChatUserId = actor.userId.toString();
      socket.data.humanChatExpiresAt = expiresAt;
      next();
    } catch { next(new Error('Unauthorized')); }
  });

  namespace.on('connection', (socket) => {
    const typingTimers = new Map<string, ReturnType<typeof setTimeout>>();
    const stopTyping = (id: string) => {
      const timer = typingTimers.get(id);
      if (!timer) return;
      clearTimeout(timer);
      typingTimers.delete(id);
      socket.to(conversationRoom(id)).emit('typing:changed', { conversationId: id, typing: false });
    };
    socket.join(userRoom(socket.data.humanChatUserId as string));
    const checkSession = async () => {
      try { await authenticatedActor(socket.data.humanChatToken as string); }
      catch { socket.disconnect(true); }
    };
    // Revoked or expired sessions must not keep receiving private room events indefinitely.
    const sessionCheck = setInterval(() => { void checkSession(); }, 30_000);
    sessionCheck.unref();
    socket.on('disconnect', () => {
      clearInterval(sessionCheck);
      for (const id of typingTimers.keys()) stopTyping(id);
    });

    socket.on('conversation:join', async (payload: unknown, ack?: (result: { ok: boolean }) => void) => {
      const id = z.object({ conversationId: conversationIdSchema }).safeParse(payload);
      if (!id.success) { ack?.({ ok: false }); return; }
      try {
        const { actor } = await authenticatedActor(socket.data.humanChatToken as string);
        await assertConversationParticipant(actor, id.data.conversationId);
        if (socket.connected) {
          socket.join(conversationRoom(id.data.conversationId));
          ack?.({ ok: true });
        }
      } catch { ack?.({ ok: false }); socket.disconnect(true); }
    });
    socket.on('conversation:leave', (payload: unknown) => {
      const id = z.object({ conversationId: conversationIdSchema }).safeParse(payload);
      if (id.success) {
        stopTyping(id.data.conversationId);
        socket.leave(conversationRoom(id.data.conversationId));
      }
    });
    socket.on('typing:set', async (payload: unknown) => {
      const parsed = z.object({ conversationId: conversationIdSchema, typing: z.boolean() }).strict().safeParse(payload);
      if (!parsed.success) return;
      const { conversationId, typing } = parsed.data;
      if (!socket.rooms.has(conversationRoom(conversationId))) return;
      if (!typing) { stopTyping(conversationId); return; }
      try {
        const { actor } = await authenticatedActor(socket.data.humanChatToken as string);
        await assertConversationCanType(actor, conversationId);
        if (!socket.connected || !socket.rooms.has(conversationRoom(conversationId))) return;
        const current = typingTimers.get(conversationId);
        if (current) clearTimeout(current);
        else socket.to(conversationRoom(conversationId)).emit('typing:changed', { conversationId, typing: true });
        const timer = setTimeout(() => stopTyping(conversationId), 5000);
        timer.unref();
        typingTimers.set(conversationId, timer);
      } catch { stopTyping(conversationId); }
    });
  });
}

export function publishHumanMessage(conversationId: string, messageId: string, participantIds: string[]): void {
  if (!namespace) return;
  namespace.to(conversationRoom(conversationId)).emit('message:created', { conversationId, messageId });
  publishHumanConversationChanged(conversationId, participantIds);
}

export function publishHumanRead(conversationId: string, readAt: string, participantIds: string[]): void {
  if (!namespace) return;
  namespace.to(conversationRoom(conversationId)).emit('read:changed', { conversationId, readAt });
  publishHumanConversationChanged(conversationId, participantIds);
}

export function publishHumanConversationChanged(conversationId: string, participantIds: string[]): void {
  if (!namespace) return;
  for (const id of participantIds) namespace.to(userRoom(id)).emit('conversation:changed', { conversationId });
}
