import express from 'express';
import request from 'supertest';

jest.mock('../../src/core/middleware/authenticate', () => ({
  authenticate: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = { sub: 'authenticated-user', role: (req.header('x-role') ?? 'BUYER') as 'SELLER' | 'BUYER', jti: 'test-token' };
    next();
  },
}));
jest.mock('../../src/core/middleware/requireActiveSeller', () => ({
  requireActiveSeller: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.sellerContext = { userId: 101n };
    next();
  },
}));
jest.mock('../../src/core/redis', () => ({ redis: { eval: jest.fn().mockResolvedValue(1) } }));
jest.mock('../../src/modules/chatbot/seller-chat.controller', () => ({
  sellerMessageHandler: (_req: express.Request, res: express.Response) => res.status(200).json({ data: { sessionId: 'seller-session-123' } }),
  streamSellerMessageHandler: (_req: express.Request, res: express.Response) => res.status(200).end(),
  sellerConversationHandler: (_req: express.Request, res: express.Response) => res.status(200).json({ data: { messages: [] } }),
}));

import { sellerChatRouter } from '../../src/modules/chatbot/seller-chat.routes';

const app = express();
app.use(express.json());
app.use('/seller/chat', sellerChatRouter);

describe('seller chat authorization', () => {
  it('allows an authenticated seller', async () => {
    const response = await request(app).post('/seller/chat').set('x-role', 'SELLER').send({ message: 'How were sales?', locale: 'en' });
    expect(response.status).toBe(200);
  });

  it('rejects an authenticated non-seller role', async () => {
    const response = await request(app).post('/seller/chat').set('x-role', 'BUYER').send({ message: 'How were sales?', locale: 'en' });
    expect(response.status).toBe(403);
  });

  it('rejects a client supplied seller ID at the route boundary', async () => {
    const response = await request(app).post('/seller/chat').set('x-role', 'SELLER').send({ message: 'How were sales?', locale: 'en', sellerId: '202' });
    expect(response.status).toBe(400);
  });
});
