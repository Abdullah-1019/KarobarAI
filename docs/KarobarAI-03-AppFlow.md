# KarobarAI — Application Flow Document

**Document 3 of 6 — Software Blueprint Series**
**Project:** KarobarAI — Generative-AI E-Commerce Platform for Micro-Sellers in Pakistan
**Version:** 1.0 (App Flow)
**Depends on:** Documents 1 (PRD) & 2 (TRD) — decisions D1–D5 binding
**Status:** Draft for approval

---

## 0. Conventions

- **Scope tags:** screens/states marked **[R1.1]** or **[Future]** are not in the MVP; everything else is MVP.
- **Surfaces:** Buyer Storefront (`/`), Seller Portal (`/seller`), Admin Console (`/admin`), plus shared Auth.
- **Canonical order status** (PRD §0): `PAYMENT_PENDING → PAYMENT_CONFIRMED → PROCESSING → PICKED_UP → IN_TRANSIT → OUT_FOR_DELIVERY → DELIVERED → COMPLETED`, plus `CANCELLED` and `PENDING_MANUAL_LOGISTICS`. Seller-facing tabs map friendly labels onto these.
- **Every screen spec** lists: Purpose · Route · UI Components · Inputs · Outputs · Navigation · Buttons · Validation · Error / Empty / Loading / Success states · Edge cases. Depth scales with screen complexity; simple screens are terse but complete.
- **Global UI states** (apply everywhere, stated once): skeleton loaders during fetch; spinner/progress bar on every AI action; toast on success/error; offline banner [R1.1 PWA]; language switch (UR-RTL / EN-LTR) without reload; 401 → redirect to Login; 403 → "not authorised" page.

---

## 1. End-to-End User Journey (first visit → logout)

1. **Guest** lands on the storefront Home, can browse/search/view products and public tracking with no account.
2. To buy, the guest **registers** (mobile-OTP or email) as a **Buyer**, or to sell, registers as a **Seller**.
3. A new **Seller** completes the **Store-Setup Wizard** (store name, description, ≥1 payout wallet), then reaches the **Seller Dashboard**, uses the **AI Store Builder** to publish a first product.
4. A **Buyer** searches/filters, opens a **Product Detail**, adds to **Cart**, and **Checks out** (address + JazzCash/Easypaisa/COD; shipping shown separately). Multi-seller carts split into one order per seller.
5. On order placement, **Intelligent Logistics** scores couriers; the seller **confirms & books**; the order moves through the lifecycle with **Live Tracking** (timeline + map) and **SMS/in-app** notifications.
6. Within 14 days the buyer may open a **Return** (≥3 photos); MVP routes it through a manual-review workflow (R1.1 adds AI auto-decision with a confidence floor); approved returns trigger pickup + refund.
7. Sellers monitor the **Analytics Dashboard**; **Admins** moderate, resolve disputes, release payments, and tune config.
8. Any authenticated user can manage **Profile/Settings** and **log out** (clears tokens, revokes refresh session).

---

## 2. Shared / Authentication Screens

### SCR-A01 — Register
- **Purpose:** create a Buyer or Seller account. **Route:** `/register`
- **UI:** role toggle (Buyer/Seller), method tabs (Mobile / Email), phone or email field, password field with strength meter, language switcher, "Already have an account? Login" link.
- **Inputs:** role; phone **or** email; password.
- **Outputs:** account created (status `pending_verification`); OTP/verification dispatched.
- **Navigation:** → OTP Verification (mobile) or Email-Verify notice; ← Login.
- **Buttons:** Send OTP / Create Account; Login.
- **Validation:** phone = valid PK format; email = RFC valid; password ≥8 incl. upper/lower/digit/special (REQ-F-Auth002); role required.
- **Error:** duplicate phone/email → "account already exists, log in"; invalid input inline.
- **Empty:** n/a (form). **Loading:** button spinner while submitting. **Success:** toast + advance to verification.
- **Edge cases:** existing-but-unverified account → resend verification instead of blocking; rate-limited OTP requests show cooldown.

### SCR-A02 — OTP Verification
- **Purpose:** verify mobile via 6-digit OTP. **Route:** `/verify-otp`
- **UI:** 6-box OTP input, countdown timer (10 min), Resend link (disabled until allowed), masked phone.
- **Inputs:** OTP code. **Outputs:** verified account; tokens issued; session started.
- **Navigation:** → Store-Setup Wizard (new seller) / storefront (buyer); ← Register.
- **Buttons:** Verify; Resend OTP.
- **Validation:** 6 digits; not expired; not already used (REQ-NF-Security-006); resends ≤5/hour (REQ-F-Auth001).
- **Error:** wrong code → inline "incorrect code"; expired → "code expired, resend"; resend limit → "try again in N min".
- **Loading:** verify spinner. **Success:** toast + redirect by role.
- **Edge cases:** user leaves and returns within validity → timer resumes; max resends reached → guidance + support hint.

