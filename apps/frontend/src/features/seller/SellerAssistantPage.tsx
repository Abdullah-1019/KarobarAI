import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Card, Input, Space, Spin, Typography } from 'antd';
import { Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { PageHeader } from '../../components';
import { ChatMarkdown } from '../ai-chat/ChatMarkdown';
import { useAuthStore } from '../../lib/authStore';
import { getSellerAssistantConversation, streamSellerAssistantMessage, type SellerAssistantMessage } from './sellerAssistantApi';

export function SellerAssistantPage() {
  const { i18n } = useTranslation();
  const sellerUserId = useAuthStore((state) => state.user?.id);
  const sessionStorageKey = sellerUserId ? `seller-assistant-session:${sellerUserId}` : undefined;
  const locale = i18n.language.toLowerCase().startsWith('ur') ? 'ur' : 'en';
  const isUrdu = locale === 'ur';
  const [sessionId, setSessionId] = useState<string | undefined>(() => {
    if (!sessionStorageKey || typeof window === 'undefined') return undefined;
    return window.sessionStorage.getItem(sessionStorageKey) ?? undefined;
  });
  const [messages, setMessages] = useState<SellerAssistantMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRequest = useRef<AbortController | null>(null);
  const pendingRequest = useRef<{ id: string; message: string } | null>(null);
  useEffect(() => () => activeRequest.current?.abort(), []);

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);
  useEffect(() => {
    if (!sessionId || !sessionStorageKey) return;
    window.sessionStorage.setItem(sessionStorageKey, sessionId);
    void getSellerAssistantConversation(sessionId).then((result) => setMessages(result.messages)).catch(() => {
      window.sessionStorage.removeItem(sessionStorageKey);
      setSessionId(undefined);
      setMessages([]);
      setError(isUrdu ? 'گفتگو لوڈ نہیں ہو سکی۔' : 'Conversation could not be loaded.');
    });
  // Reload persisted history when a session is created; send response already updates the view.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, sessionStorageKey]);

  function startNewConversation() {
    if (sessionStorageKey) window.sessionStorage.removeItem(sessionStorageKey);
    setSessionId(undefined);
    setMessages([]);
    setError('');
  }

  async function send() {
    const message = draft.trim();
    if (!message || loading) return;
    setDraft(''); setError(''); setLoading(true);
    const userAt = new Date().toISOString();
    setMessages((current) => [...current, { role: 'USER', content: message, createdAt: userAt }]);
    const controller = new AbortController();
    activeRequest.current = controller;
    if (pendingRequest.current?.message !== message) pendingRequest.current = { id: crypto.randomUUID(), message };
    const replyAt = new Date().toISOString();
    setMessages((current) => [...current, { role: 'ASSISTANT', content: '', createdAt: replyAt }]);
    try {
      const result = await streamSellerAssistantMessage({ message, sessionId, locale, requestId: pendingRequest.current!.id }, (text) => {
        setMessages((current) => current.map((item) => item.createdAt === replyAt && item.role === 'ASSISTANT'
          ? { ...item, content: item.content + text } : item));
      }, controller.signal);
      setSessionId(result.sessionId);
      pendingRequest.current = null;
      setMessages((current) => current.map((item) => item.createdAt === replyAt && item.role === 'ASSISTANT'
        ? { ...item, content: result.reply } : item));
    } catch {
      setMessages((current) => current.filter((item) => item.createdAt !== replyAt && item.createdAt !== userAt));
      setError(controller.signal.aborted ? (isUrdu ? 'جواب روک دیا گیا۔' : 'Generation stopped.')
        : (isUrdu ? 'پیغام نہیں بھیجا جا سکا۔ دوبارہ کوشش کریں۔' : 'Message could not be sent. Please try again.'));
      setDraft(message);
    } finally { if (activeRequest.current === controller) activeRequest.current = null; setLoading(false); }
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <PageHeader title={isUrdu ? 'کاروباری معاون' : 'Business assistant'} />
      <Card extra={messages.length > 0 ? <Button size="small" onClick={startNewConversation}>{isUrdu ? '\u0646\u0626\u06cc \u06af\u0641\u062a\u06af\u0648' : 'New conversation'}</Button> : undefined}>
        <Typography.Paragraph type="secondary">
          {isUrdu ? 'اپنی فروخت، آرڈرز، انوینٹری، جائزوں، واپسیوں یا ڈیلیوری کے بارے میں پوچھیں۔ یہ معاون صرف ڈیٹا پڑھ سکتا ہے۔' : 'Ask about sales, orders, inventory, reviews, returns, or deliveries. This assistant is read-only.'}
        </Typography.Paragraph>
        <div dir={isUrdu ? 'rtl' : 'ltr'} style={{ minHeight: 300, maxHeight: '55vh', overflowY: 'auto', padding: 12 }} aria-live="polite">
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            {messages.map((message, index) => (
              <div key={`${message.createdAt}-${index}`} style={{ alignSelf: message.role === 'USER' ? 'flex-end' : 'flex-start', maxWidth: '90%', margin: 0, padding: 12, borderRadius: 10, background: message.role === 'USER' ? 'var(--brand-primary-soft)' : 'var(--bg-sunken)' }}>
                {message.role === 'ASSISTANT' ? <ChatMarkdown content={message.content} /> : message.content}
              </div>
            ))}
            {loading && <Spin size="small" />}
            {loading && <Button onClick={() => activeRequest.current?.abort()}>{isUrdu ? 'جواب روکیں' : 'Stop generating'}</Button>}
            <div ref={scrollRef} />
          </Space>
        </div>
        {error && <Alert type="error" showIcon message={error} style={{ margin: '12px 0' }} />}
        <Space.Compact style={{ width: '100%', marginTop: 12 }}>
          <Input.TextArea value={draft} maxLength={1000} autoSize={{ minRows: 1, maxRows: 4 }} aria-label={isUrdu ? 'آپ کا پیغام' : 'Your message'} placeholder={isUrdu ? 'اپنا سوال لکھیں' : 'Ask a business question'} onChange={(event) => setDraft(event.target.value)} onPressEnter={(event) => { if (!event.shiftKey) { event.preventDefault(); void send(); } }} />
          <Button type="primary" icon={<Send size={16} />} aria-label={isUrdu ? 'بھیجیں' : 'Send'} loading={loading} disabled={!draft.trim()} onClick={() => void send()} />
        </Space.Compact>
      </Card>
    </div>
  );
}
