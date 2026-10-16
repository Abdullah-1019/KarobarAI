import { useMemo, useState } from 'react';
import { Alert, Button } from 'antd';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { confirmStripePayment } from './stripeConfirmation';

interface Props {
  publishableKey: string;
  clientSecret: string;
  submitLabel: string;
  pendingLabel: string;
  onSubmitted: () => void;
  initiallySubmitted?: boolean;
  onAttemptStarted?: () => void;
  onAttemptFailed?: () => void;
}

function PaymentElementForm({ submitLabel, pendingLabel, onSubmitted, initiallySubmitted = false, onAttemptStarted, onAttemptFailed }: Omit<Props, 'publishableKey' | 'clientSecret'>) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(initiallySubmitted);
  const [error, setError] = useState<string | null>(null);

  async function submitPayment() {
    if (!stripe || !elements || submitting || submitted) return;
    setSubmitting(true);
    setError(null);
    onAttemptStarted?.();
    const outcome = await confirmStripePayment(() => stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: 'if_required',
    }));
    setSubmitting(false);
    if (outcome.kind === 'failed') {
      setError(outcome.message);
      onAttemptFailed?.();
      return;
    }
    // Success and lost browser responses both require an authoritative order-status check.
    // Keep the form pending so a late Stripe response cannot prompt a second charge.
    setSubmitted(true);
    onSubmitted();
  }

  return (
    <div>
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />}
      <PaymentElement />
      {submitted ? (
        <Alert type="info" showIcon message={pendingLabel} style={{ marginTop: 12 }} />
      ) : (
        <Button type="primary" block disabled={!stripe || !elements} loading={submitting} onClick={submitPayment} style={{ marginTop: 16 }}>
          {submitLabel}
        </Button>
      )}
    </div>
  );
}

export function StripePaymentForm(props: Props) {
  const stripePromise = useMemo(() => loadStripe(props.publishableKey), [props.publishableKey]);
  return (
    <Elements stripe={stripePromise} options={{ clientSecret: props.clientSecret }}>
      <PaymentElementForm {...props} />
    </Elements>
  );
}