### SCR-A03 — Login
- **Purpose:** authenticate existing users. **Route:** `/login`
- **UI:** identifier (phone/email), password, "Forgot password?", role-agnostic (role read from account).
- **Inputs:** identifier, password. **Outputs:** access + refresh tokens; redirect by role (Buyer→storefront, Seller→dashboard, Admin→admin).
- **Navigation:** → role home; → Forgot Password; → Register.
- **Buttons:** Login; Forgot Password; Register.
- **Validation:** required fields; credentials verified server-side.
- **Error:** invalid creds → generic "invalid credentials" (no user enumeration); **lockout after 5 fails/15 min → 30-min lock** message (REQ-F-Auth007); suspended account → "account suspended, contact support".
- **Loading:** button spinner. **Success:** redirect.
- **Edge cases:** suspended/banned session already open elsewhere → invalidated immediately (REQ-F-Auth006).

### SCR-A04 — Forgot / Reset Password
- **Purpose:** recover access. **Route:** `/forgot-password`, `/reset-password?token=`
- **UI:** identifier field → sends reset link/OTP; reset form with new password + confirm.
- **Validation:** valid reset token (single-use, expiring); password complexity; confirm match.
- **Error:** expired/invalid token → "link expired, request again". **Success:** "password updated" → Login.
- **Edge cases:** reset clears active lockout; reset rotates refresh tokens.

---

## 3. Seller Portal Screens

### SCR-S00 — Store-Setup Wizard (first login)
- **Purpose:** required onboarding before selling (REQ-F-Auth005). **Route:** `/seller/setup`
- **UI:** stepper — (1) Store name + description, (2) Payout wallet (JazzCash/Easypaisa number, ≥1), (3) optional brand/logo; progress bar; target <10 min (REQ-NF-Quality-008).
- **Inputs:** store name, description, wallet number(s). **Outputs:** Seller profile completed → can publish.
- **Navigation:** blocks access to selling features until complete; → Seller Dashboard on finish.
- **Buttons:** Next / Back / Finish; Save & continue later.
- **Validation:** store name unique-ish/required; ≥1 valid wallet (mock-validated in MVP, D2).
- **Error:** wallet format invalid inline. **Loading:** save spinner. **Success:** confetti/toast → Dashboard.
- **Edge cases:** partial completion persists; revisiting resumes at last step.

### SCR-S01 — Seller Dashboard
- **Purpose:** at-a-glance business health. **Route:** `/seller`
- **UI:** summary cards (Total Sales, Total Orders, Return Requests), 7-day sales trend chart, recent-orders list, quick "Add Product" CTA, notification bell.
- **Inputs:** none (read). **Outputs:** rendered metrics.
- **Navigation:** sidebar → Products, Orders, Returns, Analytics, Wallet, Settings.
- **Buttons:** Add Product; view-all links per card.
- **Validation:** n/a.
- **Error:** metric fetch fail → card-level "couldn't load, retry". **Empty (new seller):** "Your dashboard will fill in once you publish a product and make your first sale." **Loading:** skeleton cards. **Success:** populated.
- **Edge cases:** brand-new seller sees onboarding nudges instead of zeros-only.

### SCR-S02 — AI Store Builder / Add Product *(flagship)*
- **Purpose:** photo → bilingual publishable listing (SRS §4.1). **Route:** `/seller/products/new`
- **UI:** drag-and-drop image upload zone (multi-image, first = primary), thumbnail previews, AI-progress bar, generated fields: Title (EN/UR), Description (EN/UR), Category, Tags (chips), Price, Stock, Condition; field-level edit; Publish / Save Draft.
- **Inputs:** product image(s) (JPEG/PNG/WebP ≤10 MB, REQ-F-Store001); editable AI fields; price; stock.
- **Outputs:** Draft or Published product; images compressed client-side then CDN-stored (<200 KB, REQ-F-Store007).
- **Navigation:** → Product Detail on publish; → Products list on draft.
- **Buttons:** Upload; Generate (auto on valid upload); Retry AI; Publish; Save as Draft.
- **Validation:** file type + ≤10 MB (client + server magic-byte, Sec-012); publish requires title + ≥1 image + category (REQ-F-Store003); price ≥0; stock ≥0.
- **Error states:** invalid/oversized file → inline reject (REQ-F-Store001); **AI fail/timeout → error + Retry, fields left blank for manual entry** (REQ-F-Store005); CDN upload fail → retry.
- **Empty:** initial upload zone with helper text + sample. **Loading:** "AI is generating your product listing…" spinner; **all fields locked during generation** (REQ-F-Store004). **Success:** fields auto-populate (EN+UR), success toast, fields unlock for edit.
- **Edge cases:** generation succeeds but seller edits everything (changes tracked locally before save); GPT-4V unavailable → silent GPT-3.5 fallback (D3, REQ-AI-Store001), seller unaware; very slow 3G → progress bar honest, 30s soft target.

