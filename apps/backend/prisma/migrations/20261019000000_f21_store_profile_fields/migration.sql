-- F21: additive store profile metadata; existing stores remain valid.
ALTER TABLE "seller_profiles"
  ADD COLUMN "store_category_id" BIGINT,
  ADD COLUMN "city" VARCHAR(80),
  ADD COLUMN "social_links" JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX "idx_seller_profiles_store_category" ON "seller_profiles"("store_category_id");

ALTER TABLE "seller_profiles"
  ADD CONSTRAINT "seller_profiles_store_category_id_fkey"
  FOREIGN KEY ("store_category_id") REFERENCES "categories"("category_id")
  ON DELETE SET NULL ON UPDATE CASCADE;
