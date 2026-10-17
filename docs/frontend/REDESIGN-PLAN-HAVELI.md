# KarobarAI Frontend Redesign: "Haveli" Plan

**Date:** 2026-10-16
**Scope:** Frontend only (Rafia + Claude). Items needing backend work are marked for Abdullah.
**Timeline:** 4 days
**Goal:** Make the app feel real, charming and alive rather than dry. It should look premium and trustworthy, and stand out from the usual green-and-white marketplaces.

---

## 1. Where we stand (as of commit `d352a02`)

### Backend (Abdullah)
- **Done and tested:** Features 0–13: Auth, Profiles, Store, Products, Marketplace, Cart/Checkout, Orders, Courier/Tracking, Notifications, Returns, Analytics, Settlement engine, Admin Panel, AI Store Builder (Gemini). The last logged run had 740/740 tests passing.
- **Not started:**
  - F14 AI Returns. `ai-service/app/cnn` and `vision` are empty.
  - F15 AI Analytics. No recommendations code.
  - F16 External APIs. All adapters are still mocks.
  - The `chatbot` module is an empty folder.

### Frontend (us)
- **Done:** All feature screens for F0–F13, connected to the real backend.
- **Done:** The first UI/UX polish pass (E1–E7, reports in `docs/design/`).
- **Redesign in progress:**
  - New tokens in `global.css`.
  - New primitives: Button, Container, Section, Breadcrumb, BottomSheet, Rating, Skeleton, LanguageToggle.
  - The 5 auth screens are redesigned (`components/auth/*`).
  - The storefront home is redesigned (Hero, header, footer, strips, ProductCard, CategoryGrid).
  - There's a `/dev/ui` gallery page and Vitest is set up.
- **Health:** `tsc --noEmit` is clean. Vitest: 5 files, 23 tests passing.
- **Not redesigned yet:** product detail (lightly touched), search and category, cart, checkout, orders, returns, notifications, profile, all seller screens, analytics and admin.

### Known issues to keep in mind
- **The redesign commit changed `apps/backend/prisma/seed.ts`** to add a dev-only demo catalogue. That's backend territory, so give Abdullah a heads-up. Also check that `commission_rate_default` wasn't dropped from the seed.
- **Backend gaps that show up in the UI:**
  - `commission_rate_default` in the admin config has no effect, because no code reads it.
  - "Adapter uptime" only checks whether things respond right now. It isn't a real uptime percentage.
  - Buyers have no "report product" flow.
- **`docs/design/FRONTEND-UI-UX.md` is out of date.** It stops at E2.

---

## 2. Design critique

### Problem #1: it doesn't look like one product

Today the app has three separate design languages:

| Area | Font | Green | Background | How it's built |
|---|---|---|---|---|
| Storefront home (new) | Plus Jakarta + Inter | `#0b6e4f` | `#fbf8f3` | New custom components |
| Auth screens (new) | IBM Plex Sans | `#14573c` | `#f7f3ec` | Its own `auth.css` (1,289 lines, 28 hard-coded colours) |
| Everything else (~40 screens) | Inter | `#0b6e4f` via `theme.ts` | `#fbf8f3` | Default AntD `Card` / `Typography.Title` / `Descriptions`, plus **324 one-off inline styles** |

The auth colours are *almost* the same as the home ones. That's the worst kind of inconsistency: people can't name it, but they feel it. Moving from home to cart feels like leaving a designed site and landing in an admin template. **No palette fixes this on its own.** The new palette and the cleanup have to happen together in Batch 0.

### Problem #2: it feels dry because nothing is real
- **The hero "product collage" is three Lucide icons in tinted cards.** Icons standing in for products is the strongest "template" signal on the site.
- **The demo product images are pastel squares with the words "Demo photo" printed on them.** Every grid looks like a wireframe in a demo.
- **The category colours are a rainbow:** pink, blue, violet, teal, mint, peach. Eight unrelated hues clash with any premium palette.
- **Sparkles ✨ for AI** appears in the hero badge, the floating chip and the AI hints. It's the most overused AI cliché.
- **Every section uses the same fade-up `Reveal` animation.** When everything animates, nothing feels alive.
- **The home page reads like a SaaS landing page, not a marketplace.** It has three reassurance strips (trust, how-it-works, payment) pushing products down. Reassurance works better next to the decision it supports, such as product detail or checkout.

