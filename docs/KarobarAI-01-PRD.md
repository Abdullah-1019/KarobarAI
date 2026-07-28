# KarobarAI — Product Requirements Document (PRD)

**Document 1 of 6 — Software Blueprint Series**
**Project:** KarobarAI — Generative-AI E-Commerce Platform for Micro-Sellers in Pakistan
**Version:** 1.0 (PRD)
**Source SRS:** KarobarAI FYP SRS, Lahore Garrison University (Rafia Akbar, Abdullah Afzal; Supervisor: Miss Anila Amjad)
**Status:** Draft for approval

---

## 0. Reading Guide & Canonical Decisions

This PRD supersedes the source SRS wherever they conflict. Five architectural decisions were agreed before authoring and are binding across all six blueprint documents:

| # | Decision | Replaces in SRS | Rationale |
|---|----------|-----------------|-----------|
| D1 | **Single PostgreSQL** datastore via Prisma ORM | MongoDB + MySQL split (§2.1, §3.3.6); the SRS itself models everything relationally in Fig 4 / Fig 11, so this only makes the document self-consistent | Removes the impossible cross-database FK (`order_items.product_id → products`); gives ACID, native bilingual full-text search (`tsvector`), JSONB for flexible AI content, and a clear path to `pgvector` later |
| D2 | **Adapter pattern: mock implementations now, real sandbox/production adapters behind the same interface later** | "Real APIs assumed available" (§2.7) | JazzCash/Easypaisa and TCS/Leopards/Trax require merchant onboarding not available to a student team; mocks unblock the full build and demo, real adapters drop in without code changes |
| D3 | **GPT-3.5-turbo as practical fallback**; ReturnsAI 95% accuracy reframed as a **target with confidence-thresholded manual review** | Self-hosted LLaMA 3 70B fallback (§3.3.1); 95% hard deploy gate (REQ-AI-Return-001) | No-budget FYP cannot self-host a 70B model on GPU; a manual-review safety net is the correct production pattern and de-risks the academic deliverable |
| D4 | **One seller per order**, **persisted cart** (cross-device), **buyer pays shipping** (separate line in `total_amount`) | Undefined in SRS | Resolves multi-seller order splitting, cart persistence, and shipping-cost ambiguity |
| D5 | **MVP-first** scope; everything else in explicit **Future Scope** | "Everything at once" implied by SRS | Realistic for a fixed 20-week, no-budget FYP timeline |

**Positioning correction:** the SRS subtitle calls KarobarAI an *"SLM-driven agentic"* platform. The system as specified is a **generative-AI + computer-vision** platform (frontier LLM for content, CV for returns) with **no autonomous agent loop**. This PRD adopts the accurate positioning: *"Generative-AI e-commerce platform."* If the FYP narrative requires an "agentic" framing, see Future Scope §17.4 for a lightweight tool-using agent that would justify the term.

**Requirement traceability:** SRS requirement IDs (e.g. `REQ-F-Store001`) are preserved throughout so downstream documents and AI coding agents can trace each capability back to the source.

---

## 1. Executive Summary

KarobarAI is a Pakistan-only, Urdu/English, mobile-first e-commerce platform that lets a micro-seller go from a single product photo to a live, bilingual, publishable storefront listing in under five minutes — with no writing, SEO, or technical skill required. It removes the operational barriers that keep Pakistan's ~5.2 million small businesses off digital commerce: listing creation, courier selection, order tracking, returns handling, and analytics are all automated or AI-assisted.

The platform combines a transactional commerce spine (catalog, cart, checkout, orders, payments, settlement) with four AI-driven differentiators: the **AI Store Builder** (photo → bilingual listing), **Intelligent Logistics** (automatic best-courier selection across TCS, Leopards, Trax), **Live Order Tracking** (real-time visibility with SMS/WhatsApp), and **ReturnsAI** (computer-vision-assisted return validation). A **Seller Analytics Dashboard** closes the loop with plain-language, AI-generated business recommendations.

This PRD scopes a buildable **MVP** that delivers a complete, demonstrable marketplace with the flagship AI Store Builder, then sequences the heavier AI features (ReturnsAI automation, AI analytics) as a Release 1.1 core-completion phase, with self-hosted models, native apps, and international expansion explicitly deferred.

---

## 2. Product Vision

> **For** Pakistani micro-sellers who want to sell online but are blocked by complexity — **and** the buyers who want a trustworthy local shopping experience — KarobarAI **is** an AI-powered marketplace **that** turns a single photo into a live bilingual store and automates the entire fulfilment lifecycle. **Unlike** global platforms (Shopify, Amazon, Daraz) that assume English fluency, business infrastructure, and manual listing work, KarobarAI **is built natively for Pakistan**: PKR, Urdu-first, local couriers, local wallets, and automation tuned for first-time sellers on low-bandwidth phones.

The long-term vision is to become the default operating system for small-scale commerce in Pakistan — the layer a seller opens every morning to run their entire business from a phone.

---

## 3. Product Goals

1. **Eliminate listing friction.** Reduce time-to-first-published-listing to under 5 minutes for a non-technical seller (SRS §1.1, §4.1).
2. **Automate fulfilment decisions.** Remove courier selection as a manual task; route every order to the optimal courier automatically (SRS §4.2).
3. **Build buyer trust through visibility.** Give buyers real-time, login-free order tracking with proactive notifications (SRS §4.3).
4. **Protect seller livelihoods.** Reduce return fraud losses through objective, evidence-based return validation (SRS §4.4).
5. **Turn data into action.** Convert raw sales data into plain-language recommendations sellers can act on (SRS §4.5).
6. **Be usable on the worst connection a target user has.** All primary screens load in under 3 seconds on simulated 3G (SRS REQ-NF-Perf001).
7. **Be bilingual everywhere.** Every user-facing surface supports Urdu (RTL, Noto Nastaliq) and English with no page reload (SRS §2.5).

---

## 4. Problem Statement

Pakistan has over 5.2 million registered small businesses, yet digital-commerce adoption among micro-sellers remains low (SRS §1.4). The barrier is not unwillingness — it is **complexity**:

