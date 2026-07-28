-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('BUYER', 'SELLER', 'ADMIN', 'SUPPORT');

-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'BANNED', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "language" AS ENUM ('EN', 'UR');

-- CreateEnum
CREATE TYPE "product_status" AS ENUM ('DRAFT', 'LIVE', 'OUT_OF_STOCK', 'REMOVED');

-- CreateEnum
CREATE TYPE "product_condition" AS ENUM ('NEW', 'LIKE_NEW', 'USED', 'REFURBISHED');

-- CreateEnum
CREATE TYPE "order_status" AS ENUM ('PAYMENT_PENDING', 'PAYMENT_CONFIRMED', 'PROCESSING', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'PENDING_MANUAL_LOGISTICS');

-- CreateEnum
CREATE TYPE "payment_method" AS ENUM ('JAZZCASH', 'EASYPAISA', 'COD');

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED', 'REFUNDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "settlement_status" AS ENUM ('PENDING', 'SETTLED', 'ON_HOLD');

-- CreateEnum
CREATE TYPE "cod_remittance_status" AS ENUM ('EXPECTED', 'RECEIVED', 'RECONCILED', 'SHORTFALL');

-- CreateEnum
CREATE TYPE "courier_code" AS ENUM ('TCS', 'LEOPARDS', 'TRAX');

-- CreateEnum
CREATE TYPE "return_status" AS ENUM ('INITIATED', 'IMAGES_SUBMITTED', 'UNDER_AI_REVIEW', 'MANUAL_REVIEW', 'APPROVED', 'REJECTED', 'PICKUP_BOOKED', 'REFUND_ISSUED', 'UNDER_DISPUTE', 'CLOSED');

-- CreateEnum
CREATE TYPE "return_condition" AS ENUM ('UNDAMAGED', 'MINOR', 'MAJOR', 'DESTROYED');

-- CreateEnum
CREATE TYPE "return_decision" AS ENUM ('APPROVED', 'REJECTED', 'MANUAL');

-- CreateEnum
CREATE TYPE "dispute_status" AS ENUM ('OPEN', 'RESOLVED_APPROVED', 'RESOLVED_REJECTED');

-- CreateEnum
CREATE TYPE "notification_channel" AS ENUM ('SMS', 'WHATSAPP', 'IN_APP', 'EMAIL');

-- CreateEnum
CREATE TYPE "notification_status" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'READ');

-- CreateEnum
CREATE TYPE "audit_action" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'SUSPEND', 'BAN', 'PAYMENT_RELEASE', 'AI_OVERRIDE', 'CONFIG_CHANGE', 'MODERATION', 'DISPUTE_RESOLVE');

-- CreateEnum
CREATE TYPE "payout_wallet_type" AS ENUM ('JAZZCASH', 'EASYPAISA');

