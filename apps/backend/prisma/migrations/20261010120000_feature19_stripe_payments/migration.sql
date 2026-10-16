ALTER TYPE "payment_method" ADD VALUE 'STRIPE';

CREATE TABLE "stripe_webhook_events" (
    "event_id" VARCHAR(120) NOT NULL,
    "event_type" VARCHAR(80) NOT NULL,
    "payment_id" BIGINT NOT NULL,
    "received_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stripe_webhook_events_pkey" PRIMARY KEY ("event_id"),
    CONSTRAINT "stripe_webhook_events_payment_id_fkey"
      FOREIGN KEY ("payment_id") REFERENCES "payments"("payment_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "idx_stripe_webhook_events_payment" ON "stripe_webhook_events"("payment_id", "received_at");
