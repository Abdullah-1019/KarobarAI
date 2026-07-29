-- Feature 2 (User Profiles) — Task 1: add avatar_url to users (base identity table).
-- Generated via `prisma migrate diff` (not `migrate dev`, which requires an interactive
-- terminal and isn't usable in this environment) and hand-edited before applying: the diff also
-- included the same recurring false-positive covered in the make_phone_optional migration and
-- docs/DoneTillNow.md — `DROP INDEX "idx_products_search"` and `ALTER TABLE "products" ALTER
-- COLUMN "search_vector" DROP DEFAULT` — both removed. Prisma's diff engine still doesn't
-- understand the GENERATED ALWAYS AS ... STORED column and will keep proposing this on every
-- future migration that touches `products`; always re-check before applying.

-- AlterTable
ALTER TABLE "users" ADD COLUMN "avatar_url" VARCHAR(512);