- **Listing creation is hard.** Writing compelling, SEO-aware, bilingual product descriptions is beyond most micro-sellers' time and skill.
- **Logistics is a maze.** Choosing among multiple couriers on price, speed, reliability, and COD coverage for every order is error-prone and time-consuming.
- **Buyers have no visibility.** After placing an order, buyers historically hear nothing until delivery, eroding trust.
- **Returns are a fraud vector.** Buyers can claim damage and return used or substituted goods, and sellers absorb the loss with no objective adjudication.
- **Sellers fly blind.** Without analytics, sellers cannot see what is working or why returns spike on certain products.

Existing global platforms assume English fluency, business email, formal infrastructure, and manual listing labour — none of which fit a Pakistani micro-seller using a budget Android phone on a patchy connection.

---

## 5. Target Audience

**Primary market:** Micro-sellers and small-shop owners across Pakistan with basic smartphone literacy and no prior e-commerce experience — the daily, high-frequency users the entire product is optimised for.

**Secondary market:** Pakistani online buyers spanning tech-comfortable shoppers to first-time online purchasers, who need a fast, trustworthy purchase-to-delivery experience.

**Geographic scope (v1):** Pakistan only; PKR currency; Urdu + English. International expansion is out of scope (D5, SRS §1.4).

---

## 6. Stakeholders

| Stakeholder | Interest / Stake |
|-------------|------------------|
| Micro-sellers (primary users) | Frictionless selling, fast payouts, fraud protection |
| Buyers (secondary users) | Trust, visibility, fair returns |
| Platform operator (KarobarAI business) | GMV growth, commission revenue, low support load |
| Platform administrators | Moderation, dispute resolution, fraud control, uptime |
| Customer support staff | Quick access to order/return data, dispute tooling |
| FYP team (Rafia Akbar, Abdullah Afzal) | Demonstrable, defensible academic deliverable |
| FYP supervisor (Miss Anila Amjad) | Requirements satisfaction, engineering rigour |
| External providers (couriers, wallets, AI/CV vendors) | Integration partners (mocked in MVP per D2) |
| Regulators (SBP, data-protection framework) | Compliant payment handling and data protection |

---

## 7. User Personas

**Persona 1 — Ayesha, the Micro-Seller (Primary).**
32, runs a home-based clothing and accessories business in Faisalabad. Owns a mid-range Android phone, comfortable with WhatsApp but has never built a website. Photographs products on her phone. Time-poor, juggling family and business. **Needs:** maximum automation, minimum typing, Urdu interface, fast payouts, protection from fraudulent returns. **Frustrations:** writing descriptions, deciding which courier to use, chasing payment confirmations. **Success looks like:** photographing an item and having it live and selling within minutes.

**Persona 2 — Bilal, the First-Time Buyer (Secondary).**
24, student in Lahore, buying online for the first time. Cautious about scams and "where is my order" anxiety. Prefers Cash on Delivery until he trusts the platform. **Needs:** clear product information, trustworthy seller signals, real-time tracking, easy returns. **Frustrations:** no updates after ordering, fear of paying for goods that never arrive. **Success looks like:** ordering with COD, getting SMS updates at every step, tracking the parcel on a map.

**Persona 3 — Sana, the Platform Administrator.**
Internal operations staff, technically proficient, uses the platform weekly. **Needs:** to suspend/ban bad actors, release stuck payments, override AI return decisions with a reason, moderate listings, and read platform-level KPIs (GMV, active users, API uptime). **Frustrations:** opaque AI decisions, no audit trail, manual reconciliation.

**Persona 4 — Faisal, the Support Agent.**
Handles disputes, return appeals, and seller queries. **Needs:** fast lookup of any order or return and its full history. **Frustrations:** scattered data, no single view of a case.

---

## 8. Competitive Analysis

| Platform | Strengths | Gaps for Pakistani micro-sellers | KarobarAI's edge |
|----------|-----------|----------------------------------|------------------|
| **Daraz** | Large marketplace, local logistics, COD | High competition, complex seller onboarding, no AI listing help, English-leaning | AI listing in seconds, Urdu-first, automation tuned for solo sellers |
| **Shopify** | Powerful store builder, app ecosystem | Monthly cost in USD, English-only setup, no local courier/wallet integration, manual listing | No subscription, PKR, native local couriers + wallets, AI-written listings |
| **Facebook/Instagram Shops** | Where sellers already are, free | No real fulfilment, tracking, returns, or analytics; manual everything | Full fulfilment lifecycle + automation + analytics |
| **WhatsApp-only selling** | Zero friction to start, ubiquitous | No catalog, payments, tracking, or fraud protection; entirely manual | Structured catalog + payments + tracking + returns while keeping WhatsApp notifications |
| **Amazon (global)** | Best-in-class logistics | Not localised for Pakistan, not micro-seller-friendly | Built for the Pakistani micro-seller as the primary user |

**Positioning summary:** KarobarAI is the only option that pairs *near-zero listing effort* (AI Store Builder) with a *complete localised fulfilment lifecycle* (local couriers, local wallets, tracking, returns) for the non-technical Pakistani micro-seller.

---

## 9. Business Objectives

1. **Adoption:** drive new-seller activation (registration → first published product) with onboarding completable in under 10 minutes (SRS REQ-NF-Quality-008).
2. **GMV growth:** grow gross merchandise value through reduced listing friction and higher buyer trust.
3. **Revenue:** earn a configurable platform commission (default 5%) on every completed transaction (SRS BR-003, REQ-F-Payment-006).
4. **Retention:** keep sellers returning daily by being their primary business tool (analytics, notifications, fast payouts).
5. **Trust & integrity:** keep return-fraud losses and disputes low via objective return validation and clear audit trails.
6. **Operational efficiency:** keep support load low through self-service tracking, plain-language AI explanations, and automation.

---

## 10. User Roles

| Role | Description | Typical frequency |
|------|-------------|-------------------|
| **Guest** | Unauthenticated visitor; can browse, search, and view public tracking pages | Variable |
| **Buyer** | Registered customer; browses, purchases, tracks, reviews, initiates returns | Frequent |
| **Seller** | Registered micro-seller; manages store, listings, orders, returns, analytics, payouts | Daily (primary) |
| **Admin** | Platform operations; user management, payment release, AI overrides, moderation, config, KPIs | Weekly |
| **Support** | Customer support; read-heavy access to orders/returns, dispute handling | Daily |

A single `User` record carries a `role` enum; Seller and Buyer extend `User` with role-specific profile data (SRS §5.6.2). Admin and Support are role flags on internal accounts.

