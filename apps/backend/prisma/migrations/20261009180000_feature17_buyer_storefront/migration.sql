ALTER TABLE "seller_profiles" ADD COLUMN "store_slug" VARCHAR(180);

UPDATE "seller_profiles" AS seller
SET "store_slug" =
  COALESCE(
    NULLIF(TRIM(BOTH '-' FROM REGEXP_REPLACE(LOWER(seller."store_name"), '[^a-z0-9]+', '-', 'g')), ''),
    'store'
  ) || '-' || account."public_id"::text
FROM "users" AS account
WHERE account."user_id" = seller."user_id";

ALTER TABLE "seller_profiles" ALTER COLUMN "store_slug" SET NOT NULL;
CREATE UNIQUE INDEX "uq_seller_profiles_store_slug" ON "seller_profiles"("store_slug");
