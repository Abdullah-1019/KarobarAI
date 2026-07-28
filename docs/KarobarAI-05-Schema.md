# KarobarAI — Backend Schema Document

**Document 5 of 6 — Software Blueprint Series**
**Project:** KarobarAI — Generative-AI E-Commerce Platform for Micro-Sellers in Pakistan
**Version:** 1.0 (Schema)
**Datastore:** Single **PostgreSQL 16** via **Prisma ORM** (decision D1)
**Depends on:** Documents 1–4 — decisions D1–D5 binding
**Status:** Draft for approval

---

## 0. Scope & Principles

- **One relational database** (D1) — no MongoDB/MySQL split; every relationship is a real FK.
- **Money** is always `DECIMAL` (never float); **rates** are `DECIMAL(5,4)`; **PKR**, two decimal places.
- **PII at rest** (phone, email, wallet IDs, address lines) is application-encrypted (AES-256-GCM, TRD §17); the column type holds ciphertext (`TEXT`/`BYTEA`) — uniqueness on encrypted fields uses a deterministic blind-index column where lookup is required (see §4.1).
- **Financial/audit tables are append-only and never soft-deleted** (orders, payments, settlements, cod_remittances, audit_logs) — corrections are compensating rows (REQ-NF-Safety-007, REQ-F-COD-004).
- **Everything else** carries soft delete (`deleted_at`) + `created_at`/`updated_at` (§8).
- Tables/columns marked **[R1.1]** / **[Future]** are not built for MVP but are reserved in the design so no migration breaks later.

---

## 1. ER Diagram (textual)

```
                         ┌──────────────┐
                         │    users     │ (base identity)
                         │ PK user_id   │
                         └──┬───┬───┬────┘
            owns 1:1│        │   │   │1:M receives
        ┌───────────┘        │   │   └──────────────► notifications
        ▼                    │   │                     notification_preferences (1:1)
 ┌──────────────┐            │   │1:M
 │ seller_profiles│          │   └──────────────► refresh_tokens / audit_logs(actor)
 │ PK user_id(FK)│           │1:1
 └──┬───────────┘            ▼
    │1:M owns          ┌──────────────┐
    ▼                  │ buyer_profiles│
 ┌──────────────┐      │ PK user_id(FK)│
 │   products    │     └──┬────┬───┬───┘
 │ PK product_id │        │    │   │1:M
 │ FK seller_id  │   1:1  │    │   └────────► addresses
 │ FK category_id│  cart  │    │1:M places
 └──┬────┬───────┘        ▼    ▼
    │    │1:M        ┌────────┐ ┌──────────────┐
    │    └─────────► │ carts  │ │    orders     │ (1 seller / order, D4)
    │  product_images│PK cart │ │ PK order_id   │
    │                └───┬────┘ │ FK buyer_id   │
    │            1:M     │      │ FK seller_id  │
    │            cart_items     └──┬──┬──┬──┬───┘
    │            (FK product)      │  │  │  │
    │1:M ◄───── order_items ───────┘  │  │  └──► tracking_events (1:M)
    │           (FK product, snap)    │  │       courier_quotes  (1:M)
 reviews (buyer×product, unique)      │  │1:1
    ▲                                 │  └──► payments (1:1) ──► refunds[via status]
    │1:M                              │1:1
 buyer_profiles                       └──► returns (1:1, unique order_id)
                                              │1:M return_images
 settlements (1:1 order) ◄─ orders            │1:1 disputes
 cod_remittances (1:1 order) ◄─ orders        ▼
 categories ◄─ products                  (state machine §Doc3)

 platform_config  (standalone key/typed config)
 audit_logs       (standalone, actor→users SET NULL)
```

**Core entities (count):** users, seller_profiles, buyer_profiles, addresses, categories, products, product_images, carts, cart_items, orders, order_items, payments, settlements, cod_remittances, returns, return_images, disputes, reviews, notifications, notification_preferences, tracking_events, courier_quotes, refresh_tokens, audit_logs, platform_config.

---

## 2. Database Naming Standards

| Rule | Convention | Example |
|------|-----------|---------|
| Tables | `snake_case`, **plural** | `order_items` |
| Columns | `snake_case`, singular | `created_at` |
| Primary key | `<entity>_id` | `order_id` |
| Foreign key | `<referenced_entity>_id` | `seller_id` |
| Booleans | `is_`/`has_` prefix | `is_default` |
| Timestamps | `_at` suffix, `TIMESTAMPTZ` | `settled_at` |
| Enums (PG types) | `snake_case` | `order_status` |
| Indexes | `idx_<table>_<cols>` | `idx_orders_seller_status` |
| Unique | `uq_<table>_<cols>` | `uq_reviews_buyer_product` |
| FK constraint | `fk_<table>_<ref>` | `fk_products_seller` |
| Junction tables | both entities, plural | `order_items` |

IDs use **`BIGINT` identity** (`GENERATED ALWAYS AS IDENTITY`) for performance and Prisma `Int/BigInt` mapping; public-facing references (orders, tracking) additionally expose a **`UUID` / opaque public token** to avoid enumerable sequential IDs.

---

## 3. Enumerated Types (PostgreSQL enums / Prisma enums)

