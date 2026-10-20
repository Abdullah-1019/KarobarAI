import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { io } from 'socket.io-client';

import { useAuthStore } from '../../lib/authStore';
import { useHumanChatSocket } from './useHumanChatSocket';

vi.mock('socket.io-client', () => ({ io: vi.fn() }));

type Handler = (...args: unknown[]) => void;
const handlers = new Map<string, Handler>();
const socket = {
  connected: true,
  on: vi.fn((name: string, handler: Handler) => { handlers.set(name, handler); }),
  emit: vi.fn((name: string, _payload: unknown, callback?: (...args: unknown[]) => void) => {
    if (name === 'conversation:join') callback?.({ ok: true });
    if (name === 'delivery:ack') callback?.(null, { ok: true });
  }),
  timeout: vi.fn(() => socket),
  removeAllListeners: vi.fn(),
  disconnect: vi.fn(),
};

const queryClient = new QueryClient();
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  queryClient.clear();
  handlers.clear();
  vi.clearAllMocks();
  vi.mocked(io).mockReturnValue(socket as unknown as ReturnType<typeof io>);
  useAuthStore.getState().setSession('buyer-test-token', { id: 'buyer', role: 'BUYER', status: 'ACTIVE', preferredLanguage: 'EN' });
});

describe('human chat delivery socket', () => {
  it('acknowledges fetched messages while connected and deduplicates until reconnect', async () => {
    const { result } = renderHook(() => useHumanChatSocket('conversation'), { wrapper });
    socket.connected = false;
    act(() => result.current.acknowledgeDelivery('conversation', ['msg']));
    expect(socket.emit).not.toHaveBeenCalledWith('delivery:ack', expect.anything(), expect.anything());
    socket.connected = true;
    act(() => handlers.get('connect')?.());
    await waitFor(() => expect(result.current.joined).toBe(true));
    act(() => result.current.acknowledgeDelivery('conversation', ['msg', 'msg']));
    expect(socket.emit).toHaveBeenCalledWith('delivery:ack', { conversationId: 'conversation', messageIds: ['msg'] }, expect.any(Function));
    const count = socket.emit.mock.calls.filter((call) => call[0] === 'delivery:ack').length;
    act(() => result.current.acknowledgeDelivery('conversation', ['msg']));
    expect(socket.emit.mock.calls.filter((call) => call[0] === 'delivery:ack')).toHaveLength(count);
    act(() => handlers.get('disconnect')?.());
    expect(result.current.joined).toBe(false);
    act(() => handlers.get('connect')?.());
    await waitFor(() => expect(result.current.joined).toBe(true));
    act(() => result.current.acknowledgeDelivery('conversation', ['msg']));
    expect(socket.emit.mock.calls.filter((call) => call[0] === 'delivery:ack')).toHaveLength(count + 1);
  });
});
