import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '../../app/i18n';
import { useAuthStore } from '../../lib/authStore';
import { HumanMessagesPage } from './HumanMessagesPage';
import { listHumanConversations, listHumanMessages, markHumanConversationRead, sendHumanMessage } from './humanChatApi';
import { useHumanChatSocket } from './useHumanChatSocket';

vi.mock('./useHumanChatSocket', () => ({ useHumanChatSocket: vi.fn(() => 'connected') }));

vi.mock('./humanChatApi', () => ({
  listHumanConversations: vi.fn(), listHumanMessages: vi.fn(), markHumanConversationRead: vi.fn(),
  openHumanConversation: vi.fn(), sendHumanMessage: vi.fn(), loadHumanAttachment: vi.fn(),
  blockHumanConversation: vi.fn(), reportHumanConversation: vi.fn(),
}));

function renderPage(path = '/messages') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><HumanMessagesPage /></MemoryRouter></QueryClientProvider>);
}

beforeEach(() => {
  void i18n.changeLanguage('en');
  vi.clearAllMocks();
  vi.mocked(useHumanChatSocket).mockReturnValue({ status: 'connected', typing: false, setTyping: vi.fn() });
  useAuthStore.getState().setSession('test-token', { id: 'buyer', role: 'BUYER', status: 'ACTIVE', preferredLanguage: 'EN' });
  vi.mocked(listHumanConversations).mockResolvedValue({ items: [{ id: 'conv', storeName: 'Cloth Corner', storeSlug: 'cloth-corner',
    blocked: false, unreadCount: 1, lastMessage: null, lastMessageAt: '2026-10-19T00:00:00.000Z' }], page: 1, limit: 20, total: 1, hasMore: false });
  vi.mocked(listHumanMessages).mockResolvedValue({ conversation: { id: 'conv', storeName: 'Cloth Corner', storeSlug: 'cloth-corner', blocked: false, blockedByMe: false }, items: [{
    id: 'msg', mine: false, seen: false, content: 'Hello buyer', createdAt: '2026-10-19T00:00:00.000Z', attachments: [],
  }], nextCursor: null });
  vi.mocked(markHumanConversationRead).mockResolvedValue({ readAt: '2026-10-19T00:00:00.000Z' });
});

describe('human messages page', () => {
  it('shows persisted conversations and the selected message', async () => {
    renderPage('/messages?conversation=conv');
    expect(await screen.findByText('Hello buyer')).toBeInTheDocument();
    expect(screen.getAllByText('Cloth Corner').length).toBeGreaterThan(0);
    expect(markHumanConversationRead).toHaveBeenCalledWith('conv', 'msg');
  });

  it('sends the typed text with an idempotency key and refreshes the history', async () => {
    vi.mocked(sendHumanMessage).mockResolvedValue({ id: 'new', mine: true, seen: false, content: 'Thanks', createdAt: '2026-10-19T00:00:01.000Z', attachments: [] });
    renderPage('/messages?conversation=conv');
    fireEvent.change(await screen.findByPlaceholderText('Write a message'), { target: { value: 'Thanks' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(sendHumanMessage).toHaveBeenCalledWith('conv', expect.any(String), 'Thanks', []));
  });

  it('provides an empty state', async () => {
    vi.mocked(listHumanConversations).mockResolvedValue({ items: [], page: 1, limit: 20, total: 0, hasMore: false });
    renderPage();
    expect(await screen.findByText('No conversations yet')).toBeInTheDocument();
  });

  it('keeps REST history visible when live updates are offline', async () => {
    vi.mocked(useHumanChatSocket).mockReturnValue({ status: 'offline', typing: false, setTyping: vi.fn() });
    renderPage('/messages?conversation=conv');
    expect(await screen.findByText('Hello buyer')).toBeInTheDocument();
    expect(screen.getByText(/Live updates unavailable/)).toBeInTheDocument();
  });

  it('shows the buyer name for sellers and labels persisted reads', async () => {
    useAuthStore.getState().setSession('seller-token', { id: 'seller', role: 'SELLER', status: 'ACTIVE', preferredLanguage: 'EN' });
    vi.mocked(listHumanConversations).mockResolvedValue({ items: [{ id: 'conv', storeName: 'Cloth Corner', storeSlug: 'cloth-corner', buyerName: 'Ayesha Khan',
      blocked: false, unreadCount: 0, lastMessage: null, lastMessageAt: '2026-10-19T00:00:00.000Z' }], page: 1, limit: 20, total: 1, hasMore: false });
    vi.mocked(listHumanMessages).mockResolvedValue({ conversation: { id: 'conv', storeName: 'Cloth Corner', storeSlug: 'cloth-corner', buyerName: 'Ayesha Khan', blocked: false, blockedByMe: false },
      items: [{ id: 'sent', mine: true, seen: true, content: 'Your parcel is ready', createdAt: '2026-10-19T00:00:01.000Z', attachments: [] }], nextCursor: null });
    renderPage('/seller/messages?conversation=conv');
    expect((await screen.findAllByText('Ayesha Khan')).length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Seen')).toBeInTheDocument();
  });

  it('uses Buyer instead of an internal identifier when the buyer has no display name', async () => {
    useAuthStore.getState().setSession('seller-token', { id: 'seller', role: 'SELLER', status: 'ACTIVE', preferredLanguage: 'EN' });
    vi.mocked(listHumanConversations).mockResolvedValue({ items: [{ id: 'conv', storeName: 'Cloth Corner', storeSlug: 'cloth-corner', buyerName: null,
      blocked: false, unreadCount: 0, lastMessage: null, lastMessageAt: '2026-10-19T00:00:00.000Z' }], page: 1, limit: 20, total: 1, hasMore: false });
    vi.mocked(listHumanMessages).mockResolvedValue({ conversation: { id: 'conv', storeName: 'Cloth Corner', storeSlug: 'cloth-corner', buyerName: null, blocked: false, blockedByMe: false },
      items: [], nextCursor: null });
    renderPage('/seller/messages?conversation=conv');
    expect((await screen.findAllByText('Buyer')).length).toBeGreaterThan(0);
    expect(screen.queryByText('conv')).not.toBeInTheDocument();
  });
});