```
user_role            : BUYER | SELLER | ADMIN | SUPPORT
user_status          : PENDING_VERIFICATION | ACTIVE | SUSPENDED | BANNED | DEACTIVATED
language             : EN | UR
product_status       : DRAFT | LIVE | OUT_OF_STOCK | REMOVED
product_condition    : NEW | LIKE_NEW | USED | REFURBISHED
order_status         : PAYMENT_PENDING | PAYMENT_CONFIRMED | PROCESSING | PICKED_UP |
                       IN_TRANSIT | OUT_FOR_DELIVERY | DELIVERED | COMPLETED |
                       CANCELLED | PENDING_MANUAL_LOGISTICS
payment_method       : JAZZCASH | EASYPAISA | COD
payment_status       : PENDING | CONFIRMED | FAILED | REFUNDED | CANCELLED
settlement_status    : PENDING | SETTLED | ON_HOLD
cod_remittance_status: EXPECTED | RECEIVED | RECONCILED | SHORTFALL
courier_code         : TCS | LEOPARDS | TRAX
return_status        : INITIATED | IMAGES_SUBMITTED | UNDER_AI_REVIEW | MANUAL_REVIEW |
                       APPROVED | REJECTED | PICKUP_BOOKED | REFUND_ISSUED |
                       UNDER_DISPUTE | CLOSED
return_condition     : UNDAMAGED | MINOR | MAJOR | DESTROYED
return_decision      : APPROVED | REJECTED | MANUAL
dispute_status       : OPEN | RESOLVED_APPROVED | RESOLVED_REJECTED
notification_channel : SMS | WHATSAPP | IN_APP | EMAIL
notification_status  : QUEUED | SENT | DELIVERED | FAILED | READ
audit_action         : CREATE | UPDATE | DELETE | SUSPEND | BAN | PAYMENT_RELEASE |
                       AI_OVERRIDE | CONFIG_CHANGE | MODERATION | DISPUTE_RESOLVE
```

---

## 4. Table Specifications

Legend — **PK** primary key · **FK** foreign key · **UQ** unique · **NN** not null · **D** default · **idx** indexed. Soft-deletable tables carry `deleted_at TIMESTAMPTZ NULL`; all carry `created_at`/`updated_at` unless noted.

### 4.1 `users` (base identity)
| Column | Type | Constraints / Default | Notes |
|--------|------|----------------------|-------|
| user_id | BIGINT | **PK**, identity | |
| public_id | UUID | NN, UQ, D `gen_random_uuid()` | external reference |
| phone | TEXT | NN (encrypted) | ciphertext |
| phone_bidx | TEXT | UQ (partial, where deleted_at IS NULL) | blind index for lookup/uniqueness |
| email | TEXT | NULL (encrypted) | optional |
| email_bidx | TEXT | UQ (partial) | blind index |
| password_hash | TEXT | NULL | bcrypt; null for OTP-only accounts until set |
| role | user_role | NN, D `BUYER` | |
| status | user_status | NN, D `PENDING_VERIFICATION` | |
| preferred_language | language | NN, D `UR` | |
| last_login_at | TIMESTAMPTZ | NULL | |
| created_at / updated_at / deleted_at | TIMESTAMPTZ | see §8 | soft delete |

Indexes: `idx_users_role`, `idx_users_status`; partial unique on `phone_bidx`, `email_bidx` (where `deleted_at IS NULL`).

### 4.2 `seller_profiles` (1:1 extends users)
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| user_id | BIGINT | **PK, FK → users.user_id** (CASCADE) | shared PK |
| store_name | VARCHAR(120) | NN | |
| store_description | TEXT | NULL | |
| logo_url | VARCHAR(512) | NULL | CDN |
| jazzcash_wallet | TEXT | NULL (encrypted) | payout |
| easypaisa_wallet | TEXT | NULL (encrypted) | payout |
| commission_rate | DECIMAL(5,4) | NN, D `0.0500` | per-seller override of platform default |
| fraud_rate_30d | DECIMAL(5,4) | NN, D `0` | rolling metric (BR-006) |
| created_at/updated_at/deleted_at | TIMESTAMPTZ | | |

### 4.3 `buyer_profiles` (1:1 extends users)
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| user_id | BIGINT | **PK, FK → users** (CASCADE) | |
| default_address_id | BIGINT | FK → addresses (SET NULL) | |
| created_at/updated_at/deleted_at | TIMESTAMPTZ | | |

### 4.4 `addresses`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| address_id | BIGINT | **PK** | |
| buyer_id | BIGINT | NN, **FK → buyer_profiles** (CASCADE) | |
| label | VARCHAR(40) | NULL | Home/Work |
| line1 / line2 | TEXT | NN / NULL (encrypted) | |
| city | VARCHAR(80) | NN | needed for COD courier coverage |
| province | VARCHAR(80) | NN | |
| postal_code | VARCHAR(20) | NULL | |
| contact_phone | TEXT | NULL (encrypted) | |
| is_default | BOOLEAN | NN, D `false` | |
| created_at/updated_at/deleted_at | | | |

Index: `idx_addresses_buyer`.

### 4.5 `categories`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| category_id | BIGINT | **PK** | |
| slug | VARCHAR(80) | NN, UQ | |
| name_en | VARCHAR(80) | NN | |
| name_ur | VARCHAR(80) | NN | |
| parent_id | BIGINT | FK → categories (SET NULL) | optional tree |
| created_at/updated_at | | | (no soft delete; reference data) |

### 4.6 `products`
| Column | Type | Constraints / Default | Notes |
|--------|------|----------------------|-------|
| product_id | BIGINT | **PK** | |
| public_id | UUID | NN, UQ, D `gen_random_uuid()` | storefront URL |
| seller_id | BIGINT | NN, **FK → seller_profiles** (RESTRICT) | ownership |
| category_id | BIGINT | FK → categories (SET NULL) | |
| title_en | VARCHAR(160) | NN | |
| title_ur | VARCHAR(160) | NULL | |
| description_en | TEXT | NULL | |
| description_ur | TEXT | NULL | |
| price | DECIMAL(12,2) | NN, CHECK ≥ 0 | PKR |
| stock | INTEGER | NN, D `0`, CHECK ≥ 0 | inventory (F14) |
| condition | product_condition | NN, D `NEW` | |
| status | product_status | NN, D `DRAFT` | |
| tags | JSONB | NN, D `'[]'` | language-tagged array (PRD assumption 13) |
| ai_generated | BOOLEAN | NN, D `false` | provenance |
| search_vector | TSVECTOR | **generated** (see §7) | FTS |
| created_at/updated_at/deleted_at | | | soft delete |

