import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { useAuthStore } from '../../lib/authStore';
import { blockHumanConversation, listHumanConversations, listHumanMessages, loadHumanAttachment, markHumanConversationRead, openHumanConversation, reportHumanConversation, sendHumanMessage } from './humanChatApi';
import type { HumanMessage } from './humanChatApi';
import { useHumanChatSocket } from './useHumanChatSocket';
import './humanChat.css';

function PrivateImage({ conversationId, attachmentId }: { conversationId: string; attachmentId: string }) {
  const [src, setSrc] = useState<string>();
  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | undefined;
    loadHumanAttachment(conversationId, attachmentId).then((url) => {
      if (cancelled) URL.revokeObjectURL(url);
      else { objectUrl = url; setSrc(url); }
    }).catch(() => { if (!cancelled) setSrc(undefined); });
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [conversationId, attachmentId]);
  return src ? <img src={src} alt="" className="human-chat__image" /> : <span className="human-chat__image-placeholder" />;
}

function Message({ item, conversationId, sentLabel, seenLabel }: { item: HumanMessage; conversationId: string; sentLabel: string; seenLabel: string }) {
  return <li className={`human-chat__message ${item.mine ? 'human-chat__message--mine' : ''}`}>
    {item.content && <p dir="auto">{item.content}</p>}
    {item.attachments.map((attachment) => <PrivateImage key={attachment.id} conversationId={conversationId} attachmentId={attachment.id} />)}
    <footer><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time>
      {item.mine && <span aria-label={item.seen ? seenLabel : sentLabel}>{item.seen ? seenLabel : sentLabel}</span>}</footer>
  </li>;
}

