ALTER TYPE "courier_code" ADD VALUE IF NOT EXISTS 'POSTEX';

CREATE TYPE "courier_shipment_source" AS ENUM ('SIMULATED', 'REAL');
CREATE TYPE "courier_shipment_status" AS ENUM (
  'EVALUATING', 'BOOKING', 'BOOKED', 'FAILED', 'UNCERTAIN',
  'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RETURNED', 'CANCELLED'
);

ALTER TABLE "courier_quotes"
  ADD COLUMN "evaluation_id" UUID,
  ADD COLUMN "sla_score" DECIMAL(5,4),
  ADD COLUMN "rating_score" DECIMAL(5,4),
  ADD COLUMN "score_breakdown" JSONB,
  ADD COLUMN "source" "courier_shipment_source" NOT NULL DEFAULT 'SIMULATED',
  ADD COLUMN "origin_city" VARCHAR(80),
  ADD COLUMN "dest_city" VARCHAR(80),
  ADD COLUMN "weight_kg" DECIMAL(8,3);
CREATE INDEX "idx_courier_quotes_evaluation" ON "courier_quotes"("order_id", "evaluation_id");

CREATE TABLE "courier_shipments" (
  "shipment_id" BIGSERIAL PRIMARY KEY,
  "order_id" BIGINT NOT NULL UNIQUE,
  "seller_id" BIGINT NOT NULL,
  "courier" "courier_code",
  "source" "courier_shipment_source" NOT NULL DEFAULT 'SIMULATED',
  "status" "courier_shipment_status" NOT NULL DEFAULT 'EVALUATING',
  "origin_city" VARCHAR(80) NOT NULL,
  "dest_city" VARCHAR(80) NOT NULL,
  "dest_province" VARCHAR(80) NOT NULL,
  "weight_kg" DECIMAL(8,3) NOT NULL,
  "dimensions" JSONB,
  "evaluation_id" UUID,
  "score_breakdown" JSONB,
  "booking_reference" VARCHAR(100),
  "tracking_id" VARCHAR(100),
  "failure_code" VARCHAR(80),
  "failure_message" VARCHAR(200),
  "booked_at" TIMESTAMP(3),
  "picked_up_at" TIMESTAMP(3),
  "in_transit_at" TIMESTAMP(3),
  "delivered_at" TIMESTAMP(3),
  "returned_at" TIMESTAMP(3),
  "cancelled_at" TIMESTAMP(3),
  "failed_at" TIMESTAMP(3),
  "on_time" BOOLEAN,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "courier_shipments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("order_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "courier_shipments_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "seller_profiles"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "idx_courier_shipments_seller_status" ON "courier_shipments"("seller_id", "status");
CREATE INDEX "idx_courier_shipments_performance" ON "courier_shipments"("courier", "dest_city", "weight_kg");