### SCR-S03 — Products (list/management) — *CRUD*
- **Purpose:** manage catalog. **Route:** `/seller/products`
- **UI:** table/grid (thumbnail, title, price, stock, status: Live/Draft/Out-of-stock), search, status filter, row actions (Edit/Unpublish/Delete).
- **Inputs:** filters/search. **Outputs:** filtered list.
- **Navigation:** → Add Product; → Product Edit.
- **Buttons:** Add Product; per-row Edit / Publish / Unpublish / Delete (soft delete, confirm dialog).
- **Validation:** delete confirmation required.
- **Error:** action fail → toast + revert. **Empty:** "No products yet — add your first with the AI Store Builder." **Loading:** skeleton rows. **Success:** action toast.
- **Edge cases:** deleting a product with active orders → block hard delete, soft-delete + hide from storefront, keep order history intact.

### SCR-S04 — Product Edit — *CRUD*
- **Purpose:** edit an existing listing. **Route:** `/seller/products/:id/edit`
- Same field set as Store Builder minus mandatory re-generation; can re-run AI on a new image. Validation/states mirror SCR-S02.
- **Edge case:** editing a live product updates storefront immediately and busts product cache (TRD §19).

### SCR-S05 — Order Management
- **Purpose:** work the order pipeline. **Route:** `/seller/orders`
- **UI:** tabs mapping canonical states → friendly labels: **Pending** (`PAYMENT_PENDING`,`PENDING_MANUAL_LOGISTICS`), **Confirmed/Processing** (`PAYMENT_CONFIRMED`,`PROCESSING`), **Shipped** (`PICKED_UP`,`IN_TRANSIT`,`OUT_FOR_DELIVERY`), **Delivered** (`DELIVERED`,`COMPLETED`), **Cancelled** (`CANCELLED`). Each row: order ID, buyer, items, total, status, inline courier box.
- **Inputs:** tab/filter selection. **Outputs:** filtered orders.
- **Navigation:** → Order Detail.
- **Buttons:** per-row open; bulk none in MVP.
- **Error:** load fail → retry. **Empty (per tab):** "No orders in this stage." **Loading:** skeleton. **Success:** list.
- **Edge cases:** order flagged `PENDING_MANUAL_LOGISTICS` surfaces a clear alert badge.

### SCR-S06 — Order Detail (+ Courier Booking) *(complex)*
- **Purpose:** view an order and book logistics. **Route:** `/seller/orders/:id`
- **UI:** buyer/shipping info, item list, payment summary (incl. shipping line, commission preview), **recommended courier card** (name, cost breakdown, ETA, score), courier override dropdown, status timeline, tracking link.
- **Inputs:** courier choice (default = AI-recommended). **Outputs:** booked shipment, tracking number, status → `PROCESSING`/`PICKED_UP`.
- **Navigation:** ← Orders; → Tracking page.
- **Buttons:** **Confirm & Book Courier** (one-click, REQ-F-Logistics-004); **Override courier** (logged, REQ-F-Logistics-008); Cancel order (only from allowed states).
- **Validation:** booking only from valid state; COD → COD-capable couriers only (REQ-F-Logistics-006).
- **Error states:** booking API fail → **3 retries @30s then next-best** (REQ-F-Logistics-005); all fail → `PENDING_MANUAL_LOGISTICS` + SMS/in-app (REQ-F-Logistics-007).
- **Loading:** "Finding the best courier…" while scoring; booking spinner. **Success:** "Courier booked, tracking #…" toast, SMS to both parties.
- **Edge cases:** seller overrides to a non-recommended courier → confirm + log; courier list empty (all adapters down) → manual-logistics path with guidance.

### SCR-S07 — Returns (seller view)
- **Purpose:** review return requests on the seller's orders. **Route:** `/seller/returns`
- **UI:** list (order, reason, status, photos), **AI assessment badge + image-analysis report [R1.1]**, decision panel; in MVP shows manual-review status and admin/seller actions.
- **Inputs:** decision (approve/reject within seller authority), override reason.
- **Outputs:** updated return status; refund/pickup triggers on approval.
- **Buttons:** Approve / Reject (with reason); **Override AI [R1.1]** (logged); Escalate to admin.
- **Validation:** reason mandatory on override/reject (REQ-F-Return-006/008).
- **Error:** action fail → retry. **Empty:** "No return requests." **Loading:** skeleton + (R1.1) "Analyzing images…". **Success:** decision toast, both parties notified.
- **Edge cases:** AI low-confidence/failure → item appears in manual-review state (D3, REQ-F-Return-007).

