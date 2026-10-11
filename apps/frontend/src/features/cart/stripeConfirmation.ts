// Stripe confirmation may finish at the provider even if its browser response is lost.
// A timeout or rejected SDK promise is therefore uncertain, never proof of failure.
export type StripeConfirmationOutcome =
  | { kind: 'submitted' }
  | { kind: 'failed'; message: string }
  | { kind: 'uncertain' };

export async function confirmStripePayment(
  confirm: () => Promise<{ error?: { message?: string } }>,
  timeoutMs = 120_000,
): Promise<StripeConfirmationOutcome> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      confirm(),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('Stripe confirmation response timed out')), timeoutMs);
      }),
    ]);
    return result.error
      ? { kind: 'failed', message: result.error.message ?? 'Payment could not be confirmed.' }
      : { kind: 'submitted' };
  } catch {
    return { kind: 'uncertain' };
  } finally {
    if (timer) clearTimeout(timer);
  }
}