### Other issues
- **Five font families load:** Jakarta, Inter, IBM Plex, Plex Arabic, Nastaliq. Jakarta at weight 800 is the generic "every startup" look.
- **Urdu text is too tall:** `line-height: 2` applies to *all* Urdu text, which stretches tables, forms and admin badly.
- **The palette lives in two places:** `theme.ts` hard-codes brand hex values instead of reading the tokens.
- **AntD controls are chunky:** `controlHeight: 48` applies everywhere, including admin and seller tables and forms.
- **The product card is noisy and missing trust signals:**
  - A COD pill repeats on every card.
  - There's no seller name or rating.
  - The price is in brand green.

---

## 3. New palette: "Haveli"

The idea is warm sandstone, espresso wood, a copper CTA and brass details, like an old Lahore haveli at golden hour. It deliberately avoids **Daraz orange (`#F85606`)**, which is bright and close to red. Our CTA is a deep, earthy copper that reads as crafted and premium rather than flash-sale.

### Light theme
| Role | Name | Hex | Use |
|---|---|---|---|
| Main background (60%) | Parchment | `#FAF6EF` | Page background |
| Card surface | Cream | `#FFFDF9` | Cards, forms |
| Sunken surface | Sand | `#F1E8DA` | Inputs, inset areas, table stripes |
| Border | Linen | `#E7DCCB` | Hairlines |
| Strong border | Clay | `#D4C4AB` | Dividers |
| **Ink (30%)** | Espresso | `#2B1D14` | Headings, body text, dark bands. Replaces green as the main brand colour |
| Brand secondary | Walnut | `#5A3A22` | Nav active state, footer, hero gradient end |
| Secondary text | Umber | `#6B5A4B` | Secondary text (≈6:1 contrast) |
| Tertiary text | Taupe | `#8A7764` | Captions and icons only (≈4:1, too low for body text) |
| **CTA (10%)** | Copper | `#B4572A` | Primary buttons, white text ≈4.9:1 |
| CTA hover / pressed | Burnt copper | `#9A4722` / `#7E3A1C` | |
| CTA tint | Peach clay | `#F6E3D6` | Selected chips, soft CTA backgrounds |
| **Urgency** | Sindoor | `#C8402E` | "Only 2 left", deal timers, sale stickers |
| **Accent (sparingly)** | Brass | `#C9963F` | AI moments, ratings, verified, celebration. Always with dark text |
| Brass tint | Haldi cream | `#F6E7C4` | AI result card backgrounds |
| Success | Moss | `#4F7A3A` | Success only |
| Info | Indigo ink | `#3A4D7A` | Info alerts, links in long text |
| Error | Kiln red | `#B3261E` | Errors |

### Dark theme ("haveli at night")
| Role | Hex |
|---|---|
| Background | `#17110C` |
| Surface | `#211912` |
| Sunken | `#120D09` |
| Border | `#3A2C20` |
| Text primary / secondary | `#F3EADF` / `#C2B2A0` |
| Copper | `#E07A45` |
| Brass | `#E2B865` |
| Sindoor | `#E8604C` |

*Dark mode polish is deferred beyond the 4 days. Light mode is the polished default.*

### Palette rules
1. **Copper means "do this", and nothing else.** One copper button per screen. Never decorative.
2. **Brass is jewellery.** Use it on less than about 3% of the screen: AI, ratings, verified badges, celebrations.
3. **Dark bands in espresso, not copper.** The hero, footer and announcement bar go espresso → walnut with brass hairlines. A large copper area looks like Daraz.
4. **Replace the 8 category colours with one tonal family:** sand, clay, peach-clay, haldi and a bit of indigo. Use duotone illustrations instead of rainbow tiles.
5. **Indigo ink is the only cool colour.** Without it the palette turns flat and sepia.

### Typography
- **Display headings:** a warm serif, **Fraunces** or **Instrument Serif**, for an editorial, crafted, charming feel.
- **Body text:** **Inter**.
- **Urdu:**
  - **Noto Nastaliq Urdu** for headings and hero text only.
  - **Noto Naskh Arabic** for dense UI (tables, forms, admin).
- **Drop IBM Plex** to cut down the number of font families.

---

## 4. Home page vs landing page vs products page