---

## 11. Permission Matrix

Legend: ✅ allowed · ❌ denied · 🟡 own records only · ⚙️ with mandatory reason/audit

| Capability | Guest | Buyer | Seller | Support | Admin |
|------------|:-----:|:-----:|:------:|:-------:|:-----:|
| Browse & search products | ✅ | ✅ | ✅ | ✅ | ✅ |
| View public tracking page | ✅ | ✅ | ✅ | ✅ | ✅ |
| Register / log in | ✅ | ✅ | ✅ | ✅ | ✅ |
| Manage own cart / checkout | ❌ | ✅ | ❌¹ | ❌ | ❌ |
| Place order | ❌ | ✅ | ❌¹ | ❌ | ❌ |
| Initiate / appeal return | ❌ | 🟡 | ❌ | ❌ | ✅ |
| Create / edit / publish listing | ❌ | ❌ | 🟡 | ❌ | ⚙️ |
| Use AI Store Builder | ❌ | ❌ | ✅ | ❌ | ❌ |
| View own order management | ❌ | 🟡 | 🟡 | ✅ | ✅ |
| Confirm & book courier | ❌ | ❌ | 🟡 | ❌ | ⚙️ |
| Override AI courier selection | ❌ | ❌ | 🟡⚙️ | ❌ | ⚙️ |
| Override AI return decision | ❌ | ❌ | 🟡⚙️ | ❌ | ⚙️ |
| View own analytics | ❌ | ❌ | 🟡 | ❌ | ✅ |
| Configure payout wallets | ❌ | ❌ | 🟡 | ❌ | ⚙️ |
| Submit product review | ❌ | 🟡² | ❌ | ❌ | ❌ |
| Suspend / ban accounts | ❌ | ❌ | ❌ | ❌ | ✅ |
| Manually release stuck payment | ❌ | ❌ | ❌ | ❌ | ✅ |
| Resolve dispute (final) | ❌ | ❌ | ❌ | 🟡³ | ✅ |
| Moderate listings | ❌ | ❌ | ❌ | 🟡³ | ✅ |
| Set commission / courier weights | ❌ | ❌ | ❌ | ❌ | ✅ |
| Broadcast SMS/WhatsApp | ❌ | ❌ | ❌ | ❌ | ✅ |
| View platform KPIs (GMV, uptime) | ❌ | ❌ | ❌ | 🟡³ | ✅ |

¹ A seller account uses a separate buyer flow if it also purchases; selling and buying are distinct roles on distinct records.
² Reviews are gated to verified purchases (assumption confirmed in pre-flight).
³ Support has read access and can prepare cases; final destructive/financial actions require Admin.

---

## 12. Functional Requirements

Functional requirements are grouped by feature and tagged with their SRS IDs for traceability. **MVP** = required for the first releasable version; **R1.1** = core-completion release within the FYP timeline if schedule permits; **Future** = post-v1 (see §17).

### 12.1 AI Store Builder (SRS §4.1) — *MVP*

| ID | Requirement | Priority | Scope |
|----|-------------|----------|-------|
| REQ-F-Store001 | Reject product images larger than 10 MB; accept JPEG/PNG/WebP | HIGH | MVP |
| REQ-F-Store002 | AI generates bilingual (UR/EN) title, 2–3 sentence description, category, and 5–10 SEO tags | HIGH | MVP |
| REQ-F-Store003 | All AI-generated fields are editable; publishing requires at least title, one image, and category | HIGH | MVP |
| REQ-F-Store004 | Show a progress indicator during generation; block submission until generation completes or fails | HIGH | MVP |
| REQ-F-Store005 | On failure/timeout: show error, offer Retry, leave fields blank for manual entry | HIGH | MVP |
| REQ-F-Store006 | Support Draft status — product hidden from storefront until published | MEDIUM | MVP |
| REQ-F-Store007 | Compress images to under 200 KB before CDN storage without perceptible quality loss; **compression begins client-side before upload** (latency correction) | MEDIUM | MVP |
| REQ-AI-Store001 | GPT-4 Vision primary; **GPT-3.5-turbo fallback** (D3); switching via config only, no code change | HIGH | MVP |
| REQ-AI-Store002 | AI output conforms to JSON schema `{ title_en, title_ur, description_en, description_ur, category, tags }` | HIGH | MVP |

### 12.2 Intelligent Logistics Management (SRS §4.2) — *MVP*

| ID | Requirement | Priority | Scope |
|----|-------------|----------|-------|
| REQ-F-Logistics-001 | Integrate at least 2 of 3 couriers (TCS, Leopards, Trax) for rate retrieval and booking — **via mock adapters in MVP, real adapters later (D2)** | HIGH | MVP |
| REQ-F-Logistics-002 | Call all courier adapters in parallel on order placement (`Promise.all`, 10s timeout each) | HIGH | MVP |
| REQ-F-Logistics-003 | Score couriers: cost 40%, delivery time 30%, reliability 20%, coverage 10%; weights admin-configurable | HIGH | MVP |
| REQ-F-Logistics-004 | One-click "Confirm & Book Courier" with no additional form input | HIGH | MVP |
| REQ-F-Logistics-005 | Retry booking up to 3× at 30s intervals, then fall back to next-best courier | HIGH | MVP |
| REQ-F-Logistics-006 | Route COD orders only to couriers supporting COD at the destination city | HIGH | MVP |
| REQ-F-Logistics-007 | If all adapters fail, flag order `PENDING_MANUAL_LOGISTICS` and notify seller (SMS + in-app) | HIGH | MVP |
| REQ-F-Logistics-008 | Allow seller to override AI courier selection; log overrides for analytics | MEDIUM | MVP |

### 12.3 Live Order Tracking (SRS §4.3) — *MVP*

| ID | Requirement | Priority | Scope |
|----|-------------|----------|-------|
| REQ-F-Track001 | Poll courier tracking adapter every 5 minutes for all active orders | HIGH | MVP |
| REQ-F-Track002 | Push status updates to seller and buyer via WebSocket in real time | HIGH | MVP |
| REQ-F-Track003 | Display map embed with last known location and a visual delivery-stage timeline | HIGH | MVP |
| REQ-F-Track004 | Auto-send SMS at: Confirmed, Picked Up, In Transit, Out for Delivery, Delivered | HIGH | MVP |
| REQ-F-Track005 | Create a login-free public tracking link per order; include it in notifications | MEDIUM | MVP |
| REQ-F-Track006 | After 3 consecutive failed polls, notify seller via in-app alert | MEDIUM | MVP |
| REQ-F-Track007 | Retain tracking history per order for ≥12 months after delivery | MEDIUM | MVP |
| REQ-F-Track008 | All notifications in the buyer's preferred language (UR/EN) | MEDIUM | MVP |