### SCR-S08 — Analytics Dashboard
- **Purpose:** business insights. **Route:** `/seller/analytics`
- **UI:** revenue cards (this month / last month / YTD with % change), daily sales trend, revenue-by-category, top-products table (click-through to product analytics), date-range filter (7d/30d/3m/custom), **AI Recommendation card [R1.1]**, **Export [Future]**.
- **Inputs:** date range; product selection. **Outputs:** charts/tables; reload <3s (REQ-F-Analytics-005).
- **Navigation:** → product-specific analytics drill-in.
- **Buttons:** date presets; dismiss AI card [R1.1] (suppress 14 days).
- **Validation:** custom range sane (start ≤ end).
- **Error:** load fail → retry. **Empty (new seller):** "Your analytics will appear here once your first order is placed." (SRS §4.5). **Loading:** chart skeletons. **Success:** rendered.
- **Edge cases:** sparse data → charts handle gaps gracefully.

### SCR-S09 — Wallet / Payout Settings
- **Purpose:** manage payout wallets and view settlements. **Route:** `/seller/wallet`
- **UI:** wallet list (JazzCash/Easypaisa), add/edit wallet, settlement history (gross, commission, net, status, settled_at), expected COD remittance ledger (F12).
- **Inputs:** wallet number. **Outputs:** updated payout config; settlement records (read-only/immutable).
- **Buttons:** Add wallet; Set default.
- **Validation:** wallet format (mock-validated MVP).
- **Error/Empty/Loading/Success:** standard. **Edge cases:** settlement records immutable (REQ-NF-Safety-007); pending COD remittance clearly labelled.

### SCR-S10 — Seller Settings / Profile — *Profile + Settings flow*
- **Purpose:** brand, notifications, security, language. **Route:** `/seller/settings`
- **UI:** tabs — Store/Brand, Notification toggles (critical ones locked on, REQ-F-Notif004), Security (change password, [Future] 2FA), Language (UR/EN default).
- **Inputs:** edits per tab. **Outputs:** saved preferences.
- **Buttons:** Save per section.
- **Validation:** password change re-auth; notification critical toggles disabled.
- **States:** standard. **Edge cases:** changing language updates app + future notification language.

---

## 4. Buyer Storefront Screens

### SCR-B01 — Home / Storefront
- **Purpose:** entry + discovery. **Route:** `/`
- **UI:** bilingual search bar with autocomplete, category grid, language switcher, featured/new products, cart icon (count), login/register.
- **Inputs:** search query; category tap. **Outputs:** navigate to results.
- **Navigation:** → Search Results; → Product Detail; → Cart; → Login.
- **Buttons:** Search; category tiles; cart.
- **Validation:** n/a. **Error:** feed fail → retry. **Empty:** "No products yet" (early platform). **Loading:** skeletons. **Success:** populated.
- **Edge cases:** guest cart held client-side until login, then merged to persisted cart (D4).

### SCR-B02 — Search Results / Browse — *Search + Filter flow*
- **Purpose:** find products. **Route:** `/search?q=`, `/category/:slug`
- **UI:** result grid, filter panel (category, price range, seller rating, condition), sort (relevance/price/newest/rating), infinite scroll, result count.
- **Inputs:** query, filters, sort. **Outputs:** filtered/sorted results (<1s, REQ-NF-Perf003).
- **Navigation:** → Product Detail.
- **Buttons:** apply/clear filters; sort selector.
- **Validation:** price-range min ≤ max.
- **Error:** search fail → retry. **Empty:** "No products match your search. Try fewer filters." with reset CTA. **Loading:** skeleton grid + "Searching…". **Success:** results.
- **Edge cases:** Urdu query matches Urdu fields (tsvector, D1); out-of-stock hidden by default (REQ-F-Inv-003); autocomplete after N chars (REQ-F-Browse-002).

### SCR-B03 — Product Detail
- **Purpose:** evaluate + buy. **Route:** `/product/:id`
- **UI:** image carousel (swipe), bilingual title/description, price, condition, stock/availability, seller rating, **reviews [R1.1]**, quantity, Add to Cart / Buy Now, wishlist [Future].
- **Inputs:** quantity; add-to-cart/buy. **Outputs:** cart updated or → checkout.
- **Navigation:** → Cart / Checkout; ← results.
- **Buttons:** Add to Cart; Buy Now; (Wishlist [Future]).
- **Validation:** quantity ≤ available stock (REQ-F-Inv-002).
- **Error:** add fail → toast. **Empty:** n/a. **Loading:** skeleton. **Success:** "Added to cart" toast.
- **Edge cases:** out-of-stock → buy disabled, "notify me" [Future]; price/stock changed since list → reconcile on add.

