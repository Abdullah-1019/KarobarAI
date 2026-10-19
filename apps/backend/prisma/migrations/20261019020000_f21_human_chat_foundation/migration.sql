-- F21 human conversations are separate from AI chat_sessions/chat_messages.
CREATE TABLE "human_conversations" (
  "id" TEXT NOT NULL,
  "buyer_id" BIGINT NOT NULL,
  "seller_id" BIGINT NOT NULL,
  "product_id" BIGINT,
  "buyer_last_read_at" TIMESTAMPTZ(6),
  "seller_last_read_at" TIMESTAMPTZ(6),
  "buyer_blocked_at" TIMESTAMPTZ(6),
  "seller_blocked_at" TIMESTAMPTZ(6),
  "last_message_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "human_conversations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "uq_human_conversation_buyer_seller" ON "human_conversations"("buyer_id", "seller_id");
CREATE INDEX "idx_human_conversation_buyer_latest" ON "human_conversations"("buyer_id", "last_message_at", "id");
CREATE INDEX "idx_human_conversation_seller_latest" ON "human_conversations"("seller_id", "last_message_at", "id");
ALTER TABLE "human_conversations" ADD CONSTRAINT "human_conversations_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "human_conversations" ADD CONSTRAINT "human_conversations_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "seller_profiles"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "human_conversations" ADD CONSTRAINT "human_conversations_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("product_id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "human_messages" (
  "id" TEXT NOT NULL,
  "conversation_id" TEXT NOT NULL,
  "sender_id" BIGINT NOT NULL,
  "client_id" UUID NOT NULL,
  "content" VARCHAR(2000) NOT NULL DEFAULT '',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "human_messages_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "uq_human_message_client_retry" ON "human_messages"("conversation_id", "sender_id", "client_id");
CREATE INDEX "idx_human_message_page" ON "human_messages"("conversation_id", "created_at", "id");
ALTER TABLE "human_messages" ADD CONSTRAINT "human_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "human_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "human_messages" ADD CONSTRAINT "human_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "human_message_attachments" (
  "id" TEXT NOT NULL,
  "message_id" TEXT NOT NULL,
  "position" SMALLINT NOT NULL,
  "object_key" VARCHAR(255) NOT NULL,
  "mime_type" VARCHAR(40) NOT NULL,
  "byte_size" INTEGER NOT NULL,
  CONSTRAINT "human_message_attachments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "uq_human_attachment_position" ON "human_message_attachments"("message_id", "position");
ALTER TABLE "human_message_attachments" ADD CONSTRAINT "human_message_attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "human_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "human_conversation_reports" (
  "id" TEXT NOT NULL,
  "conversation_id" TEXT NOT NULL,
  "message_id" TEXT,
  "reporter_id" BIGINT NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "human_conversation_reports_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_human_report_conversation" ON "human_conversation_reports"("conversation_id", "created_at");
ALTER TABLE "human_conversation_reports" ADD CONSTRAINT "human_conversation_reports_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "human_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "human_conversation_reports" ADD CONSTRAINT "human_conversation_reports_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "human_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "human_conversation_reports" ADD CONSTRAINT "human_conversation_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
