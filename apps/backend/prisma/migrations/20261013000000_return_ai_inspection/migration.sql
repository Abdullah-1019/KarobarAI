ALTER TABLE "returns" ADD COLUMN "order_item_id" BIGINT;
ALTER TABLE "returns" ADD CONSTRAINT "returns_order_item_id_fkey"
  FOREIGN KEY ("order_item_id") REFERENCES "order_items"("order_item_id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "idx_returns_order_item" ON "returns"("order_item_id");

ALTER TABLE "return_images" ADD COLUMN "storage_key" VARCHAR(512);

CREATE TABLE "dispatch_evidence" (
  "evidence_id" BIGSERIAL PRIMARY KEY,
  "order_item_id" BIGINT NOT NULL,
  "storage_key" VARCHAR(512) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "dispatch_evidence_order_item_id_fkey" FOREIGN KEY ("order_item_id")
    REFERENCES "order_items"("order_item_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "idx_dispatch_evidence_item" ON "dispatch_evidence"("order_item_id");

CREATE TABLE "return_inspections" (
  "inspection_id" BIGSERIAL PRIMARY KEY,
  "return_id" BIGINT NOT NULL UNIQUE,
  "state" VARCHAR(30) NOT NULL,
  "outcome" VARCHAR(50),
  "provider" VARCHAR(40),
  "model" VARCHAR(100),
  "policy_version" VARCHAR(40) NOT NULL,
  "findings" JSONB,
  "image_quality" VARCHAR(30),
  "comparison_available" BOOLEAN NOT NULL DEFAULT FALSE,
  "comparison_result" VARCHAR(50),
  "error_code" VARCHAR(60),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "return_inspections_return_id_fkey" FOREIGN KEY ("return_id")
    REFERENCES "returns"("return_id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "idx_return_inspections_state" ON "return_inspections"("state", "updated_at");