Indexes: `idx_products_seller`, `idx_products_category`, `idx_products_status`, `idx_products_price`, **GIN `idx_products_search` on `search_vector`**, partial `idx_products_live` (where `status='LIVE' AND deleted_at IS NULL`).

### 4.7 `product_images`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| image_id | BIGINT | **PK** | |
| product_id | BIGINT | NN, **FK → products** (CASCADE) | |
| cdn_url | VARCHAR(512) | NN | compressed <200 KB |
| position | SMALLINT | NN, D `0` | first = primary |
| created_at | | | |

Index: `idx_product_images_product`. Composite consideration: UQ `(product_id, position)`.

### 4.8 `carts` (persisted, D4)
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| cart_id | BIGINT | **PK** | |
| buyer_id | BIGINT | NN, UQ, **FK → buyer_profiles** (CASCADE) | one active cart per buyer |
| created_at/updated_at | | | |

### 4.9 `cart_items` (junction: carts × products)
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| cart_item_id | BIGINT | **PK** | |
| cart_id | BIGINT | NN, **FK → carts** (CASCADE) | |
| product_id | BIGINT | NN, **FK → products** (CASCADE) | |
| quantity | INTEGER | NN, D `1`, CHECK > 0 | |
| created_at/updated_at | | | |

**Composite unique:** `uq_cart_items_cart_product (cart_id, product_id)` — one row per product per cart. Index `idx_cart_items_cart`.

### 4.10 `orders` (1 seller per order, D4 — **append-only / no soft delete**)
| Column | Type | Constraints / Default | Notes |
|--------|------|----------------------|-------|
| order_id | BIGINT | **PK** | |
| public_id | UUID | NN, UQ, D `gen_random_uuid()` | |
| tracking_token | UUID | NN, UQ, D `gen_random_uuid()` | login-free tracking (REQ-F-Track005) |
| buyer_id | BIGINT | NN, **FK → buyer_profiles** (RESTRICT) | |
| seller_id | BIGINT | NN, **FK → seller_profiles** (RESTRICT) | one seller (D4) |
| status | order_status | NN, D `PAYMENT_PENDING` | canonical enum |
| payment_method | payment_method | NN | |
| subtotal | DECIMAL(12,2) | NN, CHECK ≥ 0 | items total |
| shipping_fee | DECIMAL(12,2) | NN, D `0` | **buyer pays (D4)** |
| total_amount | DECIMAL(12,2) | NN | subtotal + shipping_fee |
| commission_rate_snapshot | DECIMAL(5,4) | NN | rate at order time |
| courier | courier_code | NULL | chosen courier |
| courier_overridden | BOOLEAN | NN, D `false` | REQ-F-Logistics-008 |
| tracking_no | VARCHAR(80) | NULL | |
| ship_name | VARCHAR(120) | NN | **snapshotted** shipping address |
| ship_line1/line2/city/province/postal | (encrypted/plain) | | snapshot (preserves history) |
| ship_phone | TEXT | NN (encrypted) | |
| placed_at | TIMESTAMPTZ | NN, D `now()` | |
| delivered_at | TIMESTAMPTZ | NULL | drives settlement timing |
| created_at/updated_at | | | (no deleted_at) |

Indexes: `idx_orders_buyer`, `idx_orders_seller`, `idx_orders_status`, `idx_orders_placed_at`, composite **`idx_orders_seller_status (seller_id, status)`**, UQ on `tracking_token`, `public_id`.

### 4.11 `order_items` (junction: orders × products, with snapshots)
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| order_item_id | BIGINT | **PK** | |
| order_id | BIGINT | NN, **FK → orders** (CASCADE) | |
| product_id | BIGINT | NN, **FK → products** (RESTRICT) | preserve history |
| title_snapshot | VARCHAR(160) | NN | listing at purchase time |
| unit_price | DECIMAL(12,2) | NN | price at purchase time |
| quantity | INTEGER | NN, CHECK > 0 | |
| created_at | | | |

Indexes: `idx_order_items_order`, `idx_order_items_product`.

### 4.12 `payments` (1:1 order — **append-only**)
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| payment_id | BIGINT | **PK** | |
| order_id | BIGINT | NN, **FK → orders** (RESTRICT) | |
| method | payment_method | NN | |
| gateway | VARCHAR(40) | NULL | adapter id |
| transaction_ref | VARCHAR(120) | UQ NULL | gateway ref only (no PINs, REQ-F-Payment-008) |
| idempotency_key | VARCHAR(80) | NN, UQ | REQ-F-Payment-004 |
| amount | DECIMAL(12,2) | NN | |
| status | payment_status | NN, D `PENDING` | |
| retry_count | SMALLINT | NN, D `0` | up to 3 (REQ-F-Payment-003) |
| confirmed_at | TIMESTAMPTZ | NULL | |
| created_at/updated_at | | | (no deleted_at) |

Indexes: `idx_payments_order`, `idx_payments_status`, UQ `transaction_ref`, UQ `idempotency_key`. *(Refunds are recorded as status transition + a compensating settlement/remittance entry, not by mutating the original.)*

### 4.13 `settlements` (1:1 order — **append-only**)
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| settlement_id | BIGINT | **PK** | |
| order_id | BIGINT | NN, UQ, **FK → orders** (RESTRICT) | |
| seller_id | BIGINT | NN, **FK → seller_profiles** (RESTRICT) | |
| gross | DECIMAL(12,2) | NN | order value |
| commission | DECIMAL(12,2) | NN | gross × rate |
| net | DECIMAL(12,2) | NN | payout |
| status | settlement_status | NN, D `PENDING` | |
| settled_at | TIMESTAMPTZ | NULL | within 24–48h / 48–72h COD |
| created_at/updated_at | | | immutable once SETTLED (REQ-NF-Safety-007) |

Indexes: `idx_settlements_seller`, `idx_settlements_status`, UQ `order_id`.

