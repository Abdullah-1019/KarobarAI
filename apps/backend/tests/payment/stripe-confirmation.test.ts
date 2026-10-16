import { confirmStripePayment } from '../../../frontend/src/features/cart/stripeConfirmation';

describe('browser Stripe confirmation state', () => {
  afterEach(() => jest.useRealTimers());

  it('clears the wait on a successful SDK response without declaring the order paid', async () => {
    await expect(confirmStripePayment(async () => ({}))).resolves.toEqual({ kind: 'submitted' });
  });

  it('returns a retryable validation failure from Stripe', async () => {
    await expect(confirmStripePayment(async () => ({ error: { message: 'Card details are incomplete.' } })))
      .resolves.toEqual({ kind: 'failed', message: 'Card details are incomplete.' });
  });

  it('treats a rejected SDK response as uncertain, without exposing an exception', async () => {
    await expect(confirmStripePayment(async () => { throw new Error('internal transport details'); }))
      .resolves.toEqual({ kind: 'uncertain' });
  });

  it('stops a hung spinner but keeps an unresolved payment uncertain', async () => {
    jest.useFakeTimers();
    const pending = confirmStripePayment(() => new Promise(() => undefined), 1_000);
    await jest.advanceTimersByTimeAsync(1_000);
    await expect(pending).resolves.toEqual({ kind: 'uncertain' });
  });
});
