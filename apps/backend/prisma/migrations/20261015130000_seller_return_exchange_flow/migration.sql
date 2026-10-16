-- Preserve existing dispute resolution fields and historical return decisions.
ALTER TABLE "disputes" ADD COLUMN "buyer_reason" VARCHAR(500);

-- Courier delivery and buyer receipt are distinct events for replacement parcels.
ALTER TYPE "ReturnFulfillmentStatus" ADD VALUE 'REPLACEMENT_DELIVERED';
ALTER TABLE "return_fulfillments" ADD COLUMN "replacement_buyer_confirmed_at" TIMESTAMP(3);
