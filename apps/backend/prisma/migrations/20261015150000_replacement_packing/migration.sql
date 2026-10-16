-- Reserve and packing are separate milestones. Existing reserved replacements remain
-- pending until their owning seller explicitly records packing.
ALTER TYPE "ReturnFulfillmentStatus" ADD VALUE 'REPLACEMENT_PACKED';
ALTER TABLE "return_fulfillments" ADD COLUMN "replacement_packed_at" TIMESTAMP(3);
