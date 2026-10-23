# Frontend → Backend notes (for Abdullah)

A running list of what the frontend needs from the backend and the AI service. Rafia and Claude add to it as the redesign goes on; Abdullah owns everything listed here. Newest items at the top of each section.

Last checked: 2026-10-17 (static analysis of `apps/frontend/src`, `apps/backend/src`, `apps/ai-service/app`; nothing was run against a live API).

---

## 0b. Day 2 findings (product, store, cart, checkout; 2026-10-18)

1. **Malformed product id returns 500.** `GET /api/v1/products/nope` answers `500 INTERNAL_ERROR` ("Something went wrong"). A well-formed but unknown UUID correctly answers `PRODUCT_NOT_FOUND`. Ask: validate the id and return 404 `PRODUCT_NOT_FOUND` (or 400 `VALIDATION_ERROR`). The frontend now treats a non-UUID id as not found, so buyers already see the right page.
2. **Store page data (nice to have).** `/stores/:slug` products carry no `createdAt` or `condition`, so cards on the store page can't show the "New" badge. The store has no city, "member since" or verified flag, and `policies` is always null. The UI shows none of these until they exist.
3. **Product detail store lookup** needs two calls (`/products/:id`, then `/stores/by-product/:id`). Embedding `{ store: { slug, name, logoUrl } }` in the product DTO would save a round trip on 3G.
4. **Seed images:** every demo product has exactly one image, so the multi-photo gallery was tested with intercepted data only. A second image on one or two seed products would let the demo show it.
5. **Order number in the checkout response.** `POST /checkout` returns `CreatedOrderDTO` with only the UUID, while the order list shows "Order #2". The confirmation page now fetches `/orders/:id` per order just to get `orderNumber`. Ask: add `orderNumber` to `CreatedOrderDTO`.
6. **Shipping before placing.** Neither the cart nor checkout knows the shipping fee until the order exists, so the UI says "Calculated per store" and "Total before shipping". `ShippingEstimateDTO` exists in `packages/shared`, but no endpoint serves it. A per-group estimate would let checkout show the real total before "Place order".
7. **Test orders created on 2026-10-18:** buyer `03003540298` now has COD orders #2, #3 and #4 (from the Day 2 checkout tests), and that buyer's cart holds 2 × Hand-Embroidered Cotton Kurta (re-added for screenshots after order #4 emptied it).

## 0a. Live test results, 2026-10-17 (after `migrate deploy` and `db seed`, with Rafia's go-ahead)

Claude applied the 11 pending migrations and ran the seed. The DB now has 8 categories, 16 live demo products and the demo seller. Then the full stack was tested live, through the API and in a real browser.

**Working:**
- Home, Search, Category, Product and Store pages show real data. The Home hero cards are the real products.
- Buyer: register by phone → OTP (the mock code is read from the API log) → verify → login → add to cart (grouped by seller) → address → **COD checkout** → order in "My orders" → "order placed" notification.
- Seller: register → OTP → login → **store setup** (needs a JazzCash or Easypaisa number) → products, orders, returns, analytics and assistant pages.
- **AI Store Builder:** upload a photo → Gemini draft in about 3s with English and Urdu title and description.
- Buyer chatbot: answers from the catalogue ("Hand-Embroidered Cotton Kurta — Rs. 2450 (18 in stock)").
- No API errors and no JS exceptions on any buyer or seller page in the sweep.

**For Abdullah:**
1. **Ollama is still downloading its model on first start.** `qwen2.5vl:7b` (6 GB) was at 43% after 24 minutes, at about 2.4 MB/s. That is why `ollama list` was empty and the health check showed "starting". The seller assistant, free-text chat and embeddings wait for it. Not a bug, but worth a README note: "the first `up` downloads about 6 GB; Ollama features work once the pull finishes". Re-test those features after the pull.
   - **Follow-up:** the pull stalled twice, at about 99% and then at 57%. On the slow home connection (about 0.2 MB/s at the time) the 6 GB model is hard to get.
     - Restarting the container restarted the download.
     - A second `docker exec … ollama pull qwen2.5vl:7b` resumed from where it stopped.
     - The model is not stored anywhere else on this machine; the `karobarai_ollama_data` volume holds no completed model yet.
     - `docker compose up --build` does not download models; the download starts when the ollama container starts.
   - **Suggestions:** (a) a smaller model option for slow connections (e.g. `qwen2.5vl:3b` through `OLLAMA_CHAT_MODEL`), (b) document "resume with `docker exec karobarai-ollama-1 ollama pull <model>`; don't use `down -v`".
