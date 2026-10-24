import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AlertCircle, Boxes, ClipboardList, PackageX, Plus, RotateCcw, SendHorizontal, Square, TrendingUp, Truck, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { AiMark } from '../../components';
import { ChatMarkdown } from '../ai-chat/ChatMarkdown';
import { useAiUnreadStore } from '../../lib/aiUnreadStore';
import { useAuthStore } from '../../lib/authStore';
import { getSellerAssistantConversation, streamSellerAssistantMessage, type SellerAssistantMessage } from './sellerAssistantApi';
import './sellerAssistant.css';

const PROMPTS: Array<{ key: string; icon: LucideIcon }> = [
  { key: 'sales', icon: TrendingUp },
  { key: 'pending', icon: ClipboardList },
  { key: 'stock', icon: PackageX },
  { key: 'top', icon: Boxes },
  { key: 'returns', icon: RotateCcw },
  { key: 'delivery', icon: Truck },
];

// Seller's read-only business assistant. Streams replies (streamSellerAssistantMessage) and keeps
// the session per seller in sessionStorage. Layout: an AiMark welcome with suggested questions
// as pills; then the user's questions as ink bubbles and the assistant's answers as plain text
// beside the mark, with a calm three-dot indicator until the first words arrive.
//
// Leaving the page doesn't cancel a reply in flight (only Stop / New chat do): it finishes in the
// background, its session id is saved, and the AI icons in SellerLayout get an unread badge.
export function SellerAssistantPage() {
  const { t, i18n } = useTranslation(['catalog']);
  const sellerUserId = useAuthStore((state) => state.user?.id);
  const sessionStorageKey = sellerUserId ? `seller-assistant-session:${sellerUserId}` : undefined;
  const locale = i18n.language.toLowerCase().startsWith('ur') ? 'ur' : 'en';
  const [sessionId, setSessionId] = useState<string | undefined>(() => {
    if (!sessionStorageKey || typeof window === 'undefined') return undefined;
    return window.sessionStorage.getItem(sessionStorageKey) ?? undefined;
  });
  const [messages, setMessages] = useState<SellerAssistantMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const activeRequest = useRef<AbortController | null>(null);
  const pendingRequest = useRef<{ id: string; message: string } | null>(null);
  const mounted = useRef(true);
  const setSellerViewing = useAiUnreadStore((s) => s.setSellerViewing);
  const sellerReplyLanded = useAiUnreadStore((s) => s.sellerReplyLanded);
  const reloadTick = useAiUnreadStore((s) => s.sellerReloadTick);
  useEffect(() => {
    mounted.current = true;
    setSellerViewing(true);
    return () => {
      mounted.current = false;
      setSellerViewing(false);
    };
  }, [setSellerViewing]);
  // A reply that an earlier visit to this page asked for has landed: show it from saved history.
  useEffect(() => {
    if (!reloadTick || !sessionStorageKey) return;
    const saved = window.sessionStorage.getItem(sessionStorageKey);
    if (!saved) return;
    setSessionId(saved);
    void getSellerAssistantConversation(saved).then((result) => setMessages(result.messages)).catch(() => undefined);
  }, [reloadTick, sessionStorageKey]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);
  useEffect(() => {
    if (!sessionId || !sessionStorageKey) return;
    window.sessionStorage.setItem(sessionStorageKey, sessionId);
    void getSellerAssistantConversation(sessionId).then((result) => setMessages(result.messages)).catch(() => {
      window.sessionStorage.removeItem(sessionStorageKey);
      setSessionId(undefined);
      setMessages([]);
      setError(t('catalog:assistantChat.loadError'));
    });
  // Reload persisted history when a session is created; send response already updates the view.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, sessionStorageKey]);

  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [draft]);

  function startNewConversation() {
    activeRequest.current?.abort();
    if (sessionStorageKey) window.sessionStorage.removeItem(sessionStorageKey);
    setSessionId(undefined);
    setMessages([]);
    setError('');
    inputRef.current?.focus();
  }

  async function send(text?: string) {
    const message = (text ?? draft).trim();
    if (!message || loading) return;
    setDraft(''); setError(''); setLoading(true);
    const userAt = new Date().toISOString();
    setMessages((current) => [...current, { role: 'USER', content: message, createdAt: userAt }]);
    const controller = new AbortController();
    activeRequest.current = controller;
    if (pendingRequest.current?.message !== message) pendingRequest.current = { id: crypto.randomUUID(), message };
    const replyAt = new Date(Date.now() + 1).toISOString();
    setMessages((current) => [...current, { role: 'ASSISTANT', content: '', createdAt: replyAt }]);
    try {
      const result = await streamSellerAssistantMessage({ message, sessionId, locale, requestId: pendingRequest.current!.id }, (delta) => {
        setMessages((current) => current.map((item) => item.createdAt === replyAt && item.role === 'ASSISTANT'
          ? { ...item, content: item.content + delta } : item));
      }, controller.signal);
      pendingRequest.current = null;
      if (!mounted.current) {
        // The seller left mid-reply: keep the session so the next visit loads it, and flag it.
        if (sessionStorageKey) window.sessionStorage.setItem(sessionStorageKey, result.sessionId);
        sellerReplyLanded();
        return;
      }
      setSessionId(result.sessionId);
      setMessages((current) => current.map((item) => item.createdAt === replyAt && item.role === 'ASSISTANT'
        ? { ...item, content: result.reply } : item));
    } catch {
      setMessages((current) => current.filter((item) => item.createdAt !== replyAt && item.createdAt !== userAt));
      setError(controller.signal.aborted ? t('catalog:assistantChat.stopped') : t('catalog:assistantChat.sendError'));
      setDraft(message);
    } finally { if (activeRequest.current === controller) activeRequest.current = null; setLoading(false); }
  }

  const empty = messages.length === 0;

  return (
    <div className="saPage">
      <header className="saHead">
        <span className="saHeadMark" aria-hidden="true"><AiMark size={20} color="var(--ai-accent)" /></span>
        <div className="saHeadText">
          <h1>{t('catalog:assistantChat.title')}</h1>
          <p>{t('catalog:assistantChat.subtitle')}</p>
        </div>
        {!empty && (
          <button type="button" className="saGhost" onClick={startNewConversation}>
            <Plus size={16} aria-hidden="true" /> {t('catalog:assistantChat.newChat')}
          </button>
        )}
      </header>

      <section className="saChat" dir={locale === 'ur' ? 'rtl' : 'ltr'}>
        <div className="saScroll" ref={scrollRef} aria-live="polite">
          {empty ? (
            <div className="saWelcome">
              <span className="saOrb" aria-hidden="true"><AiMark size={40} color="var(--ai-accent)" /></span>
              <h2>{t('catalog:assistantChat.welcomeTitle')}</h2>
              <p>{t('catalog:assistantChat.welcomeBody')}</p>
              <ul className="saPrompts">
                {PROMPTS.map(({ key, icon: Icon }, index) => (
                  <li key={key} style={{ animationDelay: `${120 + index * 60}ms` }}>
                    <button type="button" className="saPrompt" disabled={loading} onClick={() => void send(t(`catalog:assistantChat.prompts.${key}`))}>
                      <Icon size={16} aria-hidden="true" />
                      {t(`catalog:assistantChat.prompts.${key}`)}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <ol className="saThread">
              {messages.map((message, index) => (
                message.role === 'USER' ? (
                  <li key={`${message.createdAt}-${index}`} className="saUser" dir="auto">{message.content}</li>
                ) : (
                  <li key={`${message.createdAt}-${index}`} className="saBot">
                    <span className="saBotMark" aria-hidden="true"><AiMark size={16} color="var(--ai-accent)" /></span>
                    <div className="saBotBody">
                      {message.content
                        ? <ChatMarkdown content={message.content} />
                        : <span className="saThinking" role="status"><span className="saDots" aria-hidden="true"><i /><i /><i /></span>{t('catalog:assistantChat.thinking')}</span>}
                    </div>
                  </li>
                )
              ))}
            </ol>
          )}
        </div>

        {loading && (
          <button type="button" className="saStop" onClick={() => activeRequest.current?.abort()}>
            <Square size={12} aria-hidden="true" /> {t('catalog:assistantChat.stop')}
          </button>
        )}

        {error && <p className="saError" role="alert"><AlertCircle size={16} aria-hidden="true" />{error}</p>}

        <div className="saCompose">
          <div className="saComposeBar">
            <textarea
              ref={inputRef}
              rows={1}
              value={draft}
              maxLength={1000}
              dir="auto"
              aria-label={t('catalog:assistantChat.inputLabel')}
              placeholder={t('catalog:assistantChat.placeholder')}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); }
              }}
            />
            <button type="button" className="saSend" aria-label={t('catalog:assistantChat.send')} disabled={!draft.trim() || loading} onClick={() => void send()}>
              <SendHorizontal size={18} aria-hidden="true" />
            </button>
          </div>
          <p className="saNote">{t('catalog:assistantChat.note')}</p>
        </div>
      </section>
    </div>
  );
}
