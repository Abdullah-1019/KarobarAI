```markdown
# RAFIA-SCHEDULE.md — Frontend Execution Schedule

## Day 1 — Feature 0: Project Foundation

| Field | Detail |
|---|---|
| **Feature** | F0 — Project Foundation |
| **Task (from playbook)** | React Setup, Folder Structure, Shared Components, Theme, Routing, API Structure (client-side) |
| **Docs to Attach** | Playbook F0, TRD §4, TRD §12, PRD §13.4 (accessibility target) |
| **Mock or Real API** | N/A — no backend exists yet |
| **Expected Git Commit(s)** | `feat/fe-f0-setup` |
| **End-of-Day Deliverable** | Frontend boots standalone (`npm run dev`); routing skeleton, AntD theme, i18n (UR/EN) with RTL, shared component shells all present |
| **Feature Complete?** | N |

**Exact Claude CLI Prompt:**
```
Follow the attached documents exactly as the source of truth — do not introduce
patterns or choices not specified in them. Write simple, clear, well-commented
code appropriate for a small two-person team, not over-engineered. If anything
in the attached documents is unclear, conflicting, or missing something you need
to proceed, STOP and ask me a specific question before writing code — do not guess.
Structure your implementation so future features can extend it without rework:
avoid hardcoded values, keep clear separation of concerns, keep this feature's
interface stable for others to depend on.

This is Day 1 — there is no previous handoff file yet, so skip that step.

Using Playbook F0, TRD §4 (Frontend Technology Stack), and TRD §12 (Folder
Structure), set up the React frontend: Vite + TypeScript project, the
apps/web folder structure exactly as specified in TRD §12, AntD ConfigProvider
themed with RTL support, react-i18next with UR/EN locale bundles and Noto
Nastaliq Urdu font loading, base routing skeleton (no protected routes yet —
those come with Feature 1), and empty shared component shells (skeleton
loader, toast, modal, empty-state) ready for later features to use. No
backend integration yet — this is a standalone frontend shell.

When finished: write a handoff note at docs/handoffs/F0-foundation-frontend.md
summarizing what was built, the folder structure decisions made, and anything
left incomplete for Day 2's integration step.
```

---

## Day 2 — Feature 0 → Feature 1 (start)

| Field | Detail |
|---|---|
| **Feature** | F0 (integrate) → F1 (start) |
| **Task (from playbook)** | Integrate app shell with `/health`; begin Login + Register screens |
| **Docs to Attach** | `docs/handoffs/F0-foundation-backend.md`, Playbook F1, App Flow SCR-A01, SCR-A03, PRD REQ-F-Auth001/002 |
| **Mock or Real API** | Mock (F1 auth endpoints not built yet) |
| **Expected Git Commit(s)** | `feat/fe-f0-integrate`, `feat/fe-f1-mock-p1` |
| **End-of-Day Deliverable** | App shell confirmed talking to live backend `/health`; Login + Register UI built against mock auth API |
| **Feature Complete?** | F0: Y (after integration) · F1: N |

**Exact Claude CLI Prompt:**
```
Follow the attached documents exactly as the source of truth — do not introduce
patterns or choices not specified in them. Write simple, clear, well-commented
code appropriate for a small two-person team, not over-engineered. If anything
in the attached documents is unclear, conflicting, or missing something you need
to proceed, STOP and ask me a specific question before writing code — do not guess.
Structure your implementation so future features can extend it without rework:
avoid hardcoded values, keep clear separation of concerns, keep this feature's
interface stable for others to depend on.

Before starting, read docs/handoffs/F0-foundation-backend.md to understand what
already exists on the backend side.

First, confirm the frontend app shell can call the backend's /health endpoint
successfully and displays a simple connectivity confirmation during local dev.

Then, using Playbook F1, App Flow screens SCR-A01 (Register) and SCR-A03
(Login), and PRD REQ-F-Auth001/002 (OTP shape, password complexity rules),
build the Register and Login screens against a mock API layer. The mock
must match the exact request/response shapes described in TRD §7
(Authentication Strategy) so swapping to the real API later is mechanical,
not a rewrite. Include client-side validation matching REQ-F-Auth002
(password ≥8 chars incl. upper/lower/digit/special) and role toggle
(Buyer/Seller) per SCR-A01.

When finished: write/update the handoff note at
docs/handoffs/F0-foundation-frontend.md (mark F0 complete) and start
docs/handoffs/F1-auth-frontend.md summarizing the mock API shape used,
so the real integration step later has something exact to match against.
```

---

## Day 3 — Feature 1 (continued)

| Field | Detail |
|---|---|
| **Feature** | F1 — Authentication |
| **Task (from playbook)** | Integrate Login/Register/OTP against real API; build Forgot/Reset Password UI (mock) |
| **Docs to Attach** | `docs/handoffs/F1-auth-backend.md`, Playbook F1, App Flow SCR-A02, SCR-A04 |
| **Mock or Real API** | Mixed — Login/Register/OTP real, Forgot/Reset mock |
| **Expected Git Commit(s)** | `feat/fe-f1-integrate-p1`, `feat/fe-f1-mock-p2` |
| **End-of-Day Deliverable** | Register→OTP→Login fully working against real backend; Forgot/Reset Password screens built on mocks |
| **Feature Complete?** | N |

**Exact Claude CLI Prompt:**
```
Follow the attached documents exactly as the source of truth — do not introduce
patterns or choices not specified in them. Write simple, clear, well-commented
code appropriate for a small two-person team, not over-engineered. If anything
in the attached documents is unclear, conflicting, or missing something you need
to proceed, STOP and ask me a specific question before writing code — do not guess.
Structure your implementation so future features can extend it without rework:
avoid hardcoded values, keep clear separation of concerns, keep this feature's
interface stable for others to depend on.

Before starting, read docs/handoffs/F1-auth-backend.md to understand exactly
what the real /auth/register, /auth/verify-otp, and /auth/login endpoints
return, including the JWT payload shape and refresh-token cookie details.

Replace the mock API calls in Register, OTP Verify, and Login screens with
real calls to those endpoints. Confirm the OTP 6-box input, 10-minute
countdown, and resend cooldown (max 5/hour, per REQ-F-Auth001) all behave
correctly against the real backend. Confirm role-based redirect works
(Buyer→storefront, Seller→setup wizard, Admin→admin) per App Flow §6.1.

Then, using Playbook F1 and App Flow SCR-A02 (OTP Verification, already
integrated) and SCR-A04 (Forgot/Reset Password), build the Forgot/Reset
Password screens against a mock API matching the shape described in TRD §7.

When finished: write/update the handoff note at
docs/handoffs/F1-auth-frontend.md documenting the confirmed real API
integration, the mock shape used for Forgot/Reset, and anything left
incomplete for tomorrow's integration.
```

---

## Day 4 — Feature 1 (finish) → Feature 2 (start)

| Field | Detail |
|---|---|
| **Feature** | F1 (finish) → F2 (start) |
| **Task (from playbook)** | Integrate Forgot/Reset/RBAC/Logout; start Profile + Edit Profile UI (mock) |
| **Docs to Attach** | `docs/handoffs/F1-auth-backend-p2.md`, Playbook F2, App Flow SCR-B12, SCR-S10 |
| **Mock or Real API** | Mixed |
| **Expected Git Commit(s)** | `feat/fe-f1-integrate-p2`, `feat/fe-f2-mock-p1` |
| **End-of-Day Deliverable** | F1 fully complete end-to-end; Profile screens scaffolded on mocks |
| **Feature Complete?** | F1: Y |

**Exact Claude CLI Prompt:**
```
Follow the attached documents exactly as the source of truth — do not introduce
patterns or choices not specified in them. Write simple, clear, well-commented
code appropriate for a small two-person team, not over-engineered. If anything
in the attached documents is unclear, conflicting, or missing something you need
to proceed, STOP and ask me a specific question before writing code — do not guess.
Structure your implementation so future features can extend it without rework:
avoid hardcoded values, keep clear separation of concerns, keep this feature's
interface stable for others to depend on.

Before starting, read docs/handoffs/F1-auth-backend-p2.md to understand the
real forgot-password, reset-password, logout, and session-revocation
endpoints and behaviors.

Wire the Forgot/Reset Password screens to the real endpoints. Confirm logout
clears tokens and revokes the refresh session (REQ-F-Auth006). Confirm that
a 401 response globally redirects to Login and a 403 shows the
"not authorised" page, per App Flow §0 (Global UI states). Run through every
acceptance criterion in PRD §14 "Epic: Auth & Accounts."

Then, using Playbook F2 and App Flow SCR-B12 (Buyer Profile/Settings) and
SCR-S10 (Seller Settings/Profile), scaffold Buyer, Seller, and Admin profile
views plus Edit Profile forms against a mock API.

When finished: write/update the handoff note at docs/handoffs/F1-auth-frontend.md
marking F1 fully complete, and start docs/handoffs/F2-profiles-frontend.md
with the mock shape used for profile data.
```

---

## Day 5 — Feature 2 (finish)

| Field | Detail |
|---|---|
| **Feature** | F2 — User Profiles |
| **Task (from playbook)** | Integrate Profile CRUD, Picture upload, Settings, Change Password |
| **Docs to Attach** | `docs/handoffs/F2-profiles-backend.md`, Playbook F2, App Flow §6.11, §6.12 |
| **Mock or Real API** | Real |
| **Expected Git Commit(s)** | `feat/fe-f2-integrate` |
| **End-of-Day Deliverable** | F2 fully complete end-to-end |
| **Feature Complete?** | Y |

**Exact Claude CLI Prompt:**
```
Follow the attached documents exactly as the source of truth — do not introduce
patterns or choices not specified in them. Write simple, clear, well-commented
code appropriate for a small two-person team, not over-engineered. If anything
in the attached documents is unclear, conflicting, or missing something you need
to proceed, STOP and ask me a specific question before writing code — do not guess.
Structure your implementation so future features can extend it without rework:
avoid hardcoded values, keep clear separation of concerns, keep this feature's
interface stable for others to depend on.

Before starting, read docs/handoffs/F2-profiles-backend.md to understand the
real profile, address, and change-password endpoints.

Wire Buyer/Seller/Admin Profile, Edit Profile, Profile Picture upload, and
Settings screens to real APIs. Implement address CRUD (App Flow §6.11) with
default-address selection. Implement Change Password with re-authentication
per App Flow §6.12. Verify the generic CRUD flow pattern (App Flow §6.8)
applies correctly: create/read/update/soft-delete all confirmed working.

When finished: write/update the handoff note at
docs/handoffs/F2-profiles-frontend.md marking F2 fully complete.
```

---

## Day 6 — Feature 3: Store Management (start)

| Field | Detail |
|---|---|
| **Feature** | F3 — Store Management |
| **Task (from playbook)** | Create/Edit Store, Store Banner, Logo, Business Information, Store Settings, Store Status (mock) |
| **Docs to Attach** | Playbook F3, App Flow SCR-S00, PRD REQ-F-Auth005 |
| **Mock or Real API** | Mock |
| **Expected Git Commit(s)** | `feat/fe-f3-mock` |
| **End-of-Day Deliverable** | Store-Setup Wizard UI built with resumable-step behavior against mocks |
| **Feature Complete?** | N |

**Exact Claude CLI Prompt:**
```
Follow the attached documents exactly as the source of truth — do not introduce
patterns or choices not specified in them. Write simple, clear, well-commented
code appropriate for a small two-person team, not over-engineered. If anything
in the attached documents is unclear, conflicting, or missing something you need
to proceed, STOP and ask me a specific question before writing code — do not guess.
Structure your implementation so future features can extend it without rework:
avoid hardcoded values, keep clear separation of concerns, keep this feature's
interface stable for others to depend on.

Before starting, read docs/handoffs/F2-profiles-frontend.md to understand
what profile data already exists that the Store Wizard can build on.

Using Playbook F3, App Flow SCR-S00 (Store-Setup Wizard), and PRD
REQ-F-Auth005 (store name, description, ≥1 payout wallet required before
selling), build the Store-Setup Wizard: a stepper with store name/description,
payout wallet add form (support multiple wallets, set-default — do not assume
only one wallet per type), optional banner/logo upload, and a progress bar.
Build it against a mock API. Critically: implement step-state so that leaving
mid-wizard and returning resumes at the last completed step, not from
scratch — this is an explicit App Flow requirement.

When finished: write/update the handoff note at
docs/handoffs/F3-store-frontend.md documenting the mock API shape used,
especially the wallet-list shape and the step-tracking field expected from
the backend.
```

---

## Day 7 — Feature 3 (finish) → Feature 4 (start)

| Field | Detail |
|---|---|
| **Feature** | F3 (finish) → F4 (start) |
| **Task (from playbook)** | Integrate Store Wizard (verify resumability); start Categories + Add/Edit/Delete Product UI (mock) |
| **Docs to Attach** | `docs/handoffs/F3-store-backend.md`, Playbook F4, App Flow SCR-S03, SCR-S04 |
| **Mock or Real API** | Mixed |
| **Expected Git Commit(s)** | `feat/fe-f3-integrate`, `feat/fe-f4-mock-p1` |
| **End-of-Day Deliverable** | F3 fully complete; Product list/edit screens scaffolded on mocks |
| **Feature Complete?** | F3: Y |

**Exact Claude CLI Prompt:**
```
Follow the attached documents exactly as the source of truth — do not introduce
patterns or choices not specified in them. Write simple, clear, well-commented
code appropriate for a small two-person team, not over-engineered. If anything
in the attached documents is unclear, conflicting, or missing something you need
to proceed, STOP and ask me a specific question before writing code — do not guess.
Structure your implementation so future features can extend it without rework:
avoid hardcoded values, keep clear separation of concerns, keep this feature's
interface stable for others to depend on.

Before starting, read docs/handoffs/F3-store-backend.md to understand the
real store, wallet, and onboarding-step endpoints.

Wire the Store-Setup Wizard to real endpoints. Explicitly test: leave the
wizard mid-step, reload the page, confirm it resumes at the correct step
rather than restarting. Confirm wallet add/set-default works with multiple
wallets of the same type.

Then, using Playbook F4 and App Flow SCR-S03 (Products list/management) and
SCR-S04 (Product Edit), scaffold Categories browsing and Add/Edit/Delete
Product screens against a mock API. This is the manual product-entry path
only — AI-assisted generation is a separate later feature, do not build it
here.

