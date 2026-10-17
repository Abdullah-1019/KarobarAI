# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

Mobile-first responsive web app (React + Vite PWA). No native apps in scope.

## Users

- **Primary: Pakistani micro-sellers and small-shop owners.** They have basic smartphone literacy and no prior e-commerce experience, often on a budget Android phone with a patchy connection. Many are more comfortable in Urdu than English. Their job is to get products online and run orders, couriers and returns from a phone without writing, SEO or technical skill. They are the daily, high-frequency users.
- **Secondary: Pakistani online buyers.** They range from tech-comfortable shoppers to first-time online purchasers. Their job is to find a product, trust the seller, pay (mostly Cash on Delivery) and see where the order is until it arrives.
- **Operators: platform Admin and Support staff.** They moderate listings, manage users, resolve return disputes and tune platform configuration. Support has read-only access; Admin can write.

## Product Purpose

KarobarAI is a Pakistan-only, Urdu/English generative-AI marketplace. A micro-seller goes from **one product photo to a live, bilingual listing in under five minutes**, and the rest of fulfilment is automated: courier selection, live tracking, notifications, returns and settlement.

**Success** means a non-technical seller publishes their first listing in under 5 minutes, and a buyer trusts a small, unknown seller enough to order.

This is a Final Year Project (Lahore Garrison University; Rafia Akbar and Abdullah Afzal). The live demo and defense are a key evaluation moment.

## Positioning

Unlike Daraz, Shopify or Amazon, which assume English fluency, business email and manual listing work, KarobarAI is built for the micro-seller:
- The AI Store Builder turns a photo into a bilingual listing.
- Couriers (TCS, Leopards, Trax) are chosen automatically.
- Buyers get login-free tracking they can share.
- Returns are backed by photo evidence.
- Urdu is first-class everywhere, not an afterthought.

## Operating Context

- **Seller loop:** onboarding wizard → AI Store Builder (photo → listing) → orders → one-click courier booking → returns review → analytics.
- **Buyer loop:** home → search/category → product detail → cart (persisted, one seller per order) → checkout (buyer pays shipping; COD and mock wallets) → confirmation → tracking (also shareable via a public link, e.g. on WhatsApp) → returns.
- **Admin loop:** dashboard alerts → user management → product moderation → returns/disputes → reports → platform config (every write needs an audit reason).
- **Network:** primary screens must load in under 3 seconds on simulated 3G.
- **Payments and couriers:** JazzCash/Easypaisa and TCS/Leopards/Trax are **mock adapters** today (decision D2). The UI must not imply real money movement or real courier APIs beyond what exists.

## Capabilities and Constraints

- **Built (backend + frontend):** Auth (phone OTP + email, RBAC, lockout), profiles, store setup, product management, marketplace search/filter, cart and checkout, orders, courier and tracking (live via Socket.IO), notifications (in-app, plus mock SMS/WhatsApp/Email), returns and refunds, seller analytics, settlement engine, admin panel, and the AI Store Builder (Gemini Flash primary and fallback).
- **Not built:**
  - AI Returns (F14, computer-vision assessment).
  - AI Analytics recommendations (F15).
  - Real external APIs (F16).
  - Wishlist and reviews (future scope).
  - Admin payments and audit-log screens (SCR-AD03 / SCR-AD08).
  - Seller wallet/payout (SCR-S09).
  - A public per-seller store page.
- **Data gaps that limit the UI:** the product DTO has no seller name, verified flag or rating; there is no compare-at/sale price; there is no product-report mechanism. Don't design affordances that would need these until the backend adds them.
- **Team split:** Rafia owns the frontend. Abdullah owns the backend; backend files (incl. `apps/backend/prisma/seed.ts`) are his.
- **Stack:** React 18, TypeScript, Vite, Ant Design 5, React Query, react-i18next, Zustand, Recharts, Leaflet, lucide-react. Monorepo with pnpm (`apps/frontend`, `apps/backend`, `apps/ai-service`, `packages/shared`).
- **Terminology:** Seller, Buyer, Admin, Support (roles); Store; Listing/Product; Order; Return; Settlement; COD; "AI Store Builder".

## Brand Commitments

- **Name:** KarobarAI ("karobar" = business in Urdu).
- **Bilingual:** English and Urdu on every user-facing surface, switching with no page reload. Urdu is RTL; Nastaliq script for Urdu.
- **Binding visual direction ("Studio Light", approved by Rafia 2026-10-17; replaces the 2026-10-16 "Haveli" direction):** move away from the common green-and-white marketplace look, from Daraz-style bright orange, and from the dark-brown "coffee brand" feel. Light, airy and premium: a near-white base, near-black ink, one warm persimmon action, soft washes instead of dark blocks, and a geometric sans for headlines, kept Pakistani through Urdu in Nastaliq, real local content, and COD and returns up front. It should feel real, charming and alive, not dry. The full direction is in `docs/frontend/DESIGN-CONSULT.md`. Visual specifics belong to the design system, not this file.
- **AI honesty:** AI-generated content is labelled as such and stays editable by the seller. Fallback between models is invisible to the user.

## Evidence on Hand

- **Product docs:** `docs/KarobarAI-01-PRD.md` through `-06-ImplementationPlan.md`, App Flow screen IDs (`docs/KarobarAI-03-AppFlow.md`), UI/UX spec (`docs/KarobarAI-04-UIUX.md`), feature handoffs in `docs/handoffs/`.
- **Redesign plan and log:** `docs/frontend/REDESIGN-PLAN-HAVELI.md`, `docs/frontend/WORKLOG.md`.
- **Demo data:** a dev-only seeded catalogue (1 seller, 16 products) with placeholder SVG images at `apps/frontend/public/demo/products/`. These are placeholders, not real photography.
- **Absent, so never fabricate:**
  - Real testimonials, seller stories or customer counts.
  - Sales or user metrics.
  - Press.
  - Partner logos beyond the named couriers and wallets.
  - Product ratings or reviews.

## Product Principles

1. **The seller's first five minutes are sacred.** Every screen on the path from sign-up to first published listing must feel effortless for a non-technical, Urdu-first user.
2. **Trust is the buyer's currency.** A small, unknown seller must look credible. Show real reassurance (COD, returns, tracking) at the moment of decision, never fake proof.
3. **Urdu is not a translation.** Both languages are designed for, including RTL layout and Nastaliq's vertical rhythm.
4. **Show only what's real.** No controls, data or claims the system doesn't actually support (mock adapters, missing fields, unbuilt features).
5. **Works on a cheap phone on 3G.** Mobile-first, light pages, graceful loading and offline-ish states.

## Accessibility & Inclusion

- WCAG 2.1 AA contrast (4.5:1 normal text) and touch targets of at least 44px.
- Visible focus states.
- Status never shown by colour alone.
- Full RTL support via CSS logical properties.
- Designed for low digital literacy: plain language, clear single primary actions, forgiving forms.
