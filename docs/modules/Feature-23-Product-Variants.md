# Feature 23 — Product sizes and colours (variants)

Sellers can give a product a list of options. Each option is a size, a colour, or both, and has its
own stock. Buyers choose one before adding the product to the cart. Products without options work
exactly as before.

## Data
Migration: `apps/backend/prisma/migrations/20261025000000_f23_product_variants/migration.sql`. It only
adds things; no table, column or row is removed.

- **New table `product_variants`:** `size`, `color`, `stock` (CHECK ≥ 0), `is_active`, `position`.
- **`cart_items.variant_id` (nullable):** the cart unique index changes from `(cart_id, product_id)` to
  `(cart_id, product_id, variant_id) NULLS NOT DISTINCT`. The new index is created before the old one
  is dropped. Existing rows are unaffected.
- **`order_items.variant_id` and `variant_label` (nullable):** a snapshot of what was bought, such as
  "M / Black".
- **`products.stock` stays the stock total.** While a product has active variants, it always equals
  their sum, so listings, search and analytics are unchanged.
- **Variants share the product price.** There is no per-variant price yet.
- **Removing an option deactivates it** (`is_active = false`). It is never deleted, because carts and
  orders may point at it.

## Behaviour
- **Seller:** the edit product page has a "Sizes & colours" card, which calls
  `PUT /seller/products/:id/variants`. While options exist, the plain stock field is locked, and
  `PATCH` with `stock` returns `PRODUCT_HAS_VARIANTS`.
- **Buyer:**
  - The product page shows option chips; sold-out options are disabled.
  - Add to cart and Buy now require a chosen option.
  - Cart, checkout confirmation and order detail show the chosen option.
  - On listing cards, quick-add opens the product page so the buyer can choose.
  - The guest cart keeps one line per option and sends the option when it merges at login.
- **Stock:**
  - Checkout decrements the option and the product total in the same transaction, with the same atomic
    conditional `UPDATE` pattern used for the product.
  - Cancellations, Stripe failures and resellable returns give the units back to the option.
  - A same-product return replacement ships the option the buyer originally bought.
- **Chatbot:** `product-variant.adapter.ts` reads the active options. "Medium black shirt add karo"
  adds that option. If no option is named, the assistant lists the options with their stock and asks
  the buyer to choose.

## Deploying to the shared Neon database (in this order)
1. Neon console → Backup & Restore → **Create snapshot**.
2. Confirm with the team that no one is mid-checkout or editing products.
3. From `apps/backend`, with the root `.env` pointing at Neon, run `npx prisma migrate deploy`. Never run
   `migrate dev` or `migrate reset` against the shared database.
4. Restart the API with the new code. The new backend needs the new columns, so do not run it against a
   database that has not been migrated.

## Tests
Mocked, with no database: `tests/catalog/variants.unit.test.ts`, the chatbot suites, and the frontend
`VariantPicker.test.tsx`. Run the backend suites with `DATABASE_URL` blocked, as described in
Feature 22.