When finished: write/update the handoff note at
docs/handoffs/F3-store-frontend.md marking F3 fully complete, and start
docs/handoffs/F4-products-frontend.md with the mock shapes used.
```

---

## Day 8 — Feature 4 (continued)

| Field | Detail |
|---|---|
| **Feature** | F4 — Product Management |
| **Task (from playbook)** | Integrate Categories/Add/Edit/Delete Product; build Product Details, Images, Search UI (mock) |
| **Docs to Attach** | `docs/handoffs/F4-products-backend-p1.md`, Playbook F4, App Flow SCR-B03 |
| **Mock or Real API** | Mixed |
| **Expected Git Commit(s)** | `feat/fe-f4-integrate-p1`, `feat/fe-f4-mock-p2` |
| **End-of-Day Deliverable** | Category/CRUD live against real API; Product Details + image upload + search UI on mocks |
| **Feature Complete?** | N |

**Exact Claude CLI Prompt:**
```
Follow the attached documents exactly as the source of truth — do not introduce
patterns or choices not specified in them. Write simple, clear, well-commented
code appropriate for a small two-person team, not over-engineered. If anything
in the attached documents is unclear, conflicting, or missing something you need
to proceed, STOP and ask me a specific question before writing code — do not guess.
Structure your implementation so future features can extend it without rework:
avoid hardcoded values, keep clear separation of concerns, keep this feature's
interface stable for others to depend on.

Before starting, read docs/handoffs/F4-products-backend-p1.md to understand
the real category and product CRUD endpoints, including the oversell-guard
error shape.

Wire Category browsing and Add/Edit/Delete Product screens to real APIs.
Verify the oversell guard surfaces a clear error to the seller. Verify
soft-deleting a product with active orders is blocked with a clear message
per App Flow SCR-S03.

Then, using Playbook F4 and App Flow SCR-B03 (Product Detail, buyer-facing
preview) build the Product Details view, drag-drop image upload zone with
client-side compression before upload (per PRD REQ-F-Store007's latency
correction — compression must happen client-side), and a basic product
search input — all against a mock API.

When finished: write/update the handoff note at
docs/handoffs/F4-products-frontend.md documenting what's integrated vs
mocked, and the image-upload contract expected from the backend.
```

---

## Day 9 — Feature 4 (finish) → Feature 5 (start)

| Field | Detail |
|---|---|
| **Feature** | F4 (finish) → F5 (start) |
| **Task (from playbook)** | Integrate Product Details/Images/Search; start Homepage, Search, Categories, Wishlist, Filters UI (mock) |
| **Docs to Attach** | `docs/handoffs/F4-products-backend-p2.md`, Playbook F5, App Flow SCR-B01, SCR-B02, SCR-B03 |
| **Mock or Real API** | Mixed |
| **Expected Git Commit(s)** | `feat/fe-f4-integrate-p2`, `feat/fe-f5-mock` |
| **End-of-Day Deliverable** | F4 fully complete; Buyer Marketplace screens scaffolded on mocks |
| **Feature Complete?** | F4: Y |

**Exact Claude CLI Prompt:**
```
Follow the attached documents exactly as the source of truth — do not introduce
patterns or choices not specified in them. Write simple, clear, well-commented
code appropriate for a small two-person team, not over-engineered. If anything
in the attached documents is unclear, conflicting, or missing something you need
to proceed, STOP and ask me a specific question before writing code — do not guess.
Structure your implementation so future features can extend it without rework:
avoid hardcoded values, keep clear separation of concerns, keep this feature's
interface stable for others to depend on.

Before starting, read docs/handoffs/F4-products-backend-p2.md to understand
the real image-upload and search endpoints.

Wire Product Details, image upload, and search bar to real APIs. Confirm
images are compressed client-side before upload and stored under 200KB per
REQ-F-Store007. Run through PRD §14 acceptance criteria for product
management.

Then, using Playbook F5 and App Flow SCR-B01 (Home), SCR-B02 (Search
Results/Browse), and SCR-B03 (Product Detail — buyer add-to-cart/wishlist
actions), scaffold the Homepage, Search Results with filters/sort/infinite
scroll, category browse, and Wishlist UI against a mock API.

When finished: write/update the handoff note at
docs/handoffs/F4-products-frontend.md marking F4 fully complete, and start
docs/handoffs/F5-marketplace-frontend.md with the mock search/filter shapes used.
```

---

## Day 10 — Feature 5 (finish) → Feature 6 (start)

| Field | Detail |
|---|---|
| **Feature** | F5 (finish) → F6 (start) |
| **Task (from playbook)** | Integrate Homepage/Search/Categories/Wishlist/Filters; start Cart, Quantity, Remove Item UI (mock) |
| **Docs to Attach** | `docs/handoffs/F5-marketplace-backend.md`, Playbook F6, App Flow SCR-B04 |
| **Mock or Real API** | Mixed |
| **Expected Git Commit(s)** | `feat/fe-f5-integrate`, `feat/fe-f6-mock-p1` |
| **End-of-Day Deliverable** | F5 fully complete; Cart UI scaffolded on mocks |
| **Feature Complete?** | F5: Y |

**Exact Claude CLI Prompt:**
```
Follow the attached documents exactly as the source of truth — do not introduce
patterns or choices not specified in them. Write simple, clear, well-commented
code appropriate for a small two-person team, not over-engineered. If anything
in the attached documents is unclear, conflicting, or missing something you need
to proceed, STOP and ask me a specific question before writing code — do not guess.
Structure your implementation so future features can extend it without rework:
avoid hardcoded values, keep clear separation of concerns, keep this feature's
interface stable for others to depend on.

Before starting, read docs/handoffs/F5-marketplace-backend.md to understand
the real search/filter/browse/wishlist endpoints, including how full-text
search results are ranked and paginated.

Wire Homepage, Search Results, Category browse, Filters, and Wishlist to
real APIs. Confirm Urdu-language search queries correctly match Urdu product
fields. Confirm out-of-stock products are hidden by default per
REQ-F-Inv-003.

Then, using Playbook F6 and App Flow SCR-B04 (Cart, grouped by seller),
scaffold the Cart screen: line items grouped by seller, quantity steppers,
remove-item, per-seller subtotal, against a mock API that returns a
persisted-cart shape.

When finished: write/update the handoff note at
docs/handoffs/F5-marketplace-frontend.md marking F5 fully complete, and
start docs/handoffs/F6-cart-frontend.md with the mock cart shape used.
```

---

## Day 11 — Feature 6 (continued)

| Field | Detail |
|---|---|
| **Feature** | F6 — Cart & Checkout |
| **Task (from playbook)** | Integrate Cart; build Checkout — Address, Shipping, Payment Selection UI (mock) |
| **Docs to Attach** | `docs/handoffs/F6-cart-backend-p1.md`, Playbook F6, App Flow SCR-B05 |
| **Mock or Real API** | Mixed |
| **Expected Git Commit(s)** | `feat/fe-f6-integrate-p1`, `feat/fe-f6-mock-p2` |
| **End-of-Day Deliverable** | Cart live against real API (cross-device persistence verified); Checkout UI scaffolded on mocks |
| **Feature Complete?** | N |

**Exact Claude CLI Prompt:**
```
Follow the attached documents exactly as the source of truth — do not introduce
patterns or choices not specified in them. Write simple, clear, well-commented
code appropriate for a small two-person team, not over-engineered. If anything
in the attached documents is unclear, conflicting, or missing something you need
to proceed, STOP and ask me a specific question before writing code — do not guess.
Structure your implementation so future features can extend it without rework:
avoid hardcoded values, keep clear separation of concerns, keep this feature's
interface stable for others to depend on.

Before starting, read docs/handoffs/F6-cart-backend-p1.md to understand the
real persisted-cart, quantity-update, and remove-item endpoints.

Wire the Cart screen to real APIs. Verify cross-device persistence: log in
on two separate sessions and confirm the same cart contents appear in both.
Verify quantity cannot exceed available stock (REQ-F-Inv-002) and shows an
inline "only N left" message on conflict.

Then, using Playbook F6 and App Flow SCR-B05 (Checkout — complex screen),
scaffold the Checkout screen: delivery address selection/add-new, payment
method selection (JazzCash/Easypaisa/COD), per-seller order summary with a
separate shipping line (buyer pays shipping — never bundle it into the item
subtotal), and a place-order CTA — against a mock API.

When finished: write/update the handoff note at
docs/handoffs/F6-cart-frontend.md documenting cart integration status and
the mock checkout shape used.
```

---

## Day 12 — Feature 6 (finish) → Feature 7 (start)

| Field | Detail |
|---|---|
| **Feature** | F6 (finish) → F7 (start) |
| **Task (from playbook)** | Integrate Checkout end-to-end; start Order Confirmation, Seller/Buyer Orders, Order Details, Status, Invoice UI (mock) |
| **Docs to Attach** | `docs/handoffs/F6-cart-backend-p2.md`, Playbook F7, App Flow SCR-B06, SCR-B07, SCR-S05, SCR-S06 |
| **Mock or Real API** | Mixed |
| **Expected Git Commit(s)** | `feat/fe-f6-integrate-p2`, `feat/fe-f7-mock` |
| **End-of-Day Deliverable** | F6 fully complete; Order screens scaffolded on mocks |
| **Feature Complete?** | F6: Y |

**Exact Claude CLI Prompt:**
```
Follow the attached documents exactly as the source of truth — do not introduce
patterns or choices not specified in them. Write simple, clear, well-commented
code appropriate for a small two-person team, not over-engineered. If anything
in the attached documents is unclear, conflicting, or missing something you need
to proceed, STOP and ask me a specific question before writing code — do not guess.
Structure your implementation so future features can extend it without rework:
avoid hardcoded values, keep clear separation of concerns, keep this feature's
interface stable for others to depend on.

Before starting, read docs/handoffs/F6-cart-backend-p2.md to understand the
real checkout endpoint, including the idempotency-key requirement and the
multi-seller split-at-checkout response shape.

Wire Checkout to the real API. Explicitly verify: a cart with items from two
different sellers produces two separate orders, each with its own shipping
line; submitting checkout twice quickly (double-click) does not create
duplicate orders, because of the idempotency key; a below-minimum-order
total is blocked with a clear message before payment starts.

Then, using Playbook F7 and App Flow SCR-B06 (Order Confirmation), SCR-B07
(My Orders), SCR-S05 (seller Order Management, tab-mapped states), and
SCR-S06 (Order Detail), scaffold these screens against a mock API using the
canonical order_status enum stated in App Flow §0.

When finished: write/update the handoff note at
docs/handoffs/F6-cart-frontend.md marking F6 fully complete, and start
docs/handoffs/F7-orders-frontend.md with the mock order shapes used.
```

---

## Day 13 — Feature 7 (finish)

| Field | Detail |
|---|---|
| **Feature** | F7 — Orders |
| **Task (from playbook)** | Integrate Order placement, lists, detail, status, invoice |
| **Docs to Attach** | `docs/handoffs/F7-orders-backend.md`, Playbook F7, App Flow SCR-B06, SCR-B07, SCR-S05, SCR-S06 |
| **Mock or Real API** | Real |
| **Expected Git Commit(s)** | `feat/fe-f7-integrate` |
| **End-of-Day Deliverable** | F7 fully complete end-to-end |
| **Feature Complete?** | Y |

**Exact Claude CLI Prompt:**
```
Follow the attached documents exactly as the source of truth — do not introduce
patterns or choices not specified in them. Write simple, clear, well-commented
code appropriate for a small two-person team, not over-engineered. If anything
in the attached documents is unclear, conflicting, or missing something you need
to proceed, STOP and ask me a specific question before writing code — do not guess.
Structure your implementation so future features can extend it without rework:
avoid hardcoded values, keep clear separation of concerns, keep this feature's
interface stable for others to depend on.

Before starting, read docs/handoffs/F7-orders-backend.md to understand the
real order-placement, order-list, order-detail, and invoice endpoints and
the exact order_status values returned.

Wire Order Confirmation, My Orders, seller Order Management tabs, Order
Detail, and Invoice download to real APIs. Verify the status-tab grouping
in seller Order Management correctly maps canonical statuses to the friendly
tab labels described in App Flow SCR-S05. Verify a PENDING_MANUAL_LOGISTICS
order shows a clear alert badge.

When finished: write/update the handoff note at
docs/handoffs/F7-orders-frontend.md marking F7 fully complete.
```

---

## Day 14 — Feature 8: Courier & Tracking (start)

| Field | Detail |
|---|---|
| **Feature** | F8 — Courier & Tracking |
| **Task (from playbook)** | Select Courier, Book Shipment, Tracking, Shipment Timeline, Delivery Status (mock) |
| **Docs to Attach** | Playbook F8, App Flow SCR-S06, SCR-B08, SCR-B09 |
| **Mock or Real API** | Mock |
| **Expected Git Commit(s)** | `feat/fe-f8-mock` |
| **End-of-Day Deliverable** | Courier card, booking, tracking timeline, and public tracking page scaffolded on mocks |
| **Feature Complete?** | N |

**Exact Claude CLI Prompt:**
```
Follow the attached documents exactly as the source of truth — do not introduce
patterns or choices not specified in them. Write simple, clear, well-commented
code appropriate for a small two-person team, not over-engineered. If anything
in the attached documents is unclear, conflicting, or missing something you need
to proceed, STOP and ask me a specific question before writing code — do not guess.
Structure your implementation so future features can extend it without rework:
avoid hardcoded values, keep clear separation of concerns, keep this feature's
interface stable for others to depend on.

Before starting, read docs/handoffs/F7-orders-frontend.md to understand the
existing Order Detail screen this feature extends.

Using Playbook F8, App Flow SCR-S06 (Order Detail + Courier Booking),
SCR-B08 (authenticated Order Tracking), and SCR-B09 (public login-free
tracking page), scaffold: a recommended-courier card (cost breakdown, ETA,
score) with an override dropdown, a one-click "Confirm & Book Courier"
button, a visual status timeline with map embed, and the public tracking
page reachable via a token in the URL (no login required) — all against a
mock API.

