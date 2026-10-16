import express from 'express';
import Stripe from 'stripe';
import request from 'supertest';

import { config } from '../../src/core/config';
import { errorHandler } from '../../src/core/middleware/errorHandler';
import { paymentRouter, stripeWebhookRouter } from '../../src/modules/payment/payment.routes';
import { processStripeEvent } from '../../src/modules/payment/stripe-webhook.service';

jest.mock('../../src/modules/payment/stripe-webhook.service', () => ({ processStripeEvent: jest.fn() }));

const processEventMock = jest.mocked(processStripeEvent);
const originalStripeConfig = { ...config.stripe };
const stripe = new Stripe('sk_test_webhook_unit');
const testApp = express();
testApp.use('/api/v1/payments', stripeWebhookRouter);
testApp.use(express.json());
testApp.use('/api/v1/payments', paymentRouter);
testApp.use(errorHandler);

function signedPayload(overrides: Record<string, unknown> = {}) {
  const event = {
    id: 'evt_feature19_test_1',
    object: 'event',
    api_version: '2024-06-20',
    created: 1_760_000_000,
    data: {
      object: {
        id: 'pi_feature19_test_1',
        object: 'payment_intent',
        amount: 100,
        currency: 'usd',
        status: 'succeeded',
        metadata: { orderId: 'order_public_1', paymentId: '1' },
      },
    },
    livemode: false,
    pending_webhooks: 1,
    request: null,
    type: 'payment_intent.succeeded',
    ...overrides,
  };
  const payload = JSON.stringify(event);
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: config.stripe.webhookSecret });
  return { payload, signature };
}

beforeEach(() => {
  Object.assign(config.stripe, {
    secretKey: 'sk_test_webhook_unit',
    publishableKey: 'pk_test_webhook_unit',
    webhookSecret: 'whsec_feature19_unit',
  });
  processEventMock.mockReset();
  processEventMock.mockResolvedValue({ duplicate: false, status: 'CONFIRMED' });
});

afterAll(() => Object.assign(config.stripe, originalStripeConfig));

describe('Stripe webhook HTTP endpoint', () => {
  it('accepts a valid Stripe test signature over the untouched raw body', async () => {
    const { payload, signature } = signedPayload();
    const response = await request(testApp)
      .post('/api/v1/payments/stripe/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', signature)
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ received: true, duplicate: false });
    expect(processEventMock).toHaveBeenCalledWith(expect.objectContaining({ type: 'payment_intent.succeeded', livemode: false }));
  });

  it('rejects an invalid signature before event processing', async () => {
    const { payload } = signedPayload();
    const response = await request(testApp)
      .post('/api/v1/payments/stripe/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 't=1,v1=invalid')
      .send(payload);

    expect(response.status).toBe(401);
    expect(processEventMock).not.toHaveBeenCalled();
  });

  it('returns an invalid-event response for signed malformed event structure', async () => {
    const malformed = JSON.stringify({ object: 'event', livemode: false, type: 'payment_intent.succeeded' });
    const signature = stripe.webhooks.generateTestHeaderString({ payload: malformed, secret: config.stripe.webhookSecret });
    const response = await request(testApp)
      .post('/api/v1/payments/stripe/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', signature)
      .send(malformed);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_PAYMENT_EVENT');
    expect(processEventMock).not.toHaveBeenCalled();
  });

  it('propagates duplicate-delivery acknowledgement without treating it as a new transition', async () => {
    const { payload, signature } = signedPayload();
    processEventMock.mockResolvedValueOnce({ duplicate: false, status: 'CONFIRMED' })
      .mockResolvedValueOnce({ duplicate: true, status: 'CONFIRMED' });

    const first = await request(testApp).post('/api/v1/payments/stripe/webhook').set('Content-Type', 'application/json').set('stripe-signature', signature).send(payload);
    const duplicate = await request(testApp).post('/api/v1/payments/stripe/webhook').set('Content-Type', 'application/json').set('stripe-signature', signature).send(payload);

    expect(first.status).toBe(200);
    expect(duplicate.status).toBe(200);
    expect(duplicate.body.data.duplicate).toBe(true);
    expect(processEventMock).toHaveBeenCalledTimes(2);
  });
});