-- CreateTable
CREATE TABLE "users" (
    "user_id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "phone" TEXT NOT NULL,
    "phone_bidx" TEXT NOT NULL,
    "email" TEXT,
    "email_bidx" TEXT,
    "password_hash" TEXT,
    "role" "user_role" NOT NULL DEFAULT 'BUYER',
    "status" "user_status" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "preferred_language" "language" NOT NULL DEFAULT 'UR',
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "seller_profiles" (
    "user_id" BIGINT NOT NULL,
    "store_name" VARCHAR(120) NOT NULL,
    "store_description" TEXT,
    "logo_url" VARCHAR(512),
    "commission_rate" DECIMAL(5,4) NOT NULL DEFAULT 0.0500,
    "fraud_rate_30d" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "onboarding_step" SMALLINT NOT NULL DEFAULT 0,
    "onboarding_completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "seller_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "buyer_profiles" (
    "user_id" BIGINT NOT NULL,
    "default_address_id" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "buyer_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "addresses" (
    "address_id" BIGSERIAL NOT NULL,
    "buyer_id" BIGINT NOT NULL,
    "label" VARCHAR(40),
    "line1" TEXT NOT NULL,
    "line2" TEXT,
    "city" VARCHAR(80) NOT NULL,
    "province" VARCHAR(80) NOT NULL,
    "postal_code" VARCHAR(20),
    "contact_phone" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("address_id")
);

-- CreateTable
CREATE TABLE "categories" (
    "category_id" BIGSERIAL NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "name_en" VARCHAR(80) NOT NULL,
    "name_ur" VARCHAR(80) NOT NULL,
    "parent_id" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("category_id")
);

-- CreateTable
CREATE TABLE "products" (
    "product_id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "seller_id" BIGINT NOT NULL,
    "category_id" BIGINT,
    "title_en" VARCHAR(160) NOT NULL,
    "title_ur" VARCHAR(160),
    "description_en" TEXT,
    "description_ur" TEXT,
    "price" DECIMAL(12,2) NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "condition" "product_condition" NOT NULL DEFAULT 'NEW',
    "status" "product_status" NOT NULL DEFAULT 'DRAFT',
    "tags" JSONB NOT NULL DEFAULT '[]',
    "ai_generated" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "products_pkey" PRIMARY KEY ("product_id")
);

-- CreateTable
CREATE TABLE "product_images" (
    "image_id" BIGSERIAL NOT NULL,
    "product_id" BIGINT NOT NULL,
    "cdn_url" VARCHAR(512) NOT NULL,
    "position" SMALLINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("image_id")
);

-- CreateTable
CREATE TABLE "carts" (
    "cart_id" BIGSERIAL NOT NULL,
    "buyer_id" BIGINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carts_pkey" PRIMARY KEY ("cart_id")
);

-- CreateTable
CREATE TABLE "cart_items" (
    "cart_item_id" BIGSERIAL NOT NULL,
    "cart_id" BIGINT NOT NULL,
    "product_id" BIGINT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("cart_item_id")
);

-- CreateTable
CREATE TABLE "orders" (
    "order_id" BIGSERIAL NOT NULL,
    "public_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tracking_token" UUID NOT NULL DEFAULT gen_random_uuid(),
    "buyer_id" BIGINT NOT NULL,
    "seller_id" BIGINT NOT NULL,
    "status" "order_status" NOT NULL DEFAULT 'PAYMENT_PENDING',
    "payment_method" "payment_method" NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "shipping_fee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "commission_rate_snapshot" DECIMAL(5,4) NOT NULL,
    "courier" "courier_code",
    "courier_overridden" BOOLEAN NOT NULL DEFAULT false,
    "tracking_no" VARCHAR(80),
    "ship_name" VARCHAR(120) NOT NULL,
    "ship_line1" TEXT NOT NULL,
    "ship_line2" TEXT,
    "ship_city" VARCHAR(80) NOT NULL,
    "ship_province" VARCHAR(80) NOT NULL,
    "ship_postal" VARCHAR(20),
    "ship_phone" TEXT NOT NULL,
    "placed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "delivered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("order_id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "order_item_id" BIGSERIAL NOT NULL,
    "order_id" BIGINT NOT NULL,
    "product_id" BIGINT NOT NULL,
    "title_snapshot" VARCHAR(160) NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("order_item_id")
);

-- CreateTable
CREATE TABLE "payments" (
    "payment_id" BIGSERIAL NOT NULL,
    "order_id" BIGINT NOT NULL,
    "method" "payment_method" NOT NULL,
    "gateway" VARCHAR(40),
    "transaction_ref" VARCHAR(120),
    "idempotency_key" VARCHAR(80) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "payment_status" NOT NULL DEFAULT 'PENDING',
    "retry_count" SMALLINT NOT NULL DEFAULT 0,
    "confirmed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("payment_id")
);

-- CreateTable
CREATE TABLE "settlements" (
    "settlement_id" BIGSERIAL NOT NULL,
    "order_id" BIGINT NOT NULL,
    "seller_id" BIGINT NOT NULL,
    "payout_wallet_id" BIGINT,
    "gross" DECIMAL(12,2) NOT NULL,
    "commission" DECIMAL(12,2) NOT NULL,
    "net" DECIMAL(12,2) NOT NULL,
    "status" "settlement_status" NOT NULL DEFAULT 'PENDING',
    "settled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settlements_pkey" PRIMARY KEY ("settlement_id")
);

-- CreateTable
CREATE TABLE "cod_remittances" (
    "remittance_id" BIGSERIAL NOT NULL,
    "order_id" BIGINT NOT NULL,
    "courier" "courier_code" NOT NULL,
    "expected_amount" DECIMAL(12,2) NOT NULL,
    "received_amount" DECIMAL(12,2),
    "status" "cod_remittance_status" NOT NULL DEFAULT 'EXPECTED',
    "remitted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cod_remittances_pkey" PRIMARY KEY ("remittance_id")
);

-- CreateTable
CREATE TABLE "returns" (
    "return_id" BIGSERIAL NOT NULL,
    "order_id" BIGINT NOT NULL,
    "seller_id" BIGINT NOT NULL,
    "reason" VARCHAR(200) NOT NULL,
    "ai_condition" "return_condition",
    "ai_authenticity" DECIMAL(5,4),
    "ai_confidence" DECIMAL(5,4),
    "decision" "return_decision",
    "status" "return_status" NOT NULL DEFAULT 'INITIATED',
    "decided_at" TIMESTAMP(3),
    "refunded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "returns_pkey" PRIMARY KEY ("return_id")
);

-- CreateTable
CREATE TABLE "return_images" (
    "return_image_id" BIGSERIAL NOT NULL,
    "return_id" BIGINT NOT NULL,
    "cdn_url" VARCHAR(512) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "return_images_pkey" PRIMARY KEY ("return_image_id")
);

-- CreateTable
CREATE TABLE "disputes" (
    "dispute_id" BIGSERIAL NOT NULL,
    "return_id" BIGINT NOT NULL,
    "status" "dispute_status" NOT NULL DEFAULT 'OPEN',
    "admin_reason" TEXT,
    "resolved_by" BIGINT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "disputes_pkey" PRIMARY KEY ("dispute_id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "review_id" BIGSERIAL NOT NULL,
    "buyer_id" BIGINT NOT NULL,
    "product_id" BIGINT NOT NULL,
    "order_id" BIGINT NOT NULL,
    "rating" SMALLINT NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("review_id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "notification_id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "order_id" BIGINT,
    "channel" "notification_channel" NOT NULL,
    "event_type" VARCHAR(60) NOT NULL,
    "message" TEXT NOT NULL,
    "language" "language" NOT NULL,
    "status" "notification_status" NOT NULL DEFAULT 'QUEUED',
    "sent_at" TIMESTAMP(3),
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("notification_id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "user_id" BIGINT NOT NULL,
    "sms_enabled" BOOLEAN NOT NULL DEFAULT true,
    "whatsapp_enabled" BOOLEAN NOT NULL DEFAULT true,
    "email_enabled" BOOLEAN NOT NULL DEFAULT true,
    "inapp_enabled" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "tracking_events" (
    "tracking_event_id" BIGSERIAL NOT NULL,
    "order_id" BIGINT NOT NULL,
    "status" "order_status" NOT NULL,
    "description" VARCHAR(200),
    "location_lat" DECIMAL(9,6),
    "location_lng" DECIMAL(9,6),
    "event_time" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracking_events_pkey" PRIMARY KEY ("tracking_event_id")
);

-- CreateTable
CREATE TABLE "courier_quotes" (
    "quote_id" BIGSERIAL NOT NULL,
    "order_id" BIGINT NOT NULL,
    "courier" "courier_code" NOT NULL,
    "cost" DECIMAL(12,2),
    "eta_hours" INTEGER,
    "score" DECIMAL(6,3),
    "selected" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "courier_quotes_pkey" PRIMARY KEY ("quote_id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "refresh_token_id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "jti" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "user_agent" VARCHAR(255),
    "ip_hash" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("refresh_token_id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "audit_id" BIGSERIAL NOT NULL,
    "actor_id" BIGINT,
    "action" "audit_action" NOT NULL,
    "entity" VARCHAR(60) NOT NULL,
    "entity_id" BIGINT,
    "reason" TEXT,
    "before" JSONB,
    "after" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("audit_id")
);

-- CreateTable
CREATE TABLE "platform_config" (
    "config_key" VARCHAR(60) NOT NULL,
    "value" JSONB NOT NULL,
    "description" VARCHAR(200),
    "updated_by" BIGINT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_config_pkey" PRIMARY KEY ("config_key")
);

-- CreateTable
CREATE TABLE "payout_wallets" (
    "wallet_id" BIGSERIAL NOT NULL,
    "seller_id" BIGINT NOT NULL,
    "type" "payout_wallet_type" NOT NULL,
    "account_number" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "payout_wallets_pkey" PRIMARY KEY ("wallet_id")
);

-- CreateTable
CREATE TABLE "seller_daily_stats" (
    "stat_id" BIGSERIAL NOT NULL,
    "seller_id" BIGINT NOT NULL,
    "stat_date" DATE NOT NULL,
    "revenue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "orders_count" INTEGER NOT NULL DEFAULT 0,
    "returns_count" INTEGER NOT NULL DEFAULT 0,
    "top_category_id" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_daily_stats_pkey" PRIMARY KEY ("stat_id")
);

-- CreateTable
CREATE TABLE "seller_recommendations" (
    "recommendation_id" BIGSERIAL NOT NULL,
    "seller_id" BIGINT NOT NULL,
    "message" TEXT NOT NULL,
    "basis" JSONB,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dismissed_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seller_recommendations_pkey" PRIMARY KEY ("recommendation_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_public_id_key" ON "users"("public_id");

-- CreateIndex
CREATE INDEX "idx_users_role" ON "users"("role");

-- CreateIndex
CREATE INDEX "idx_users_status" ON "users"("status");

-- CreateIndex
CREATE INDEX "idx_addresses_buyer" ON "addresses"("buyer_id");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "products_public_id_key" ON "products"("public_id");

-- CreateIndex
CREATE INDEX "idx_products_seller" ON "products"("seller_id");

-- CreateIndex
CREATE INDEX "idx_products_category" ON "products"("category_id");

-- CreateIndex
CREATE INDEX "idx_products_status" ON "products"("status");

-- CreateIndex
CREATE INDEX "idx_products_price" ON "products"("price");

-- CreateIndex
CREATE UNIQUE INDEX "uq_product_images_product_position" ON "product_images"("product_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "carts_buyer_id_key" ON "carts"("buyer_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_cart_items_cart_product" ON "cart_items"("cart_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_public_id_key" ON "orders"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_tracking_token_key" ON "orders"("tracking_token");

-- CreateIndex
CREATE INDEX "idx_orders_buyer" ON "orders"("buyer_id");

-- CreateIndex
CREATE INDEX "idx_orders_seller" ON "orders"("seller_id");

-- CreateIndex
CREATE INDEX "idx_orders_status" ON "orders"("status");

-- CreateIndex
CREATE INDEX "idx_orders_placed_at" ON "orders"("placed_at");

-- CreateIndex
CREATE INDEX "idx_orders_seller_status" ON "orders"("seller_id", "status");

-- CreateIndex
CREATE INDEX "idx_orders_ship_city" ON "orders"("ship_city");

-- CreateIndex
CREATE INDEX "idx_order_items_order" ON "order_items"("order_id");

-- CreateIndex
CREATE INDEX "idx_order_items_product" ON "order_items"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_order_id_key" ON "payments"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_transaction_ref_key" ON "payments"("transaction_ref");

-- CreateIndex
CREATE UNIQUE INDEX "payments_idempotency_key_key" ON "payments"("idempotency_key");

-- CreateIndex
CREATE INDEX "idx_payments_status" ON "payments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "settlements_order_id_key" ON "settlements"("order_id");

-- CreateIndex
CREATE INDEX "idx_settlements_seller" ON "settlements"("seller_id");

-- CreateIndex
CREATE INDEX "idx_settlements_status" ON "settlements"("status");

-- CreateIndex
CREATE UNIQUE INDEX "cod_remittances_order_id_key" ON "cod_remittances"("order_id");

-- CreateIndex
CREATE INDEX "idx_cod_remit_status" ON "cod_remittances"("status");

-- CreateIndex
CREATE UNIQUE INDEX "returns_order_id_key" ON "returns"("order_id");

-- CreateIndex
CREATE INDEX "idx_returns_status" ON "returns"("status");

-- CreateIndex
CREATE INDEX "idx_returns_seller_created" ON "returns"("seller_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_return_images_return" ON "return_images"("return_id");

-- CreateIndex
CREATE UNIQUE INDEX "disputes_return_id_key" ON "disputes"("return_id");

-- CreateIndex
CREATE INDEX "idx_reviews_product" ON "reviews"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_reviews_buyer_product" ON "reviews"("buyer_id", "product_id");

-- CreateIndex
CREATE INDEX "idx_notifications_user_created" ON "notifications"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_notifications_status" ON "notifications"("status");

-- CreateIndex
CREATE INDEX "idx_tracking_order_time" ON "tracking_events"("order_id", "event_time");

-- CreateIndex
CREATE UNIQUE INDEX "uq_tracking_events_order_status_time" ON "tracking_events"("order_id", "status", "event_time");

-- CreateIndex
CREATE INDEX "idx_courier_quotes_order" ON "courier_quotes"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_jti_key" ON "refresh_tokens"("jti");

-- CreateIndex
CREATE INDEX "idx_refresh_user" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "idx_refresh_expires" ON "refresh_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "idx_audit_entity" ON "audit_logs"("entity", "entity_id");

-- CreateIndex
CREATE INDEX "idx_audit_actor" ON "audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "idx_audit_created" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "idx_payout_wallets_seller" ON "payout_wallets"("seller_id");

-- CreateIndex
CREATE INDEX "idx_seller_daily_stats_seller_range" ON "seller_daily_stats"("seller_id", "stat_date");

-- CreateIndex
CREATE UNIQUE INDEX "uq_seller_daily_stats_seller_date" ON "seller_daily_stats"("seller_id", "stat_date");

-- CreateIndex
CREATE INDEX "idx_seller_recommendations_seller_active" ON "seller_recommendations"("seller_id", "generated_at");

-- AddForeignKey
ALTER TABLE "seller_profiles" ADD CONSTRAINT "seller_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyer_profiles" ADD CONSTRAINT "buyer_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyer_profiles" ADD CONSTRAINT "buyer_profiles_default_address_id_fkey" FOREIGN KEY ("default_address_id") REFERENCES "addresses"("address_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "buyer_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("category_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "seller_profiles"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("category_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("product_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carts" ADD CONSTRAINT "carts_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "buyer_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "carts"("cart_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("product_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "buyer_profiles"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "seller_profiles"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("order_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("product_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("order_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("order_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "seller_profiles"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_payout_wallet_id_fkey" FOREIGN KEY ("payout_wallet_id") REFERENCES "payout_wallets"("wallet_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cod_remittances" ADD CONSTRAINT "cod_remittances_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("order_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "returns" ADD CONSTRAINT "returns_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("order_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "returns" ADD CONSTRAINT "returns_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "seller_profiles"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_images" ADD CONSTRAINT "return_images_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "returns"("return_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "returns"("return_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "buyer_profiles"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("product_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("order_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("order_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracking_events" ADD CONSTRAINT "tracking_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("order_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courier_quotes" ADD CONSTRAINT "courier_quotes_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("order_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_config" ADD CONSTRAINT "platform_config_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_wallets" ADD CONSTRAINT "payout_wallets_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "seller_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_daily_stats" ADD CONSTRAINT "seller_daily_stats_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "seller_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_daily_stats" ADD CONSTRAINT "seller_daily_stats_top_category_id_fkey" FOREIGN KEY ("top_category_id") REFERENCES "categories"("category_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_recommendations" ADD CONSTRAINT "seller_recommendations_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "seller_profiles"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════
-- Manual addendum: constraints not expressible in Prisma schema syntax.
-- See the header comment in schema.prisma for the full list and doc references.
-- ═══════════════════════════════════════════════════════════════════════════

-- gen_random_uuid() is built into Postgres core since v13; kept for portability to older
-- versions and for teammates whose local Postgres predates that.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- §7: full-text search — generated tsvector column ('simple' config avoids English stemming
-- on Urdu tokens) + GIN index. One index serves both EN and UR queries at <=100k listings.
ALTER TABLE "products" ADD COLUMN "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce("title_en", '') || ' ' || coalesce("title_ur", '')), 'A') ||
    setweight(to_tsvector('simple', coalesce("description_en", '') || ' ' || coalesce("description_ur", '')), 'B') ||
    setweight(to_tsvector('simple', coalesce("tags"::text, '')), 'C')
  ) STORED;

CREATE INDEX "idx_products_search" ON "products" USING GIN ("search_vector");

-- §4.1: blind-index uniqueness is partial (only among non-deleted rows) so a phone/email can be
-- reused after a soft-deleted account is purged.
CREATE UNIQUE INDEX "uq_users_phone_bidx" ON "users" ("phone_bidx") WHERE "deleted_at" IS NULL;
CREATE UNIQUE INDEX "uq_users_email_bidx" ON "users" ("email_bidx") WHERE "deleted_at" IS NULL;

-- §14.1: same partial-uniqueness reasoning for payout wallets.
CREATE UNIQUE INDEX "uq_payout_wallets_seller_type_acct" ON "payout_wallets" ("seller_id", "type", "account_number") WHERE "deleted_at" IS NULL;

-- §4.6: storefront browse hot path — live, non-deleted products only.
CREATE INDEX "idx_products_live" ON "products" ("status") WHERE "status" = 'LIVE' AND "deleted_at" IS NULL;

-- Defensive CHECK constraints (§4.6, §4.9, §4.11, §4.18, §14.2 chk_settlements_net).
ALTER TABLE "products" ADD CONSTRAINT "chk_products_price_nonneg" CHECK ("price" >= 0);
ALTER TABLE "products" ADD CONSTRAINT "chk_products_stock_nonneg" CHECK ("stock" >= 0);
ALTER TABLE "cart_items" ADD CONSTRAINT "chk_cart_items_quantity_pos" CHECK ("quantity" > 0);
ALTER TABLE "order_items" ADD CONSTRAINT "chk_order_items_quantity_pos" CHECK ("quantity" > 0);
ALTER TABLE "reviews" ADD CONSTRAINT "chk_reviews_rating_range" CHECK ("rating" BETWEEN 1 AND 5);
ALTER TABLE "settlements" ADD CONSTRAINT "chk_settlements_net" CHECK ("net" = "gross" - "commission");
