-- Feature 23: optional size/colour variants with their own stock.
-- Additive only: no table, column or row is removed. Existing products, cart lines and order
-- items keep variant_id = NULL and behave exactly as before.

CREATE TABLE "product_variants" (
    "variant_id" BIGSERIAL NOT NULL,
    "product_id" BIGINT NOT NULL,
    "size" VARCHAR(40),
    "color" VARCHAR(40),
    "stock" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "position" SMALLINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("variant_id"),
    CONSTRAINT "product_variants_stock_non_negative" CHECK ("stock" >= 0)
);

CREATE INDEX "idx_product_variants_product" ON "product_variants"("product_id");

ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("product_id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cart_items" ADD COLUMN "variant_id" BIGINT;
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_variant_id_fkey"
    FOREIGN KEY ("variant_id") REFERENCES "product_variants"("variant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- One cart line per (cart, product, variant). NULLS NOT DISTINCT keeps the old guarantee of a
-- single line per product for products without variants. The new index is created before the old
-- one is dropped, so the cart is never without a uniqueness guard. Existing rows all have
-- variant_id NULL and were already unique on (cart_id, product_id), so this cannot fail.
CREATE UNIQUE INDEX "uq_cart_items_cart_product_variant"
    ON "cart_items"("cart_id", "product_id", "variant_id") NULLS NOT DISTINCT;
DROP INDEX "uq_cart_items_cart_product";

ALTER TABLE "order_items" ADD COLUMN "variant_id" BIGINT;
ALTER TABLE "order_items" ADD COLUMN "variant_label" VARCHAR(90);
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variant_id_fkey"
    FOREIGN KEY ("variant_id") REFERENCES "product_variants"("variant_id") ON DELETE RESTRICT ON UPDATE CASCADE;