1b. **Ollama models are now pulled** (`qwen2.5vl:7b` and `nomic-embed-text`, container healthy, 22:10). Live AI chat test results:

| Test | Reply | Time | Verdict |
|---|---|---|---|
| Seller assistant, EN: "How are my sales… first order?" | "Your sales… are not available… promote on social media…" | **149 s** | OK, but slow and generic |
| Seller assistant, UR: "میرے اسٹور کی فروخت کیسی ہے؟" | "Your store's revenue for today is **$1000**." | 18 s | **Wrong.** It invents a figure (the new store has no sales), uses dollars instead of PKR, and answers in English. |
| Buyer chat: "gift for my mother under 2000 rupees" | "This question is outside the scope…" | 2 s | **Wrong refusal.** This is a valid shopping question, so the scope guard is too strict. |
| Buyer chat, UR: "کیا آپ کے پاس سردیوں کے لیے کچھ ہے؟" | "No products found for the query 'winter clothing'." | **186 s** | Correct content, but slow and in English |
| Buyer chat: "Who won the cricket world cup?" | Out-of-scope refusal | 0 s | Correct |

**Asks:**
- **(a) Hallucinated business numbers:** the assistant must only state figures returned by the analytics tools, in PKR. This is critical for the demo and for PRODUCT.md's "show only what's real".
- **(b) Reply language:** answer in the language of the question (Urdu in, Urdu out).
- **(c) Scope guard:** loosen it for gift and budget questions.
- **(d) Latency:** 2–3 minutes per reply on CPU. Options: a smaller model, GPU, or a hosted model. Also, the first call loads the model; consider warming it up on startup.

The frontend will show a clear "thinking" state for long replies (Day 3).

2. **Payment config:** `stripeEnabled`, `jazzCashEnabled` and `easyPaisaEnabled` are all `false`, so checkout offers COD only. Is that intended for the demo?
3. **Seed seller has no password.** `demo-seller@karobarai.local` cannot log in, so the demo catalogue cannot be managed from the UI. Consider a known dev password.
4. **Notification text uses the order UUID** ("Your order #499ffb46-… has been placed"), while the order list shows "Order #1". A short order number in the template would match.
5. Migrations and seed still need to run automatically on `up` (see section 0).

**Frontend items found (Rafia and Claude will fix):**
- After OTP verification the app sends the user to `/login` instead of using the session the API returns. The account is created and active, but it feels like registration failed. Batch 3.
- The `/notifications` page renders without the storefront header and footer. Day 4.

**Test accounts created (dev DB):**
- Buyer `03003540298` / `Test@12345`, with one COD order.
- Seller `03013662522` / `Test@12345`, with store "Test Store 2522".
- One extra buyer from the UI register test.

---

## 0. Update 2026-10-17: Docker is up, but the database is behind the code (blocking)

All containers run and the API answers (`/health`, `/ready`, `/categories` and `/marketplace/home` all return 200). However:
- **11 Prisma migrations are not applied.** `prisma migrate status` lists them, from `20261008120000_feature16_ai_core` through `20261015160000_item_scoped_returns`. They cover AI core, the storefront chatbot, Stripe, courier history and the returns/exchange flow.
- **As a result the seed fails**: `P2022`, column `platform_config.chatbot_enabled` does not exist. The DB has 8 categories, **0 products**, 0 seller profiles, and one seller stuck in `PENDING_VERIFICATION`.
- That is why Home, Search and Category are empty, and why other flows (including registration) may fail.

**Fix** (inside the `api` container, from `apps/backend`): `npx prisma migrate deploy` (applies the pending migrations only, no reset), then `npx prisma db seed`.

**Ask:** run migrate and seed automatically on `docker compose up`, or document the steps in the README.

No frontend fault was found: CORS, the API URL and every endpoint match.

---

## 1. Why the app shows no data right now (connectivity)