export function HumanMessagesPage() {
  const { t } = useTranslation('humanChat');
  const user = useAuthStore((state) => state.user);
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('conversation');
  const store = params.get('store');
  const product = params.get('product') ?? undefined;
  const queryClient = useQueryClient();
  const { status: socketStatus, typing, setTyping } = useHumanChatSocket(selectedId);
  const [page, setPage] = useState(1);
  const [older, setOlder] = useState<HumanMessage[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [pendingClientId, setPendingClientId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendingPreview, setSendingPreview] = useState('');
  const [error, setError] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');

  const conversations = useQuery({ queryKey: ['human-conversations', page], queryFn: () => listHumanConversations(page) });
  const messages = useQuery({ queryKey: ['human-messages', selectedId], queryFn: () => listHumanMessages(selectedId!), enabled: Boolean(selectedId) });

  useEffect(() => {
    if (!store || user?.role !== 'BUYER') return;
    let cancelled = false;
    openHumanConversation(store, product).then(({ id }) => {
      if (!cancelled) setParams({ conversation: id }, { replace: true });
    }).catch(() => { if (!cancelled) setError(t('failed')); });
    return () => { cancelled = true; };
  }, [store, product, user?.role, setParams, t]);

  useEffect(() => { setOlder([]); setNextCursor(null); setError(''); }, [selectedId]);
  useEffect(() => {
    if (!selectedId || !messages.data) return;
    if (older.length === 0) setNextCursor(messages.data.nextCursor);
    const latestIncoming = messages.data.items.find((item) => !item.mine);
    if (!latestIncoming) return;
    const markVisibleRead = () => {
      if (document.visibilityState !== 'visible') return;
      void markHumanConversationRead(selectedId, latestIncoming.id).then(() => queryClient.invalidateQueries({ queryKey: ['human-conversations'] }));
    };
    markVisibleRead();
    document.addEventListener('visibilitychange', markVisibleRead);
    return () => document.removeEventListener('visibilitychange', markVisibleRead);
  }, [selectedId, messages.data, queryClient, older.length]);

  useEffect(() => {
    if (!content || !selectedId) return;
    const timer = window.setTimeout(() => setTyping(false), 3000);
    return () => window.clearTimeout(timer);
  }, [content, selectedId, setTyping]);

  async function send() {
    if (!selectedId || sending) return;
    if (!content.trim() && files.length === 0) { setError(t('onlyImages')); return; }
    setTyping(false);
    setSending(true); setError('');
    setSendingPreview(content.trim());
    const clientId = pendingClientId ?? crypto.randomUUID();
    setPendingClientId(clientId);
    try {
      await sendHumanMessage(selectedId, clientId, content.trim(), files);
      setContent(''); setFiles([]); setPendingClientId(null);
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['human-messages', selectedId] }), queryClient.invalidateQueries({ queryKey: ['human-conversations'] })]);
    } catch { setError(t('failed')); }
    finally { setSending(false); setSendingPreview(''); }
  }

  async function loadOlder() {
    if (!selectedId || !nextCursor) return;
    try {
      const result = await listHumanMessages(selectedId, nextCursor);
      setOlder((current) => [...current, ...result.items]);
      setNextCursor(result.nextCursor);
    } catch { setError(t('failed')); }
  }

  async function setBlock(blocked: boolean) {
    if (!selectedId) return;
    try {
      await blockHumanConversation(selectedId, blocked);
      await Promise.all([messages.refetch(), conversations.refetch()]);
    } catch { setError(t('failed')); }
  }

  async function report() {
    if (!selectedId || reportReason.trim().length < 10) return;
    try {
      await reportHumanConversation(selectedId, reportReason.trim());
      setReportOpen(false); setReportReason(''); setError(t('reported'));
    } catch { setError(t('failed')); }
  }

  const current = conversations.data?.items.find((row) => row.id === selectedId);
  const history = [...(messages.data?.items ?? []), ...older].reverse();
  return <main className="human-chat" dir="auto">
    <h1>{t('title')}</h1>
    {socketStatus === 'offline' && <p role="status">{t('realtimeOffline')}</p>}
    <div className="human-chat__layout">
      <aside className="human-chat__list" aria-label={t('title')}>
        {conversations.isPending && <p>{t('loading')}</p>}
        {conversations.isError && <button onClick={() => void conversations.refetch()}>{t('retry')}</button>}
        {conversations.data?.items.length === 0 && <p>{t('empty')}</p>}
        {conversations.data?.items.map((row) => <button key={row.id} className={row.id === selectedId ? 'is-selected' : ''}
          onClick={() => setParams({ conversation: row.id })}>
          <strong>{user?.role === 'SELLER' ? row.buyerName?.trim() || t('buyer') : row.storeName}</strong>
          <span>{row.lastMessage?.content || t('noMessages')}</span>
          {row.unreadCount > 0 && <b>{t('unread', { count: row.unreadCount })}</b>}
        </button>)}
        {page > 1 && <button onClick={() => setPage((value) => value - 1)}>{t('previousPage')}</button>}
        {conversations.data?.hasMore && <button onClick={() => setPage((value) => value + 1)}>{t('nextPage')}</button>}
      </aside>
      <section className="human-chat__thread" aria-label={t('title')}>
        {!selectedId && <p>{t('select')}</p>}
        {messages.isPending && selectedId && <p>{t('loading')}</p>}
        {messages.isError && <button onClick={() => void messages.refetch()}>{t('retry')}</button>}
        {selectedId && messages.data && <>
          <header className="human-chat__thread-head"><strong>{user?.role === 'SELLER'
            ? current?.buyerName?.trim() || messages.data.conversation.buyerName?.trim() || t('buyer')
            : current?.storeName ?? messages.data.conversation.storeName}</strong>
            <div>{(!messages.data.conversation.blocked || messages.data.conversation.blockedByMe) &&
              <button onClick={() => void setBlock(!messages.data!.conversation.blockedByMe)}>{t(messages.data.conversation.blockedByMe ? 'unblock' : 'block')}</button>}
              <button onClick={() => setReportOpen((value) => !value)}>{t('report')}</button></div></header>
          {reportOpen && <div className="human-chat__report"><textarea value={reportReason} maxLength={500} onChange={(event) => setReportReason(event.target.value)} placeholder={t('reportReason')} />
            <button disabled={reportReason.trim().length < 10} onClick={() => void report()}>{t('submitReport')}</button></div>}
          {nextCursor && <button onClick={() => void loadOlder()}>{t('previous')}</button>}
          {history.length === 0 && <p>{t('noMessages')}</p>}
          <ol className="human-chat__history">{history.map((item) => <Message key={item.id} item={item} conversationId={selectedId} sentLabel={t('sent')} seenLabel={t('seen')} />)}
            {sending && <li className="human-chat__message human-chat__message--mine" aria-label={t('sending')}>
              {sendingPreview && <p dir="auto">{sendingPreview}</p>}<small>{t('sending')}</small></li>}</ol>
          {typing && <p role="status" className="human-chat__typing">{t(user?.role === 'SELLER' ? 'buyerTyping' : 'sellerTyping')}</p>}
          {messages.data.conversation.blocked ? <p>{t('blocked')}</p> : <div className="human-chat__compose">
            <textarea value={content} maxLength={2000} onChange={(event) => {
              setContent(event.target.value); setPendingClientId(null); setTyping(Boolean(event.target.value.trim()));
            }} onBlur={() => setTyping(false)} placeholder={t('placeholder')} />
            <label>{t('images')}<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => {
              const selected = Array.from(event.target.files ?? []);
              if (selected.length > 3) { setFiles([]); setError(t('imageLimit')); }
              else { setFiles(selected); setError(''); }
              setPendingClientId(null);
            }} /></label>
            <button disabled={sending} onClick={() => void send()}>{sending ? t('loading') : t('send')}</button>
          </div>}
        </>}
        {error && <p role="status">{error}</p>}
      </section>
    </div>
  </main>;
}