When finished: write/update the handoff note at
docs/handoffs/F8-courier-frontend.md documenting the mock shapes used for
courier quotes and tracking events.
```

---

## Day 15 — Feature 8 (finish)

| Field | Detail |
|---|---|
| **Feature** | F8 — Courier & Tracking |
| **Task (from playbook)** | Integrate Courier/Tracking; verify WebSocket live-push and map fallback |
| **Docs to Attach** | `docs/handoffs/F8-courier-backend.md`, Playbook F8, App Flow SCR-S06, SCR-B08, SCR-B09 |
| **Mock or Real API** | Real |
| **Expected Git Commit(s)** | `feat/fe-f8-integrate` |
| **End-of-Day Deliverable** | F8 fully complete end-to-end |
| **Feature Complete?** | Y |

**Exact Claude CLI Prompt:**
```
Follow the attached documents exactly as the source of truth — do not introduce
patterns or choices not specified in them. Write simple, clear, well-commented
code appropriate for a small two-person team, not over-engineered. If anything
in the attached documents is unclear, conflicting, or missing something you need
to proceed, STOP and ask me a specific question before writing code — do not guess.
Structure your implementation so future features can extend it without rework:
avoid hardcoded values, keep clear separation of concerns, keep this feature's
interface stable for others to depend on.

Before starting, read docs/handoffs/F8-courier-backend.md to understand the
real courier-scoring, booking, and WebSocket tracking endpoints, including
the Socket.IO namespace and event names used.

Wire courier booking and tracking to real APIs. Explicitly verify: booking
a courier in one browser tab causes the tracking timeline to update live in
a second tab without a manual refresh (WebSocket push working correctly);
if the map fails to load, the screen falls back to a text-only status
display rather than breaking; after 3 consecutive failed tracking polls, an
in-app alert appears per REQ-F-Track006.

When finished: write/update the handoff note at
docs/handoffs/F8-courier-frontend.md marking F8 fully complete.
```

---

## Day 16 — Feature 9: Notifications

| Field | Detail |
|---|---|
| **Feature** | F9 — Notifications |
| **Task (from playbook)** | In-App, Email, SMS, WhatsApp, Notification Center (mock first, then integrate) |
| **Docs to Attach** | `docs/handoffs/F9-notifications-backend.md`, Playbook F9, App Flow SCR-S10, SCR-B12 |
| **Mock or Real API** | Real (backend was built ahead on Day 15 by CR, per the pipeline) |
| **Expected Git Commit(s)** | `feat/fe-f9-integrate` |
| **End-of-Day Deliverable** | F9 fully complete end-to-end |
| **Feature Complete?** | Y |

**Exact Claude CLI Prompt:**
```
Follow the attached documents exactly as the source of truth — do not introduce
patterns or choices not specified in them. Write simple, clear, well-commented
code appropriate for a small two-person team, not over-engineered. If anything
in the attached documents is unclear, conflicting, or missing something you need
to proceed, STOP and ask me a specific question before writing code — do not guess.
Structure your implementation so future features can extend it without rework:
avoid hardcoded values, keep clear separation of concerns, keep this feature's
interface stable for others to depend on.

Before starting, read docs/handoffs/F9-notifications-backend.md to understand
the real notification-list, mark-read, and preference endpoints.

Using Playbook F9 and App Flow SCR-S10/SCR-B12 (notification preferences
tabs), build and wire the Notification Center: an in-app bell with unread
count and chronological list, and preference toggles for SMS/Email/WhatsApp/
In-App — with critical notification types shown as permanently enabled and
not toggleable, per REQ-F-Notif004. Confirm templates render correctly in
both Urdu and English based on the user's language preference.

When finished: write/update the handoff note at
docs/handoffs/F9-notifications-frontend.md marking F9 fully complete.
```

---

## Day 17 — Feature 10: Returns & Refunds (start)

| Field | Detail |
|---|---|
| **Feature** | F10 — Returns & Refunds |
| **Task (from playbook)** | Return Request, Upload Images, Seller Review, Admin Review, Refund Status, Return History (mock) |
| **Docs to Attach** | Playbook F10, App Flow SCR-B10, SCR-B11, SCR-S07 |
| **Mock or Real API** | Mock |
| **Expected Git Commit(s)** | `feat/fe-f10-mock` |
| **End-of-Day Deliverable** | Returns Wizard, Return Status/Appeal, and seller Returns review screens scaffolded on mocks |
| **Feature Complete?** | N |

**Exact Claude CLI Prompt:**
```
Follow the attached documents exactly as the source of truth — do not introduce
patterns or choices not specified in them. Write simple, clear, well-commented
code appropriate for a small two-person team, not over-engineered. If anything
in the attached documents is unclear, conflicting, or missing something you need
to proceed, STOP and ask me a specific question before writing code — do not guess.
Structure your implementation so future features can extend it without rework:
avoid hardcoded values, keep clear separation of concerns, keep this feature's
interface stable for others to depend on.

Before starting, read docs/handoffs/F7-orders-frontend.md and
docs/handoffs/F9-notifications-frontend.md to understand the order data and
notification patterns this feature builds on.

Using Playbook F10, App Flow SCR-B10 (Returns Wizard — stepper, ≥3-photo
upload, Next button disabled until 3 valid photos), SCR-B11 (Return
Status/Appeal), and SCR-S07 (seller Returns review view), scaffold these
screens against a mock API. Enforce the 14-day return window and one-return-
per-order rule client-side as a first check (the backend is the real source
of truth, but the UI should give immediate feedback).

When finished: write/update the handoff note at
docs/handoffs/F10-returns-frontend.md documenting the mock return-request
shape used.
```

---

## Day 18 — Feature 10 (finish) → Feature 11 (start)

| Field | Detail |
|---|---|
| **Feature** | F10 (finish) → F11 (start) |
| **Task (from playbook)** | Integrate Returns; start Revenue, Sales, Orders, Customers, Charts, Top Products UI (mock) |
| **Docs to Attach** | `docs/handoffs/F10-returns-backend.md`, Playbook F11, App Flow SCR-S08 |
| **Mock or Real API** | Mixed |
| **Expected Git Commit(s)** | `feat/fe-f10-integrate`, `feat/fe-f11-mock` |
| **End-of-Day Deliverable** | F10 fully complete; Analytics Dashboard scaffolded on mocks |
| **Feature Complete?** | F10: Y |

**Exact Claude CLI Prompt:**
```
Follow the attached documents exactly as the source of truth — do not introduce
patterns or choices not specified in them. Write simple, clear, well-commented
code appropriate for a small two-person team, not over-engineered. If anything
in the attached documents is unclear, conflicting, or missing something you need
to proceed, STOP and ask me a specific question before writing code — do not guess.
Structure your implementation so future features can extend it without rework:
avoid hardcoded values, keep clear separation of concerns, keep this feature's
interface stable for others to depend on.

Before starting, read docs/handoffs/F10-returns-backend.md to understand the
real return-request, review, and refund-status endpoints.

Wire the Returns Wizard, Return Status/Appeal, and seller Returns view to
real APIs. Verify the 14-day window and one-return-per-order rules are
enforced server-side (not just client-side) and produce clear error
messages. Verify appeal submission and the 5-business-day resolution
messaging per App Flow.

Then, using Playbook F11 and App Flow SCR-S08 (Analytics Dashboard), scaffold
revenue cards (this month/last month/YTD), a daily sales trend chart,
revenue-by-category breakdown, and a Top Products table with date-range
filter (7d/30d/3m/custom) — against a mock API.

When finished: write/update the handoff note at
docs/handoffs/F10-returns-frontend.md marking F10 fully complete, and start
docs/handoffs/F11-analytics-frontend.md with the mock analytics shape used.
```

---

## Day 19 — Feature 11 (finish)

| Field | Detail |
|---|---|
| **Feature** | F11 — Analytics Dashboard |
| **Task (from playbook)** | Integrate Analytics Dashboard (date-range filter, charts) |
| **Docs to Attach** | `docs/handoffs/F11-analytics-backend.md`, Playbook F11, App Flow SCR-S08 |
| **Mock or Real API** | Real |
| **Expected Git Commit(s)** | `feat/fe-f11-integrate` |
| **End-of-Day Deliverable** | F11 fully complete end-to-end |
| **Feature Complete?** | Y |

**Exact Claude CLI Prompt:**
```
Follow the attached documents exactly as the source of truth — do not introduce
patterns or choices not specified in them. Write simple, clear, well-commented
code appropriate for a small two-person team, not over-engineered. If anything
in the attached documents is unclear, conflicting, or missing something you need
to proceed, STOP and ask me a specific question before writing code — do not guess.
Structure your implementation so future features can extend it without rework:
avoid hardcoded values, keep clear separation of concerns, keep this feature's
interface stable for others to depend on.

Before starting, read docs/handoffs/F11-analytics-backend.md to understand
the real analytics endpoint, including that it reads from a pre-aggregated
rollup table rather than computing live from raw orders.

Wire revenue cards, trend chart, category breakdown, and Top Products to the
real analytics endpoints. Verify the date-range filter reloads within a
reasonable time. Verify a brand-new seller with no orders yet sees a
friendly empty state rather than broken charts, per App Flow SCR-S08.

When finished: write/update the handoff note at
docs/handoffs/F11-analytics-frontend.md marking F11 fully complete.
```

---

## Day 20 — Feature 12: Payments & Admin Operations (start)

| Field | Detail |
|---|---|
| **Feature** | F12 — Payments & Admin Operations |
| **Task (from playbook)** | Admin Dashboard, User Management, Reports, Platform Config, Wallet/Payout Settings (mock) |
| **Docs to Attach** | Playbook F12, App Flow SCR-AD01–SCR-AD08, SCR-S09 |
| **Mock or Real API** | Mock |
| **Expected Git Commit(s)** | `feat/fe-f12-mock` |
| **End-of-Day Deliverable** | Admin Console and Wallet/Payout screens scaffolded on mocks |
| **Feature Complete?** | N |

**Exact Claude CLI Prompt:**
```
Follow the attached documents exactly as the source of truth — do not introduce
patterns or choices not specified in them. Write simple, clear, well-commented
code appropriate for a small two-person team, not over-engineered. If anything
in the attached documents is unclear, conflicting, or missing something you need
to proceed, STOP and ask me a specific question before writing code — do not guess.
Structure your implementation so future features can extend it without rework:
avoid hardcoded values, keep clear separation of concerns, keep this feature's
interface stable for others to depend on.

Before starting, read docs/handoffs/F3-store-frontend.md to review the
existing wallet-add pattern from Store Setup, since this feature extends it
with settlement history.

Using Playbook F12 and App Flow SCR-AD01 (Admin Dashboard/KPIs), SCR-AD02
(User Management), SCR-AD03 (Payment Management), SCR-AD04 (Returns/Disputes
Queue), SCR-AD05 (Listing Moderation), SCR-AD06 (Config Panel), SCR-AD08
(Audit Log Viewer), and SCR-S09 (seller Wallet/Payout Settings), scaffold
the full Admin Console and the seller Wallet screen — including settlement
history display (read-only, since settled records are immutable) and the
expected COD remittance ledger view — against a mock API.

When finished: write/update the handoff note at
docs/handoffs/F12-admin-frontend.md documenting the mock shapes used for
settlements and admin actions.
```

---

## Day 21 — Feature 12 (finish)

| Field | Detail |
|---|---|
| **Feature** | F12 — Payments & Admin Operations |
| **Task (from playbook)** | Integrate Payments/Wallet/Admin Console; verify immutability and mandatory-reason overrides |
| **Docs to Attach** | `docs/handoffs/F12-payments-backend.md`, `docs/handoffs/F12-admin-backend.md`, Playbook F12, App Flow SCR-AD01–SCR-AD08, SCR-S09 |
| **Mock or Real API** | Real |
| **Expected Git Commit(s)** | `feat/fe-f12-integrate` |
| **End-of-Day Deliverable** | F12 fully complete end-to-end |
| **Feature Complete?** | Y |

**Exact Claude CLI Prompt:**
```
Follow the attached documents exactly as the source of truth — do not introduce
patterns or choices not specified in them. Write simple, clear, well-commented
code appropriate for a small two-person team, not over-engineered. If anything
in the attached documents is unclear, conflicting, or missing something you need
to proceed, STOP and ask me a specific question before writing code — do not guess.
Structure your implementation so future features can extend it without rework:
avoid hardcoded values, keep clear separation of concerns, keep this feature's
interface stable for others to depend on.

Before starting, read docs/handoffs/F12-payments-backend.md and
docs/handoffs/F12-admin-backend.md to understand the real settlement,
wallet, and admin-action endpoints, including exactly how commission is
calculated (confirm it is calculated on the item subtotal, not the total
including shipping).

Wire Wallet/Payout Settings, Settlement history, COD ledger, and the full
Admin Console to real APIs. Explicitly verify: settled financial records
render as read-only with no edit affordance anywhere in the UI; every admin
override action (suspend, ban, payment release, return override) requires a
reason to be entered before the Submit button becomes enabled; the audit log
viewer correctly shows every privileged action taken.

When finished: write/update the handoff note at
docs/handoffs/F12-admin-frontend.md marking F12 fully complete.
```

---

## Day 22 — Feature 13: AI Store Builder

| Field | Detail |
|---|---|
| **Feature** | F13 — AI Store Builder |
| **Task (from playbook)** | Generate Title/Description/Tags/Category/SEO, Edit Output (mock) |
| **Docs to Attach** | Playbook F13, App Flow SCR-S02, PRD REQ-F-Store001–007 |
| **Mock or Real API** | Mock |
| **Expected Git Commit(s)** | `feat/fe-f13-mock` |
| **End-of-Day Deliverable** | AI Store Builder screen scaffolded on mocks |
| **Feature Complete?** | N |

**Exact Claude CLI Prompt:**
```
Follow the attached documents exactly as the source of truth — do not introduce
patterns or choices not specified in them. Write simple, clear, well-commented
code appropriate for a small two-person team, not over-engineered. If anything
in the attached documents is unclear, conflicting, or missing something you need
to proceed, STOP and ask me a specific question before writing code — do not guess.
Structure your implementation so future features can extend it without rework:
avoid hardcoded values, keep clear separation of concerns, keep this feature's
interface stable for others to depend on.