### 4.14 `cod_remittances` (1:1 COD order — **append-only**, F12)
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| remittance_id | BIGINT | **PK** | |
| order_id | BIGINT | NN, UQ, **FK → orders** (RESTRICT) | |
| courier | courier_code | NN | collected the cash |
| expected_amount | DECIMAL(12,2) | NN | order total |
| received_amount | DECIMAL(12,2) | NULL | reconciled |
| status | cod_remittance_status | NN, D `EXPECTED` | |
| remitted_at | TIMESTAMPTZ | NULL | |
| created_at/updated_at | | | |

Index: `idx_cod_remit_status`.

### 4.15 `returns` (1:1 order, unique — REQ-F-Return-001 / BR-007)
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| return_id | BIGINT | **PK** | |
| order_id | BIGINT | NN, **UQ**, **FK → orders** (RESTRICT) | one per order |
| reason | VARCHAR(200) | NN | |
| ai_condition | return_condition | NULL | [R1.1] |
| ai_authenticity | DECIMAL(5,4) | NULL | similarity score [R1.1] |
| ai_confidence | DECIMAL(5,4) | NULL | drives manual-review routing (D3) |
| decision | return_decision | NULL | |
| status | return_status | NN, D `INITIATED` | state machine |
| decided_at | TIMESTAMPTZ | NULL | |
| refunded_at | TIMESTAMPTZ | NULL | |
| created_at/updated_at/deleted_at | | | |

Indexes: UQ `order_id`, `idx_returns_status`.

### 4.16 `return_images`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| return_image_id | BIGINT | **PK** | |
| return_id | BIGINT | NN, **FK → returns** (CASCADE) | |
| cdn_url | VARCHAR(512) | NN | ≥3 required at app layer |
| created_at | | | |

Index: `idx_return_images_return`.

### 4.17 `disputes` (1:1 return)
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| dispute_id | BIGINT | **PK** | |
| return_id | BIGINT | NN, UQ, **FK → returns** (RESTRICT) | |
| status | dispute_status | NN, D `OPEN` | |
| admin_reason | TEXT | NULL | mandatory on resolve |
| resolved_by | BIGINT | FK → users (SET NULL) | admin |
| resolved_at | TIMESTAMPTZ | NULL | final (BR-008) |
| created_at/updated_at | | | |

### 4.18 `reviews` (verified purchase — R1.1)
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| review_id | BIGINT | **PK** | |
| buyer_id | BIGINT | NN, **FK → buyer_profiles** (RESTRICT) | |
| product_id | BIGINT | NN, **FK → products** (RESTRICT) | |
| order_id | BIGINT | NN, **FK → orders** (RESTRICT) | proves purchase |
| rating | SMALLINT | NN, CHECK 1–5 | |
| comment | TEXT | NULL | |
| created_at/updated_at/deleted_at | | | |

**Composite unique:** `uq_reviews_buyer_product (buyer_id, product_id)` — one review per buyer per product. Index `idx_reviews_product`.

### 4.19 `notifications`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| notification_id | BIGINT | **PK** | |
| user_id | BIGINT | NN, **FK → users** (CASCADE) | |
| order_id | BIGINT | FK → orders (SET NULL) | optional context |
| channel | notification_channel | NN | |
| event_type | VARCHAR(60) | NN | order_placed, refund_issued, … |
| message | TEXT | NN | rendered template |
| language | language | NN | |
| status | notification_status | NN, D `QUEUED` | |
| sent_at / read_at | TIMESTAMPTZ | NULL | |
| created_at | | | |

Indexes: composite **`idx_notifications_user_created (user_id, created_at DESC)`**, `idx_notifications_status`.

### 4.20 `notification_preferences` (1:1 user)
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| user_id | BIGINT | **PK, FK → users** (CASCADE) | |
| sms_enabled / whatsapp_enabled / email_enabled / inapp_enabled | BOOLEAN | NN, D `true` | non-critical only; critical always sent (REQ-F-Notif004) |
| updated_at | | | |

### 4.21 `tracking_events` (history, ≥12 months — REQ-F-Track007)
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| tracking_event_id | BIGINT | **PK** | |
| order_id | BIGINT | NN, **FK → orders** (CASCADE) | |
| status | order_status | NN | milestone |
| description | VARCHAR(200) | NULL | |
| location_lat / location_lng | DECIMAL(9,6) | NULL | map |
| event_time | TIMESTAMPTZ | NN | |
| created_at | | | |

Index: composite **`idx_tracking_order_time (order_id, event_time)`**. *Candidate for time-based partitioning at scale (TRD §30).*

### 4.22 `courier_quotes` (scoring log — REQ-F-Logistics-008)
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| quote_id | BIGINT | **PK** | |
| order_id | BIGINT | NN, **FK → orders** (CASCADE) | |
| courier | courier_code | NN | |
| cost | DECIMAL(12,2) | NULL | |
| eta_hours | INTEGER | NULL | |
| score | DECIMAL(6,3) | NULL | weighted (40/30/20/10) |
| selected | BOOLEAN | NN, D `false` | |
| created_at | | | |

Index: `idx_courier_quotes_order`.

### 4.23 `refresh_tokens` (session management, §10)
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| refresh_token_id | BIGINT | **PK** | |
| user_id | BIGINT | NN, **FK → users** (CASCADE) | |
| jti | UUID | NN, UQ | token id; Redis denylist mirrors for fast revoke |
| token_hash | TEXT | NN | hashed refresh token (never plaintext) |
| user_agent | VARCHAR(255) | NULL | device |
| ip_hash | TEXT | NULL | hashed |
| expires_at | TIMESTAMPTZ | NN | 7-day |
| revoked_at | TIMESTAMPTZ | NULL | rotation/logout/suspension |
| created_at | | | |

Indexes: UQ `jti`, `idx_refresh_user`, `idx_refresh_expires`.

### 4.24 `audit_logs` (**append-only**, immutable)
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| audit_id | BIGINT | **PK** | |
| actor_id | BIGINT | FK → users (SET NULL) | preserve log if actor removed |
| action | audit_action | NN | |
| entity | VARCHAR(60) | NN | table/domain |
| entity_id | BIGINT | NULL | |
| reason | TEXT | NULL | mandatory for overrides/suspensions |
| before | JSONB | NULL | snapshot |
| after | JSONB | NULL | snapshot |
| created_at | TIMESTAMPTZ | NN, D `now()` | (no update/delete) |