| Page | What it is | In KarobarAI |
|---|---|---|
| **Home page** | The front door of the shop. It shows a little of everything to get people browsing. | `/`: Home / Storefront (SCR-B01) |
| **Landing page** | A marketing page with one goal. It isn't for shopping. | **Missing.** Should be **"Sell on KarobarAI"** at `/sell`, aimed at sellers and showing off the AI Store Builder. |
| **Products page** | The full product grid with filters and sorting. | `/search`: Search / Browse (SCR-B02). `/category/:slug` is the same grid for one category. |

**In short:** Home makes people want to browse, the products page is where they actually shop, and the landing page brings sellers in.

---

## 5. Page levels

~40 pages in 4 days means not every page can get custom design time.

- ★ **Showcase:** fully custom layout, illustrations and animation. The demo pages.
- ◆ **Polish:** proper layout rework using the new components.
- ○ **Re-skin:** the new tokens and components applied, with the structure kept.

Most of the improvement comes from Batch 0. Once the tokens, buttons, cards, inputs and layouts change, every ○ page improves automatically.

---

## 6. The 4-day batch plan

### Day 1: Batch 0 (foundation) + Batch 1 (discovery)

#### Batch 0: Foundation (morning, must come first)
- **Colour tokens:** the Haveli palette in `global.css`, replacing the green.
- **Fonts:** serif display headings, Inter for body text, Naskh/Nastaliq for Urdu. Drop IBM Plex.
- **AntD theme bridge:** `theme.ts` reads the tokens instead of hard-coded hex values.
- **Control density:** comfortable (48px) for buyers, compact (40px) for seller and admin.
- **Auth styles:** `auth.css` uses the global tokens, not its own set.
- **Core UI pieces:** Button, Input/TextField, Card, Badge/StatusTag, Skeleton, EmptyState, Toast, Modal, Tabs/Segmented.
- **Shared ProductCard:** price in espresso, no per-card COD pill, hover lift and image zoom.
- **Layouts:**
  - StorefrontHeader, StorefrontFooter and AnnouncementBar for buyers.
  - AppShell, Sidebar and BottomTabBar for seller and admin.
- **Imagery:**
  - Real product photos for the seed/demo data, replacing the "Demo photo" SVGs.
  - Block-print (ajrak/ralli) brass pattern at around 6% opacity.
  - Paper-grain texture.
  - A KarobarAI AI mark to replace ✨.
- **Motion budget:** remove the blanket `Reveal` and keep motion for meaningful moments:
  - Add-to-cart: the item flies to the cart and the badge bumps.
  - Price count-up.
  - AI text appearing with a typewriter effect.
  - Celebrations.

#### Batch 1: Discovery
| Page | Route | Purpose | Components | Level |
|---|---|---|---|---|
| Home | `/` | Get buyers excited and browsing | AnnouncementBar, Header (search, language, cart, account), Hero (real photo, serif headline, one copper CTA), single promise bar (COD, returns, verified), Category grid (tonal), Featured, New arrivals, Seller spotlight *(new)*, AI "Sell with AI" band, Footer | ★ |
| Seller landing *(new)* | `/sell` | Convince small businesses to open a store | Hero with phone mockup, animated "photo → AI listing" demo, 3-step how-it-works, benefits (COD, couriers, Urdu), seller stories, FAQ, final CTA to register | ★ |
| All products / Search | `/search` | Where buyers actually shop | Search bar, result count, filter panel (desktop sidebar, mobile bottom sheet), filter chips, sort, product grid, skeletons, empty "no results" state | ◆ |
| Category | `/category/:slug` | One category's products | Category banner (title, illustration, count), breadcrumb, then the same grid and filters as Search | ◆ |

### Day 2: Batch 2 (purchase) + Batch 3 (auth)

#### Batch 2: Purchase flow
| Page | Route | Purpose | Components | Level |
|---|---|---|---|---|
| Product detail | `/product/:id` | Decide and buy | Breadcrumb, image gallery (thumbnails and zoom), English/Urdu title, price, stock urgency pill (sindoor), quantity stepper, Add to cart / Buy now, sticky mobile action bar, store card, reassurance (COD, returns), description, "More from this store" | ★ |
| Cart | `/cart` | Review items | Items grouped by seller (store header per group), line items with stepper and remove, order summary, free-shipping progress *(new)*, checkout CTA, empty-cart illustration | ◆ |
| Checkout | `/checkout` | Place the order | Step indicator, address cards plus add-address modal, payment method cards, order summary, one copper "Place order" | ◆ |
| Order confirmation | `/checkout/confirmation` | Celebrate and point to the next step | Celebration illustration and animation, "Shukriya!", order numbers, address, "Track order" / "Keep shopping" | ★ |

