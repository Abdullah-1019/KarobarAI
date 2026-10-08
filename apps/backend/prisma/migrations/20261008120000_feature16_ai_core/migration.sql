-- Feature 16: local RAG embeddings and shared agent conversation storage.
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TYPE "chat_context" AS ENUM ('BUYER_STORE', 'SELLER_ASSISTANT');
CREATE TYPE "chat_role" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM', 'TOOL');

CREATE TABLE "product_embeddings" (
    "id" TEXT NOT NULL,
    "product_id" BIGINT NOT NULL,
    "embedding" vector(768) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "product_embeddings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "product_embeddings_product_id_key" ON "product_embeddings"("product_id");
CREATE INDEX "idx_product_embeddings_product" ON "product_embeddings"("product_id");
ALTER TABLE "product_embeddings" ADD CONSTRAINT "product_embeddings_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("product_id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "chat_sessions" (
    "id" TEXT NOT NULL,
    "context" "chat_context" NOT NULL,
    "store_id" BIGINT,
    "seller_id" BIGINT,
    "buyer_user_id" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "chat_sessions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_chat_sessions_store" ON "chat_sessions"("store_id");
CREATE INDEX "idx_chat_sessions_seller" ON "chat_sessions"("seller_id");
CREATE INDEX "idx_chat_sessions_buyer" ON "chat_sessions"("buyer_user_id");
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_store_id_fkey"
    FOREIGN KEY ("store_id") REFERENCES "seller_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_seller_id_fkey"
    FOREIGN KEY ("seller_id") REFERENCES "seller_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_buyer_user_id_fkey"
    FOREIGN KEY ("buyer_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "role" "chat_role" NOT NULL,
    "content" TEXT NOT NULL,
    "tool_call" JSONB,
    "tool_result" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_chat_messages_session" ON "chat_messages"("session_id");
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_session_id_fkey"
    FOREIGN KEY ("session_id") REFERENCES "chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "platform_config" ADD COLUMN "chatbot_enabled" BOOLEAN NOT NULL DEFAULT true;
