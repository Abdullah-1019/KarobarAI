-- Auth-feature correction: TRD §7 registration is mobile+OTP OR email+password, so a
-- user registering by email alone has no phone. §4.1 listed phone as NOT NULL; that's wrong
-- for this registration model — made nullable here, mirroring email/email_bidx.
--
-- NOTE: Prisma's auto-generated diff for this migration also proposed
-- `DROP INDEX "idx_products_search"` and `ALTER TABLE "products" ALTER COLUMN "search_vector"
-- DROP DEFAULT` — both removed by hand. Prisma's schema.prisma model for search_vector is
-- `Unsupported("tsvector")?` (it has no way to represent a GENERATED ALWAYS AS ... STORED
-- column), so its diff engine sees the real generated column as unexplained "drift" and wants
-- to strip it. Applying those two statements would have silently broken full-text search
-- (dropped the GIN index, and DROP DEFAULT on a generated column is a no-op/confusion at best).
-- This same false-positive will resurface on every future migration that touches `products` —
-- always re-check generated migrations for it before applying.

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "phone" DROP NOT NULL,
ALTER COLUMN "phone_bidx" DROP NOT NULL;

-- A user must have at least one way to sign in.
ALTER TABLE "users" ADD CONSTRAINT "chk_users_has_identifier" CHECK ("phone" IS NOT NULL OR "email" IS NOT NULL);
