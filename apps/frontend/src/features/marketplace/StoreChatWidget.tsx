import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Drawer, Input, Space, Spin, Typography } from 'antd';
import { MessageCircle, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { useAuthStore } from '../../lib/authStore';
import { sendBuyerMessage, type BuyerChatMessage } from './storeApi';

interface StoreChatWidgetProps {
  storeSlug: string;
  storeName: string;
  locale: 'en' | 'ur';
}

export function StoreChatWidget({ storeSlug, storeName, locale }: StoreChatWidgetProps) {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [open, setOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string>();
  const [messages, setMessages] = useState<BuyerChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const tailRef = useRef<HTMLDivElement>(null);
  const isUrdu = locale === 'ur';

  useEffect(() => {
    tailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loading]);

  useEffect(() => {
    setSessionId(undefined);
    setMessages([]);
    setError('');
  }, [storeSlug]);

  async function send() {
    const message = draft.trim();
    if (!message || loading) return;
    setDraft('');
    setError('');
    setMessages((current) => [...current, { role: 'USER', content: message, createdAt: new Date().toISOString() }]);
    setLoading(true);
    try {
      const result = await sendBuyerMessage(storeSlug, { message, sessionId, locale });
      setSessionId(result.sessionId);
      setMessages((current) => [...current, { role: 'ASSISTANT', content: result.reply, createdAt: new Date().toISOString() }]);
      if (result.redirectToCheckout) {
        navigate(user?.role === 'BUYER' ? '/checkout' : '/login', user?.role === 'BUYER' ? undefined : { state: { redirect: '/checkout' } });
      }
    } catch {
      setError(isUrdu ? 'پیغام بھیجا نہیں جا سکا۔ دوبارہ کوشش کریں۔' : 'Message could not be sent. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        type="primary"
        shape="circle"
        size="large"
        icon={<MessageCircle size={20} />}
        aria-label={isUrdu ? 'اسٹور سے سوال کریں' : `Chat with ${storeName}`}
        onClick={() => setOpen(true)}
        style={{ position: 'fixed', right: 24, bottom: 28, zIndex: 1000, width: 56, height: 56 }}
      />
      <Drawer
        title={isUrdu ? `${storeName} سے پوچھیں` : `Ask ${storeName}`}
        placement={isUrdu ? 'left' : 'right'}
        width={Math.min(420, window.innerWidth)}
        open={open}
        onClose={() => setOpen(false)}
        destroyOnClose={false}
      >
        <div dir={isUrdu ? 'rtl' : 'ltr'} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 12 }} aria-live="polite">
            {messages.length === 0 && (
              <Typography.Paragraph type="secondary">
                {isUrdu ? 'مصنوعات، قیمت یا دستیابی کے بارے میں پوچھیں۔' : 'Ask about products, prices, or availability.'}
              </Typography.Paragraph>
            )}
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              {messages.map((message, index) => (
                <div key={`${message.createdAt}-${index}`} style={{ alignSelf: message.role === 'USER' ? 'flex-end' : 'flex-start', maxWidth: '90%' }}>
                  <Typography.Paragraph
                    style={{ margin: 0, padding: 10, borderRadius: 10, background: message.role === 'USER' ? 'var(--brand-primary-soft)' : 'var(--bg-sunken)' }}
                  >
                    {message.content}
                  </Typography.Paragraph>
                </div>
              ))}
              {loading && <Spin size="small" />}
              <div ref={tailRef} />
            </Space>
          </div>
          {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 8 }} />}
          <Space.Compact style={{ width: '100%' }}>
            <Input.TextArea
              value={draft}
              autoSize={{ minRows: 1, maxRows: 4 }}
              maxLength={1000}
              aria-label={isUrdu ? 'آپ کا پیغام' : 'Your message'}
              placeholder={isUrdu ? 'اپنا سوال لکھیں' : 'Type your question'}
              onChange={(event) => setDraft(event.target.value)}
              onPressEnter={(event) => {
                if (!event.shiftKey) {
                  event.preventDefault();
                  void send();
                }
              }}
            />
            <Button type="primary" aria-label={isUrdu ? 'بھیجیں' : 'Send'} icon={<Send size={16} />} loading={loading} disabled={!draft.trim()} onClick={() => void send()} />
          </Space.Compact>
        </div>
      </Drawer>
    </>
  );
}
