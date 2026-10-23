import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check, CheckCheck, ImagePlus, MessagesSquare, MoreHorizontal, Search, SendHorizontal, WifiOff, X } from 'lucide-react';

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

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function clockTime(iso: string, locale: string): string {
  return new Date(iso).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
}

function initialOf(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?';
}

function Message({ item, conversationId, sentLabel, deliveredLabel, seenLabel, locale }: { item: HumanMessage; conversationId: string; sentLabel: string; deliveredLabel: string; seenLabel: string; locale: string }) {
  const status = item.seen ? 'SEEN' : item.status ?? 'SENT';
  const label = status === 'SEEN' ? seenLabel : status === 'DELIVERED' ? deliveredLabel : sentLabel;
  return <li className={`human-chat__message ${item.mine ? 'human-chat__message--mine' : ''}`}>
    {item.attachments.length > 0 && <div className="human-chat__images">
      {item.attachments.map((attachment) => <PrivateImage key={attachment.id} conversationId={conversationId} attachmentId={attachment.id} />)}
    </div>}
    {item.content && <p dir="auto">{item.content}</p>}
    <footer><time dateTime={item.createdAt} title={new Date(item.createdAt).toLocaleString(locale)}>{clockTime(item.createdAt, locale)}</time>
      {item.mine && <span className={`human-chat__receipt human-chat__receipt--${status.toLowerCase()}`} aria-label={label} title={label}>
        {status === 'SENT' ? <Check size={15} aria-hidden="true" /> : <CheckCheck size={15} aria-hidden="true" />}
      </span>}</footer>
  </li>;
}