Before starting, read docs/handoffs/F4-products-frontend.md to review the
existing manual product-creation screen, since this feature adds an AI-
assisted path alongside it, not a replacement.

Using Playbook F13, App Flow SCR-S02 (AI Store Builder), and PRD
REQ-F-Store001–007, build: a drag-and-drop image upload zone (JPEG/PNG/WebP,
reject >10MB with a clear inline message), a progress indicator during
generation with all fields locked while generating, editable bilingual
output fields (Title, Description, Category, Tags) once generation
completes, a Retry button on failure/timeout, and Publish/Save Draft
buttons — against a mock API. Publish should require at minimum a title,
one image, and a category, per REQ-F-Store003.

When finished: write/update the handoff note at
docs/handoffs/F13-ai-store-frontend.md documenting the mock generation
response shape used.
```

---

## Day 23 — Feature 13 (finish) → Feature 14 (start)

| Field | Detail |
|---|---|
| **Feature** | F13 (finish) → F14 (start) |
| **Task (from playbook)** | Integrate AI Store Builder; start Image Analysis, Damage Detection, Confidence Score, Recommendation UI (mock) |
| **Docs to Attach** | `docs/handoffs/F13-ai-store-backend.md`, Playbook F14, App Flow SCR-S07, SCR-B10 |
| **Mock or Real API** | Mixed |
| **Expected Git Commit(s)** | `feat/fe-f13-integrate`, `feat/fe-f14-mock` |
| **End-of-Day Deliverable** | F13 fully complete; AI Returns UI elements scaffolded on mocks |
| **Feature Complete?** | F13: Y |

**Exact Claude CLI Prompt:**
```
Follow the attached documents exactly as the source of truth — do not introduce
patterns or choices not specified in them. Write simple, clear, well-commented
code appropriate for a small two-person team, not over-engineered. If anything
in the attached documents is unclear, conflicting, or missing something you need
to proceed, STOP and ask me a specific question before writing code — do not guess.
Structure your implementation so future features can extend it without rework:
avoid hardcoded values, keep clear separation of concerns, keep this feature's
interface stable for others to depend on.

Before starting, read docs/handoffs/F13-ai-store-backend.md to understand
the real listing-generation endpoint, including the exact JSON schema it
returns and how long generation typically takes.

Wire the AI Store Builder to the real endpoint. Verify: the progress bar's
30-second soft target feels honest against real generation time; if the
primary AI model falls back to a secondary model, this is completely
invisible to the seller in the UI — no visible difference in behavior or
messaging; the Retry button works correctly on a real failure/timeout.

Then, using Playbook F14 and App Flow SCR-S07 (seller Returns view) and
SCR-B10 (Returns Wizard), scaffold an AI-assessment badge, image-analysis
report display, and confidence-score indicator to be added onto the existing
Returns screens — against a mock API.

When finished: write/update the handoff note at
docs/handoffs/F13-ai-store-frontend.md marking F13 fully complete, and start
docs/handoffs/F14-ai-returns-frontend.md with the mock AI-assessment shape used.
```

---

## Day 24 — Feature 14 (finish) → Feature 15 (start)

| Field | Detail |
|---|---|
| **Feature** | F14 (finish) → F15 (start) |
| **Task (from playbook)** | Integrate AI Returns; start Sales Insights, Recommendations, Forecasts, Business Suggestions UI (mock) |
| **Docs to Attach** | `docs/handoffs/F14-ai-returns-backend.md`, Playbook F15, App Flow SCR-S08 |
| **Mock or Real API** | Mixed |
| **Expected Git Commit(s)** | `feat/fe-f14-integrate`, `feat/fe-f15-mock` |
| **End-of-Day Deliverable** | F14 fully complete; AI Analytics recommendation card scaffolded on mocks |
| **Feature Complete?** | F14: Y |

**Exact Claude CLI Prompt:**
```
Follow the attached documents exactly as the source of truth — do not introduce
patterns or choices not specified in them. Write simple, clear, well-commented
code appropriate for a small two-person team, not over-engineered. If anything
in the attached documents is unclear, conflicting, or missing something you need
to proceed, STOP and ask me a specific question before writing code — do not guess.
Structure your implementation so future features can extend it without rework:
avoid hardcoded values, keep clear separation of concerns, keep this feature's
interface stable for others to depend on.

Before starting, read docs/handoffs/F14-ai-returns-backend.md to understand
the real return-analysis endpoint and the confidence-threshold routing logic.

Wire the AI-assessment badge and confidence display into the Returns
screens. Explicitly verify: a return with confidence above the platform
threshold shows an auto-decision; a return with confidence below the
threshold, or where the AI call fails, or where the images don't visually
match the listing, always lands in a clearly-labeled manual-review state
visible to both seller and admin — never silently auto-approved.

Then, using Playbook F15 and App Flow SCR-S08 (Analytics Dashboard), scaffold
an AI Recommendation card with a dismiss action against a mock API.

When finished: write/update the handoff note at
docs/handoffs/F14-ai-returns-frontend.md marking F14 fully complete, and
start docs/handoffs/F15-ai-analytics-frontend.md with the mock
recommendation shape used.
```

---

## Day 25 — Feature 15 (finish) → Feature 16 (start)

| Field | Detail |
|---|---|
| **Feature** | F15 (finish) → F16 (start) |
| **Task (from playbook)** | Integrate AI Recommendation card (verify 14-day dismiss); minimal adapter-mode indicator UI |
| **Docs to Attach** | `docs/handoffs/F15-ai-analytics-backend.md`, Playbook F16 |
| **Mock or Real API** | Real |
| **Expected Git Commit(s)** | `feat/fe-f15-integrate`, `feat/fe-f16-minimal` |
| **End-of-Day Deliverable** | F15 fully complete; small admin adapter-mode indicator built |
| **Feature Complete?** | F15: Y |

**Exact Claude CLI Prompt:**
```
Follow the attached documents exactly as the source of truth — do not introduce
patterns or choices not specified in them. Write simple, clear, well-commented
code appropriate for a small two-person team, not over-engineered. If anything
in the attached documents is unclear, conflicting, or missing something you need
to proceed, STOP and ask me a specific question before writing code — do not guess.
Structure your implementation so future features can extend it without rework:
avoid hardcoded values, keep clear separation of concerns, keep this feature's
interface stable for others to depend on.

Before starting, read docs/handoffs/F15-ai-analytics-backend.md to understand
the real recommendation-generation and dismiss endpoints, including exactly
how the 14-day suppression window is calculated.

Wire the AI Recommendation card to real APIs. Verify a dismissed card does
not reappear until the 14-day window has passed. Verify generation happens
asynchronously and never blocks the Analytics Dashboard from loading.

Then, using Playbook F16, build a small admin-facing indicator (dev/staging
only) that shows whether the platform is currently running in mock or live
adapter mode for payments/couriers/SMS — this is a convenience tool, not an
end-user-facing feature.

When finished: write/update the handoff note at
docs/handoffs/F15-ai-analytics-frontend.md marking F15 fully complete, and
docs/handoffs/F16-external-apis-frontend.md noting the indicator built.
```

---

## Day 26 — Feature 17: Final Integration (Day 1 of 2 — shared task board)

| Field | Detail |
|---|---|
| **Feature** | F17 — Final Integration |
| **Task (from playbook)** | Full E2E walkthrough of every screen; log and fix frontend-side integration bugs |
| **Docs to Attach** | Playbook F17, App Flow (full document, especially §1 and §7 flowchart), all previous handoff files |
| **Mock or Real API** | Real (fully integrated system) |
| **Expected Git Commit(s)** | `fix/fe-f17-<bug-desc>` (one per bug fixed) |
| **End-of-Day Deliverable** | First-pass list of cross-feature bugs from full E2E walkthrough fixed |
| **Feature Complete?** | N |

**Exact Claude CLI Prompt:**
```
Follow the attached documents exactly as the source of truth — do not introduce
patterns or choices not specified in them. Write simple, clear, well-commented
code appropriate for a small two-person team, not over-engineered. If anything
in the attached documents is unclear, conflicting, or missing something you need
to proceed, STOP and ask me a specific question before writing code — do not guess.
Structure your implementation so future features can extend it without rework:
avoid hardcoded values, keep clear separation of concerns, keep this feature's
interface stable for others to depend on.

Before starting, read every handoff file in docs/handoffs/ in feature order
to build a full picture of what exists across the entire system.

Using Playbook F17 and the App Flow document's full end-to-end journey
(§1) and the complete textual flowchart (§7), walk through every buyer,
seller, and admin screen in the live application, following each journey
exactly as described: guest browse → register → buy → track → return, and
seller register → setup → list product → receive order → ship → get paid.
Log every frontend-side bug, inconsistency, or broken flow found. Fix each
one with a separate, small commit. Do not fix backend-side issues — flag
those clearly in the shared bug list for CR to pick up instead.

When finished: write/update the handoff note at
docs/handoffs/F17-integration-frontend-day1.md listing every bug fixed and
every backend-side issue flagged for CR.
```

---

## Day 27 — Feature 17: Final Integration (Day 2 of 2 — shared task board)

| Field | Detail |
|---|---|
| **Feature** | F17 — Final Integration |
| **Task (from playbook)** | Continue bug board; verify F16 adapter-mode indicator; RTL/UR polish pass |
| **Docs to Attach** | `docs/handoffs/F17-integration-frontend-day1.md`, `docs/handoffs/F17-integration-backend-day1.md`, Playbook F17 |
| **Mock or Real API** | Real |
| **Expected Git Commit(s)** | `fix/fe-f17-<bug-desc>` |
| **End-of-Day Deliverable** | F17 feature-complete: full journey passes E2E |
| **Feature Complete?** | Y |

**Exact Claude CLI Prompt:**
```
Follow the attached documents exactly as the source of truth — do not introduce
patterns or choices not specified in them. Write simple, clear, well-commented
code appropriate for a small two-person team, not over-engineered. If anything
in the attached documents is unclear, conflicting, or missing something you need
to proceed, STOP and ask me a specific question before writing code — do not guess.
Structure your implementation so future features can extend it without rework:
avoid hardcoded values, keep clear separation of concerns, keep this feature's
interface stable for others to depend on.

Before starting, read docs/handoffs/F17-integration-frontend-day1.md and
docs/handoffs/F17-integration-backend-day1.md to see what was already fixed
and what remains open on the shared bug board.

Using Playbook F17, continue clearing remaining frontend-side bug-board
items. Confirm the adapter-mode indicator built on Day 25 correctly reflects
real backend adapter configuration. Do a full visual pass across every
screen in Urdu with RTL layout active, confirming nothing overlaps, clips,
or misaligns compared to the English/LTR version.

When finished: write/update the handoff note at
docs/handoffs/F17-integration-frontend-final.md confirming F17 is fully
complete and every journey in App Flow §1/§7 passes end-to-end.
```

---

## Day 28 — Feature 18: Testing & Deployment (Day 1 of 3)

| Field | Detail |
|---|---|
| **Feature** | F18 — Testing & Deployment |
| **Task (from playbook)** | Unit Testing, Integration Testing (frontend E2E), accessibility AA audit fixes |
| **Docs to Attach** | Playbook F18, PRD §13.4 (REQ-NF-Quality-007 — WCAG 2.1 AA) |
| **Mock or Real API** | Real |
| **Expected Git Commit(s)** | `test/fe-f18-unit`, `test/fe-f18-e2e`, `fix/fe-f18-a11y` |
| **End-of-Day Deliverable** | Frontend test suites green; AA audit fixes applied |
| **Feature Complete?** | N |

**Exact Claude CLI Prompt:**
```
Follow the attached documents exactly as the source of truth — do not introduce
patterns or choices not specified in them. Write simple, clear, well-commented
code appropriate for a small two-person team, not over-engineered. If anything
in the attached documents is unclear, conflicting, or missing something you need
to proceed, STOP and ask me a specific question before writing code — do not guess.
Structure your implementation so future features can extend it without rework:
avoid hardcoded values, keep clear separation of concerns, keep this feature's
interface stable for others to depend on.

Before starting, read docs/handoffs/F17-integration-frontend-final.md to
confirm the system is stable before testing begins.

Using Playbook F18 and PRD REQ-NF-Quality-007 (WCAG 2.1 AA target), write
or complete frontend unit tests for key components, write end-to-end tests
covering the core buyer and seller journeys, and run an accessibility audit
across both Urdu and English. Fix every AA violation found: contrast ratios,
keyboard navigation, alt text, focus management.

When finished: write/update the handoff note at
docs/handoffs/F18-testing-frontend-day1.md summarizing test coverage and
accessibility fixes made.
```

---

## Day 29 — Feature 18: Testing & Deployment (Day 2 of 3)

| Field | Detail |
|---|---|
| **Feature** | F18 — Testing & Deployment |
| **Task (from playbook)** | Bug Fixes (frontend), cross-platform/browser matrix pass |
| **Docs to Attach** | `docs/handoffs/F18-testing-frontend-day1.md`, Playbook F18, PRD §13.4 (REQ-NF-Quality-009) |
| **Mock or Real API** | Real |
| **Expected Git Commit(s)** | `fix/fe-f18-<platform>` |
| **End-of-Day Deliverable** | Cross-platform matrix (Android/Chrome, iOS/Safari, Windows, macOS/Safari) passes |
| **Feature Complete?** | N |

**Exact Claude CLI Prompt:**
```
Follow the attached documents exactly as the source of truth — do not introduce
patterns or choices not specified in them. Write simple, clear, well-commented
code appropriate for a small two-person team, not over-engineered. If anything
in the attached documents is unclear, conflicting, or missing something you need
to proceed, STOP and ask me a specific question before writing code — do not guess.
Structure your implementation so future features can extend it without rework:
avoid hardcoded values, keep clear separation of concerns, keep this feature's
interface stable for others to depend on.

Before starting, read docs/handoffs/F18-testing-frontend-day1.md to see what
was already tested and fixed.

Using Playbook F18 and PRD REQ-NF-Quality-009 (cross-platform test matrix:
Android/Chrome, iOS/Safari, Windows/Chrome+Edge, macOS/Safari), test the
application across this matrix and fix any platform-specific bugs found —
layout issues, touch-target sizing, font rendering, RTL quirks.

