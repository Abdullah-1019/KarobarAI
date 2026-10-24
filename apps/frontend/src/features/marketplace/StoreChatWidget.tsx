import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Drawer } from 'antd';
import { ArrowUp, MessageCircle, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { AiMark, CountBadge } from '../../components';
import { ChatMarkdown } from '../ai-chat/ChatMarkdown';
import { ChatModeSelector } from '../ai-chat/ChatModeSelector';
import { chatErrorMessage, useChatMode } from '../ai-chat/chatMode';
import { CART_QUERY_KEY } from '../cart/cartApi';
import { useAiUnreadStore } from '../../lib/aiUnreadStore';
import { useAuthStore } from '../../lib/authStore';
import { useStoreChatStore } from '../../lib/storeChatStore';
import { streamBuyerMessage, type BuyerChatMessage } from './storeApi';
import { StoreMonogram } from './StoreMonogram';

interface StoreChatWidgetProps {
  storeSlug: string;
  storeName: string;
  locale: 'en' | 'ur';
  /** Controlled open state (the product page opens it from the store card). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Shows the floating "Ask the store" pill (stacked above the WhatsApp button). */
  showLauncher?: boolean;
  /** A product the buyer is looking at, offered as a first question. */
  productTitle?: string;
  /** That product's id, so "this product" in the chat refers to it. */
  productId?: string;
}

// After this long without a reply, say so: the store assistant runs on a local model and a reply
// can take a minute or more (docs/frontend/BACKEND-NOTES.md 1b). Silence that long reads as broken.
const SLOW_REPLY_MS = 8000;

// The buyer chatbot (F-store chat) in Studio Light: a white side sheet whose header names the store
// and labels the helper as AI (PRODUCT.md "AI honesty"), buyer messages as ink bubbles at the
// inline-end, assistant replies as white bubbles on the stone ground, suggested first questions as
// stone chips, and a stone pill composer with a round ink send button. Persimmon is left to the
// page's own action; nothing in here competes with it.
export function StoreChatWidget({
  storeSlug,
  storeName,
  locale,
  open: openProp,
  onOpenChange,
  showLauncher = true,
  productTitle,
  productId,
}: StoreChatWidgetProps) {
  const { t } = useTranslation('marketplace');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [mode, setMode] = useChatMode('karobar-ai-mode:buyer');
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  // Read inside the async send() so a reply that lands after the sheet was closed counts as unseen.
  const openRef = useRef(open);
  openRef.current = open;
  const unseen = useAiUnreadStore((s) => s.buyer[storeSlug] ?? 0);
  const buyerReplyLanded = useAiUnreadStore((s) => s.buyerReplyLanded);
  const clearBuyer = useAiUnreadStore((s) => s.clearBuyer);
  const setOpen = (next: boolean) => {
    setOpenState(next);
    onOpenChange?.(next);
  };
  const [sessionId, setSessionId] = useState<string>();
  const [messages, setMessages] = useState<BuyerChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState('');
  const tailRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const activeRequest = useRef<AbortController | null>(null);
  const pendingRequest = useRef<{ id: string; message: string } | null>(null);
  const isUrdu = locale === 'ur';

  useEffect(() => {
    tailRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, loading, slow]);

  useEffect(() => {
    setSessionId(undefined);
    setMessages([]);
    setError('');
    activeRequest.current?.abort();
    pendingRequest.current = null;
  }, [storeSlug]);
  useEffect(() => () => activeRequest.current?.abort(), []);
  useEffect(() => {
    if (open) clearBuyer(storeSlug);
  }, [open, storeSlug, clearBuyer]);
  // The conversation lives only while this page is open, so its unseen count goes with it.
  useEffect(() => () => clearBuyer(storeSlug), [storeSlug, clearBuyer]);

  // Let the storefront navbar's AI button open this store's chat while this page is open.
  const registerChat = useStoreChatStore((s) => s.register);
  const unregisterChat = useStoreChatStore((s) => s.unregister);
  const openTick = useStoreChatStore((s) => s.openTick);
  const seenOpenTick = useRef(openTick);
  useEffect(() => {
    registerChat({ slug: storeSlug, name: storeName });
    return () => unregisterChat(storeSlug);
  }, [storeSlug, storeName, registerChat, unregisterChat]);
  useEffect(() => {
    if (openTick === seenOpenTick.current) return;
    seenOpenTick.current = openTick;
    setOpen(true);
  // setOpen is recreated each render; only a new navbar request should open the sheet.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openTick]);

  useEffect(() => {
    if (!loading) {
      setSlow(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setSlow(true), SLOW_REPLY_MS);
    return () => window.clearTimeout(timer);
  }, [loading]);

  async function send(text = draft) {
    const message = text.trim();
    if (!message || loading) return;
    setDraft('');
    setError('');
    const userAt = new Date().toISOString();
    setMessages((current) => [...current, { role: 'USER', content: message, createdAt: userAt }]);
    setLoading(true);
    const controller = new AbortController();
    activeRequest.current = controller;
    if (pendingRequest.current?.message !== message) pendingRequest.current = { id: crypto.randomUUID(), message };
    const replyAt = new Date().toISOString();
    setMessages((current) => [...current, { role: 'ASSISTANT', content: '', createdAt: replyAt }]);
    try {
      const result = await streamBuyerMessage(storeSlug, { message, sessionId, locale, requestId: pendingRequest.current!.id, mode, ...(productId ? { productId } : {}) }, (text) => {
        setMessages((current) => current.map((item) => item.createdAt === replyAt && item.role === 'ASSISTANT'
          ? { ...item, content: item.content + text } : item));
      }, controller.signal);
      setSessionId(result.sessionId);
      pendingRequest.current = null;
      setMessages((current) => current.map((item) => item.createdAt === replyAt && item.role === 'ASSISTANT'
        ? { ...item, content: result.reply } : item));
      if (!openRef.current) buyerReplyLanded(storeSlug);
      // The server confirmed a cart change: refresh the header cart badge.
      if (result.cartChanged) void queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
      if (result.redirectToCheckout) {
        navigate(user?.role === 'BUYER' ? '/checkout' : '/login', user?.role === 'BUYER' ? undefined : { state: { redirect: '/checkout' } });
      }
    } catch (failure) {
      setError(controller.signal.aborted ? t('chat.stopped') : chatErrorMessage(failure, t) ?? t('chat.error'));
      setMessages((current) => current.filter((item) => item.createdAt !== replyAt && item.createdAt !== userAt));
      // Give the unsent text back so the buyer doesn't have to retype it.
      setDraft(message);
    } finally {
      if (activeRequest.current === controller) activeRequest.current = null;
      setLoading(false);
    }
  }

  const suggestions = [
    productTitle ? t('chat.suggestProduct', { title: productTitle }) : null,
    t('chat.suggestStock'),
    t('chat.suggestCod'),
  ].filter((s): s is string => !!s);

  return (
    <>
      {showLauncher && (
        <button
          type="button"
          className="chat-launcher"
          aria-label={
            unseen > 0
              ? t('common:nav.withUnread', { label: t('chat.openNamed', { store: storeName }), count: unseen })
              : t('chat.openNamed', { store: storeName })
          }
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <MessageCircle size={20} strokeWidth={2} aria-hidden="true" />
          <span className="chat-launcher__label">{t('chat.open')}</span>
          <CountBadge count={unseen} />
        </button>
      )}
      <Drawer
        rootClassName="store-chat"
        placement={isUrdu ? 'left' : 'right'}
        width={420}
        open={open}
        onClose={() => setOpen(false)}
        afterOpenChange={(visible) => {
          if (visible) inputRef.current?.focus();
        }}
        closable={false}
        title={null}
        destroyOnClose={false}
        aria-label={t('chat.title', { store: storeName })}
      >
        <div className="store-chat__frame" dir={isUrdu ? 'rtl' : 'ltr'}>
          <header className="store-chat__head">
            <StoreMonogram name={storeName} size={44} />
            <div className="store-chat__who">
              <h2 className="store-chat__title">{t('chat.title', { store: storeName })}</h2>
              <p className="store-chat__sub">
                <span className="store-chat__ai">
                  <AiMark size={12} color="var(--ai-accent)" />
                  {t('chat.aiLabel')}
                </span>
                {t('chat.sub')}
              </p>
            </div>
            <button type="button" className="store-chat__close" aria-label={t('common:actions.close', 'Close')} onClick={() => setOpen(false)}>
              <X size={20} aria-hidden="true" />
            </button>
          </header>
          <div className="store-chat__mode">
            <ChatModeSelector value={mode} onChange={setMode} disabled={loading} />
          </div>

          <div className="store-chat__log" aria-live="polite">
            {messages.length === 0 && (
              <div className="store-chat__intro">
                <p>{t('chat.intro')}</p>
                <ul className="store-chat__chips" aria-label={t('chat.suggestions')}>
                  {suggestions.map((s) => (
                    <li key={s}>
                      <button type="button" className="store-chat__chip" onClick={() => void send(s)}>
                        {s}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {messages.map((message, index) => (
              <div
                key={`${message.createdAt}-${index}`}
                dir="auto"
                className={`store-chat__msg store-chat__msg--${message.role === 'USER' ? 'me' : 'store'}`}
              >
                {message.role === 'ASSISTANT' ? <ChatMarkdown content={message.content} /> : message.content}
              </div>
            ))}
            {loading && (
              <div className="store-chat__thinking">
                <span className="store-chat__dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                <span className="sr-only">{t('chat.thinking')}</span>
                {slow && mode === 'slow' && <span className="store-chat__slow">{t('chat.slow')}</span>}
              </div>
            )}
            {loading && <button type="button" onClick={() => activeRequest.current?.abort()}>{t('chat.stopGenerating')}</button>}
            <div ref={tailRef} />
          </div>

          {error && (
            <p className="store-chat__error" role="alert">
              {error}
            </p>
          )}
          <form
            className="store-chat__composer"
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
          >
            <textarea
              ref={inputRef}
              className="store-chat__input"
              rows={1}
              value={draft}
              maxLength={1000}
              aria-label={t('chat.inputLabel')}
              placeholder={t('chat.placeholder')}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void send();
                }
              }}
            />
            <button type="submit" className="store-chat__send" aria-label={t('chat.send')} disabled={!draft.trim() || loading}>
              <ArrowUp size={20} strokeWidth={2.2} aria-hidden="true" />
            </button>
          </form>
        </div>
      </Drawer>
    </>
  );
}
