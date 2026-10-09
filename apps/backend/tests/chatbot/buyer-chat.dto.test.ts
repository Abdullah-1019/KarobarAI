import { sendBuyerMessageSchema } from '../../src/modules/chatbot/buyer-chat.dto';

describe('sendBuyerMessageSchema', () => {
  it('accepts supported locale and defaults to English', () => {
    expect(sendBuyerMessageSchema.parse({ message: 'Hello' })).toEqual({ message: 'Hello', locale: 'en' });
    expect(sendBuyerMessageSchema.parse({ message: 'سلام', locale: 'ur' }).locale).toBe('ur');
  });

  it('rejects client-supplied store identity and oversized messages', () => {
    expect(sendBuyerMessageSchema.safeParse({ message: 'Hi', storeId: 'foreign-store' }).success).toBe(false);
    expect(sendBuyerMessageSchema.safeParse({ message: 'x'.repeat(1001) }).success).toBe(false);
  });
});