Indexes: `idx_audit_entity (entity, entity_id)`, `idx_audit_actor`, `idx_audit_created`.

### 4.25 `platform_config` (admin-tunable, SRS §5.5)
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| config_key | VARCHAR(60) | **PK** | |
| value | JSONB | NN | typed value |
| description | VARCHAR(200) | NULL | |
| updated_by | BIGINT | FK → users (SET NULL) | |
| updated_at | | | |

Seed keys: `commission_rate_default=0.05`, `courier_weights={cost:0.4,time:0.3,reliability:0.2,coverage:0.1}`, `return_window_days=14`, `min_order_value_pkr=100`, `returns_confidence_threshold=0.85`.

---

## 5. Relationships Summary

| Parent | Child | Type | On delete |
|--------|-------|------|-----------|
| users | seller_profiles / buyer_profiles | 1:1 | CASCADE |
| users | notifications / notification_preferences / refresh_tokens | 1:M / 1:1 | CASCADE |
| users | audit_logs (actor) | 1:M | SET NULL |
| seller_profiles | products | 1:M | RESTRICT |
| seller_profiles | orders / settlements | 1:M | RESTRICT |
| buyer_profiles | addresses / carts | 1:M / 1:1 | CASCADE |
| buyer_profiles | orders / reviews | 1:M | RESTRICT |
| categories | products | 1:M | SET NULL |
| products | product_images | 1:M | CASCADE |
| products | order_items / reviews | 1:M | RESTRICT |
| products | cart_items | 1:M | CASCADE |
| carts | cart_items | 1:M | CASCADE |
| orders | order_items / tracking_events / courier_quotes | 1:M | CASCADE |
| orders | payments / settlements / cod_remittances / returns | 1:1 | RESTRICT |
| returns | return_images | 1:M | CASCADE |
| returns | disputes | 1:1 | RESTRICT |

**Cascade philosophy:** child *content* of a mutable parent cascades (images, cart items, tracking events); **financial and historical records RESTRICT** so orders/payments/settlements/returns can never be silently destroyed. Because users/products are soft-deleted, hard cascades are a last-resort cleanup path, not normal operation.

---

## 6. Junction & Audit Tables

- **Junction tables:** `cart_items` (carts × products, composite-unique), `order_items` (orders × products, with purchase-time snapshots). Reviews act as a constrained junction (buyer × product, composite-unique) but carry their own PK and payload.
- **Audit table:** `audit_logs` (§4.24) — single immutable log for every privileged/financial action (suspend, ban, payment release, AI/return override, config change, moderation), capturing actor, reason, and before/after JSONB. This is the system of record for REQ-F-Admin-003 and the override requirements.

---

## 7. Indexes & Query Optimization

**Full-text search (REQ-F-Browse-001):**
```sql
ALTER TABLE products ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(title_en,'') || ' ' || coalesce(title_ur,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(description_en,'') || ' ' || coalesce(description_ur,'')), 'B') ||
    setweight(to_tsvector('simple', coalesce(tags::text,'')), 'C')
  ) STORED;
CREATE INDEX idx_products_search ON products USING GIN (search_vector);
```
`'simple'` config avoids English stemming on Urdu tokens; `unaccent` applied at query time for diacritic-insensitive matching. Bilingual queries (Urdu or English) hit one GIN index — no separate search engine needed at ≤100k listings (REQ-NF-Perf003).

**Hot-path composite indexes:** `idx_orders_seller_status` (seller order tabs), `idx_notifications_user_created` (notification bell), `idx_tracking_order_time` (tracking timeline), partial `idx_products_live` (storefront browse).

**Optimization practices:** parameterised queries only (Prisma, REQ-NF-Security-009); pagination (cursor/limit) on all lists; pre-aggregated analytics tables/materialized views for the dashboard so reloads stay <3s (REQ-F-Analytics-005); `EXPLAIN ANALYZE` review of the five hottest queries; connection pooling (PgBouncer); covering indexes where read-heavy; avoid N+1 via Prisma `include`/`select`. Partition `tracking_events`/`notifications` by time when volume warrants (TRD §30).

---

## 8. Soft Deletes & Timestamps

- **Timestamps:** every mutable table has `created_at TIMESTAMPTZ NOT NULL DEFAULT now()` and `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()` (Prisma `@updatedAt`). Reference/append-only tables omit `updated_at` where irrelevant.
- **Soft delete:** `deleted_at TIMESTAMPTZ NULL` on users, seller/buyer profiles, addresses, products, returns, reviews. A global Prisma middleware injects `deleted_at IS NULL` into reads and converts deletes into `UPDATE … SET deleted_at = now()`.
- **Partial unique indexes** (`WHERE deleted_at IS NULL`) let a phone/email be reused after a soft-deleted account is purged.
- **Never soft-deleted (append-only):** orders, order_items, payments, settlements, cod_remittances, tracking_events, audit_logs — financial/historical integrity (REQ-NF-Safety-007).

---

## 9. Ownership Rules

Enforced in the service layer on top of the schema (TRD §8), keyed off these FKs:
- A **seller** may read/mutate only `products`, `orders`, `settlements`, `cod_remittances`, `returns` where `seller_id = self`.
- A **buyer** may read/mutate only `carts`, `cart_items`, `addresses`, `orders`, `returns`, `reviews` where `buyer_id = self`.
- **Public tracking** resolves an order solely via `tracking_token` (no auth, read-only, REQ-F-Track005) — never via sequential `order_id`.
- **Admin/Support** bypass ownership but every privileged write lands in `audit_logs`.
Ownership checks run after authentication and role authorization; violations return 403.

---

## 10. Permission Rules (schema-level)

