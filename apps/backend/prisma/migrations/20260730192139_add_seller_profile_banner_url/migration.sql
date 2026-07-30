-- Feature 3 (Store Management): additive nullable column, mirrors avatar_url's precedent.
-- The auto-generated diff also proposed dropping idx_products_search and the search_vector
-- column's DEFAULT — Prisma's diff engine doesn't understand GENERATED ALWAYS AS ... STORED
-- columns and treats them as unexplained drift on every migration touching any table. Stripped
-- by hand, as with every prior migration that has hit this same trap.
ALTER TABLE "seller_profiles" ADD COLUMN "banner_url" VARCHAR(512);