When finished: write/update the handoff note at
docs/handoffs/F18-testing-frontend-day2.md summarizing the cross-platform
results and fixes made.
```

---

## Day 30 — Feature 18: Testing & Deployment (Day 3 of 3 — Final Demo)

| Field | Detail |
|---|---|
| **Feature** | F18 — Testing & Deployment |
| **Task (from playbook)** | Final Demo prep (frontend polish, demo script walkthrough) |
| **Docs to Attach** | `docs/handoffs/F18-testing-frontend-day2.md`, Playbook F18, Implementation Plan §24 (Launch Checklist) |
| **Mock or Real API** | Real |
| **Expected Git Commit(s)** | `chore/fe-f18-demo-polish` |
| **End-of-Day Deliverable** | UI polish pass complete; demo script rehearsed screen-by-screen |
| **Feature Complete?** | Y — **PROJECT COMPLETE** |

**Exact Claude CLI Prompt:**
```
Follow the attached documents exactly as the source of truth — do not introduce
patterns or choices not specified in them. Write simple, clear, well-commented
code appropriate for a small two-person team, not over-engineered. If anything
in the attached documents is unclear, conflicting, or missing something you need
to proceed, STOP and ask me a specific question before writing code — do not guess.
Structure your implementation so future features can extend it without rework:
avoid hardcoded values, keep clear separation of concerns, keep this feature's
interface stable for others to depend on.

Before starting, read docs/handoffs/F18-testing-frontend-day2.md to confirm
all known issues are resolved.

Using Playbook F18 and the Implementation Plan's Launch Checklist, do a
final visual polish pass across every screen in both languages, and prepare
a written demo script that walks through the flagship journeys (AI Store
Builder, buyer checkout with live tracking, a return with AI-assisted
review) in a clear, presentable order.

When finished: write the final handoff note at
docs/handoffs/F18-testing-frontend-final.md confirming the frontend is
demo-ready and the project is complete from the frontend side.
```
```

```markdown
# CR-SCHEDULE.md — Backend Execution Schedule

## Day 1 — Feature 0: Project Foundation

| Field | Detail |
|---|---|
| **Feature** | F0 — Project Foundation |
| **Task (from playbook)** | GitHub Repository, Project Setup, Folder Structure, Coding Standards, Branch Strategy, Development Environment, Backend Setup, Database Setup |
| **Docs to Attach** | Playbook F0, Schema (full document + §14/§15 addenda), TRD §5, TRD §12 |
| **Mock or Real API** | N/A |
| **Expected Git Commit(s)** | `feat/be-f0-setup` |
| **End-of-Day Deliverable** | `docker compose up` boots the full stack; complete `schema.prisma` migrated and seeded; CI pipeline green on empty PR |
| **Feature Complete?** | N |

**Exact Claude CLI Prompt:**
```
Follow the attached documents exactly as the source of truth — do not introduce
patterns or choices not specified in them. Write simple, clear, well-commented
code appropriate for a small two-person team, not over-engineered. If anything
in the attached documents is unclear, conflicting, or missing something you need
to proceed, STOP and ask me a specific question before writing code — do not guess.
Structure your implementation so future features can extend it without rework:
avoid hardcoded values, keep clear separation of concerns, keep this feature's
interface stable for others to depend on.

This is Day 1 — there is no previous handoff file yet, so skip that step.

Using Playbook F0, the complete Schema document including addenda §14 (schema
corrections) and §15 (audit follow-ups), and TRD §5 (Backend Technology
Stack) and §12 (Folder Structure), set up the repository: monorepo structure
exactly as TRD §12 specifies (apps/web, apps/api, apps/ai-service,
packages/shared, infra), Docker Compose covering web/api/ai-service/postgres/
redis/nginx, coding-standard configs (ESLint/Prettier, Flake8/Black), branch-
protection-ready GitHub Actions CI (lint+test+build), the Node.js/Express/
TypeScript backend skeleton, and the complete schema.prisma file covering
every table in Schema §1–§13 plus every addition from §14 and §15 (including
the payout_wallets table, the orders shipping-address encryption split, the
seller_daily_stats and seller_recommendations tables, and the seller_id
denormalization on returns). Run the initial migration and seed categories +
platform_config defaults.

When finished: write a handoff note at docs/handoffs/F0-foundation-backend.md
summarizing the exact folder structure created, confirming schema.prisma
includes every addendum item, and noting anything left incomplete for
tomorrow.
```

---

## Day 2 — Feature 1: Authentication (Part 1)

| Field | Detail |
|---|---|
| **Feature** | F1 — Authentication |
| **Task (from playbook)** | Login, Register, OTP, JWT (part 1 of 2) |
| **Docs to Attach** | `docs/handoffs/F0-foundation-backend.md`, Playbook F1, Schema §4.1, §4.23, TRD §7 |
| **Mock or Real API** | N/A (backend build day) |
| **Expected Git Commit(s)** | `feat/be-f1-auth-p1` |
| **End-of-Day Deliverable** | Register, OTP verify, JWT-based Login endpoints working, tested, Swagger-documented |
| **Feature Complete?** | N |

**Exact Claude CLI Prompt:**
```
Follow the attached documents exactly as the source of truth — do not introduce
patterns or choices not specified in them. Write simple, clear, well-commented
code appropriate for a small two-person team, not over-engineered. If anything
in the attached documents is unclear, conflicting, or missing something you need
to proceed, STOP and ask me a specific question before writing code — do not guess.
Structure your implementation so future features can extend it without rework:
avoid hardcoded values, keep clear separation of concerns, keep this feature's
interface stable for others to depend on.

Before starting, read docs/handoffs/F0-foundation-backend.md to understand
the folder structure and schema already in place.