// Shared by buyers (/messages) and sellers (/seller/messages): a conversation list beside one
// thread. On phones the list and the thread take turns full-width (the ?conversation= param
// decides which). Realtime delivery/seen receipts, typing, block/report and paging all run
// through useHumanChatSocket + humanChatApi unchanged; this file only owns the layout.
export function HumanMessagesPage() {
  const { t, i18n } = useTranslation('humanChat');
  const locale = i18n.language.toLowerCase().startsWith('ur') ? 'ur-PK' : 'en-GB';
  const user = useAuthStore((state) => state.user);
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('conversation');
  const store = params.get('store');
  const product = params.get('product') ?? undefined;
  const queryClient = useQueryClient();
  const { status: socketStatus, typing, setTyping, acknowledgeDelivery } = useHumanChatSocket(selectedId);
  const [page, setPage] = useState(1);
  const [older, setOlder] = useState<HumanMessage[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [pendingClientId, setPendingClientId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendingPreview, setSendingPreview] = useState('');
  const [persistedPreview, setPersistedPreview] = useState<{ conversationId: string; message: HumanMessage } | null>(null);
  const [error, setError] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState('');
  const historyRef = useRef<HTMLDivElement>(null);
  const composeRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const conversations = useQuery({ queryKey: ['human-conversations', page], queryFn: () => listHumanConversations(page) });
  const messages = useQuery({ queryKey: ['human-messages', selectedId], queryFn: () => listHumanMessages(selectedId!), enabled: Boolean(selectedId) });

  useEffect(() => {
    if (socketStatus !== 'connected') return;
    for (const row of conversations.data?.items ?? []) {
      if (row.lastMessage && !row.lastMessage.mine) acknowledgeDelivery(row.id, [row.lastMessage.id]);
    }
  }, [socketStatus, conversations.data, acknowledgeDelivery]);

  useEffect(() => {
    if (!store || user?.role !== 'BUYER') return;
    let cancelled = false;
    openHumanConversation(store, product).then(({ id }) => {
      if (!cancelled) setParams({ conversation: id }, { replace: true });
    }).catch(() => { if (!cancelled) setError(t('failed')); });
    return () => { cancelled = true; };
  }, [store, product, user?.role, setParams, t]);

  useEffect(() => { setOlder([]); setNextCursor(null); setError(''); setPersistedPreview(null); setMenuOpen(false); setReportOpen(false); }, [selectedId]);
  useEffect(() => {
    if (persistedPreview && messages.data?.items.some((item) => item.id === persistedPreview.message.id)) setPersistedPreview(null);
  }, [messages.data, persistedPreview]);
  useEffect(() => {
    if (!selectedId || !messages.data) return;
    if (older.length === 0) setNextCursor(messages.data.nextCursor);
    const incoming = [...messages.data.items, ...older].filter((item) => !item.mine);
    const latestIncoming = incoming[0];
    if (!latestIncoming) return;
    if (socketStatus === 'connected') acknowledgeDelivery(selectedId, incoming.map((item) => item.id));
    const markVisibleRead = () => {
      if (document.visibilityState !== 'visible') return;
      void markHumanConversationRead(selectedId, latestIncoming.id).then(() => queryClient.invalidateQueries({ queryKey: ['human-conversations'] }));
    };
    markVisibleRead();
    document.addEventListener('visibilitychange', markVisibleRead);
    return () => document.removeEventListener('visibilitychange', markVisibleRead);
  }, [selectedId, messages.data, queryClient, older, socketStatus, acknowledgeDelivery]);

  useEffect(() => {
    if (!content || !selectedId) return;
    const timer = window.setTimeout(() => setTyping(false), 3000);
    return () => window.clearTimeout(timer);
  }, [content, selectedId, setTyping]);

  // Grow the composer with its text (up to ~5 lines).
  useLayoutEffect(() => {
    const el = composeRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }, [content]);

  async function send() {
    if (!selectedId || sending) return;
    if (!content.trim() && files.length === 0) { setError(t('onlyImages')); return; }
    setTyping(false);
    setSending(true); setError('');
    setSendingPreview(content.trim());
    const clientId = pendingClientId ?? crypto.randomUUID();
    setPendingClientId(clientId);
    try {
      const persisted = await sendHumanMessage(selectedId, clientId, content.trim(), files);
      setPersistedPreview({ conversationId: selectedId, message: persisted });
      setSending(false); setSendingPreview('');
      setContent(''); setFiles([]); setPendingClientId(null);
      void Promise.allSettled([queryClient.invalidateQueries({ queryKey: ['human-messages', selectedId] }), queryClient.invalidateQueries({ queryKey: ['human-conversations'] })]);
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
    setMenuOpen(false);
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
  const showPersisted = persistedPreview?.conversationId === selectedId && !history.some((item) => item.id === persistedPreview?.message.id);
  const rowName = (row: { buyerName?: string | null; storeName: string }) =>
    user?.role === 'SELLER' ? row.buyerName?.trim() || t('buyer') : row.storeName;
  const threadName = messages.data ? (user?.role === 'SELLER'
    ? current?.buyerName?.trim() || messages.data.conversation.buyerName?.trim() || t('buyer')
    : current?.storeName ?? messages.data.conversation.storeName) : '';
  const rows = (conversations.data?.items ?? []).filter((row) => !search.trim() || rowName(row).toLowerCase().includes(search.trim().toLowerCase()));

  // Keep the newest message in view as the thread grows.
  const lastId = history[history.length - 1]?.id;
  useEffect(() => {
    const el = historyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [selectedId, lastId, sending, showPersisted, typing]);

  function dayLabel(iso: string): string {
    const d = new Date(iso);
    const now = new Date();
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    if (isSameDay(d, now)) return t('today');
    if (isSameDay(d, yesterday)) return t('yesterday');
    return d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
  }
  function rowTime(iso: string): string {
    const d = new Date(iso);
    const now = new Date();
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    if (isSameDay(d, now)) return clockTime(iso, locale);
    if (isSameDay(d, yesterday)) return t('yesterday');
    return d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  }

  return <main className="human-chat" data-thread={selectedId ? 'open' : undefined}>
    <header className="human-chat__head">
      <h1>{t('title')}</h1>
      {socketStatus === 'offline' && <p role="status" className="human-chat__offline"><WifiOff size={14} aria-hidden="true" />{t('realtimeOffline')}</p>}
    </header>
    <div className="human-chat__layout">
      <aside className="human-chat__list" aria-label={t('title')}>
        <label className="human-chat__search">
          <Search size={16} aria-hidden="true" />
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('search')} aria-label={t('search')} />
        </label>
        <div className="human-chat__rows">
          {conversations.isPending && [0, 1, 2, 3].map((i) => <span key={i} className="human-chat__row-skeleton" aria-hidden="true" />)}
          {conversations.isPending && <p className="human-chat__sr">{t('loading')}</p>}
          {conversations.isError && <div className="human-chat__quiet"><button type="button" className="human-chat__ghost" onClick={() => void conversations.refetch()}>{t('retry')}</button></div>}
          {conversations.data?.items.length === 0 && <div className="human-chat__quiet">
            <span className="human-chat__quiet-icon" aria-hidden="true"><MessagesSquare size={22} /></span>
            <p>{t('empty')}</p>
            <small>{t(user?.role === 'SELLER' ? 'emptyHintSeller' : 'emptyHintBuyer')}</small>
          </div>}
          {rows.map((row, index) => {
            const name = rowName(row);
            return <button key={row.id} type="button" className={`human-chat__row${row.id === selectedId ? ' is-selected' : ''}`}
              style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}
              onClick={() => setParams({ conversation: row.id })}>
              <span className="human-chat__avatar" aria-hidden="true">{initialOf(name)}</span>
              <span className="human-chat__row-main">
                <span className="human-chat__row-top">
                  <strong>{name}</strong>
                  <time dateTime={row.lastMessageAt}>{rowTime(row.lastMessageAt)}</time>
                </span>
                <span className="human-chat__row-bottom">
                  <span className="human-chat__preview">{row.lastMessage ? `${row.lastMessage.mine ? `${t('you')}: ` : ''}${row.lastMessage.content || t('photo')}` : t('noMessages')}</span>
                  {row.unreadCount > 0 && <b aria-label={t('unread', { count: row.unreadCount })}>{row.unreadCount}</b>}
                </span>
              </span>
            </button>;
          })}
          {conversations.data && conversations.data.items.length > 0 && rows.length === 0 && <p className="human-chat__quiet-line">{t('noMatch')}</p>}
        </div>
        {(page > 1 || conversations.data?.hasMore) && <div className="human-chat__pager">
          {page > 1 && <button type="button" className="human-chat__ghost" onClick={() => setPage((value) => value - 1)}>{t('previousPage')}</button>}
          {conversations.data?.hasMore && <button type="button" className="human-chat__ghost" onClick={() => setPage((value) => value + 1)}>{t('nextPage')}</button>}
        </div>}
      </aside>

      <section className="human-chat__thread" aria-label={threadName || t('title')}>
        {!selectedId && <div className="human-chat__welcome">
          <span className="human-chat__welcome-art" aria-hidden="true">
            <span /><span /><span />
          </span>
          <p className="human-chat__welcome-title">{t('select')}</p>
          <p className="human-chat__welcome-body">{t('selectHint')}</p>
          {error && <p role="status" className="human-chat__notice">{error}</p>}
        </div>}
        {messages.isPending && selectedId && <div className="human-chat__thread-loading">
          <span className="human-chat__bubble-skeleton" /><span className="human-chat__bubble-skeleton is-mine" /><span className="human-chat__bubble-skeleton" />
          <p className="human-chat__sr">{t('loading')}</p>
        </div>}
        {messages.isError && <div className="human-chat__quiet"><button type="button" className="human-chat__ghost" onClick={() => void messages.refetch()}>{t('retry')}</button></div>}
        {selectedId && messages.data && <>
          <header className="human-chat__thread-head">
            <button type="button" className="human-chat__back" onClick={() => setParams({})} aria-label={t('back')}>
              <ArrowLeft size={18} aria-hidden="true" />
            </button>
            <span className="human-chat__avatar human-chat__avatar--lg" aria-hidden="true">{initialOf(threadName)}</span>
            <div className="human-chat__thread-title">
              <strong>{threadName}</strong>
              {typing
                ? <p role="status" className="human-chat__typing"><span className="human-chat__dots" aria-hidden="true"><i /><i /><i /></span>{t(user?.role === 'SELLER' ? 'buyerTyping' : 'sellerTyping')}</p>
                : <p className="human-chat__subtle">{t(user?.role === 'SELLER' ? 'roleBuyer' : 'roleSeller')}</p>}
            </div>
            <div className="human-chat__menu-wrap">
              <button type="button" className="human-chat__icon-btn" aria-label={t('options')} aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)}>
                <MoreHorizontal size={18} aria-hidden="true" />
              </button>
              {menuOpen && <div className="human-chat__menu" role="menu">
                {(!messages.data.conversation.blocked || messages.data.conversation.blockedByMe) &&
                  <button type="button" role="menuitem" onClick={() => void setBlock(!messages.data!.conversation.blockedByMe)}>{t(messages.data.conversation.blockedByMe ? 'unblock' : 'block')}</button>}
                <button type="button" role="menuitem" onClick={() => { setReportOpen((value) => !value); setMenuOpen(false); }}>{t('report')}</button>
              </div>}
            </div>
          </header>
          {reportOpen && <div className="human-chat__report">
            <textarea value={reportReason} maxLength={500} onChange={(event) => setReportReason(event.target.value)} placeholder={t('reportReason')} />
            <div className="human-chat__report-actions">
              <button type="button" className="human-chat__ghost" onClick={() => setReportOpen(false)}>{t('cancel')}</button>
              <button type="button" className="human-chat__solid" disabled={reportReason.trim().length < 10} onClick={() => void report()}>{t('submitReport')}</button>
            </div>
          </div>}

          <div className="human-chat__scroll" ref={historyRef} aria-live="polite">
            {nextCursor && <button type="button" className="human-chat__older" onClick={() => void loadOlder()}>{t('previous')}</button>}
            {history.length === 0 && !showPersisted && !sending && <div className="human-chat__quiet">
              <span className="human-chat__quiet-icon" aria-hidden="true"><MessagesSquare size={22} /></span>
              <p>{t('noMessages')}</p>
              <small>{t('firstMessageHint')}</small>
            </div>}
            <ol className="human-chat__history">
              {history.map((item, index) => {
                const newDay = index === 0 || dayKey(history[index - 1]!.createdAt) !== dayKey(item.createdAt);
                return <Fragment key={item.id}>
                  {newDay && <li className="human-chat__day" aria-hidden="true"><span>{dayLabel(item.createdAt)}</span></li>}
                  <Message item={item} conversationId={selectedId} sentLabel={t('sent')} deliveredLabel={t('delivered')} seenLabel={t('seen')} locale={locale} />
                </Fragment>;
              })}
              {showPersisted && persistedPreview &&
                <Message item={persistedPreview.message} conversationId={selectedId} sentLabel={t('sent')} deliveredLabel={t('delivered')} seenLabel={t('seen')} locale={locale} />}
              {sending && <li className="human-chat__message human-chat__message--mine human-chat__message--pending" aria-label={t('sending')}>
                {sendingPreview && <p dir="auto">{sendingPreview}</p>}<footer><small>{t('sending')}</small></footer></li>}
            </ol>
          </div>

          {error && <p role="status" className="human-chat__notice">{error}</p>}

          {messages.data.conversation.blocked ? <p className="human-chat__blocked">{t('blocked')}</p> : <div className="human-chat__compose">
            {files.length > 0 && <ul className="human-chat__files">
              {files.map((file, index) => <li key={`${file.name}-${index}`}>
                <span>{file.name}</span>
                <button type="button" aria-label={t('removeImage')} onClick={() => { setFiles((list) => list.filter((_, i) => i !== index)); setPendingClientId(null); }}>
                  <X size={13} aria-hidden="true" />
                </button>
              </li>)}
            </ul>}
            <div className="human-chat__compose-bar">
              <button type="button" className="human-chat__icon-btn" aria-label={t('images')} title={t('images')} onClick={() => fileInputRef.current?.click()}>
                <ImagePlus size={19} aria-hidden="true" />
              </button>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(event) => {
                const selected = Array.from(event.target.files ?? []);
                event.target.value = '';
                if (selected.length > 3) { setFiles([]); setError(t('imageLimit')); }
                else { setFiles(selected); setError(''); }
                setPendingClientId(null);
              }} />
              <textarea ref={composeRef} rows={1} dir="auto" value={content} maxLength={2000} onChange={(event) => {
                setContent(event.target.value); setPendingClientId(null); setTyping(Boolean(event.target.value.trim()));
              }} onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); }
              }} onBlur={() => setTyping(false)} placeholder={t('placeholder')} />
              <button type="button" className="human-chat__send" aria-label={t('send')} disabled={sending} onClick={() => void send()}>
                <SendHorizontal size={18} aria-hidden="true" />
              </button>
            </div>
          </div>}
        </>}
      </section>
    </div>
  </main>;
}
