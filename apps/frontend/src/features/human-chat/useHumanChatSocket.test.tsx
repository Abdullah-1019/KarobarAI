import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import { io } from 'socket.io-client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from '../../lib/authStore';
import { useHumanChatSocket } from './useHumanChatSocket';

vi.mock('socket.io-client', () => ({ io: vi.fn() }));

type Listener = (payload?: { conversationId: string; typing?: boolean }) => void;
function fakeSocket() {
  const listeners = new Map<string, Listener>();
  return {
    connected: true,
    on: vi.fn((name: string, listener: Listener) => { listeners.set(name, listener); }),
    emit: vi.fn((_name: string, _payload: unknown, ack?: (result: { ok: boolean }) => void) => ack?.({ ok: true })),
    removeAllListeners: vi.fn(() => listeners.clear()),
    disconnect: vi.fn(),
    fire: (name: string, payload?: { conversationId: string; typing?: boolean }) => listeners.get(name)?.(payload),
  };
}

function Status({ conversationId }: { conversationId: string }) {
  const { status, typing, setTyping } = useHumanChatSocket(conversationId);
  return <><span>{status}</span><span>{typing ? 'remote typing' : 'remote idle'}</span>
    <button onClick={() => setTyping(true)}>Start typing</button>
    <button onClick={() => setTyping(false)}>Stop typing</button></>;
}

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.getState().setSession('test-token', { id: 'buyer', role: 'BUYER', status: 'ACTIVE', preferredLanguage: 'EN' });
});

describe('human chat socket REST reconciliation', () => {
  it('joins the selected room and refetches persisted data on connect and message notice', () => {
    const socket = fakeSocket();
    vi.mocked(io).mockReturnValue(socket as unknown as ReturnType<typeof io>);
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries').mockResolvedValue();
    const view = render(<QueryClientProvider client={client}><Status conversationId="conversation-1" /></QueryClientProvider>);
    expect(io).toHaveBeenCalledWith(expect.stringContaining('/human-chat'), expect.objectContaining({ auth: { token: 'test-token' } }));
    act(() => socket.fire('connect'));
    expect(screen.getByText('connected')).toBeInTheDocument();
    expect(socket.emit).toHaveBeenCalledWith('conversation:join', { conversationId: 'conversation-1' }, expect.any(Function));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['human-messages', 'conversation-1'] });
    invalidate.mockClear();
    act(() => socket.fire('message:created', { conversationId: 'conversation-1' }));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['human-messages', 'conversation-1'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['human-conversations'] });
    view.unmount();
    expect(socket.disconnect).toHaveBeenCalledOnce();
  });

  it('keeps REST available while disconnected and refetches after reconnect', () => {
    const socket = fakeSocket();
    vi.mocked(io).mockReturnValue(socket as unknown as ReturnType<typeof io>);
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries').mockResolvedValue();
    render(<QueryClientProvider client={client}><Status conversationId="conversation-2" /></QueryClientProvider>);
    act(() => socket.fire('disconnect'));
    expect(screen.getByText('offline')).toBeInTheDocument();
    invalidate.mockClear();
    act(() => socket.fire('connect'));
    expect(screen.getByText('connected')).toBeInTheDocument();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['human-messages', 'conversation-2'] });
  });

  it('limits typing to the selected conversation and clears it on disconnect', () => {
    const socket = fakeSocket();
    vi.mocked(io).mockReturnValue(socket as unknown as ReturnType<typeof io>);
    const client = new QueryClient();
    render(<QueryClientProvider client={client}><Status conversationId="conversation-3" /></QueryClientProvider>);
    act(() => socket.fire('connect'));
    act(() => socket.fire('typing:changed', { conversationId: 'another', typing: true }));
    expect(screen.getByText('remote idle')).toBeInTheDocument();
    act(() => socket.fire('typing:changed', { conversationId: 'conversation-3', typing: true }));
    expect(screen.getByText('remote typing')).toBeInTheDocument();
    act(() => screen.getByText('Start typing').click());
    expect(socket.emit).toHaveBeenCalledWith('typing:set', { conversationId: 'conversation-3', typing: true });
    act(() => screen.getByText('Stop typing').click());
    expect(socket.emit).toHaveBeenCalledWith('typing:set', { conversationId: 'conversation-3', typing: false });
    act(() => socket.fire('disconnect'));
    expect(screen.getByText('remote idle')).toBeInTheDocument();
  });
});
