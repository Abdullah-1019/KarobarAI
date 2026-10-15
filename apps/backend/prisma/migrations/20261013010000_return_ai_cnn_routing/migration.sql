-- Preserve the verified category of the purchased item; later product edits must
-- not silently change the inspection provider for an existing order.
ALTER TABLE "order_items" ADD COLUMN "category_slug_snapshot" VARCHAR(80);

-- Advisory model evidence and provider routing are auditable independently of
-- the seller's decision. Existing inspection records remain valid.
ALTER TABLE "return_inspections" ADD COLUMN "category_slug" VARCHAR(80),
ADD COLUMN "confidence" DOUBLE PRECISION,
ADD COLUMN "predictions" JSONB;