The PRD §11 permission matrix is the authority; at the data layer it is reinforced by:
- **RBAC** via `users.role` + route guards (TRD §8).
- **Row ownership** via the FKs in §9.
- **Mandatory-reason writes** (overrides, suspensions, payment release, config) must insert an `audit_logs` row in the same transaction as the mutation, or the transaction rolls back.
- **Immutability** of settled financial rows enforced by application rule + (optionally) a DB trigger rejecting `UPDATE` on `settlements`/`payments` once `status` is terminal.

---

## 11. Session Management & Refresh Tokens

- **Access token:** stateless JWT (RS256, 1h) — not stored; verified by signature + `jti` denylist check.
- **Refresh token:** persisted hashed in `refresh_tokens` (§4.23), HttpOnly cookie, 7-day expiry, **rotated on every use** (old `jti` revoked, new row issued).
- **Revocation:** logout, password reset, suspension, and ban set `revoked_at` and add `jti` to a **Redis denylist** (fast O(1) check on each access-token validation) so sessions die immediately (REQ-F-Auth006).
- **Cleanup:** a scheduled job purges expired/revoked refresh rows.
- **OTP & lockout state** live in **Redis** with TTLs (TRD §7) — short-lived, not in Postgres — so the relational schema stays focused on durable records.

---

## 12. Migration Strategy

- **Tooling:** **Prisma Migrate**. `schema.prisma` is the single source of truth; `prisma migrate dev` in development, `prisma migrate deploy` gated in CI before app cutover (TRD §23).
- **Reversibility:** every migration is reviewed for a safe rollback; destructive changes (drops, type narrowing) are split into expand → migrate-data → contract steps to stay zero-downtime-ish.
- **Seeding:** `prisma/seed.ts` seeds enums-as-data where needed, `categories`, and `platform_config` defaults (§4.25).
- **Data integrity in migrations:** new NOT NULL columns ship with a default or a backfill step; FK additions verified against existing data.
- **Encryption:** field-encryption keys are environment-provided; a migration never embeds keys or plaintext PII.
- **Versioning:** migrations are committed to VCS, named descriptively, and run in order across dev → staging → prod.

---

## 13. Reference Prisma Excerpt (illustrative)

```prisma
model Order {
  orderId               BigInt      @id @default(autoincrement()) @map("order_id")
  publicId              String      @unique @default(uuid()) @map("public_id") @db.Uuid
  trackingToken         String      @unique @default(uuid()) @map("tracking_token") @db.Uuid
  buyerId               BigInt      @map("buyer_id")
  sellerId              BigInt      @map("seller_id")
  status                OrderStatus @default(PAYMENT_PENDING)
  paymentMethod         PaymentMethod @map("payment_method")
  subtotal              Decimal     @db.Decimal(12,2)
  shippingFee           Decimal     @default(0) @db.Decimal(12,2) @map("shipping_fee")
  totalAmount           Decimal     @db.Decimal(12,2) @map("total_amount")
  commissionRateSnapshot Decimal    @db.Decimal(5,4) @map("commission_rate_snapshot")
  buyer    BuyerProfile  @relation(fields: [buyerId], references: [userId], onDelete: Restrict)
  seller   SellerProfile @relation(fields: [sellerId], references: [userId], onDelete: Restrict)
  items    OrderItem[]
  payment  Payment?
  settlement Settlement?
  return   Return?
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  @@index([sellerId, status], name: "idx_orders_seller_status")
  @@map("orders")
}
```

---

*End of Document 5 (Backend Schema). On approval, the final document is the **Implementation Plan** — phased roadmap (objective, deliverables, dependencies, complexity, risks, testing, completion criteria per phase), plus timeline, milestones, sprint plan, Git branching strategy, code-review process, Definition of Done, and deployment/launch checklists.*


-------------------------------------------------------------------------------------------------------------------------------------------
-------------------------------------------------------------------------------------------------------------------------------------------
-------------------------------------------------------------------------------------------------------------------------------------------
-------------------------------------------------------------------------------------------------------------------------------------------
-------------------------------------------------------------------------------------------------------------------------------------------
-------------------------------------------------------------------------------------------------------------------------------------------
-------------------------------------------------------------------------------------------------------------------------------------------

## 14. Schema Addendum — Corrections (v1.0.1)

**Status:** Binding. This section supersedes §4.3, §4.13, §4.22, §4.10, and §8 wherever they conflict.
Reason: pre-implementation review surfaced 4 gaps between the schema and Doc 1 (PRD) / Doc 3 (AppFlow).

---

### 14.1 New table: `payout_wallets` (replaces fixed wallet columns on `seller_profiles`)

**Problem:** §4.2 gave `seller_profiles` two fixed columns (`jazzcash_wallet`, `easypaisa_wallet`), but Doc 3 SCR-S09 requires a seller to add/list/default multiple wallets. A fixed-column design can't support that.

**Fix:** Remove `jazzcash_wallet` and `easypaisa_wallet` from `seller_profiles` (§4.2). Add:

```sql
CREATE TYPE payout_wallet_type AS ENUM ('JAZZCASH', 'EASYPAISA');

CREATE TABLE payout_wallets (
  wallet_id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  seller_id       BIGINT NOT NULL REFERENCES seller_profiles(user_id) ON DELETE CASCADE,
  type            payout_wallet_type NOT NULL,
  account_number  TEXT NOT NULL,        -- encrypted (AES-256-GCM, same as other PII)
  is_default      BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ NULL
);

CREATE UNIQUE INDEX uq_payout_wallets_seller_type_acct
  ON payout_wallets (seller_id, type, account_number) WHERE deleted_at IS NULL;
CREATE INDEX idx_payout_wallets_seller ON payout_wallets (seller_id);
```

