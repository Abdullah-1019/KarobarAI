import express from 'express';
import request from 'supertest';

jest.mock('../../src/core/redis', () => ({ redis: { eval: jest.fn().mockResolvedValue(1) } }));
jest.mock('../../src/modules/chatbot/buyer-chat.controller', () => ({
  getStoreForProductHandler: (_req: express.Request, res: express.Response) => res.status(200).end(),
  getPublicStorefrontHandler: (_req: express.Request, res: express.Response) => res.status(200).end(),
  sendBuyerMessageHandler: (_req: express.Request, res: express.Response) => res.status(200).end(),
  streamBuyerMessageHandler: (_req: express.Request, res: express.Response) => res.status(200).end(),
  getBuyerConversationHandler: (_req: express.Request, res: express.Response) => res.status(200).end(),
}));

import { buyerChatRouter } from '../../src/modules/chatbot/buyer-chat.routes';

const app = express();
app.use(express.json());
app.use('/api/v1/stores', buyerChatRouter);

describe('buyer AI streaming route', () => {
  it('matches the store chat stream URL used by the browser', async () => {
    const response = await request(app).post('/api/v1/stores/returnai-clothing-demo/chat/stream')
      .send({ message: 'hello', locale: 'en' });
    expect(response.status).toBe(200);
  });

  it('validates the request before calling the stream handler', async () => {
    const response = await request(app).post('/api/v1/stores/returnai-clothing-demo/chat/stream').send({});
    expect(response.status).toBe(400);
  });
});
