import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';

import { apiRootUrl } from '../../api';
import { useAuthStore } from '../../lib/authStore';

type SocketStatus = 'connecting' | 'connected' | 'offline';
export type HumanChatSocket = { status: SocketStatus; typing: boolean; setTyping: (typing: boolean) => void };

// Socket events are change notices. REST remains the source of message history and unread counts.
export function useHumanChatSocket(conversationId: string | null): HumanChatSocket {
  const token = useAuthStore((state) => state.accessToken);
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<SocketStatus>('connecting');
  const [typing, setRemoteTyping] = useState(false);
  const socketRef = useRef<ReturnType<typeof io> | null>(null);
  const lastTypingAt = useRef(0);
  const remoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setTyping = useCallback((active: boolean) => {
    const socket = socketRef.current;
    if (!conversationId || !socket?.connected) return;
    if (active && Date.now() - lastTypingAt.current < 2000) return;
    lastTypingAt.current = active ? Date.now() : 0;
    socket.emit('typing:set', { conversationId, typing: active });
  }, [conversationId]);

  useEffect(() => {
    if (!token) { setStatus('offline'); return; }
    setStatus('connecting');
    const socket = io(`${apiRootUrl}/human-chat`, { auth: { token }, withCredentials: true });
    socketRef.current = socket;
    setRemoteTyping(false);
    const refreshConversations = () => { void queryClient.invalidateQueries({ queryKey: ['human-conversations'] }); };
    const refreshMessages = (event: { conversationId?: string }) => {
      refreshConversations();
      if (event?.conversationId === conversationId) {
        void queryClient.invalidateQueries({ queryKey: ['human-messages', conversationId] });
      }
    };
    socket.on('connect', () => {
      setStatus('connected');
      if (conversationId) socket.emit('conversation:join', { conversationId }, (result: { ok: boolean }) => {
        if (!result.ok) void queryClient.invalidateQueries({ queryKey: ['human-messages', conversationId] });
      });
      // Events can be missed while offline; always reconcile with persisted REST state.
      refreshConversations();
      if (conversationId) void queryClient.invalidateQueries({ queryKey: ['human-messages', conversationId] });
    });
    socket.on('connect_error', () => { setStatus('offline'); setRemoteTyping(false); });
    socket.on('disconnect', () => { setStatus('offline'); setRemoteTyping(false); });
    socket.on('typing:changed', (event: { conversationId?: string; typing?: boolean }) => {
      if (event.conversationId !== conversationId) return;
      if (remoteTimer.current) clearTimeout(remoteTimer.current);
      setRemoteTyping(event.typing === true);
      if (event.typing) remoteTimer.current = setTimeout(() => setRemoteTyping(false), 6000);
    });
    socket.on('message:created', refreshMessages);
    socket.on('read:changed', refreshMessages);
    socket.on('conversation:changed', refreshMessages);
    return () => {
      if (conversationId && socket.connected) socket.emit('typing:set', { conversationId, typing: false });
      if (remoteTimer.current) clearTimeout(remoteTimer.current);
      if (socketRef.current === socket) socketRef.current = null;
      socket.removeAllListeners(); socket.disconnect();
    };
  }, [token, conversationId, queryClient]);

  return { status, typing, setTyping };
}