**Rules:**
- A seller must have ≥1 active wallet before publishing (REQ-F-Auth005) — enforce at service layer, not DB.
- Exactly one wallet may have `is_default = true` per seller at a time — enforce in a transaction (unset old default, set new).
- `settlements` and `cod_remittances` payout target = seller's default `payout_wallets` row at time of settlement; store the `wallet_id` used as `settlements.payout_wallet_id` (add this FK column to §4.13, nullable, `SET NULL` on delete — it's a reference, not a dependency for immutability).
- Update PRD REQ-F-Payment-008 mapping: wallet numbers referenced in Doc 1 §12.7 now live in `payout_wallets`, not `seller_profiles`.

---

### 14.2 Settlement calculation base — clarify `gross`

**Problem:** §4.13 `settlements.gross` was ambiguous — could be read as `orders.total_amount` (which includes buyer-paid shipping) or `orders.subtotal` (items only). Since shipping is a pass-through the buyer pays and the platform/seller doesn't earn commission on, this must be fixed to `subtotal`.

**Binding definition (add to §4.13):**

`orders.shipping_fee` is **never** part of settlement math — it is a pass-through cost the platform owes to the courier (see §14.3), not seller or platform revenue.

Add a `CHECK` constraint for defensive correctness:
```sql
ALTER TABLE settlements
  ADD CONSTRAINT chk_settlements_net CHECK (net = gross - commission);
```

---

### 14.3 Courier cost liability — explicitly out of scope for MVP

**Problem:** `courier_quotes` (§4.22) logs quotes/scores for the courier-selection algorithm, but nothing tracks what the platform owes the courier for a booked shipment (a payables ledger).

**Decision (add to §4.22):** This liability ledger is **explicitly deferred to Future scope** — mock courier adapters in MVP do not involve real money owed to a courier, so no `courier_payables` table is built now. When real courier adapters (D2 live mode) ship, add a `courier_payables` table mirroring the `cod_remittances` append-only pattern (expected/received/status). Do not attempt to backfill this via `courier_quotes.cost`, which is a scoring-time snapshot, not a billing record.

---

### 14.4 Order address snapshot — explicit encryption split

**Problem:** §4.10 listed `ship_line1/line2/city/province/postal` as a single row marked "(encrypted/plain)" without saying which columns are which. This matters: Logistics (REQ-F-Logistics-006) needs to filter/query COD coverage by city, which is impossible if city is ciphertext — exactly the same reasoning §4.4 already applied to `addresses.city`.

**Binding column-level spec for `orders` (replaces the ambiguous row in §4.10):**

| Column | Type | Encrypted? |
|--------|------|:---:|
| `ship_name` | VARCHAR(120) | No |
| `ship_line1` | TEXT | **Yes** |
| `ship_line2` | TEXT (nullable) | **Yes** |
| `ship_city` | VARCHAR(80) | **No** — plain, required for courier coverage matching |
| `ship_province` | VARCHAR(80) | **No** — plain |
| `ship_postal` | VARCHAR(20) (nullable) | No |
| `ship_phone` | TEXT | **Yes** |

Add index: `idx_orders_ship_city` (supports courier-coverage filtering at booking time).

---

### 14.5 `returns` — remove from soft-delete list (data-integrity fix)

**Problem:** §8 lists `returns` as soft-deletable, but `returns.order_id` also carries a hard `UNIQUE` constraint enforcing BR-007 (one return per order). If a return row is ever soft-deleted, the unique constraint (which does not exclude `deleted_at`) would still block a second return on that order — or if the constraint is later made partial (`WHERE deleted_at IS NULL`) to "fix" that, it would silently violate BR-007 by allowing a second return after the first is soft-deleted.

**Fix:** Remove `returns` from the soft-delete list in §8. `returns` keeps `created_at`/`updated_at` but drops `deleted_at` entirely — its `status` enum (already includes `CLOSED`) is the correct lifecycle mechanism, not row deletion. Update §4.15 accordingly (drop `deleted_at` from the returns column list).

---

### 14.6 Minor hardening (apply during Phase 4, non-blocking)

- **`product_images`:** commit to `UQ (product_id, position)`. Reordering images is a single transaction that shifts positions.
- **`tracking_events`:** add `UNIQUE (order_id, status, event_time)` or de-duplicate in the polling job before insert, to prevent duplicate timeline entries from poll-retry overlap.
- **`reviews`:** service layer must validate that `product_id` appears in `order_items` for the given `order_id` (not just that *some* order with the seller exists) before allowing a review insert. Schema alone (`order_id` FK) does not enforce this — document it as a mandatory service-layer check in TRD §8 (Authorization Strategy) or wherever business-rule validation is specified.

---

*Addendum §14 is binding and takes precedence over any conflicting text in §1–§13 above.*

---

## 15. Schema Addendum — Audit Follow-ups (v1.0.2)

**Status:** Binding. Additive only — nothing here removes or contradicts §1–§14. Applied on top of §14.
Reason: full production-readiness audit (Principal DB Architect review) identified 6 gaps not covered by §14.

---

### 15.1 New table: `seller_daily_stats` (analytics rollup — F6, F7)

**Problem:** TRD §7 requires pre-aggregated analytics so the dashboard reloads in <3s (REQ-F-Analytics-005), but no rollup table exists. Computing revenue/trend/top-products from raw `orders`/`order_items` on every page load will not scale past pilot volume.

**Fix:** Add a daily rollup table, populated by a scheduled job (BullMQ, nightly + on settlement):

```sql
CREATE TABLE seller_daily_stats (
  stat_id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  seller_id         BIGINT NOT NULL REFERENCES seller_profiles(user_id) ON DELETE CASCADE,
  stat_date         DATE NOT NULL,
  revenue           DECIMAL(14,2) NOT NULL DEFAULT 0,
  orders_count      INTEGER NOT NULL DEFAULT 0,
  returns_count     INTEGER NOT NULL DEFAULT 0,
  top_category_id   BIGINT REFERENCES categories(category_id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_seller_daily_stats_seller_date
  ON seller_daily_stats (seller_id, stat_date);
CREATE INDEX idx_seller_daily_stats_seller_range
  ON seller_daily_stats (seller_id, stat_date DESC);
```