### 12.4 ReturnsAI System (SRS §4.4) — *R1.1 (workflow MVP-adjacent; AI automation R1.1)*

| ID | Requirement | Priority | Scope |
|----|-------------|----------|-------|
| REQ-F-Return-001 | Enforce 14-day return window from delivery; block initiation afterward (window admin-configurable) | HIGH | MVP |
| REQ-F-Return-002 | Require ≥3 product photos; submit disabled until met | HIGH | MVP |
| REQ-F-Return-003 | AI pipeline classifies condition (undamaged/minor/major/destroyed) and checks visual authenticity | HIGH | R1.1 |
| REQ-F-Return-004 | Produce an automated approve/reject decision within 60 seconds **when confidence ≥ threshold; otherwise route to manual review (D3)** | HIGH | R1.1 |
| REQ-F-Return-005 | On approval: auto-book courier pickup and queue refund within 24h | HIGH | R1.1 |
| REQ-F-Return-006 | On rejection: provide a plain-language reason and an appeal pathway | HIGH | MVP |
| REQ-F-Return-007 | On AI failure/low confidence: flag for manual review; notify seller and admin | HIGH | MVP |
| REQ-F-Return-008 | Sellers may override AI decisions, subject to logging and admin visibility | MEDIUM | R1.1 |
| REQ-F-Return-009 | Buyer appeals resolved within 5 business days; admin decisions final | MEDIUM | MVP |
| REQ-AI-Return-001 | Custom CNN **targets** ≥95% validation accuracy; below the confidence threshold, decisions go to manual review rather than auto-approve/reject (D3) | HIGH→target | R1.1 |
| REQ-AI-Return-002 | Images not visually matching the listing are flagged for manual review, never auto-approved | HIGH | R1.1 |

*MVP ships a complete returns **workflow** (window enforcement, photo upload, manual review queue, appeal, admin override, refund). R1.1 adds the **AI automation layer** (Cloud Vision labels + custom CNN) on top, with manual review as the always-present floor.*

### 12.5 Seller Analytics Dashboard (SRS §4.5) — *R1.1 (basic metrics MVP-adjacent; AI cards R1.1)*

| ID | Requirement | Priority | Scope |
|----|-------------|----------|-------|
| REQ-F-Analytics-001 | Total revenue: current month, previous month, YTD, with % change | MEDIUM | MVP |
| REQ-F-Analytics-002 | Daily sales trend chart and revenue breakdown by category | MEDIUM | MVP |
| REQ-F-Analytics-003 | Top-products list | MEDIUM | MVP |
| REQ-F-Analytics-004 | Generate ≥1 AI recommendation per seller (plain-language, data-derived) | MEDIUM | R1.1 |
| REQ-F-Analytics-005 | Date-range filtering (7d/30d/3m/custom); reload within 3s | MEDIUM | MVP |
| REQ-F-Analytics-006 | Export analytics report as PDF or Excel | LOW | Future |

### 12.6 Authentication & Account Management (SRS §4.6) — *MVP*

| ID | Requirement | Priority | Scope |
|----|-------------|----------|-------|
| REQ-F-Auth001 | OTP: 6 digits, 10-minute validity, max 5 resends/hour | HIGH | MVP |
| REQ-F-Auth002 | Password: ≥8 chars incl. upper, lower, digit, special | HIGH | MVP |
| REQ-F-Auth003 | JWT access tokens (1h, RS256) + HttpOnly refresh tokens (7d) | HIGH | MVP |
| REQ-F-Auth004 | RBAC for Buyer, Seller, Admin (and Support) with defined endpoint permissions | HIGH | MVP |
| REQ-F-Auth005 | First-login store-setup wizard: store name, description, ≥1 payout wallet | HIGH | MVP |
| REQ-F-Auth006 | Admin can suspend/deactivate accounts; suspension invalidates active sessions immediately | HIGH | MVP |
| REQ-F-Auth007 | Account lockout after 5 failed logins in 15 min; 30-min lockout or until reset | HIGH | MVP |
| REQ-F-Auth008 | Optional 2FA for sellers via SMS OTP | LOW | Future |

