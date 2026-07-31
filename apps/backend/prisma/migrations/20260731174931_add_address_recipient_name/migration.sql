-- Feature 6 (Cart & Checkout): orders.ship_name (Schema §4.10/§14.4) is NOT NULL and snapshotted
-- from the buyer's selected address at order time, but neither addresses nor users/buyer_profiles
-- has any name field anywhere in the base Schema Doc. Safe as NOT NULL with no default — the
-- addresses table has zero rows so far (no feature has written to it before this one). The
-- auto-generated diff also proposed dropping idx_products_search's DEFAULT on search_vector —
-- stripped by hand, the same recurring Prisma diff-engine trap every prior migration has hit.
ALTER TABLE "addresses" ADD COLUMN "recipient_name" VARCHAR(120) NOT NULL;
