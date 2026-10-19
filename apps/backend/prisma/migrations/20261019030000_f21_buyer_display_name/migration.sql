-- A buyer may choose a public name for human conversations. Existing buyers remain unnamed.
ALTER TABLE "buyer_profiles" ADD COLUMN "display_name" VARCHAR(80);
