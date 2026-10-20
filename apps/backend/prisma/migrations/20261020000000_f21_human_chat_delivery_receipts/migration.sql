-- First authenticated recipient-device acknowledgement for each human message.
-- Existing messages remain SENT until explicitly acknowledged or read.
CREATE TABLE "human_message_deliveries" (
  "message_id" TEXT NOT NULL,
  "delivered_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "human_message_deliveries_pkey" PRIMARY KEY ("message_id")
);

ALTER TABLE "human_message_deliveries" ADD CONSTRAINT "human_message_deliveries_message_id_fkey"
  FOREIGN KEY ("message_id") REFERENCES "human_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