**Symptom (Rafia's testing):** registering a user fails, and most pages render empty.

**Cause:** the backend is not running. `http://localhost:4000/health` does not answer, and Docker Desktop is not running (`docker ps` cannot reach the Docker engine). Postgres, Redis and MinIO all run in Docker, so the API cannot start without them.

**What is already correct, so no change is needed:**
- Root `.env` exists and the backend loads it (`apps/backend/src/core/config/index.ts` walks up to the repo root).
- `CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:8080`, so the Vite dev server is allowed, with credentials.
- `PORT_API=4000`, and the frontend defaults to `http://localhost:4000/api/v1`. `VITE_API_URL` is not set in `.env`, which is fine because the default matches.
- `DATABASE_URL` and `REDIS_URL` point at `localhost`, which is right when the API runs on the host with `pnpm dev:backend`.

**Steps to bring it up (please confirm or correct):**
1. Start Docker Desktop.
2. `docker compose -f infra/docker-compose.yml up -d postgres redis minio`. Add `ollama` if the chatbot, embeddings or return comparison are needed.
3. `pnpm prisma:generate`, then `pnpm prisma:migrate`, then seed with `pnpm --filter @karobarai/backend prisma:seed`.
4. `pnpm dev:backend`. The API listens on `:4000`.
5. AI service: either the `ai-service` container, or run it locally from `apps/ai-service`.
   - The AI service defaults assume Docker hostnames: `ollama_base_url=http://ollama:11434` and `listing_image_allowed_hosts=minio`.
   - The backend's `AI_SERVICE_URL` defaults to `localhost:8000`, but Compose overrides it to `http://ai-service:8000`.
   - When mixing host and Docker processes, these three values have to agree.
6. Frontend: `npx vite --port 5173` from `apps/frontend`.

**Ask:** a short "run everything locally" section in the README (or a single `docker compose up` that includes `api` and `ai-service`) would let Rafia test against real data without asking each time.

---

## 2. Endpoint coverage

**Frontend → backend:** every API call the frontend makes has a matching backend route (123 distinct calls, 128 backend routes). No missing endpoints.

**Backend routes the frontend does not use:**

| Route | Status |
|---|---|
| `GET /api/v1/orders/courier-performance` (seller only) | **Not used by the frontend yet.** Frontend task for Rafia (e.g. the courier-selection step or seller analytics). |
| `POST /api/v1/payments/stripe/webhook` | Server-to-server. No frontend use needed. |
| `GET /health`, `GET /ready` | `/health` is used by the dev health indicator; `/ready` is for infra. |
| `GET /api/v1/returns/:id/images/:imageId/content` | Used (built dynamically in `PrivateEvidenceImage.tsx`). |

**AI service:** every working endpoint is reached only through the backend, as designed. The AI service has no public port.

| AI endpoint | Called by |
|---|---|
| `POST /generate-listing` | `ai-store-builder.service.ts`, `catalog.service.ts` |
| `POST /internal/chat` | `chatbot/slm-client.ts` |
| `POST /internal/embeddings` | `chatbot/*` (3 places) |
| `POST /internal/compare-return-images` | `returns/return-inspection.service.ts` |
| `GET /health`, `GET /internal/return-comparison/health` | Health checks only |

**Not checked yet:** request and response shapes per endpoint. That needs the API running, and will be done page by page during Day 2 and later.

---

## 3. Data the redesigned UI would use if the backend provided it

The UI does **not** fake any of these. Each one is left out until the field exists.

| Need | Where it would show | Today |
|---|---|---|
| Seller **name** and **city** on the product DTO | Product cards ("Fashion · Lahore" in the approved design), product detail store card, cart grouping header | Not in `ProductDetailDTO`. Cards show the category only. |
| **Wishlist / saved** API (F17) | The heart on every product card, and a "Saved" page | The heart saves to `localStorage` on the device only. A real API would make saves follow the account. |
| **Compare-at / sale price** | "-20%" badge, struck-through old price | Not in the schema. No sale UI. |
| Seller **verified** flag | Trust badge on the store card | Not in the schema. "Verified sellers" was removed from the Home trust row for that reason. |
| Real **product photos** in the dev seed | Every product card and the Home hero fan | The seed points at placeholder SVG illustrations (`public/demo/products/*.svg`). Not a blocker. |
| Product **thumbnail on orders** (`thumbnailUrl` on `OrderListItemDTO` = first item, and on each `OrderItemDetailDTO`; ideally a snapshot taken at order time) | Orders list rows (buyer + seller), order detail items, tracking band | Not in the order DTOs. Detail/tracking fetch each product via `GET /products/:id` (works, but shows the product's *current* photo and fails for removed products). The list shows an initial avatar until the field exists; the row is built to swap in the photo. |
| **Store slug on the seller profile** (`storeSlug` on `SellerProfileDTO` from `GET /profile/me`) | Seller profile header: a "View my store" button that opens the public `/store/:storeSlug` page | The seller profile has no slug, so the button is left out for now. Adding the field is enough; the page is ready to show the link. |

---

## 4. Open questions

- **Home feed "featured":** how is it chosen? The redesign shows it as its own rail and de-duplicates New arrivals against it.
- **Payments:** JazzCash and Easypaisa are mock adapters (`ADAPTER_MODE=mock`). Checkout will label them "demo". Please flag if that should change.
