-- Stable display number, independent from the internal order primary key.
CREATE SEQUENCE "order_number_seq";
ALTER TABLE "orders" ADD COLUMN "order_number" BIGINT;
WITH numbered AS (
  SELECT order_id, row_number() OVER (ORDER BY placed_at, order_id) AS display_number
  FROM orders
)
UPDATE orders AS o SET order_number = numbered.display_number
FROM numbered WHERE o.order_id = numbered.order_id;
SELECT setval('order_number_seq', COALESCE((SELECT max(order_number) FROM orders), 1),
  EXISTS (SELECT 1 FROM orders));
ALTER TABLE "orders" ALTER COLUMN "order_number" SET NOT NULL;
ALTER TABLE "orders" ALTER COLUMN "order_number" SET DEFAULT nextval('order_number_seq'::regclass);
CREATE UNIQUE INDEX "orders_order_number_key" ON "orders"("order_number");
ALTER TABLE "orders" ADD COLUMN "buyer_confirmed_at" TIMESTAMP(3);

CREATE TYPE "OrderItemResolution" AS ENUM ('PURCHASED', 'RETURNED', 'EXCHANGED');
ALTER TABLE "order_items" ADD COLUMN "resolution" "OrderItemResolution" NOT NULL DEFAULT 'PURCHASED';

CREATE TYPE "ReturnShipmentLeg" AS ENUM ('RETURN', 'REPLACEMENT');
CREATE TYPE "ReturnFulfillmentStatus" AS ENUM (
  'AWAITING_COURIER', 'RETURN_IN_TRANSIT', 'AWAITING_SELLER_RECEIPT',
  'REPLACEMENT_PENDING', 'REPLACEMENT_IN_TRANSIT', 'EXCHANGE_COMPLETED',
  'REFUND_PROPOSED', 'REFUND_CONSENTED', 'REFUND_DECLINED'
);
CREATE TYPE "ReturnReceiptCondition" AS ENUM ('RESELLABLE', 'DAMAGED', 'NEEDS_INSPECTION');
CREATE TYPE "ReturnRefundProposalStatus" AS ENUM ('NONE', 'PENDING_BUYER', 'ACCEPTED', 'DECLINED');

CREATE TABLE "return_fulfillments" (
  "return_id" BIGINT NOT NULL PRIMARY KEY,
  "status" "ReturnFulfillmentStatus" NOT NULL DEFAULT 'AWAITING_COURIER',
  "receipt_condition" "ReturnReceiptCondition",
  "receipt_confirmed_by" BIGINT,
  "receipt_confirmed_at" TIMESTAMP(3),
  "inventory_reconciled_at" TIMESTAMP(3),
  "replacement_product_id" BIGINT,
  "replacement_quantity" INTEGER,
  "replacement_reserved_at" TIMESTAMP(3),
  "refund_proposal_status" "ReturnRefundProposalStatus" NOT NULL DEFAULT 'NONE',
  "refund_proposal_reason" VARCHAR(500),
  "refund_proposed_by" BIGINT,
  "refund_proposed_at" TIMESTAMP(3),
  "buyer_responded_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "return_fulfillments_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "returns"("return_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "return_fulfillments_replacement_product_id_fkey" FOREIGN KEY ("replacement_product_id") REFERENCES "products"("product_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
-- Existing accepted returns have no confirmed return-leg booking. Do not invent one.
INSERT INTO "return_fulfillments" ("return_id", "updated_at")
SELECT "return_id", CURRENT_TIMESTAMP FROM "returns" WHERE "status" = 'APPROVED';

CREATE TABLE "return_shipments" (
  "shipment_id" BIGSERIAL NOT NULL PRIMARY KEY,
  "return_id" BIGINT NOT NULL,
  "leg" "ReturnShipmentLeg" NOT NULL,
  "source" "courier_shipment_source" NOT NULL DEFAULT 'SIMULATED',
  "status" "courier_shipment_status" NOT NULL DEFAULT 'EVALUATING',
  "courier" "courier_code",
  "origin_city" VARCHAR(80) NOT NULL,
  "dest_city" VARCHAR(80) NOT NULL,
  "dest_province" VARCHAR(80) NOT NULL,
  "weight_kg" DECIMAL(8,3) NOT NULL,
  "quote_cost" DECIMAL(12,2),
  "quote_eta_hours" INTEGER,
  "score_breakdown" JSONB,
  "booking_reference" VARCHAR(100),
  "tracking_id" VARCHAR(100),
  "failure_code" VARCHAR(80),
  "booked_at" TIMESTAMP(3),
  "delivered_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "return_shipments_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "returns"("return_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "uq_return_shipments_leg" ON "return_shipments"("return_id", "leg");
CREATE INDEX "idx_return_shipments_status" ON "return_shipments"("status", "created_at");

CREATE TABLE "return_shipment_events" (
  "event_id" BIGSERIAL NOT NULL PRIMARY KEY,
  "shipment_id" BIGINT NOT NULL,
  "status" "courier_shipment_status" NOT NULL,
  "description" VARCHAR(200) NOT NULL,
  "event_time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "return_shipment_events_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "return_shipments"("shipment_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "idx_return_shipment_events_time" ON "return_shipment_events"("shipment_id", "event_time");