### SCR-B04 — Cart — *CRUD on cart*
- **Purpose:** review items before checkout. **Route:** `/cart`
- **UI:** line items grouped **by seller** (preview of order splitting, D4), qty steppers, remove, per-seller subtotal, **shipping note**, grand total estimate, Checkout CTA.
- **Inputs:** qty changes, removals. **Outputs:** persisted cart (cross-device, REQ-F-Cart-001).
- **Navigation:** → Checkout; ← continue shopping.
- **Buttons:** Update qty; Remove; Checkout.
- **Validation:** qty ≤ stock; min order PKR 100 per resulting order (REQ-F-Cart-004).
- **Error:** stock conflict → inline "only N left". **Empty:** "Your cart is empty" + Browse CTA. **Loading:** skeleton. **Success:** totals update live.
- **Edge cases:** item went out of stock while in cart → flagged, excluded from checkout; multi-seller cart shows it will split into separate orders.

### SCR-B05 — Checkout — *Payment flow* *(complex)*
- **Purpose:** complete purchase. **Route:** `/checkout`
- **UI:** delivery address (book + add new), payment method (JazzCash / Easypaisa / COD), per-seller order summary, **shipping line (buyer pays, D4)**, commission not shown to buyer, place-order CTA.
- **Inputs:** address, payment method. **Outputs:** one order per seller created (`PAYMENT_PENDING`), payment initiated (mock adapter, D2), stock decremented atomically on confirmation (REQ-F-Inv-001).
- **Navigation:** → Order Confirmation; ← Cart.
- **Buttons:** Place Order / Pay Now.
- **Validation:** address complete; method selected; min order met; idempotency key attached (REQ-F-Payment-004).
- **Error states:** **payment fail → 3 retries @1 min, then cancel + notify** (REQ-F-Payment-003); address invalid inline; stock gone → block + message.
- **Loading:** "Processing payment…" (no double-submit). **Success:** → Order Confirmation, SMS/in-app sent, courier-selection pipeline triggered.
- **Edge cases:** wallet flow returns via webhook (HMAC-verified, REQ-F-Payment-002); COD skips charge, marks COD, confirm-on-delivery (F12); duplicate submit prevented by idempotency.

### SCR-B06 — Order Confirmation
- **Purpose:** confirm success + next steps. **Route:** `/orders/:id/confirmation`
- **UI:** order number(s), summary, estimated delivery, tracking link, "view my orders".
- **States:** success-only screen; if arrived without a valid order → redirect home.
- **Edge cases:** multi-seller checkout shows all created orders with individual tracking.

### SCR-B07 — My Orders
- **Purpose:** order history + entry to tracking/returns. **Route:** `/orders`
- **UI:** order list (status chips), filters (active/completed/returns), per-order actions (Track / Return / Review [R1.1]).
- **Empty:** "You haven't placed any orders yet." **States:** standard.
- **Edge cases:** return eligibility (≤14 days, no prior return) gates the Return action (REQ-F-Return-001/007=one per order, BR-007).

### SCR-B08 — Order Tracking (authenticated)
- **Purpose:** live shipment visibility. **Route:** `/orders/:id/track`
- **UI:** visual status timeline, **map embed with last known location** (REQ-F-Track003), notification history, courier + tracking number, ETA.
- **Inputs:** none. **Outputs:** live updates via WebSocket (REQ-F-Track002).
- **Buttons:** copy tracking link; contact support.
- **Error:** map/tracking fail → **text-only status fallback** (graceful degradation); after 3 failed polls → in-app notice (REQ-F-Track006). **Empty:** pre-shipment "preparing your order". **Loading:** timeline skeleton. **Success:** live timeline + map.
- **Edge cases:** delivered → final SMS/WhatsApp, polling stops (REQ-F-Track004); 12-month history retained (REQ-F-Track007).

### SCR-B09 — Public Tracking Page (login-free)
- **Purpose:** track from an SMS link without login (REQ-F-Track005). **Route:** `/t/:publicToken`
- **UI:** read-only status + map, no account actions; language defaults to order buyer's language then Urdu (PRD assumption 12).
- **States:** read-only; invalid/expired token → friendly "tracking not found".
- **Edge cases:** no PII beyond what's needed to show status.