*(SRS §4.6's "Description" paragraph was an erroneous copy of the payment-settlement text; the corrected description is: account management covers mobile-OTP and email registration, role-based login, the store-setup wizard, and session/lockout security.)*

### 12.7 Payment Processing & Settlement (SRS §4.7) — *MVP*

| ID | Requirement | Priority | Scope |
|----|-------------|----------|-------|
| REQ-F-Payment-001 | Support JazzCash wallet, Easypaisa wallet, and COD — **via mock adapters in MVP (D2)** | HIGH | MVP |
| REQ-F-Payment-002 | All payment calls server-side only; webhooks HMAC/signature-verified before status updates | HIGH | MVP |
| REQ-F-Payment-003 | Retry failed payments up to 3× at 1-min intervals; cancel and notify buyer if all fail | HIGH | MVP |
| REQ-F-Payment-004 | Idempotency keys on all payment calls to prevent duplicate charges | HIGH | MVP |
| REQ-F-Payment-005 | Settle seller payout within 48h of confirmed delivery (72h for COD) | HIGH | MVP |
| REQ-F-Payment-006 | Commission rate admin-configurable without code change (default 5%) | MEDIUM | MVP |
| REQ-F-Payment-007 | Trigger full refund within 24h of return approval — to the **original wallet for prepaid; via a defined COD refund channel** (see §12.8) | HIGH | MVP |
| REQ-F-Payment-008 | Store only gateway-issued transaction reference IDs; never store wallet PINs/credentials | HIGH | MVP |

### 12.8 COD Money Flow & Reconciliation (gap closed) — *MVP*

The SRS leaves the COD remittance and refund path undefined. This PRD defines it:

| ID | Requirement | Priority | Scope |
|----|-------------|----------|-------|
| REQ-F-COD-001 | For COD orders, the courier collects cash and remits to the platform per the courier remittance cycle; the platform records an expected-remittance ledger entry per order | HIGH | MVP |
| REQ-F-COD-002 | On confirmed courier remittance, the platform settles the seller payout (order value − commission − shipping rules) within 72h | HIGH | MVP |
| REQ-F-COD-003 | COD refunds are issued to the buyer's nominated wallet (JazzCash/Easypaisa) captured at return approval, since no card/wallet charge exists to reverse | HIGH | MVP |
| REQ-F-COD-004 | All settlement and remittance records are immutable once written; corrections via compensating ledger entries only (SRS REQ-NF-Safety-007) | HIGH | MVP |

### 12.9 Cart & Checkout (gap closed) — *MVP*

| ID | Requirement | Priority | Scope |
|----|-------------|----------|-------|
| REQ-F-Cart-001 | Cart is **persisted per buyer** and synchronised across devices (D4) | HIGH | MVP |
| REQ-F-Cart-002 | A cart spanning multiple sellers is **split into one order per seller at checkout** (D4); each split order has its own logistics, payment line, and tracking | HIGH | MVP |
| REQ-F-Cart-003 | Checkout collects delivery address, payment method (JazzCash/Easypaisa/COD), and shows a full order summary including a separate **shipping line** (buyer pays shipping, D4) | HIGH | MVP |
| REQ-F-Cart-004 | Enforce minimum order value PKR 100 (admin-configurable); block below-minimum at checkout (SRS BR-005) | MEDIUM | MVP |

### 12.10 Inventory Management (gap closed) — *MVP*

| ID | Requirement | Priority | Scope |
|----|-------------|----------|-------|
| REQ-F-Inv-001 | Each product has a stock count; stock is decremented atomically on order confirmation | HIGH | MVP |
| REQ-F-Inv-002 | Prevent oversell: block checkout for quantities exceeding available stock | HIGH | MVP |
| REQ-F-Inv-003 | Display out-of-stock state on listings; hide from default storefront results when stock = 0 | MEDIUM | MVP |
| REQ-F-Inv-004 | Restore stock on cancellation/rejected payment | MEDIUM | MVP |

### 12.11 Product Search & Browse (SRS §4.8) — *MVP*

| ID | Requirement | Priority | Scope |
|----|-------------|----------|-------|
| REQ-F-Browse-001 | Full-text search across UR/EN titles, descriptions, tags (PostgreSQL `tsvector`, D1) | MEDIUM | MVP |
| REQ-F-Browse-002 | Autocomplete suggestions after N characters | MEDIUM | MVP |
| REQ-F-Browse-003 | Filters: category, price range, seller rating, condition; sorts: relevance, price, newest, rating | MEDIUM | MVP |
| REQ-F-Browse-004 | Buyers submit 1–5 star rating + written review for purchased products | MEDIUM | R1.1 |
| REQ-F-Browse-005 | Wishlist from listing/detail pages | LOW | Future |

### 12.12 Notification Center (SRS §4.9) — *MVP (SMS + in-app); WhatsApp R1.1*

| ID | Requirement | Priority | Scope |
|----|-------------|----------|-------|
| REQ-F-Notif001 | Send SMS (MVP) + WhatsApp (R1.1) at: order placed, confirmed, picked up, in transit, out for delivery, delivered, return decision, refund issued | MEDIUM | MVP/R1.1 |
| REQ-F-Notif002 | In-app notification bell with unread count and chronological list | MEDIUM | MVP |
| REQ-F-Notif003 | All templates in UR/EN, by recipient preference | MEDIUM | MVP |
| REQ-F-Notif004 | Critical transactional notifications cannot be disabled; non-critical configurable per user | MEDIUM | MVP |
| REQ-F-Notif005 | All notifications dispatched asynchronously via BullMQ/Redis queue | MEDIUM | MVP |

### 12.13 Admin & Support (SRS §3.1.3) — *MVP*

| ID | Requirement | Priority | Scope |
|----|-------------|----------|-------|
| REQ-F-Admin-001 | Search, suspend, and ban accounts | HIGH | MVP |
| REQ-F-Admin-002 | Manually release stuck payments | HIGH | MVP |
| REQ-F-Admin-003 | Override AI return decisions with a mandatory reason (audited) | HIGH | MVP |
| REQ-F-Admin-004 | Listing moderation (takedown of prohibited items per SRS BR-001) | HIGH | MVP |
| REQ-F-Admin-005 | Platform KPI dashboard: GMV, active users, API/adapter uptime | MEDIUM | MVP |
| REQ-F-Admin-006 | Config panel: commission rate, courier weights, return window, minimum order value | HIGH | MVP |
| REQ-F-Admin-007 | Broadcast SMS/WhatsApp to seller/buyer segments | LOW | R1.1 |

---

## 13. Non-Functional Requirements

Tagged with SRS IDs; targets reflect the pragmatic-production interpretation agreed in pre-flight.

### 13.1 Performance (SRS §5.1)
- **REQ-NF-Perf001** — Primary screens load < 3s on simulated 3G (1 Mbps). *MVP.*
- **REQ-NF-Perf002** — Image upload + AI generation completes < 30s under normal load (with client-side compression, D-correction). *MVP.*
- **REQ-NF-Perf003** — Search results < 1s for datasets up to 100,000 listings. *MVP.*
- **REQ-NF-Perf004** — Backend REST p95 latency < 1s for non-AI endpoints. *MVP.*
- **REQ-NF-Perf005** — Support concurrent active users without degradation. *SRS specifies 1,000; this PRD reframes as a **load-tested target appropriate to provisioned infrastructure** — a single 4 vCPU / 8 GB box (SRS §3.2) running two services, Postgres, and Redis cannot hold 1,000 concurrent; the TRD will define realistic capacity with a horizontal-scaling path.* *MVP target reduced; full target Future.*
- **REQ-NF-Perf006** — Tracking page (incl. map embed) loads < 2s. *MVP.*
- **REQ-NF-Perf007** — PWA offline access for previously loaded pages via service worker. *R1.1.*

### 13.2 Safety (SRS §5.2)
- **REQ-NF-Safety-001** — Automated DB backups every 24h; ≥3 copies across separate availability zones. *MVP (single managed-Postgres automated backups; multi-AZ Future per budget).*
- **REQ-NF-Safety-002** — Documented DR plan: RTO 4h, RPO 1h. *MVP (documented); full multi-region DR Future.*
- **REQ-NF-Safety-003** — Graceful error handling; never expose stack traces to end users. *MVP.*
- **REQ-NF-Safety-004** — Graceful degradation when any dependency fails; affected feature shows a maintenance message, others stay operational. *MVP.*
- **REQ-NF-Safety-005** — API rate limiting: 100 req/min/IP default. *MVP.*
- **REQ-NF-Safety-006** — Deployment rollback to last stable within 30 min. *MVP.*
- **REQ-NF-Safety-007** — Completed payment/settlement records immutable; corrections via compensating transactions only. *MVP.*

### 13.3 Security (SRS §5.3) — *all MVP*
TLS 1.3 minimum with forced HTTPS redirect (Sec-001); strict CORS allowlist, no wildcards (Sec-002); bcrypt cost 12 for passwords (Sec-003); RS256 JWTs (Sec-004); auth + RBAC on every endpoint (Sec-005); OTP expiry/single-use (Sec-006); encryption at rest for phone numbers, wallet IDs, addresses (Sec-007); secrets in a manager, never in source (Sec-008); parameterised queries / ORM only — no string concatenation (Sec-009); output escaping, no `dangerouslySetInnerHTML` (Sec-010); HMAC verification on payment webhooks, reject invalid with 401 (Sec-011); server-side file validation via magic bytes (Sec-012); full OWASP Top 10 review before submission (Sec-013).

### 13.4 Software Quality (SRS §5.4)
- **REQ-NF-Quality-001** — Uptime ≥ 99.5% monthly. *MVP target.*
- **REQ-NF-Quality-002** — Critical bugs (data loss, wrong payments, full feature outage) resolved < 24h. *MVP.*
- **REQ-NF-Quality-003** — Backend unit-test coverage ≥ 80% (Jest/Istanbul), reported in CI. *MVP.*
- **REQ-NF-Quality-004** — All REST endpoints documented via Swagger/OpenAPI 3.0 at `/api-docs`. *MVP.*
- **REQ-NF-Quality-005** — Entire stack Docker-containerised; full platform runnable locally with one command. *MVP.*
- **REQ-NF-Quality-006** — ESLint (JS/TS) + Flake8 (Python) in CI; zero lint errors. *MVP.*
- **REQ-NF-Quality-007** — **WCAG 2.1 AA** (SRS prose value; the SRS requirement text's "AAA" is an inconsistency corrected here to AA). *MVP.*
- **REQ-NF-Quality-008** — Seller onboarding (register → first published product) testable, target < 10 min. *MVP.*
- **REQ-NF-Quality-009** — Cross-platform tested: Android (Chrome), iOS (Safari), Windows (Chrome/Edge), macOS (Safari). *MVP.*

### 13.5 Business Rules (SRS §5.5) — *all MVP, all admin-configurable where noted*
BR-001 prohibited-item ban (weapons, controlled substances, counterfeits, adult content); BR-002 14-day return window (configurable); BR-003 5% commission (configurable); BR-004 payout 24–48h prepaid / 48–72h COD; BR-005 minimum order PKR 100 (configurable); BR-006 fraud flag at 20% / auto-suspend at 40% return-fraud rate in rolling 30 days; BR-007 one return per order; BR-008 admin override on disputes is final; BR-009 Pakistan-only, PKR-only for v1.

---

## 14. User Stories & Acceptance Criteria

Representative stories per epic (Given/When/Then). MVP stories shown; R1.1/Future stories follow the same pattern in their respective phases.

**Epic: AI Store Builder**
- *As a seller, I want to generate a listing from one photo so that I can publish without writing.*
  - **AC1:** Given a valid image ≤10 MB, when I upload it, then a progress indicator appears and all fields lock until generation completes or fails.
  - **AC2:** Given generation succeeds within 30s, then bilingual title, description, category, and 5–10 tags populate and become editable.
  - **AC3:** Given generation fails/times out, then an error and a Retry button appear and fields remain blank for manual entry.
  - **AC4:** Given I click Publish with at least a title, one image, and a category, then the product goes live and I land on its detail page.

**Epic: Logistics**
- *As a seller, I want the best courier chosen automatically so that I don't have to compare rates.*
  - **AC1:** Given an order is placed, when the courier adapters are queried in parallel, then the weighted score (40/30/20/10) selects an optimal courier within the 10s-per-call timeout window.
  - **AC2:** Given the order is COD, then only couriers supporting COD at the destination city are eligible.
  - **AC3:** Given all adapters fail, then the order is flagged `PENDING_MANUAL_LOGISTICS` and I am notified by SMS and in-app.
  - **AC4:** Given I click "Confirm & Book Courier", then booking is attempted with up to 3 retries before falling back to next-best.

**Epic: Tracking**
- *As a buyer, I want live tracking and updates so that I know where my order is.*
  - **AC1:** Given a tracking number is assigned, then status is polled every 5 minutes and pushed to my session via WebSocket without refresh.
  - **AC2:** Given a milestone is reached, then I receive an SMS in my preferred language and the timeline + map update.
  - **AC3:** Given I open the tracking link from SMS, then a read-only public page renders with no login required.

**Epic: Cart & Checkout**
- *As a buyer, I want my cart saved across devices and a clear total so that I can buy with confidence.*
  - **AC1:** Given items from two sellers in my cart, when I check out, then the system creates one order per seller, each with its own shipping line and payment.
  - **AC2:** Given my order is below PKR 100, then checkout is blocked with a clear message.
  - **AC3:** Given I select COD, then shipping cost is shown as a separate line and added to my total.

**Epic: Payments & Settlement**
- *As a seller, I want reliable payouts so that I trust the platform with my income.*
  - **AC1:** Given a prepaid delivery is confirmed, then my payout (value − 5% commission) settles within 48h.
  - **AC2:** Given a duplicate payment callback arrives, then the idempotency key prevents a double charge.
  - **AC3:** Given a payment webhook has an invalid HMAC signature, then it is rejected with HTTP 401 and no status change.

**Epic: Auth & Accounts**
- *As a seller, I want to register with my mobile number so that I don't need a business email.*
  - **AC1:** Given I request an OTP, then a 6-digit code valid for 10 minutes is sent, with max 5 resends/hour.
  - **AC2:** Given 5 failed logins in 15 minutes, then my account locks for 30 minutes or until password reset.
  - **AC3:** Given first login, then the store-setup wizard requires store name, description, and ≥1 payout wallet before I can sell.

**Epic: Returns (workflow MVP; AI R1.1)**
- *As a buyer, I want to request a return with photos so that I can return faulty goods.*
  - **AC1:** Given delivery was ≤14 days ago and no prior return exists, then I can initiate a return; otherwise it is blocked with a closure message.
  - **AC2:** Given I upload fewer than 3 valid photos, then the submit button stays disabled.
  - **AC3 (R1.1):** Given AI confidence is below threshold or the AI fails, then the return is routed to manual review and seller + admin are notified.
  - **AC4:** Given a return is rejected, then I see a plain-language reason and an appeal option resolved within 5 business days.

**Epic: Admin**
- *As an admin, I want to override an AI return decision so that I can resolve disputes fairly.*
  - **AC1:** Given a dispute, when I override, then a reason is mandatory and the action is written to an immutable audit log.
  - **AC2:** Given I change the commission rate in the config panel, then it applies to future settlements without a deployment.

---

## 15. Complete Feature List

| # | Feature | SRS Ref | Scope |
|---|---------|---------|-------|
| F1 | AI Store Builder (photo → bilingual listing) | §4.1 | MVP |
| F2 | Intelligent Logistics (parallel scoring + booking) | §4.2 | MVP |
| F3 | Live Order Tracking (poll + WebSocket + SMS) | §4.3 | MVP |
| F4 | Returns workflow (window, photos, appeal, override) | §4.4 | MVP |
| F5 | ReturnsAI automation (Cloud Vision + CNN + confidence routing) | §4.4 | R1.1 |
| F6 | Seller Analytics — core metrics | §4.5 | MVP |
| F7 | Seller Analytics — AI recommendation cards | §4.5 | R1.1 |
| F8 | Authentication & account management (OTP/email, JWT, RBAC) | §4.6 | MVP |
| F9 | Store-setup onboarding wizard | §4.6 | MVP |
| F10 | Payment processing (mock JazzCash/Easypaisa/COD adapters) | §4.7 | MVP |
| F11 | Seller settlement & payout engine | §4.7 | MVP |
| F12 | COD money flow & reconciliation ledger | new (gap) | MVP |
| F13 | Persisted multi-device cart + multi-seller order splitting | new (gap) | MVP |
| F14 | Inventory management (stock, oversell prevention) | new (gap) | MVP |
| F15 | Product search & browse (full-text UR/EN, filters) | §4.8 | MVP |
| F16 | Reviews & ratings (verified purchase) | §4.8 | R1.1 |
| F17 | Wishlist | §4.8 | Future |
| F18 | Notification Center — in-app + SMS | §4.9 | MVP |
| F19 | Notification Center — WhatsApp channel | §4.9 | R1.1 |
| F20 | Admin console (users, payments, overrides, moderation, KPIs, config) | §3.1.3 | MVP |
| F21 | Admin broadcast tool | §3.1.3 | R1.1 |
| F22 | PWA offline support | §3.2, §5.1 | R1.1 |
| F23 | Bilingual UI with live language switch (Noto Nastaliq RTL) | §2.5, §3.1.4 | MVP |
| F24 | Self-hosted LLaMA fallback | §3.3.1 | Future |
| F25 | Analytics report export (PDF/Excel) | §4.5 | Future |
| F26 | International expansion / multi-currency | §1.4 | Future |
| F27 | Native mobile apps | — | Future |
| F28 | Lightweight tool-using AI agent (true "agentic" layer) | new | Future |

---

## 16. MVP Scope

The MVP is a **complete, demonstrable single-region marketplace** that proves the core thesis (photo → live store → fulfilled order) end-to-end.

**In MVP:**
- Bilingual UI (UR/EN, live switch, Noto Nastaliq RTL) — F23
- Auth & accounts (OTP + email, JWT RS256, RBAC, lockout) + store-setup wizard — F8, F9
- **AI Store Builder** with GPT-4 Vision + GPT-3.5 fallback — F1 *(the headline differentiator; stays in MVP)*
- Catalog, full-text search & browse, filters — F15
- Inventory with oversell prevention — F14
- Persisted cart + multi-seller order splitting — F13
- Checkout with buyer-paid shipping, minimum-order enforcement — F13
- Payments via **mock** JazzCash/Easypaisa/COD adapters; settlement engine; COD ledger — F10, F11, F12
- **Intelligent Logistics** via **mock** courier adapters with the real scoring algorithm — F2
- **Live Order Tracking** (5-min poll, WebSocket, SMS, login-free page, map embed) — F3
- Returns **workflow** (window, ≥3 photos, manual review queue, appeal, admin override, refund) — F4
- Core seller analytics (revenue, trend, top products, date filter) — F6
- Notification Center (in-app + SMS, async queue, bilingual templates) — F18
- Admin console (user mgmt, payment release, AI/return override with reason, moderation, config panel, KPI view) — F20
- Cross-platform tested; OWASP Top 10 review; ≥80% backend coverage; Dockerised one-command run

**MVP success bar:** a non-technical seller can register, complete onboarding, photograph and publish a bilingual product in < 10 minutes; a buyer can search, add to cart, check out (COD or mock wallet), and track the order live with SMS updates; an approved return triggers an automated refund; an admin can moderate and resolve a dispute.

---

## 17. Future Scope

### 17.1 Release 1.1 (within FYP timeline if schedule permits)
- **ReturnsAI automation** (F5): Cloud Vision labels + custom CNN, confidence-thresholded auto-decision with manual-review floor.
- **AI analytics recommendation cards** (F7): weekly plain-language insights.
- **Reviews & ratings** (F16).
- **WhatsApp notification channel** (F19) via Meta Cloud API.
- **Admin broadcast tool** (F21).
- **PWA offline support** (F22).

### 17.2 Post-v1 product
- Wishlist (F17); analytics export PDF/Excel (F25); seller 2FA (REQ-F-Auth008).

### 17.3 Infrastructure & scale
- Self-hosted LLaMA fallback once GPU budget exists (F24).
- Horizontal scaling to the full 1,000+ concurrent target; multi-AZ backups and multi-region DR.
- Native mobile apps (F27).

### 17.4 International & "agentic" evolution
- International expansion + multi-currency (F26).
- A genuine **agentic layer** (F28): a tool-using assistant that can, e.g., draft listings, propose pricing, pre-select couriers, and answer seller questions by calling platform tools — the capability that would make the original "agentic" subtitle accurate.

---

## 18. Success Metrics

| Category | Metric | Target (v1) |
|----------|--------|-------------|
| Activation | Time from registration to first published product | < 10 min |
| Activation | % of new sellers who publish ≥1 product | (baseline; grow over pilot) |
| Engagement | AI Store Builder success rate (generation completes ≤30s) | ≥ 95% |
| Engagement | Daily active sellers | (pilot baseline) |
| Conversion | Search/browse → checkout completion rate | (pilot baseline) |
| Fulfilment | % orders auto-assigned a courier without manual logistics | ≥ 90% |
| Fulfilment | Tracking notification delivery success | ≥ 98% |
| Trust | Return-fraud rate (rolling 30 days) | < 20% (BR-006 flag threshold) |
| Trust | Dispute resolution time | ≤ 5 business days |
| Revenue | Commission GMV captured | track per BR-003 |
| Reliability | Monthly uptime | ≥ 99.5% |
| Performance | Primary screen load on 3G | < 3s |
| Quality | Backend test coverage | ≥ 80% |
| ReturnsAI (R1.1) | CNN validation accuracy | ≥ 95% target; sub-threshold → manual review |

---

## 19. Risks

| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|:----------:|:------:|------------|
| R1 | Payment/courier APIs unavailable to a student team | High | High | **D2 mock adapters behind clean interfaces**; real adapters drop in later without code change |
| R2 | Self-hosting LLaMA 70B infeasible on no budget | High | Medium | **D3:** GPT-3.5 fallback; LLaMA deferred to Future |
| R3 | Custom CNN misses 95% accuracy | Medium | High (if hard gate) | **D3:** target + confidence-thresholded manual review floor; never blocks deploy |
| R4 | LLM API cost overrun | Medium | Medium | Monitor from Week 2 (SRS); cap usage; cache; GPT-3.5 for non-critical paths |
| R5 | 3G performance targets vs. 10 MB uploads | Medium | Medium | **Client-side compression before upload**; lazy loading; CDN; cap effective upload size |
| R6 | Single-box infra can't hold 1,000 concurrent | High | Medium | Reframe MVP capacity target; design stateless services + horizontal-scale path in TRD |
| R7 | Urdu RTL + Noto Nastaliq rendering/perf issues | Medium | Medium | Early spike; font subsetting; test on low-end Android |
| R8 | COD reconciliation complexity | Medium | High | **F12 explicit ledger + compensating-entry model** defined up front |
| R9 | Scope creep across 5 flagship features in 20 weeks | High | High | **D5 MVP-first**; R1.1 and Future clearly fenced |
| R10 | ReturnsAI training-data scarcity | High | Medium | Curate/augment dataset early; manual-review fallback makes the feature shippable regardless |
| R11 | Regulatory change (SBP/data protection) mid-project | Low | Medium | Track guidelines; keep payment handling adapter-isolated |
| R12 | Multi-seller cart edge cases (split orders, partial failures) | Medium | Medium | **F13** split-at-checkout model; per-order isolation of payment/logistics/tracking |

---

## 20. Assumptions

1. Sellers have basic smartphone literacy (upload images, fill simple forms). *(SRS §2.7.1)*
2. Buyers have an internet-connected device. *(SRS §2.7.1)*
3. Target-area connectivity meets the 1 Mbps minimum. *(SRS §2.7.1)*
4. Pakistan e-commerce regulations will not change significantly before completion. *(SRS §2.7.1)*
5. **Mock adapters** faithfully emulate provider request/response/webhook shapes so real adapters can replace them without changing callers. *(D2)*
6. GPT-4 Vision quota is sufficient for development; **GPT-3.5-turbo is the practical fallback**. *(D3)*
7. **One seller per order**; multi-seller carts split at checkout. *(D4)*
8. **Cart is persisted** per buyer and synced across devices. *(D4)*
9. **Buyer pays shipping**, shown as a separate line in the order total. *(D4)*
10. WCAG target is **2.1 AA**. *(pre-flight)*
11. Reviews are gated to verified purchases. *(pre-flight)*
12. Login-free tracking pages default to the order buyer's language, falling back to Urdu. *(pre-flight)*
13. AI tags are stored as a single language-tagged array, not separate columns. *(pre-flight)*
14. "Production-grade" is interpreted pragmatically for a 20-week, no-budget FYP — clean, scalable patterns without gold-plating (e.g. no multi-region DR theatre). *(pre-flight)*

---

## 21. Glossary

| Term | Definition |
|------|------------|
| **AI Store Builder** | Feature converting one product photo into a complete bilingual listing |
| **ReturnsAI** | Computer-vision-assisted return-validation pipeline (Cloud Vision + custom CNN) |
| **Adapter** | A swappable integration module exposing a stable interface; mock now, real later (D2) |
| **Confidence threshold** | The minimum AI confidence above which a return decision may be automated; below it, manual review (D3) |
| **COD** | Cash on Delivery — buyer pays the courier in cash on receipt |
| **GMV** | Gross Merchandise Value — total value of goods sold through the platform |
| **Idempotency key** | A unique key ensuring a payment operation executes at most once |
| **JWT / RS256** | JSON Web Token signed with the RSA SHA-256 asymmetric algorithm |
| **Manual review queue** | Admin/support workflow for returns the AI cannot confidently decide |
| **MVP** | Minimum Viable Product — smallest releasable version proving the core thesis |
| **PWA** | Progressive Web App — installable, offline-capable web application |
| **RBAC** | Role-Based Access Control |
| **Settlement** | Payout of order proceeds (minus commission) to the seller |
| **`tsvector`** | PostgreSQL full-text search type used for bilingual search (D1) |
| **Weighted courier score** | cost 40% + delivery time 30% + reliability 20% + coverage 10% |

---

*End of Document 1 (PRD). On approval, the next document is the **Technical Requirements Document (TRD)**, which will detail the single-Postgres architecture (D1), the adapter layer (D2), the AI fallback + confidence-routing design (D3), and the realistic deployment/scaling model.*