#### Batch 3: Auth (good structure, so mostly a re-skin)
| Page | Route | Components | Level |
|---|---|---|---|
| Login | `/login` | AuthLayout (espresso brand panel with block-print pattern and a real photo per slide, form side), TextField, PasswordField, Checkbox, PrimaryButton, FormAlert, language toggle | ◆ |
| Register | `/register` | Plus RoleSelector, MethodTabs, PhoneField, PasswordStrength | ◆ |
| OTP verify | `/verify-otp` | OtpInput (6 boxes), countdown, resend | ○ |
| Forgot password | `/forgot-password` | Identifier field, AuthResult "sent" state | ○ |
| Reset password | `/reset-password` | Password fields, strength meter, invalid-token state | ○ |

### Day 3: Batch 4 (seller workspace, the FYP headline)
| Page | Route | Purpose | Components | Level |
|---|---|---|---|---|
| Seller layout | wraps all seller pages | The seller's "office" | Sidebar, top header, mobile bottom tabs, store avatar | ◆ |
| Store setup wizard | `/seller/setup` | First-login onboarding | Step progress, store name and info, logo/banner upload, live "your store preview" card *(new)*, finish celebration | ★ |
| Seller home (dashboard + products) | `/seller` | Daily overview and product list | Greeting by name and time of day, "what to do next" card, sparkline metric cards, recent orders, product table with status tags, filters, "Add product" CTA | ◆ |
| **AI Store Builder** | `/seller/products/new` | **The flagship** | Photo drop zone, brass AI scan shimmer, AIStatus progress, English and Urdu fields side by side with a typewriter reveal, AIFieldBadge (brass dot until edited), category/price/stock, Save draft / Publish | ★★ |
| Edit product | `/seller/products/:id/edit` | Edit a listing | Form sections, ProductImageManager, "Regenerate with AI", publish toggle, delete | ○ |
| Seller orders | `/seller/orders` | Order queue | Status tabs, order rows/cards, search | ◆ |
| Seller order detail | `/seller/orders/:id` | Fulfil and book a courier | Summary, buyer and address, items, courier selection card, one-click "Book shipment", status timeline | ◆ |
| Seller tracking | `/seller/orders/:id/track` | Follow the shipment | Shared tracking timeline and map | ○ |
| Analytics | `/seller/analytics` | Business health | Date range filter, revenue cards, sales trend chart (espresso line, brass highlight, sand gridlines), category chart, order and customer cards, top products table | ◆ |
| Seller returns | `/seller/returns` | Returns queue | List, status tags | ○ |
| Seller return detail | `/seller/returns/:id` | Approve or dispute a return | Buyer photo gallery, progress timeline, approve/reject | ○ |
| Profile / store brand / settings / change password | `/seller/profile…` | Account and store branding | Avatar header, StoreBrandTab, setting rows, password form | ○ |

### Day 4: Batch 5 (buyer after purchase) + Batch 6 (admin) + QA

#### Batch 5: Buyer after purchase (morning)
| Page | Route | Components | Level |
|---|---|---|---|
| My orders | `/orders` | Status tabs, order cards (thumbnail, store, status, total) | ◆ |
| Order detail | `/orders/:id` | Status header, items, address, payment, actions (track, return) | ◆ |
| Tracking | `/orders/:id/track` | Animated journey timeline (rickshaw/bike moving along), map, live updates | ★ |
| Public tracking | `/t/:token` | Same tracking without login (for sharing on WhatsApp), minimal branded header | ◆ |
| My returns | `/returns` | Returns list with status | ○ |
| Return wizard | `/orders/:id/return` | Stepper, reason picker, 3-photo uploader with photo-guide illustration, review | ◆ |
| Return status | `/orders/:id/return/status` | ReturnProgressTimeline, appeal action | ○ |
| Notifications | `/notifications` | Grouped by day, toned icons (copper for actions, moss for done), unread dot, preference tabs, friendly empty state | ◆ |
| Profile / settings / change password | `/buyer/profile…` | Avatar header, address book, iOS-style setting rows instead of AntD `Descriptions` | ○ |