### SCR-B10 — Returns Wizard *(complex)*
- **Purpose:** initiate a return. **Route:** `/orders/:id/return`
- **UI:** stepper — (1) eligibility check, (2) reason select, (3) **≥3 photo upload** with previews, (4) review/submit; condition guidance.
- **Inputs:** reason; ≥3 photos (REQ-F-Return-002). **Outputs:** Return record `Under Review`; images stored; (R1.1) dispatched to AI pipeline.
- **Navigation:** → Return Status; ← My Orders.
- **Buttons:** Next (disabled until ≥3 valid photos); Submit.
- **Validation:** within 14-day window + no prior return (REQ-F-Return-001, BR-002/BR-007); photo count/type/size; **Next stays disabled until 3 valid images** (REQ-F-Return-002).
- **Error states:** outside window → block + closure message; second return → blocked; upload fail → retry.
- **Loading:** upload progress; **[R1.1] "AI is reviewing your return…" (≤60s)**. **Success:** "Return submitted" + status.
- **Edge cases (R1.1):** AI confidence ≥ threshold → auto decision; below threshold / AI fail / image mismatch → **manual review**, seller+admin notified (D3, REQ-F-Return-004/007, REQ-AI-Return-002).

### SCR-B11 — Return Status / Appeal
- **Purpose:** track a return + appeal. **Route:** `/orders/:id/return/status`
- **UI:** status timeline (Initiated→…→Approved/Rejected→Refund), decision reason (plain language), refund status, **Appeal** button if rejected.
- **Buttons:** Appeal (opens dispute, REQ-F-Return-006/009).
- **States:** standard; appeal window/limits enforced. **Edge cases:** admin override resolves appeal, final (BR-008).

### SCR-B12 — Buyer Profile / Settings — *Profile + Settings flow*
- **Purpose:** address book, language, notifications, security. **Route:** `/account`
- **UI:** tabs — Addresses (CRUD), Notification preferences (critical locked on), Language, Security (password).
- **States:** standard. **Edge cases:** default address used at checkout; deleting the only address prompts to add one before checkout.

### SCR-B13 — Reviews **[R1.1]**
- **Purpose:** rate purchased products (verified-purchase gated). **Route:** within Product Detail / My Orders.
- **UI:** 1–5 stars + comment. **Validation:** only after delivery; one per buyer per product (SRS §5.6.2). **States:** standard.

---

## 5. Admin Console Screens

### SCR-AD01 — Admin Dashboard (KPIs)
- **Purpose:** platform health. **Route:** `/admin`
- **UI:** KPI tiles (GMV, active users, adapter/API uptime), trend charts, alert feed (manual-logistics orders, stuck payments, disputes, fraud flags).
- **States:** standard; **Empty:** early-stage zeros with context. **Edge cases:** uptime sourced from adapter health counters (TRD §24).

### SCR-AD02 — User Management
- **Purpose:** govern accounts. **Route:** `/admin/users`
- **UI:** searchable table (role, status, fraud rate), detail drawer; actions: suspend / ban / reactivate.
- **Inputs:** search, action + reason. **Outputs:** status change; **suspension invalidates sessions immediately** (REQ-F-Auth006).
- **Buttons:** Suspend / Ban / Reactivate (reason mandatory, audited).
- **Validation:** reason required; destructive confirm.
- **States:** standard. **Edge cases:** auto-suspend at 40% fraud rate surfaces here (BR-006); banning a seller with open orders triggers reconciliation flow.

### SCR-AD03 — Payment Management
- **Purpose:** resolve stuck payments/settlements. **Route:** `/admin/payments`
- **UI:** filterable list (status, age), detail with transaction refs; **manual release** action; COD remittance reconciliation view (F12).
- **Buttons:** Release payment (reason, audited); flag for investigation.
- **Validation:** immutable records — corrections via compensating entries only (REQ-NF-Safety-007, REQ-F-COD-004).
- **States:** standard. **Edge cases:** never edits a completed record; release creates a new ledger action.

### SCR-AD04 — Returns / Disputes Queue
- **Purpose:** adjudicate returns + appeals. **Route:** `/admin/disputes`
- **UI:** queue (manual-review items, appeals), case detail (photos, **AI report [R1.1]**, history), override panel.
- **Inputs:** decision + **mandatory reason**. **Outputs:** final decision (BR-008); refund/pickup triggers; audit entry.
- **Buttons:** Approve / Reject / Uphold (reason required).
- **Validation:** reason mandatory (REQ-F-Admin-003).
- **States:** standard; **Empty:** "No cases awaiting review." **Edge cases:** AI-failed/low-confidence returns land here by design (D3).

### SCR-AD05 — Listing Moderation
- **Purpose:** enforce prohibited-item policy (BR-001). **Route:** `/admin/moderation`
- **UI:** reported/flagged listings, preview, takedown action (reason). **Buttons:** Take down / Restore (audited). **States:** standard.

### SCR-AD06 — Config Panel
- **Purpose:** tune business parameters without deploys (SRS §5.5). **Route:** `/admin/config`
- **UI:** forms — commission rate (default 5%), courier weights (40/30/20/10), return window (14d), min order (PKR 100).
- **Inputs:** parameter values. **Outputs:** persisted config applied to future operations (REQ-F-Admin-006, REQ-F-Payment-006, REQ-F-Logistics-003).
- **Validation:** weights sum to 100%; rates within sane bounds.
- **States:** standard; **Success:** "Config saved, applies to new transactions." **Edge cases:** changes audited; never retroactively alter settled records.