**Rules:**
- Populated by an async job on order settlement + a nightly backfill/reconciliation pass — never computed synchronously in the request path.
- `REQ-F-Analytics-001/002/003/005` (revenue cards, trend chart, top-products, date-range filter) all read from this table, not from raw `orders`.
- Per-product breakdowns (top-products list) can either extend this table with a companion `seller_product_daily_stats` or be computed on-demand from `order_items` filtered by the already-narrow date range — service-layer decision, not a schema blocker.

---

### 15.2 New table: `seller_recommendations` (AI recommendation cards — F7, R1.1)

**Problem:** AppFlow SCR-S08 requires a dismissible AI recommendation card ("dismiss AI card [R1.1] (suppress 14 days)"), and PRD REQ-F-Analytics-004 requires ≥1 AI recommendation per seller. No table exists to persist the recommendation text or its dismiss-state.

**Fix:**

```sql
CREATE TABLE seller_recommendations (
  recommendation_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  seller_id          BIGINT NOT NULL REFERENCES seller_profiles(user_id) ON DELETE CASCADE,
  message            TEXT NOT NULL,          -- plain-language, AI-generated
  basis              JSONB NULL,             -- optional: data points the recommendation was derived from
  generated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  dismissed_until    TIMESTAMPTZ NULL,        -- set to now() + 14 days on dismiss
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_seller_recommendations_seller_active
  ON seller_recommendations (seller_id, generated_at DESC);
```

**Rules:**
- A recommendation is "active" for display if `dismissed_until IS NULL OR dismissed_until < now()`.
- Generation is an R1.1 async job (AI Service `/recommend`), never synchronous with page load.

---

### 15.3 Decision: `tracking_events` scope — order-status history

**Problem:** `tracking_events.status` uses the full `order_status` enum, but the table is populated by the courier-polling job (REQ-F-Track001), which has no natural way to log pre-shipment transitions (`PAYMENT_PENDING → PAYMENT_CONFIRMED`, system auto-`CANCELLED` on payment failure, etc.). Left ambiguous, admins/support have no reliable single table to answer "what happened to this order and when."

**Binding decision:** `tracking_events` is the **single system of record for every `orders.status` transition**, not just courier-driven ones.

**Rule:** Any code path that updates `orders.status` — whether the courier-poll job, the payment-confirmation webhook handler, the checkout service (initial `PAYMENT_PENDING`), or an admin action — **must** insert a corresponding `tracking_events` row in the same transaction as the status update. `location_lat/location_lng` remain nullable and are simply omitted for non-courier transitions (e.g., payment confirmation has no GPS location).

No new table is required — this is a process rule, not a schema change. Document this rule in TRD §8 (or wherever service-layer invariants are specified) so every module author implements it consistently.

---

### 15.4 Documentation: BigInt → JSON serialization strategy

**Problem:** All PKs/FKs use `BigInt` (§2, correct for performance at stated scale). Node's native `JSON.stringify()` throws on `BigInt` values — any Express endpoint returning a raw Prisma result containing a `BigInt` field will crash at runtime the first time it's hit.

**Binding rule (add to TRD §5.1 or Core API module conventions):**
> All `BigInt` fields (every `*_id` PK/FK) are serialized to `string` at the API response boundary, via a global override:
> ```ts
> (BigInt.prototype as any).toJSON = function () { return this.toString(); };
> ```
> registered once at server bootstrap — or equivalently via a DTO-mapping layer if the team prefers explicit response shaping over a global prototype patch. Public-facing UUIDs (`public_id`, `tracking_token`) remain the primary external identifiers per §2; the string-cast BigInt is a fallback for any internal ID that leaks through, not the intended client-facing reference.

This is process/config, not a schema change — no DDL required.

---

### 15.5 Denormalize `seller_id` onto `returns`

**Problem:** BR-006 (fraud-rate flag at 20%/auto-suspend at 40%, rolling 30 days) requires computing a per-seller return count, but `returns` only reaches `seller_id` via `order_id → orders.seller_id`. At stated scale (100M orders), this join runs on every fraud-rate recompute.

**Fix:** Add to §4.15:

```sql
ALTER TABLE returns ADD COLUMN seller_id BIGINT NOT NULL REFERENCES seller_profiles(user_id);
CREATE INDEX idx_returns_seller_created ON returns (seller_id, created_at);
```

**Rule:** `seller_id` is populated from `orders.seller_id` at return-creation time (snapshot, consistent with the schema's existing snapshot pattern for `order_items`/`orders.commission_rate_snapshot`) — never joined at read time for the fraud-rate job.

---

### 15.6 Add onboarding progress state to `seller_profiles`

**Problem:** AppFlow SCR-S00 requires: *"partial completion persists; revisiting resumes at last step."* No field currently tracks wizard progress — inferring it from which fields are non-null is fragile and ambiguous (a null `store_description` could mean "not reached" or "left blank on purpose").

**Fix:** Add to §4.2:

```sql
ALTER TABLE seller_profiles ADD COLUMN onboarding_step SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE seller_profiles ADD COLUMN onboarding_completed_at TIMESTAMPTZ NULL;
```

**Rule:** `onboarding_step` increments as the seller completes each wizard step (1 = store info, 2 = payout wallet, 3 = optional branding); `onboarding_completed_at` is set once all required steps are done. Selling features (REQ-F-Auth005) remain blocked while `onboarding_completed_at IS NULL`.

---

### 15.7 Deferred (optional, not blocking MVP): broadcast campaign table

**Note only — no action required until Phase 8.** When F21 (Admin Broadcast Tool, R1.1) is actually built, add a `broadcast_campaigns` table (`campaign_id, segment, template, sent_by, sent_at`) and add `notifications.campaign_id` (nullable FK) so broadcast-originated notifications are distinguishable from lifecycle-event notifications and can be reported on as a batch. Not required for MVP; flagged here only so it isn't forgotten.

---

*Addendum §15 is binding and additive. Together with §14, it forms the complete pre-implementation correction layer for this schema. No further schema changes were identified as blocking in the full audit.*