Using Playbook F1, Schema §4.1 (users table) and §4.23 (refresh_tokens), and
TRD §7 (Authentication Strategy), implement: mobile-number + SMS-OTP
registration (via the mock SmsAdapter from F0's adapter skeleton) and email +
password registration, OTP generate/verify backed by Redis with a 10-minute
TTL and hashed storage, bcrypt password hashing at cost 12, and JWT RS256
access-token issuance plus login. Write unit and integration tests for the
OTP lifecycle and login flow. Document every endpoint in Swagger.

When finished: write a handoff note at docs/handoffs/F1-auth-backend.md
documenting the exact JWT payload shape (sub, role, jti), the OTP request/
response shapes, and any deviation from the playbook.
```

---

## Day 3 — Feature 1 (Part 2)

| Field | Detail |
|---|---|
| **Feature** | F1 — Authentication |
| **Task (from playbook)** | Forgot Password, Reset Password, RBAC, Logout, Session Handling |
| **Docs to Attach** | `docs/handoffs/F1-auth-backend.md`, Playbook F1, Schema §4.1, §4.23, TRD §8 |
| **Mock or Real API** | N/A |
| **Expected Git Commit(s)** | `feat/be-f1-auth-p2` |
| **End-of-Day Deliverable** | Forgot/reset password, RBAC middleware, logout, refresh rotation, and lockout all working, tested, documented |
| **Feature Complete?** | Y (backend side) |

**Exact Claude CLI Prompt:**
```
Follow the attached documents exactly as the source of truth — do not introduce
patterns or choices not specified in them. Write simple, clear, well-commented
code appropriate for a small two-person team, not over-engineered. If anything
in the attached documents is unclear, conflicting, or missing something you need
to proceed, STOP and ask me a specific question before writing code — do not guess.
Structure your implementation so future features can extend it without rework:
avoid hardcoded values, keep clear separation of concerns, keep this feature's
interface stable for others to depend on.

Before starting, read docs/handoffs/F1-auth-backend.md to understand the
existing register/OTP/login implementation before extending it.

Using Playbook F1 and TRD §8 (Authorization Strategy), implement:
forgot-password (single-use, expiring reset token), reset-password, RBAC
middleware (authenticate → authorize(roles) → ownership chain), logout with
immediate refresh-token revocation via a Redis jti denylist, and account
lockout after 5 failed logins in 15 minutes (30-minute lock). Write tests
covering token rotation, revocation-on-suspend, and RBAC denial cases
(401/403). Document every endpoint in Swagger.

When finished: write/update the handoff note at
docs/handoffs/F1-auth-backend.md marking the backend side of F1 fully
complete, and confirm the exact cookie name/flags used for the refresh
token so the frontend integrates correctly.
```

---

## Day 4 — Feature 2: User Profiles

| Field | Detail |
|---|---|
| **Feature** | F2 — User Profiles |
| **Task (from playbook)** | Buyer Profile, Seller Profile, Admin Profile, Edit Profile, Profile Picture, Settings, Change Password |
| **Docs to Attach** | `docs/handoffs/F1-auth-backend.md`, Playbook F2, Schema §4.2–§4.4, TRD §9 |
| **Mock or Real API** | N/A |
| **Expected Git Commit(s)** | `feat/be-f2-profiles` |
| **End-of-Day Deliverable** | Profile CRUD, address CRUD, picture upload, change-password endpoints working, tested, documented |
| **Feature Complete?** | Y (backend side) |

**Exact Claude CLI Prompt:**
```
Follow the attached documents exactly as the source of truth — do not introduce
patterns or choices not specified in them. Write simple, clear, well-commented
code appropriate for a small two-person team, not over-engineered. If anything
in the attached documents is unclear, conflicting, or missing something you need
to proceed, STOP and ask me a specific question before writing code — do not guess.
Structure your implementation so future features can extend it without rework:
avoid hardcoded values, keep clear separation of concerns, keep this feature's
interface stable for others to depend on.

Before starting, read docs/handoffs/F1-auth-backend.md to confirm how
authenticated requests carry the user's identity into this feature's
endpoints.

Using Playbook F2, Schema §4.2 (seller_profiles), §4.3 (buyer_profiles), and
§4.4 (addresses), and TRD §9 (API Design Standards), implement profile
read/update for buyer/seller/admin, address CRUD with default-address logic,
ownership checks (a buyer can only touch their own addresses), profile
picture upload with server-side validation, and change-password with
re-authentication required. Write tests confirming ownership violations
return 403 and the default-address swap is transactionally correct.
Document every endpoint in Swagger.

When finished: write a handoff note at docs/handoffs/F2-profiles-backend.md
documenting the profile/address response shapes.
```

---

## Day 5 — Buffer / Catch-Up

| Field | Detail |
|---|---|
| **Feature** | Buffer |
| **Task (from playbook)** | Absorb any delay from F0–F2; fix flagged issues; start F3 backend prep if on schedule |
| **Docs to Attach** | All handoffs so far, Playbook F3, Schema §4.2, §14.1, §15.6 |
| **Mock or Real API** | N/A |
| **Expected Git Commit(s)** | `fix/be-f0-f2-<desc>` or `feat/be-f3-store` if ahead of schedule |
| **End-of-Day Deliverable** | All open issues from F0–F2 resolved, or F3 backend started early |
| **Feature Complete?** | — |

**Exact Claude CLI Prompt:**
```
Follow the attached documents exactly as the source of truth — do not introduce
patterns or choices not specified in them. Write simple, clear, well-commented
code appropriate for a small two-person team, not over-engineered. If anything
in the attached documents is unclear, conflicting, or missing something you need
to proceed, STOP and ask me a specific question before writing code — do not guess.
Structure your implementation so future features can extend it without rework:
avoid hardcoded values, keep clear separation of concerns, keep this feature's
interface stable for others to depend on.

Before starting, read every handoff file from F0 through F2 and check the
frontend handoffs for any backend-side issues flagged during integration.

If any issues are flagged: fix them, following the same document-grounding
and simplicity rules as every other session. If nothing is flagged and the
schedule is on track, begin Playbook F3 (Store Management) early using
Schema §4.2 and addenda §14.1 (payout_wallets table) and §15.6 (onboarding
step tracking) — implement the payout_wallets table's repository and service
layer as a head start.

When finished: write/update the relevant handoff file(s) reflecting whichever
path was taken today.
```

---

## Day 6 — Feature 3: Store Management

| Field | Detail |
|---|---|
| **Feature** | F3 — Store Management |
| **Task (from playbook)** | Create Store, Edit Store, Store Banner, Store Logo, Business Information, Store Settings, Store Status |
| **Docs to Attach** | Playbook F3, Schema §4.2, §14.1, §15.6 |
| **Mock or Real API** | N/A |
| **Expected Git Commit(s)** | `feat/be-f3-store` |
| **End-of-Day Deliverable** | Store CRUD, wallet CRUD, wizard-step tracking endpoints working, tested, documented |
| **Feature Complete?** | Y (backend side) |

**Exact Claude CLI Prompt:**
```
Follow the attached documents exactly as the source of truth — do not introduce
patterns or choices not specified in them. Write simple, clear, well-commented
code appropriate for a small two-person team, not over-engineered. If anything
in the attached documents is unclear, conflicting, or missing something you need
to proceed, STOP and ask me a specific question before writing code — do not guess.
Structure your implementation so future features can extend it without rework:
avoid hardcoded values, keep clear separation of concerns, keep this feature's
interface stable for others to depend on.

Before starting, read docs/handoffs/F2-profiles-backend.md to build on the
existing seller_profiles implementation.

Using Playbook F3, Schema §4.2 (seller_profiles) with addenda §14.1
(payout_wallets table — supports multiple wallets per seller with a single
default) and §15.6 (onboarding_step / onboarding_completed_at fields),
implement: store create/edit, banner/logo upload, business information,
store status toggle, payout wallet add/list/set-default (enforce exactly one
default per seller in a transaction), and wizard step-tracking that
increments as each step completes. Block selling-feature access while
onboarding_completed_at is null, per REQ-F-Auth005. Write tests covering
resumability, the wallet-default-swap transaction, and the onboarding block.
Document every endpoint in Swagger.

When finished: write a handoff note at docs/handoffs/F3-store-backend.md
documenting the wallet list shape and the onboarding_step field's exact
values/meaning.
```

---

## Day 7 — Feature 4: Product Management (Part 1)

| Field | Detail |
|---|---|
| **Feature** | F4 — Product Management |
| **Task (from playbook)** | Categories, Add Product, Edit Product, Delete Product, Inventory |
| **Docs to Attach** | `docs/handoffs/F3-store-backend.md`, Playbook F4, Schema §4.5, §4.6, TRD §6 |
| **Mock or Real API** | N/A |
| **Expected Git Commit(s)** | `feat/be-f4-product-p1` |
| **End-of-Day Deliverable** | Category CRUD, Product CRUD, atomic stock decrement, oversell guard working, tested, documented |
| **Feature Complete?** | N |

**Exact Claude CLI Prompt:**
```
Follow the attached documents exactly as the source of truth — do not introduce
patterns or choices not specified in them. Write simple, clear, well-commented
code appropriate for a small two-person team, not over-engineered. If anything
in the attached documents is unclear, conflicting, or missing something you need
to proceed, STOP and ask me a specific question before writing code — do not guess.
Structure your implementation so future features can extend it without rework:
avoid hardcoded values, keep clear separation of concerns, keep this feature's
interface stable for others to depend on.

Before starting, read docs/handoffs/F3-store-backend.md to confirm a seller
must have completed onboarding before creating products.

Using Playbook F4, Schema §4.5 (categories) and §4.6 (products), and TRD §6
(Database Technology), implement Category CRUD, Product CRUD (create/edit/
delete with soft-delete blocked when active orders exist), and atomic stock
decrement with an oversell guard using a database-level check, not just
application logic, so concurrent requests can't oversell. Write tests
including a concurrent-request test to prove the oversell guard actually
holds under race conditions. Document every endpoint in Swagger.

When finished: write a handoff note at docs/handoffs/F4-products-backend-p1.md
documenting the product CRUD shapes and the oversell-guard error code.
```

---

## Day 8 — Feature 4 (Part 2)

| Field | Detail |
|---|---|
| **Feature** | F4 — Product Management |
| **Task (from playbook)** | Product Details, Images, Search |
| **Docs to Attach** | `docs/handoffs/F4-products-backend-p1.md`, Playbook F4, Schema §4.6, §4.7, §7 (FTS) |
| **Mock or Real API** | N/A |
| **Expected Git Commit(s)** | `feat/be-f4-product-p2` |
| **End-of-Day Deliverable** | Product-detail endpoint, image upload with validation, full-text search all working, tested, documented |
| **Feature Complete?** | Y (backend side) |

**Exact Claude CLI Prompt:**
```
Follow the attached documents exactly as the source of truth — do not introduce
patterns or choices not specified in them. Write simple, clear, well-commented
code appropriate for a small two-person team, not over-engineered. If anything
in the attached documents is unclear, conflicting, or missing something you need
to proceed, STOP and ask me a specific question before writing code — do not guess.
Structure your implementation so future features can extend it without rework:
avoid hardcoded values, keep clear separation of concerns, keep this feature's
interface stable for others to depend on.

Before starting, read docs/handoffs/F4-products-backend-p1.md to build on
the existing product CRUD implementation.

Using Playbook F4, Schema §4.6/§4.7, and §7 (Indexes & Query Optimization —
tsvector full-text search setup), implement: a product-detail endpoint,
image upload with server-side magic-byte validation and compression, and
full-text search over the tsvector column covering Urdu and English title/
description/tags. Write tests confirming both Urdu and English queries hit
the GIN index correctly and return relevant results. Document every endpoint
in Swagger.

When finished: write/update the handoff note at
docs/handoffs/F4-products-backend-p2.md marking F4 fully complete on the
backend side, documenting the image-upload contract and search query params.
```

---

## Day 9 — Feature 5: Buyer Marketplace

| Field | Detail |
|---|---|
| **Feature** | F5 — Buyer Marketplace |
| **Task (from playbook)** | Homepage, Search, Categories, Product Details, Wishlist, Filters |
| **Docs to Attach** | `docs/handoffs/F4-products-backend-p2.md`, Playbook F5, Schema §4.5–§4.7, §7 |
| **Mock or Real API** | N/A |
| **Expected Git Commit(s)** | `feat/be-f5-marketplace` |
| **End-of-Day Deliverable** | Homepage feed, search/filter/sort, category browse, wishlist endpoints working, tested, documented |
| **Feature Complete?** | Y (backend side) |

**Exact Claude CLI Prompt:**
```
Follow the attached documents exactly as the source of truth — do not introduce
patterns or choices not specified in them. Write simple, clear, well-commented
code appropriate for a small two-person team, not over-engineered. If anything
in the attached documents is unclear, conflicting, or missing something you need
to proceed, STOP and ask me a specific question before writing code — do not guess.
Structure your implementation so future features can extend it without rework:
avoid hardcoded values, keep clear separation of concerns, keep this feature's
interface stable for others to depend on.

Before starting, read docs/handoffs/F4-products-backend-p2.md to build on
the existing search implementation rather than duplicating it.

Using Playbook F5 and Schema §7 (FTS query optimization), implement a
homepage feed endpoint, filter+sort composition on top of the existing
search, category browse, and wishlist backend (add/remove/list). Write
tests for filter combination correctness (category + price range + rating
together) and confirm out-of-stock products are excluded from default
results. Document every endpoint in Swagger.

When finished: write a handoff note at docs/handoffs/F5-marketplace-backend.md
documenting the homepage/filter/wishlist endpoint shapes.
```

---

## Day 10 — Feature 6: Cart & Checkout (Part 1)

| Field | Detail |
|---|---|
| **Feature** | F6 — Cart & Checkout |
| **Task (from playbook)** | Cart, Quantity, Remove Item, Address |
| **Docs to Attach** | `docs/handoffs/F5-marketplace-backend.md`, Playbook F6, Schema §4.8, §4.9, §4.4 |
| **Mock or Real API** | N/A |
| **Expected Git Commit(s)** | `feat/be-f6-cart-p1` |
| **End-of-Day Deliverable** | Persisted cart CRUD, quantity update, remove-item, address selection working, tested, documented |
| **Feature Complete?** | N |

**Exact Claude CLI Prompt:**
```
Follow the attached documents exactly as the source of truth — do not introduce
patterns or choices not specified in them. Write simple, clear, well-commented
code appropriate for a small two-person team, not over-engineered. If anything
in the attached documents is unclear, conflicting, or missing something you need
to proceed, STOP and ask me a specific question before writing code — do not guess.
Structure your implementation so future features can extend it without rework:
avoid hardcoded values, keep clear separation of concerns, keep this feature's
interface stable for others to depend on.

Before starting, read docs/handoffs/F5-marketplace-backend.md to confirm
which product endpoints the cart will reference.

Using Playbook F6 and Schema §4.8 (carts) and §4.9 (cart_items), implement
persisted cart CRUD (buyer_id-scoped, so it works cross-device by design
since it's database-backed, not session-backed), quantity update against
current stock, remove-item, and address selection reusing the addresses
endpoint from Feature 2. Write tests confirming the cart persists correctly
across two separate logins for the same buyer. Document every endpoint in
Swagger.

When finished: write a handoff note at docs/handoffs/F6-cart-backend-p1.md
documenting the cart response shape.
```

---

## Day 11 — Feature 6 (Part 2)

| Field | Detail |
|---|---|
| **Feature** | F6 — Cart & Checkout |
| **Task (from playbook)** | Checkout, Shipping, Payment Selection |
| **Docs to Attach** | `docs/handoffs/F6-cart-backend-p1.md`, Playbook F6, Schema §4.10, §14.2, §14.4 |
| **Mock or Real API** | N/A |
| **Expected Git Commit(s)** | `feat/be-f6-checkout-p2` |
| **End-of-Day Deliverable** | Checkout with multi-seller split, idempotency, min-order enforcement working, tested, documented |
| **Feature Complete?** | Y (backend side) — **Financial-sensitive, self-review carefully before merging** |

**Exact Claude CLI Prompt:**
```
Follow the attached documents exactly as the source of truth — do not introduce
patterns or choices not specified in them. Write simple, clear, well-commented
code appropriate for a small two-person team, not over-engineered. If anything
in the attached documents is unclear, conflicting, or missing something you need
to proceed, STOP and ask me a specific question before writing code — do not guess.
Structure your implementation so future features can extend it without rework:
avoid hardcoded values, keep clear separation of concerns, keep this feature's
interface stable for others to depend on.

Before starting, read docs/handoffs/F6-cart-backend-p1.md to build on the
existing cart implementation.

Using Playbook F6, Schema §4.10 (orders) with addendum §14.2 (binding rule:
settlements.gross is calculated from subtotal, never total_amount which
includes shipping) and §14.4 (ship_city and ship_province must be stored as
plain text, not encrypted, so courier logistics can filter by city later),
implement checkout: multi-seller cart splits into one order per seller,
each with its own shipping-fee line (buyer pays shipping — never bundle
into item subtotal), minimum-order-value enforcement per resulting order,
idempotency-key middleware on the checkout endpoint so duplicate submissions
never create duplicate orders, and a mock-payment-adapter kickoff. Write
tests proving a two-seller cart produces exactly two orders, idempotency
blocks a duplicate submit, and below-minimum is rejected with a stable error
code. This touches money — self-review this code extra carefully against
the addendum rules before merging. Document every endpoint in Swagger.

When finished: write/update the handoff note at
docs/handoffs/F6-cart-backend-p2.md marking F6 fully complete on the
backend side, explicitly confirming the gross/commission calculation
follows §14.2 exactly, and flagging this as a financial-sensitive feature
that was self-reviewed.
```

---

## Day 12 — Feature 7: Orders

| Field | Detail |
|---|---|
| **Feature** | F7 — Orders |
| **Task (from playbook)** | Place Order, Seller Orders, Buyer Orders, Order Details, Order Status, Invoice |
| **Docs to Attach** | `docs/handoffs/F6-cart-backend-p2.md`, Playbook F7, Schema §4.10, §4.11, §15.3 |
| **Mock or Real API** | N/A |
| **Expected Git Commit(s)** | `feat/be-f7-orders` |
| **End-of-Day Deliverable** | Order state machine, seller/buyer order queries, order detail, invoice working, tested, documented |
| **Feature Complete?** | Y (backend side) |

**Exact Claude CLI Prompt:**
```
Follow the attached documents exactly as the source of truth — do not introduce
patterns or choices not specified in them. Write simple, clear, well-commented
code appropriate for a small two-person team, not over-engineered. If anything
in the attached documents is unclear, conflicting, or missing something you need
to proceed, STOP and ask me a specific question before writing code — do not guess.
Structure your implementation so future features can extend it without rework:
avoid hardcoded values, keep clear separation of concerns, keep this feature's
interface stable for others to depend on.

Before starting, read docs/handoffs/F6-cart-backend-p2.md to understand how
checkout creates orders, since this feature manages their lifecycle.

Using Playbook F7, Schema §4.10/§4.11 with the binding decision in addendum
§15.3 (tracking_events is the single system of record for every order-status
transition, not just courier-driven ones), implement the order state
machine with a single source of valid transitions, seller/buyer order
queries, order-detail, and invoice generation. Every single status change —
whether from the payment webhook, an admin action, or the checkout service
setting the initial status — must write a tracking_events row in the same
transaction as the status update. Write tests confirming invalid transitions
are rejected and every transition produces a tracking_events row. Document
every endpoint in Swagger.

When finished: write a handoff note at docs/handoffs/F7-orders-backend.md
documenting the order_status enum values and the tracking_events writing
rule so every future feature that touches order status knows to follow it.
```

---

## Day 13 — Feature 8: Courier & Tracking

| Field | Detail |
|---|---|
| **Feature** | F8 — Courier & Tracking |
| **Task (from playbook)** | Select Courier, Book Shipment, Tracking, Shipment Timeline, Delivery Status (mock first) |
| **Docs to Attach** | `docs/handoffs/F7-orders-backend.md`, Playbook F8, Schema §4.21, §4.22, §14.3, TRD §3 |
| **Mock or Real API** | N/A |
| **Expected Git Commit(s)** | `feat/be-f8-courier` |
| **End-of-Day Deliverable** | Mock courier scoring/booking, retry/fallback, poll job, WebSocket push all working, tested, documented |
| **Feature Complete?** | Y (backend side) |

**Exact Claude CLI Prompt:**
```
Follow the attached documents exactly as the source of truth — do not introduce
patterns or choices not specified in them. Write simple, clear, well-commented
code appropriate for a small two-person team, not over-engineered. If anything
in the attached documents is unclear, conflicting, or missing something you need
to proceed, STOP and ask me a specific question before writing code — do not guess.
Structure your implementation so future features can extend it without rework:
avoid hardcoded values, keep clear separation of concerns, keep this feature's
interface stable for others to depend on.

Before starting, read docs/handoffs/F7-orders-backend.md to confirm exactly
how order status transitions must be recorded, since courier events feed
into the same tracking_events table.

Using Playbook F8, Schema §4.21 (tracking_events) and §4.22 (courier_quotes)
with addendum §14.3 (a courier payables ledger is explicitly out of scope
for MVP — do not build one), and TRD §3 (design patterns — Adapter, Circuit
breaker + retry), implement: parallel mock-courier-adapter calls with a 10s
timeout each, weighted scoring (cost 40% / time 30% / reliability 20% /
coverage 10%, admin-configurable via platform_config), COD-coverage
filtering using the plain-text ship_city column from Feature 6, retry ×3
at 30s intervals then fall back to next-best courier, a
PENDING_MANUAL_LOGISTICS fallback if all adapters fail, a 5-minute polling
job, and Socket.IO push on status change. Write tests covering the
all-adapters-fail path and confirming COD orders only route to COD-capable
couriers. Document every endpoint in Swagger.

When finished: write a handoff note at docs/handoffs/F8-courier-backend.md
documenting the Socket.IO namespace/event names and the courier-quote
response shape.
```

---

## Day 14 — Feature 9: Notifications

| Field | Detail |
|---|---|
| **Feature** | F9 — Notifications |
| **Task (from playbook)** | In-App, Email, SMS, WhatsApp, Notification Center (mock first) |
| **Docs to Attach** | `docs/handoffs/F7-orders-backend.md`, Playbook F9, Schema §4.19, §4.20 |
| **Mock or Real API** | N/A |
| **Expected Git Commit(s)** | `feat/be-f9-notif` |
| **End-of-Day Deliverable** | BullMQ producer/consumer, mock adapters, in-app bell backend, preferences working, tested, documented |
| **Feature Complete?** | Y (backend side) |

**Exact Claude CLI Prompt:**
```
Follow the attached documents exactly as the source of truth — do not introduce
patterns or choices not specified in them. Write simple, clear, well-commented
code appropriate for a small two-person team, not over-engineered. If anything
in the attached documents is unclear, conflicting, or missing something you need
to proceed, STOP and ask me a specific question before writing code — do not guess.
Structure your implementation so future features can extend it without rework:
avoid hardcoded values, keep clear separation of concerns, keep this feature's
interface stable for others to depend on.

Before starting, read docs/handoffs/F7-orders-backend.md to know which order
lifecycle events this feature needs to listen for. This feature only
requires F7's events to exist, not F8 — it can proceed even if courier
integration is still finishing.

Using Playbook F9 and Schema §4.19 (notifications) and §4.20
(notification_preferences), implement a BullMQ producer that enqueues a job
on every lifecycle event, a consumer that dispatches via mock SMS/Email/
WhatsApp adapters, in-app bell backend (list + mark-read), and preferences
with critical notification types hardcoded as non-disableable server-side
(not just client-side — the server must reject an attempt to disable a
critical type). Write tests for queue idempotency (a duplicate job doesn't
double-send) and confirm critical toggles can't be disabled via a direct API
call. Document every endpoint in Swagger.

When finished: write a handoff note at docs/handoffs/F9-notifications-backend.md
documenting the notification list/preferences response shapes and the exact
event_type strings used.
```

---

## Day 15 — Buffer / Catch-Up + Feature 10 Prep

| Field | Detail |
|---|---|
| **Feature** | Buffer → F10 prep |
| **Task (from playbook)** | Absorb delay from F6–F9; start Returns backend if on schedule |
| **Docs to Attach** | All handoffs so far, Playbook F10, Schema §4.15–§4.17, §14.5, §15.5 |
| **Mock or Real API** | N/A |
| **Expected Git Commit(s)** | `fix/be-f6-f9-<desc>` or `feat/be-f10-returns` if ahead |
| **End-of-Day Deliverable** | Open issues resolved, or F10 backend started early |
| **Feature Complete?** | — |

**Exact Claude CLI Prompt:**
```
Follow the attached documents exactly as the source of truth — do not introduce
patterns or choices not specified in them. Write simple, clear, well-commented
code appropriate for a small two-person team, not over-engineered. If anything
in the attached documents is unclear, conflicting, or missing something you need
to proceed, STOP and ask me a specific question before writing code — do not guess.
Structure your implementation so future features can extend it without rework:
avoid hardcoded values, keep clear separation of concerns, keep this feature's
interface stable for others to depend on.

Before starting, read every handoff file from F6 through F9 and check the
frontend handoffs for any backend-side issues flagged during integration.

If any issues are flagged: fix them first. If nothing is flagged and the
schedule is on track, begin Playbook F10 (Returns & Refunds) early using
Schema §4.15–§4.17 and addenda §14.5 (returns table has no soft-delete —
status enum is the lifecycle mechanism, not deleted_at) and §15.5 (seller_id
denormalized onto returns for fraud-rate performance) — implement the
returns repository layer and the 14-day-window/one-per-order check as a
head start.

When finished: write/update the relevant handoff file(s).
```

---

## Day 16 — Feature 10: Returns & Refunds

| Field | Detail |
|---|---|
| **Feature** | F10 — Returns & Refunds |
| **Task (from playbook)** | Return Request, Upload Images, Seller Review, Admin Review, Refund Status, Return History |
| **Docs to Attach** | `docs/handoffs/F7-orders-backend.md`, Playbook F10, Schema §4.15–§4.17, §14.5, §15.5 |
| **Mock or Real API** | N/A |
| **Expected Git Commit(s)** | `feat/be-f10-returns` |
| **End-of-Day Deliverable** | Return creation, review, refund-trigger, history endpoints working, tested, documented |
| **Feature Complete?** | Y (backend side) |

**Exact Claude CLI Prompt:**
```
Follow the attached documents exactly as the source of truth — do not introduce
patterns or choices not specified in them. Write simple, clear, well-commented
code appropriate for a small two-person team, not over-engineered. If anything
in the attached documents is unclear, conflicting, or missing something you need
to proceed, STOP and ask me a specific question before writing code — do not guess.
Structure your implementation so future features can extend it without rework:
avoid hardcoded values, keep clear separation of concerns, keep this feature's
interface stable for others to depend on.

Before starting, read docs/handoffs/F7-orders-backend.md to confirm a return
can only be created against a delivered order.

Using Playbook F10, Schema §4.15 (returns), §4.16 (return_images), §4.17
(disputes), with addenda §14.5 (no soft-delete on returns — use the status
enum's CLOSED value instead) and §15.5 (seller_id is denormalized onto
returns at creation time, copied from the order, never joined at read time),
implement: return creation with the 14-day window check and one-return-per-
order enforcement, a ≥3-photo requirement before submission is accepted,
seller/admin review actions, refund-trigger on approval, and return history
retrieval. Write tests confirming window-closed rejection, second-return-
blocked, and that appeal resolution is treated as final. Document every
endpoint in Swagger.

When finished: write a handoff note at docs/handoffs/F10-returns-backend.md
documenting the return-request and review response shapes.
```

---

## Day 17 — Feature 11: Analytics Dashboard

| Field | Detail |
|---|---|
| **Feature** | F11 — Analytics Dashboard |
| **Task (from playbook)** | Revenue, Sales, Orders, Customers, Charts, Top Products |
| **Docs to Attach** | `docs/handoffs/F10-returns-backend.md`, Playbook F11, Schema §15.1 |
| **Mock or Real API** | N/A |
| **Expected Git Commit(s)** | `feat/be-f11-analytics` |
| **End-of-Day Deliverable** | Rollup job and analytics query endpoints working, tested, documented |
| **Feature Complete?** | Y (backend side) |

**Exact Claude CLI Prompt:**
```
Follow the attached documents exactly as the source of truth — do not introduce
patterns or choices not specified in them. Write simple, clear, well-commented
code appropriate for a small two-person team, not over-engineered. If anything
in the attached documents is unclear, conflicting, or missing something you need
to proceed, STOP and ask me a specific question before writing code — do not guess.
Structure your implementation so future features can extend it without rework:
avoid hardcoded values, keep clear separation of concerns, keep this feature's
interface stable for others to depend on.

Before starting, read docs/handoffs/F10-returns-backend.md to know how
return-rate metrics can be derived alongside revenue metrics.

Using Playbook F11 and addendum §15.1 (seller_daily_stats rollup table —
binding rule: this must be populated asynchronously via a scheduled job on
order settlement plus a nightly backfill, and must never be computed
synchronously inside a request), implement the rollup job and the analytics
query endpoints (revenue cards, sales trend, orders, customers, top products,
date-range filter) reading only from the rollup table, never scanning raw
orders live. Write tests spot-checking rollup correctness against a manually
summed sample and confirming date-range filtering works correctly. Document
every endpoint in Swagger.

When finished: write a handoff note at docs/handoffs/F11-analytics-backend.md
documenting the analytics response shape and confirming the rollup job's
trigger schedule.
```

---

## Day 18 — Feature 12: Payments & Admin Operations (Part 1)

| Field | Detail |
|---|---|
| **Feature** | F12 — Payments & Admin Operations |
| **Task (from playbook)** | Payment Webhooks, Retry Logic, Settlement, COD Ledger |
| **Docs to Attach** | `docs/handoffs/F6-cart-backend-p2.md`, Playbook F12, Schema §4.12–§4.14, §14.1, §14.2 |
| **Mock or Real API** | N/A |
| **Expected Git Commit(s)** | `feat/be-f12-payments` |
| **End-of-Day Deliverable** | Mock payment webhooks with HMAC verify, retry logic, settlement engine, COD ledger working, tested, documented |
| **Feature Complete?** | N — **Financial-sensitive, self-review carefully before merging** |

**Exact Claude CLI Prompt:**
```
Follow the attached documents exactly as the source of truth — do not introduce
patterns or choices not specified in them. Write simple, clear, well-commented
code appropriate for a small two-person team, not over-engineered. If anything
in the attached documents is unclear, conflicting, or missing something you need
to proceed, STOP and ask me a specific question before writing code — do not guess.
Structure your implementation so future features can extend it without rework:
avoid hardcoded values, keep clear separation of concerns, keep this feature's
interface stable for others to depend on.

Before starting, read docs/handoffs/F6-cart-backend-p2.md to reconfirm the
gross/commission calculation rule and the idempotency-key pattern already
established, since this feature extends both.

Using Playbook F12, Schema §4.12 (payments), §4.13 (settlements), §4.14
(cod_remittances), with addenda §14.1 (settlements references the seller's
default payout_wallets row) and §14.2 (binding rule, restated: gross =
subtotal, commission = gross × commission_rate_snapshot, net = gross −
commission — never touches shipping_fee — enforce this with a database CHECK
constraint, not just application logic), implement: mock payment webhooks
with HMAC signature verification (reject invalid signatures with 401 and no
status change), retry logic (×3 at 1-minute intervals, then cancel and
notify buyer), the settlement engine implementing the exact gross/commission
formula above, and the COD remittance ledger. Write tests for duplicate-
webhook idempotency, signature-rejection, exact settlement-math correctness,
and immutability (an UPDATE on a SETTLED settlement must fail). This is the
most financial-sensitive feature in the project — self-review it extra
carefully against §14.2 before merging.

When finished: write a handoff note at docs/handoffs/F12-payments-backend.md
documenting the settlement/payment response shapes and explicitly confirming
the gross/commission formula was implemented exactly as specified, flagged
as self-reviewed.
```

---

## Day 19 — Feature 12 (Part 2)

| Field | Detail |
|---|---|
| **Feature** | F12 — Payments & Admin Operations |
| **Task (from playbook)** | Admin Dashboard, User Management, Reports, Platform Config |
| **Docs to Attach** | `docs/handoffs/F12-payments-backend.md`, Playbook F12, Schema §4.24, §4.25, §10 |
| **Mock or Real API** | N/A |
| **Expected Git Commit(s)** | `feat/be-f12-admin` |
| **End-of-Day Deliverable** | Admin suspend/ban, payment release, config panel, audit log, KPI endpoints working, tested, documented |
| **Feature Complete?** | Y (backend side) |

**Exact Claude CLI Prompt:**
```
Follow the attached documents exactly as the source of truth — do not introduce
patterns or choices not specified in them. Write simple, clear, well-commented
code appropriate for a small two-person team, not over-engineered. If anything
in the attached documents is unclear, conflicting, or missing something you need
to proceed, STOP and ask me a specific question before writing code — do not guess.
Structure your implementation so future features can extend it without rework:
avoid hardcoded values, keep clear separation of concerns, keep this feature's
interface stable for others to depend on.

Before starting, read docs/handoffs/F12-payments-backend.md to know which
payment/settlement records the admin console needs to surface.

Using Playbook F12, Schema §4.24 (audit_logs), §4.25 (platform_config), and
§10 (Permission Rules — schema-level, binding rule: mandatory-reason writes
must insert an audit_logs row in the same transaction as the mutation, or
the whole transaction rolls back), implement: user suspend/ban with
immediate session revocation via the Redis jti denylist, manual payment
release, AI/return override endpoints requiring a mandatory reason, config
panel endpoints (commission rate, courier weights, return window, min order
value), and KPI aggregation queries for the admin dashboard. Write a test
that specifically proves a failed audit-log insert rolls back the entire
override action, not just that both usually succeed together. Document
every endpoint in Swagger.

When finished: write/update the handoff note at
docs/handoffs/F12-admin-backend.md marking F12 fully complete on the backend
side.
```

---

## Day 20 — Feature 13: AI Store Builder

| Field | Detail |
|---|---|
| **Feature** | F13 — AI Store Builder |
| **Task (from playbook)** | Generate Title, Description, Tags, Category, SEO, Edit Output |
| **Docs to Attach** | `docs/handoffs/F4-products-backend-p2.md`, Playbook F13, TRD §5.2 |
| **Mock or Real API** | N/A |
| **Expected Git Commit(s)** | `feat/be-f13-ai-store` |
| **End-of-Day Deliverable** | ai-service generate-listing endpoint with fallback chain, apps/api proxy route working, tested, documented |
| **Feature Complete?** | Y (backend side) |

**Exact Claude CLI Prompt:**
```
Follow the attached documents exactly as the source of truth — do not introduce
patterns or choices not specified in them. Write simple, clear, well-commented
code appropriate for a small two-person team, not over-engineered. If anything
in the attached documents is unclear, conflicting, or missing something you need
to proceed, STOP and ask me a specific question before writing code — do not guess.
Structure your implementation so future features can extend it without rework:
avoid hardcoded values, keep clear separation of concerns, keep this feature's
interface stable for others to depend on.

Before starting, read docs/handoffs/F4-products-backend-p2.md to confirm the
exact product schema (ai_generated flag, title/description/category/tags
fields) this feature populates.

Using Playbook F13 and TRD §5.2 (AI Service stack), implement the
ai-service /generate-listing endpoint: a primary-model call with a
config-only-switchable fallback to a secondary model, Pydantic schema
enforcement on the output (title_en, title_ur, description_en,
description_ur, category, tags), and a apps/api proxy route reachable only
on the private Docker network, never exposed publicly. Write tests
confirming the output always conforms to the schema and that a primary-
model failure correctly and cleanly triggers the fallback rather than
crashing. Document every endpoint in Swagger.

When finished: write a handoff note at docs/handoffs/F13-ai-store-backend.md
documenting the generation response shape and typical generation latency.
```

---

## Day 21 — Feature 14: AI Returns

| Field | Detail |
|---|---|
| **Feature** | F14 — AI Returns |
| **Task (from playbook)** | Image Analysis, Damage Detection, Confidence Score, Recommendation |
| **Docs to Attach** | `docs/handoffs/F10-returns-backend.md`, Playbook F14, Schema §4.15, TRD §5.2 |
| **Mock or Real API** | N/A |
| **Expected Git Commit(s)** | `feat/be-f14-ai-returns` |
| **End-of-Day Deliverable** | Image analysis, confidence-threshold routing working, tested, documented |
| **Feature Complete?** | Y (backend side) |

**Exact Claude CLI Prompt:**
```
Follow the attached documents exactly as the source of truth — do not introduce
patterns or choices not specified in them. Write simple, clear, well-commented
code appropriate for a small two-person team, not over-engineered. If anything
in the attached documents is unclear, conflicting, or missing something you need
to proceed, STOP and ask me a specific question before writing code — do not guess.
Structure your implementation so future features can extend it without rework:
avoid hardcoded values, keep clear separation of concerns, keep this feature's
interface stable for others to depend on.

Before starting, read docs/handoffs/F10-returns-backend.md to confirm the
existing manual-review return state this feature routes into.

Using Playbook F14, Schema §4.15 (ai_condition, ai_authenticity,
ai_confidence fields on returns), and TRD §5.2, implement: the ai-service
image-analysis and damage-detection inference producing a confidence score,
and the apps/api confidence-threshold routing logic reading from
platform_config.returns_confidence_threshold — routing to auto-decision
above the threshold, and to manual review below the threshold, on AI
failure, or on any image-mismatch case, without exception. Write a test
specifically for the image-mismatch case as its own scenario (not just a
low-confidence-number test) to confirm it never auto-approves. Document
every endpoint in Swagger.

When finished: write a handoff note at docs/handoffs/F14-ai-returns-backend.md
documenting the analysis response shape and the exact routing logic.
```

---

## Day 22 — Feature 15: AI Analytics

| Field | Detail |
|---|---|
| **Feature** | F15 — AI Analytics |
| **Task (from playbook)** | Sales Insights, Recommendations, Forecasts, Business Suggestions |
| **Docs to Attach** | `docs/handoffs/F11-analytics-backend.md`, Playbook F15, Schema §15.1, §15.2 |
| **Mock or Real API** | N/A |
| **Expected Git Commit(s)** | `feat/be-f15-ai-analytics` |
| **End-of-Day Deliverable** | Recommendation generation and dismiss-logic endpoints working, tested, documented |
| **Feature Complete?** | Y (backend side) |

**Exact Claude CLI Prompt:**
```
Follow the attached documents exactly as the source of truth — do not introduce
patterns or choices not specified in them. Write simple, clear, well-commented
code appropriate for a small two-person team, not over-engineered. If anything
in the attached documents is unclear, conflicting, or missing something you need
to proceed, STOP and ask me a specific question before writing code — do not guess.
Structure your implementation so future features can extend it without rework:
avoid hardcoded values, keep clear separation of concerns, keep this feature's
interface stable for others to depend on.

Before starting, read docs/handoffs/F11-analytics-backend.md to confirm the
exact shape of seller_daily_stats, since recommendations are derived from it.

Using Playbook F15 and addendum §15.2 (seller_recommendations table —
binding rule: a recommendation is "active" if dismissed_until is null or in
the past), implement the ai-service /recommend endpoint generating a
plain-language recommendation from seller_daily_stats data, and the
apps/api dismiss endpoint setting dismissed_until to 14 days from now. Write
tests confirming a dismissed recommendation stays hidden until the window
passes, and that generation runs asynchronously, never blocking the
analytics page load. Document every endpoint in Swagger.

When finished: write a handoff note at
docs/handoffs/F15-ai-analytics-backend.md documenting the recommendation
response shape.
```

---

## Day 23 — Feature 16: External APIs

| Field | Detail |
|---|---|
| **Feature** | F16 — External APIs |
| **Task (from playbook)** | Courier APIs, Payment APIs, SMS APIs, WhatsApp APIs, Email APIs (Mock → Real interfaces) |
| **Docs to Attach** | `docs/handoffs/F8-courier-backend.md`, `docs/handoffs/F12-payments-backend.md`, `docs/handoffs/F9-notifications-backend.md`, Playbook F16, TRD §28 |
| **Mock or Real API** | N/A |
| **Expected Git Commit(s)** | `feat/be-f16-external-apis` |
| **End-of-Day Deliverable** | LiveAdapter interfaces finalized for all providers (still mock-mode by default), WhatsApp adapter added, tested, documented |
| **Feature Complete?** | Y (backend side) |

**Exact Claude CLI Prompt:**
```
Follow the attached documents exactly as the source of truth — do not introduce
patterns or choices not specified in them. Write simple, clear, well-commented
code appropriate for a small two-person team, not over-engineered. If anything
in the attached documents is unclear, conflicting, or missing something you need
to proceed, STOP and ask me a specific question before writing code — do not guess.
Structure your implementation so future features can extend it without rework:
avoid hardcoded values, keep clear separation of concerns, keep this feature's
interface stable for others to depend on.

Before starting, read docs/handoffs/F8-courier-backend.md,
docs/handoffs/F12-payments-backend.md, and
docs/handoffs/F9-notifications-backend.md to see every adapter interface
already established.

Using Playbook F16 and TRD §28 (Third-Party Integrations — Adapter Layer),
finalize the LiveAdapter interfaces for courier, payment, SMS, and email
providers so they structurally satisfy the exact same TypeScript interface
as the existing MockAdapters (still selected via ADAPTER_MODE=mock as the
default — no real credentials are wired up here). Add the WhatsApp adapter
interface (Meta Cloud API shape) alongside the existing SMS adapter pattern.
Write a compile-time interface-conformance test proving mock and live
adapters are interchangeable without any caller code changes.

When finished: write a handoff note at
docs/handoffs/F16-external-apis-backend.md documenting which adapters now
have finalized live interfaces and confirming ADAPTER_MODE still defaults to
mock everywhere.
```

---

## Day 24 — Feature 17: Final Integration (Day 1 of 2 — shared task board)

| Field | Detail |
|---|---|
| **Feature** | F17 — Final Integration |
| **Task (from playbook)** | Run full backend E2E flow; fix backend-side bugs; re-run project-wide coverage gate |
| **Docs to Attach** | Playbook F17, Schema (full), TRD (full), all previous handoffs |
| **Mock or Real API** | N/A |
| **Expected Git Commit(s)** | `fix/be-f17-<bug-desc>` |
| **End-of-Day Deliverable** | Backend-side cross-feature bugs from full E2E run fixed; coverage gate re-confirmed ≥80% |
| **Feature Complete?** | N |

**Exact Claude CLI Prompt:**
```
Follow the attached documents exactly as the source of truth — do not introduce
patterns or choices not specified in them. Write simple, clear, well-commented
code appropriate for a small two-person team, not over-engineered. If anything
in the attached documents is unclear, conflicting, or missing something you need
to proceed, STOP and ask me a specific question before writing code — do not guess.
Structure your implementation so future features can extend it without rework:
avoid hardcoded values, keep clear separation of concerns, keep this feature's
interface stable for others to depend on.

Before starting, read every handoff file in docs/handoffs/ in feature order
to build a full picture of the entire backend system, and read
docs/handoffs/F17-integration-frontend-day1.md for any backend-side issues
already flagged by the frontend.

Using Playbook F17, run the complete backend flow end-to-end (register →
onboard seller → publish product → buyer purchase → courier booking →
tracking → delivery → settlement → return → refund) and fix every backend-
side bug found. Re-run the full test suite and confirm project-wide coverage
is still at or above 80%. Fix any items flagged by the frontend team as
backend-side issues.

When finished: write a handoff note at
docs/handoffs/F17-integration-backend-day1.md listing every bug fixed and
the current coverage percentage.
```

---

## Day 25 — Feature 17: Final Integration (Day 2 of 2)

| Field | Detail |
|---|---|
| **Feature** | F17 — Final Integration |
| **Task (from playbook)** | Continue backend bug board; verify adapter interfaces end-to-end |
| **Docs to Attach** | `docs/handoffs/F17-integration-backend-day1.md`, `docs/handoffs/F17-integration-frontend-day1.md`, Playbook F17 |
| **Mock or Real API** | N/A |
| **Expected Git Commit(s)** | `fix/be-f17-<bug-desc>` |
| **End-of-Day Deliverable** | F17 feature-complete on backend side: full journey passes E2E |
| **Feature Complete?** | Y |

**Exact Claude CLI Prompt:**
```
Follow the attached documents exactly as the source of truth — do not introduce
patterns or choices not specified in them. Write simple, clear, well-commented
code appropriate for a small two-person team, not over-engineered. If anything
in the attached documents is unclear, conflicting, or missing something you need
to proceed, STOP and ask me a specific question before writing code — do not guess.
Structure your implementation so future features can extend it without rework:
avoid hardcoded values, keep clear separation of concerns, keep this feature's
interface stable for others to depend on.

Before starting, read docs/handoffs/F17-integration-backend-day1.md and
docs/handoffs/F17-integration-frontend-day1.md to see what remains open on
the shared bug board.

Using Playbook F17, continue clearing remaining backend-side bug-board
items. Confirm mock and live adapter interfaces remain structurally
interchangeable end-to-end. Confirm every financial-sensitive feature
(checkout, settlement, COD ledger) still passes its immutability and
idempotency tests after all fixes.

When finished: write a handoff note at
docs/handoffs/F17-integration-backend-final.md confirming F17 is fully
complete on the backend side.
```

---

## Day 26 — Feature 18: Testing & Deployment (Day 1 of 3)

| Field | Detail |
|---|---|
| **Feature** | F18 — Testing & Deployment |
| **Task (from playbook)** | Unit Testing, Integration Testing (backend), load test setup |
| **Docs to Attach** | `docs/handoffs/F17-integration-backend-final.md`, Playbook F18, Implementation Plan Phase 11 |
| **Mock or Real API** | N/A |
| **Expected Git Commit(s)** | `test/be-f18-unit`, `test/be-f18-integration`, `test/be-f18-load` |
| **End-of-Day Deliverable** | Backend test suites at ≥80% coverage; k6 load test executed and results logged |
| **Feature Complete?** | N |

**Exact Claude CLI Prompt:**
```
Follow the attached documents exactly as the source of truth — do not introduce
patterns or choices not specified in them. Write simple, clear, well-commented
code appropriate for a small two-person team, not over-engineered. If anything
in the attached documents is unclear, conflicting, or missing something you need
to proceed, STOP and ask me a specific question before writing code — do not guess.
Structure your implementation so future features can extend it without rework:
avoid hardcoded values, keep clear separation of concerns, keep this feature's
interface stable for others to depend on.

Before starting, read docs/handoffs/F17-integration-backend-final.md to
confirm the system is stable before testing begins.

Using Playbook F18 and Implementation Plan Phase 11 (Testing — system
hardening), complete backend unit and integration tests to reach or exceed
80% coverage, and run a k6 load test against a realistic single-node target,
documenting the results against the performance targets stated in the TRD.

When finished: write a handoff note at
docs/handoffs/F18-testing-backend-day1.md summarizing coverage percentage
and load-test results.
```

---

## Day 27 — Feature 18: Testing & Deployment (Day 2 of 3)

| Field | Detail |
|---|---|
| **Feature** | F18 — Testing & Deployment |
| **Task (from playbook)** | Bug Fixes (backend), OWASP Top 10 review and remediation |
| **Docs to Attach** | `docs/handoffs/F18-testing-backend-day1.md`, Playbook F18, TRD §16, §29 |
| **Mock or Real API** | N/A |
| **Expected Git Commit(s)** | `fix/be-f18-owasp-<item>` |
| **End-of-Day Deliverable** | Zero open HIGH/CRITICAL OWASP findings |
| **Feature Complete?** | N |

**Exact Claude CLI Prompt:**
```
Follow the attached documents exactly as the source of truth — do not introduce
patterns or choices not specified in them. Write simple, clear, well-commented
code appropriate for a small two-person team, not over-engineered. If anything
in the attached documents is unclear, conflicting, or missing something you need
to proceed, STOP and ask me a specific question before writing code — do not guess.
Structure your implementation so future features can extend it without rework:
avoid hardcoded values, keep clear separation of concerns, keep this feature's
interface stable for others to depend on.

Before starting, read docs/handoffs/F18-testing-backend-day1.md to see what
was already tested.

Using Playbook F18 and TRD §16 (Security Requirements) and §29 (Technical
Risks), run a full OWASP Top 10 review against the security control table in
TRD §16 (TLS, CORS, password hashing, JWT, RBAC, OTP, encryption at rest,
secrets management, injection protection, XSS, webhook HMAC, upload
validation), and fix every HIGH and CRITICAL finding before moving on.

When finished: write a handoff note at
docs/handoffs/F18-testing-backend-day2.md listing every finding and its
resolution, confirming zero HIGH/CRITICAL remain open.
```

---

## Day 28 — Feature 18: Testing & Deployment (Day 3 of 3 — Deployment)

| Field | Detail |
|---|---|
| **Feature** | F18 — Testing & Deployment |
| **Task (from playbook)** | Deployment: staging→prod pipeline, migration gating, rollback rehearsal, monitoring setup |
| **Docs to Attach** | `docs/handoffs/F18-testing-backend-day2.md`, Playbook F18, TRD §22–§26, Implementation Plan §23–24 |
| **Mock or Real API** | N/A |
| **Expected Git Commit(s)** | `chore/be-f18-deploy` |
| **End-of-Day Deliverable** | Live staging/prod deployment; health/readiness endpoints, Sentry, uptime pinger all live; rollback rehearsed |
| **Feature Complete?** | Y — **PROJECT COMPLETE** |

**Exact Claude CLI Prompt:**
```
Follow the attached documents exactly as the source of truth — do not introduce
patterns or choices not specified in them. Write simple, clear, well-commented
code appropriate for a small two-person team, not over-engineered. If anything
in the attached documents is unclear, conflicting, or missing something you need
to proceed, STOP and ask me a specific question before writing code — do not guess.
Structure your implementation so future features can extend it without rework:
avoid hardcoded values, keep clear separation of concerns, keep this feature's
interface stable for others to depend on.

Before starting, read docs/handoffs/F18-testing-backend-day2.md to confirm
all security findings are resolved before deployment.

Using Playbook F18, TRD §22 (Deployment Architecture) through §26 (Disaster
Recovery), and Implementation Plan §23 (Deployment Checklist) and §24
(Launch Checklist), execute the full deployment: build and tag Docker
images, run the gated `prisma migrate deploy` before app cutover, configure
TLS with forced HTTPS, set up /health and /ready endpoints, wire Sentry
error tracking and an uptime pinger, and rehearse a rollback to confirm it
completes within 30 minutes as required.

When finished: write the final handoff note at
docs/handoffs/F18-testing-backend-final.md confirming the backend is
deployed, monitored, and the project is complete from the backend side.
```
```