### SCR-AD07 — Broadcast Tool **[R1.1]**
- **Purpose:** mass SMS/WhatsApp to segments (REQ-F-Admin-007). **Route:** `/admin/broadcast`
- **UI:** segment selector, template (UR/EN), preview, send. **Validation:** template + segment required; rate-limited. **States:** standard.

### SCR-AD08 — Audit Log Viewer
- **Purpose:** review privileged actions. **Route:** `/admin/audit`
- **UI:** filterable immutable log (actor, action, reason, before/after, timestamp). **States:** read-only. **Edge cases:** export [Future].

---

## 6. Cross-Cutting Flows

### 6.1 Authentication Flow
```
Guest → Register (role, method) → [mobile] OTP Verify | [email] Verify link
      → tokens issued (access 1h RS256 + HttpOnly refresh 7d)
      → role redirect: Buyer→/  Seller→/seller(setup if first login)  Admin→/admin
Login → verify creds → (lockout check) → tokens → role redirect
Refresh → on access expiry, rotate refresh → new access (silent)
Logout → clear tokens + revoke refresh (jti denylist) → /login
```

### 6.2 Authorization Flow
```
Request → authenticate (verify JWT, load principal)
        → authorize(requiredRole)        # PRD §11 matrix
        → ownership check (own records)   # e.g. seller↔product/order
        → privileged? → write audit_log (+mandatory reason)
        → handler
Failures: no/expired token→401 ; wrong role→403 ; not owner→403
```

### 6.3 User (Buyer) Flow
```
Browse/Search → Filter/Sort → Product Detail → Add to Cart (persisted)
→ Checkout (address, method, shipping line) → split into 1 order/seller
→ Pay (mock adapter | COD) → Confirmation → Track (live) → Delivered
→ [optional] Return (≤14d, ≥3 photos) → decision → refund/appeal → Review[R1.1]
```

### 6.4 Seller Flow
```
Register(seller) → Store-Setup Wizard → Dashboard
→ AI Store Builder (photo→listing) → Publish
→ Order arrives → Order Detail → Confirm & Book Courier (or override)
→ Tracking auto-updates → Delivered → Settlement (payout − commission)
→ Returns review (manual MVP / AI badge R1.1) → Analytics
```

### 6.5 Admin Flow
```
Admin Login → Dashboard (KPIs, alerts)
→ User Mgmt (suspend/ban) | Payments (release) | Disputes (override+reason)
| Moderation (takedown) | Config (commission/weights/window/min order)
| Broadcast[R1.1] | Audit Log
All privileged actions → immutable audit_log
```

### 6.6 Notification Flow
```
Lifecycle event (order placed/confirmed/picked up/in transit/out for delivery/
delivered/return decision/refund issued)
→ enqueue job (BullMQ/Redis, async — never blocks request)
→ resolve recipient + language (UR/EN preference)
→ render template (templates decoupled from code)
→ dispatch via SmsAdapter (MVP) + WhatsAppAdapter[R1.1] + in-app bell
→ delivery status logged; critical notifs non-disableable (REQ-F-Notif004)
```

### 6.7 Payment Flow
```
Checkout → generate idempotency key
[Prepaid wallet] charge() via adapter → webhook (HMAC-verify) → PAYMENT_CONFIRMED
  fail → retry ×3 @1min → else cancel + notify buyer
[COD] mark COD → confirm on delivery → courier remits → ledger → settle
After confirmed delivery → settle(order): payout = value − 5% commission
  prepaid 24–48h | COD 48–72h
Approved return → refund within 24h (wallet for prepaid; nominated wallet for COD)
Records immutable; corrections = compensating entries only
```

### 6.8 CRUD Flows (generic pattern)
```
Create → validate(Zod) → authz/ownership → persist(Prisma) → cache-bust → 201 + toast
Read   → authz → cache-or-DB → 200 (skeleton while loading; empty-state if none)
Update → validate → authz/ownership → persist → cache-bust → 200 + toast
Delete → confirm dialog → soft-delete(deleted_at) → hide → 200 + toast
         (hard delete blocked if linked active records, e.g. product with open orders)
```
Applies to: products (SCR-S03/04), addresses (SCR-B12), wallets (SCR-S09), cart items (SCR-B04).

### 6.9 Search Flow
```
Type query → after N chars → autocomplete (cached) → submit
→ tsvector FTS over UR/EN title+description+tags (D1) → ranked results <1s
→ empty → "no matches, try fewer filters"
```

### 6.10 Filter Flow
```
Open filter panel → set category / price range / seller rating / condition
→ choose sort (relevance/price/newest/rating) → apply
→ re-query → update result count + grid (infinite scroll)
→ clear → reset to base results ; price min≤max enforced
```

