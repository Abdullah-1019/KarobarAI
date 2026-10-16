import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Card, Input, Space, Spin, Typography } from 'antd';
import { Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { PageHeader } from '../../components';
import { useAuthStore } from '../../lib/authStore';
import { getSellerAssistantConversation, sendSellerAssistantMessage, type SellerAssistantMessage } from './sellerAssistantApi';

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
    setMessages((current) => [...current, { role: 'USER', content: message, createdAt: new Date().toISOString() }]);
    try {
      const result = await sendSellerAssistantMessage({ message, sessionId, locale });
      setSessionId(result.sessionId);
      setMessages((current) => [...current, { role: 'ASSISTANT', content: result.reply, createdAt: new Date().toISOString() }]);
    } catch {
      setError(isUrdu ? 'پیغام نہیں بھیجا جا سکا۔ دوبارہ کوشش کریں۔' : 'Message could not be sent. Please try again.');
    } finally { setLoading(false); }
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
              <Typography.Paragraph key={`${message.createdAt}-${index}`} style={{ alignSelf: message.role === 'USER' ? 'flex-end' : 'flex-start', maxWidth: '90%', margin: 0, padding: 12, borderRadius: 10, background: message.role === 'USER' ? 'var(--primary-100, #e6f4ff)' : 'var(--bg-sunken, #f5f5f5)' }}>
                {message.content}
              </Typography.Paragraph>
            ))}
            {loading && <Spin size="small" />}
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