#### Batch 6: Admin (early afternoon, calm and dense, re-skin only)
| Page | Route | Components |
|---|---|---|
| Admin dashboard | `/admin` | KPI MetricCards, alert tiles (sindoor when non-zero) |
| Users | `/admin/users` | Search, filters, table, sectioned detail drawer, suspend/ban |
| Product moderation | `/admin/moderation` | Status filter, table, drawer, takedown/restore |
| Reports | `/admin/reports` | Date range, GMV trend chart, seller performance table, insights |
| Returns queue and detail | `/admin/returns`, `/admin/returns/:id` | List, timeline, photos, audit trail, decision with required reason |
| Platform config | `/admin/config` | One card per setting, required audit reason, Save |

All admin pages are ○. Admin rules:
- Use the compact density with a more neutral sand-and-ink treatment.
- Copper only for destructive or override actions.

#### Late afternoon: QA pass
- Mobile at 375px.
- Urdu/RTL.
- Empty, loading and error states.
- Focus states and 44px touch targets.
- Dark mode is deferred.

### Summary
| Day | Batches | Showcase pages |
|---|---|---|
| 1 | 0 Foundation + 1 Discovery | Home, Seller landing |
| 2 | 2 Purchase + 3 Auth | Product detail, Order confirmation |
| 3 | 4 Seller workspace | AI Store Builder, Setup wizard |
| 4 | 5 Buyer after purchase + 6 Admin + QA | Tracking |

**If time runs short, cut the ○ pages first.** They still pick up the new look from Batch 0.

---

## 7. Missing pages and components

### Missing pages, frontend only (can be built now)
1. **Seller landing `/sell`.** The strongest marketing page and great for the FYP demo.
2. **Proper 404 / error page.** Today it's a bare EmptyState line. Use an illustration and a way back.
3. **Static info pages:** About, Help/FAQ, Return policy, Terms and Privacy. One shared template, linked from the footer.
4. **Separate seller dashboard (SCR-S01).** Optional. It's currently merged into the product list at `/seller`.

### Missing pages that need backend work first (Abdullah)
5. **Public store page `/store/:slug`.** Each seller's own shop front with banner, logo, story and products. The most "alive" page a micro-seller marketplace can have.
6. **Wallet / payout (SCR-S09).** In the App Flow doc but never built.
7. **Admin payments (SCR-AD03) and audit log (SCR-AD08).** Documented, no backend.
8. **Reviews (SCR-B13) and wishlist.** Future scope.

**Also needed from the backend:** seller name, verified flag and rating on the product DTO, so the product card can show trust signals.

### Missing components
| Component | Where it's used |
|---|---|
| Category nav / mega menu + mobile menu drawer | Header |
| Product gallery with thumbnails and zoom | Product detail |
| Store card / seller badge (name, verified tick) | Product card, product detail, cart *(needs backend fields)* |
| Stock urgency pill ("Only 3 left") | Product card, product detail |
| Free-shipping progress bar | Cart |
| Checkout step indicator | Checkout |
| Celebration animation | Order confirmation, wizard finish, first product published |
| Seller spotlight / story card | Home, Seller landing |
| Promo / deal banner | Home |
| Animated AI demo ("photo → listing") | Seller landing, AI Store Builder |
| KarobarAI AI mark (replaces ✨) | Everywhere AI appears |
| Illustrated empty-state set (cart, orders, search, notifications, returns) | Many pages |
| Live store preview card | Store setup wizard |
| Animated delivery journey (rickshaw/bike) | Tracking pages |
| Account / avatar dropdown menu | Header |
| Footer link sections + newsletter/WhatsApp contact | Footer |

### Already built and reusable
Breadcrumb, BottomSheet, StickyActionBar, Rating, Badge, Skeleton, Reveal, LanguageToggle, AIFieldBadge, AIStatus.

---

## 8. Open items
- **Sample images:** Rafia has reference images of the target look. Attach them and map each one to the page(s) it should inspire.
- **Seed data:** tell Abdullah about the `seed.ts` change and confirm `commission_rate_default` is still seeded.
- **Docs:** update `docs/design/FRONTEND-UI-UX.md`, or mark it superseded by this plan.