### 6.11 Profile Flow
```
Open Profile → edit (store/brand or buyer addresses) → validate → save → toast
Addresses: CRUD; default address feeds checkout
Store: brand/logo feeds storefront
```

### 6.12 Settings Flow
```
Open Settings → tab (Notifications | Language | Security)
Notifications: toggle non-critical (critical locked on)
Language: switch UR/EN (no reload; sets notification language)
Security: change password (re-auth) | 2FA[Future]
→ save per section → toast
```

---

## 7. Complete Textual Flowchart (application-wide)

```
                         ┌──────────────┐
                         │  Guest @ /    │
                         │ browse/search │
                         └──────┬────────┘
                  view product / track (public)│ want to act?
                                ▼
                         ┌──────────────┐      no account
                         │  Register?    │──────────────────┐
                         └──────┬────────┘                  │
                       Buyer    │    Seller                 │
            ┌───────────────────┘                           │
            ▼                                                 ▼
   ┌─────────────────┐                              ┌──────────────────┐
   │ Verify (OTP/email)│                            │ Verify (OTP/email)│
   └────────┬─────────┘                             └─────────┬────────┘
            ▼                                                  ▼
   ┌─────────────────┐                              ┌──────────────────┐
   │ BUYER @ /        │                              │ Store-Setup Wizard│
   └────────┬─────────┘                             └─────────┬────────┘
            │ search→filter→product                           ▼
            ▼                                         ┌──────────────────┐
   ┌─────────────────┐                                │ SELLER @ /seller  │
   │ Product Detail   │                               └─────────┬────────┘
   └────────┬─────────┘                                         │ Add Product
            │ add to cart (persisted)                            ▼
            ▼                                          ┌──────────────────┐
   ┌─────────────────┐                                 │ AI Store Builder  │
   │ Cart (by seller) │                                │ photo→AI listing  │
   └────────┬─────────┘                                │ ok? ──no──► Retry │
            │ checkout                                  │  │yes              │
            ▼                                           │  ▼                 │
   ┌─────────────────┐  split 1 order/seller            │ Publish/Draft     │
   │ Checkout         │◄─────────────┐                  └─────────┬────────┘
   │ address+method   │              │                            │ live
   │ +shipping line   │              │                            ▼
   └────────┬─────────┘              │                  ┌──────────────────┐
       pay  │                        │                  │ Product on store  │
   ┌────────▼─────────┐  fail×3      │                  └──────────────────┘
   │ Payment (adapter)│──► cancel+notify
   │ wallet | COD     │
   └────────┬─────────┘ confirmed
            ▼
   ┌─────────────────┐  order placed → COURIER PIPELINE (parallel TCS/Leopards/Trax)
   │ Order Confirmed  │  → score 40/30/20/10 → store best
   └────────┬─────────┘  all fail → PENDING_MANUAL_LOGISTICS → notify seller
            │                         │
            │            seller: Confirm & Book Courier (retry×3→next-best)
            ▼                         ▼
   ┌─────────────────┐        tracking# assigned → poll q5min → WebSocket push
   │ Live Tracking    │◄──── SMS/in-app at each milestone (async queue)
   │ timeline + map   │        map down → text fallback
   └────────┬─────────┘
            ▼ delivered → final notif → polling stops
   ┌─────────────────┐ after confirmed delivery → SETTLEMENT
   │ Delivered/Done   │ payout = value − 5% (prepaid 24–48h / COD 48–72h)
   └────────┬─────────┘
            │ within 14 days & no prior return?
            ▼ yes
   ┌─────────────────┐  ≥3 photos
   │ Returns Wizard   │──► Under Review
   └────────┬─────────┘        │
            │        [R1.1] AI pipeline ≤60s
            │        conf≥threshold? ──no/fail/mismatch──► MANUAL REVIEW (admin)
            │              │yes                                   │
            ▼              ▼                                       ▼
        Rejected      Approved → auto pickup + refund≤24h     Admin decision (final)
            │
            ▼ appeal (≤5 business days) → Admin Disputes → final

   ───────────── ADMIN (parallel governance) ─────────────
   Admin Login → Dashboard(KPIs/alerts) → {Users | Payments | Disputes |
   Moderation | Config | Broadcast[R1.1] | Audit}  → all writes → audit_log

   ───────────── SESSION ─────────────
   Any authed screen → Logout → clear tokens + revoke refresh → /login
```

---

*End of Document 3 (Application Flow). On approval, the next document is the **UI/UX Design Brief** — brand, design principles, tokens, color/typography (incl. Urdu RTL/Noto Nastaliq), components, responsive rules, accessibility (WCAG 2.1 AA), dark/light mode, motion, and the AI/conversational component patterns.*
