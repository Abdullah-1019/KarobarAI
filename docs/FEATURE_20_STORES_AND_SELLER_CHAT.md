# Feature 20: Store Directory, Store Profile Upgrades and Buyer-Seller Chat

**Status:** Planned (not started)
**Owners:** Frontend: Rafia · Backend: Abdullah
**Depends on:** Store Management (F3), Buyer Marketplace (F5), AI Store Builder (F13/16), Notifications (F9), Admin Panel (F12)

---

## 0. Current state (checked in code)

| Item | Today | Gap |
|---|---|---|
| One store per seller | Already true: `SellerProfile` is 1:1 with `User` and holds `storeName`, `storeSlug`, `storeDescription`, `logoUrl`, `bannerUrl` | None. Keep it this way: one store per seller, no multi-store |
| Public store page | Exists at `/store/:storeSlug` (with the Buyer Storefront Agent) | Needs a header with category, social links and a "Chat with seller" button |
| Store category | Not stored | New field needed |
| Social media links | Not stored | New field needed |
| Stores on home page | Home page has Hero, CategoryGrid and FeaturedProducts only | New "Stores" section and an all-stores page |
| AI store description | AI only writes **product** listings | New AI endpoint for the **store** description |
| Buyer to seller chat | Only the AI assistants exist (`ChatContext` = `BUYER_STORE`, `SELLER_ASSISTANT`) | New human-to-human messaging, kept separate from the AI chat tables |

---

## 1. One store per seller

- Every seller has exactly one store, created in the Store Setup wizard (`/seller/setup`).
- A seller cannot create a second store. The setup endpoint returns the existing store if one already exists.
- The store slug stays unique and is used in the public link `/store/{slug}`.

**Acceptance:** a seller account always maps to exactly one store, and a second create attempt returns an error such as `STORE_ALREADY_EXISTS`.

---

## 2. Stores section on the home page and an "All Stores" page

### Behaviour
- The home page gets a **"Shop by Store"** section below Featured Products. It shows about 8 store cards and a **"View all stores"** button.
- The button opens a new page at **`/stores`**. It works like the product listing: a grid of store cards with pagination or infinite scroll, a search box and filters.
- Store card: logo, store name, category label, short description (one or two lines), product count, city, and a "Visit store" link to `/store/{slug}`.
- Show only stores that have completed onboarding, are not suspended and have at least one published product.

### Sorting
Newest, Most products, and A–Z. "Top rated" can be added later, once reviews exist.

### Backend
- `GET /api/stores?category=&q=&sort=&page=&limit=` is a public, paginated list.
- `GET /api/stores/featured?limit=8` feeds the home page section.
- Cache both responses in Redis for a short time, about 60 seconds.

### Frontend
- `features/marketplace/StoresSection.tsx` for the home page section.
- `features/stores/StoresPage.tsx` for the `/stores` route.
- `StoreCard.tsx`, shared by both.
- Urdu right-to-left layout, skeleton loaders and an empty state ("No stores found in this category").

---

## 3. Category filter for stores

### Behaviour
- Every store has a **primary category**, picked in the setup wizard and editable later from store settings. It reuses the existing product `Category` list, for example Clothing, Electronics, Beauty and Home.
- On `/stores`, category chips or a dropdown filter the list. Selecting "Clothing" shows only clothing stores.
- Clicking a category on the home page can link to `/stores?category=clothing`.

### Data model (backend)
```prisma
model SellerProfile {
  // ...existing fields
  storeCategoryId BigInt?   @map("store_category_id")
  storeCategory   Category? @relation("StoreCategory", fields: [storeCategoryId], references: [categoryId])
  @@index([storeCategoryId])
}
```
(Match the real `Category` primary key name when implementing.)

Optional for later: allow up to 3 secondary categories through a `seller_store_categories` join table. Version 1 needs only one primary category.

**Acceptance:** `GET /api/stores?category=clothing` returns only stores whose primary category is Clothing or one of its child categories.

---

## 4. AI-generated store description

### Behaviour
- In the setup wizard and in store settings, the description box gets a **"Generate with AI"** button next to it. The seller can still type the description manually.
- Input to the AI: store name, selected category, and optional keywords typed by the seller (for example "handmade, cotton, Lahore").
- Output: a short description of 2 to 4 sentences, in **English and Urdu**. The seller picks the language tab.
- The generated text is placed in the box and stays **fully editable**. Nothing is saved until the seller clicks Save.
- A "Regenerate" button gives another version. Show a loading state while generating.
- If the AI fails or times out, show "Couldn't generate right now, please write it yourself or try again". Manual entry always works.

### Backend
- `POST /api/seller/store/description/generate` with body `{ storeName, categoryId, keywords? }` returns `{ description_en, description_ur }`.
- The backend calls a new AI-service route `POST /store-description`, reusing the existing LLM client (Gemini, with fallback per config). Text only, no images.
- Validate the output against a schema with length limits, about 600 characters per language. Strip links and phone numbers.
- Rate limit: about 10 generations per seller per hour (Redis).
- Seller role only.

### Frontend
- Add the button and the language toggle to the store setup and store settings forms, reusing the AI Store Builder's loading and error UI.

---

## 5. Social media links on the store

### Behaviour
- In store setup and store settings, the seller can add links for **Facebook, Instagram, TikTok, YouTube, WhatsApp and Website**. All are optional.
- The public store page shows them as icons in the store header. They open in a new tab with `rel="noopener noreferrer nofollow"`.
- For WhatsApp, the seller enters a number, which is shown as a `https://wa.me/<number>` link.

### Validation
- Each link must be a valid `https://` URL on the matching domain (instagram.com, facebook.com, tiktok.com, youtube.com). Website accepts any https URL.
- Maximum length of 255 characters. Admins can remove abusive links from moderation.

### Data model (backend)
```prisma
model SellerProfile {
  // ...existing fields
  socialLinks Json? @map("social_links") // { facebook?, instagram?, tiktok?, youtube?, whatsapp?, website? }
}
```

### API
- `PATCH /api/seller/store` accepts `socialLinks`.
- `GET /api/stores/:slug` returns it.

---

## 6. Buyer to seller chat (trusted and reliable)

### 6.1 Behaviour
- The public store page and the product detail page get a **"Chat with seller"** button.
- Guests are asked to log in first. Only verified (OTP) buyer accounts can start a chat.
- One conversation per buyer–store pair. Messages can optionally be **linked to a product or an order**, shown as a small product or order card at the top of the message.
- The seller sees all conversations in a new **Seller Center → Messages** page (`/seller/messages`). The buyer sees them at **`/messages`**.
- Messages are delivered in real time through Socket.IO. If the user is offline, an in-app notification is created, plus SMS or email if enabled.
- Text messages plus up to 3 images per message (stored in MinIO, same type and size checks as product images).

### 6.2 Trust and reliability features
| Feature | Why |
|---|---|
| **Verified Seller** badge (OTP verified, onboarding complete, not suspended) and "Member since" date in the chat header | Buyer knows who they are talking to |
| Seller's **average response time** shown on the store ("Usually replies within 1 hour") | Sets expectations and builds trust |
| Messages saved in the database and never lost on refresh; ordered by server timestamp | Reliability |
| Sent ✓, Delivered ✓✓ and Read status, plus a typing indicator | Clear feedback |
| Client-side message id (idempotency key) so a retried send is not duplicated | Reliability on weak networks |
| Offline sending queue: messages sent on a bad connection are retried automatically, and failures show a "Retry" button | Reliability on 3G |
| **Safety banner**: "Keep payments on KarobarAI. Never share OTPs or pay outside the platform." | Fraud prevention |
| Automatic warning when a message contains a phone number, bank or wallet number, or an outside payment link | Fraud prevention |
| **Report** and **Block** buttons in every conversation; reports go to the admin panel | Abuse handling |
| Rate limit (for example 30 messages per minute per user) and a basic profanity filter | Spam prevention |
| Only the two participants (and an admin reviewing a report) can read a conversation; every query checks ownership | Privacy |
| Admin can view **reported** conversations only, and every view is written to the audit log | Accountability |
| Escaped text, no HTML rendering, links shown as plain text with a warning icon | Security (XSS) |

### 6.3 Data model (backend)
These tables are separate from the AI chat tables (`ChatSession` and `ChatMessage`), so human conversations never mix with assistant context.
```prisma
model Conversation {
  conversationId BigInt   @id @default(autoincrement()) @map("conversation_id")
  buyerId        BigInt   @map("buyer_id")
  sellerId       BigInt   @map("seller_id")
  lastMessageAt  DateTime @map("last_message_at")
  buyerUnread    Int      @default(0) @map("buyer_unread")
  sellerUnread   Int      @default(0) @map("seller_unread")
  blockedBy      BigInt?  @map("blocked_by")
  createdAt      DateTime @default(now()) @map("created_at")
  messages       DirectMessage[]
  @@unique([buyerId, sellerId])
  @@index([sellerId, lastMessageAt])
  @@map("conversations")
}

model DirectMessage {
  messageId       BigInt    @id @default(autoincrement()) @map("message_id")
  conversationId  BigInt    @map("conversation_id")
  senderId        BigInt    @map("sender_id")
  clientMessageId String    @map("client_message_id") @db.VarChar(64)
  body            String?   @db.Text
  imageUrls       Json?     @map("image_urls")
  productId       BigInt?   @map("product_id")
  orderId         BigInt?   @map("order_id")
  flagged         Boolean   @default(false)   // contains phone/payment info
  readAt          DateTime? @map("read_at")
  createdAt       DateTime  @default(now()) @map("created_at")
  conversation    Conversation @relation(fields: [conversationId], references: [conversationId], onDelete: Cascade)
  @@unique([senderId, clientMessageId])
  @@index([conversationId, createdAt])
  @@map("direct_messages")
}

model ConversationReport {
  reportId       BigInt   @id @default(autoincrement()) @map("report_id")
  conversationId BigInt   @map("conversation_id")
  reporterId     BigInt   @map("reporter_id")
  reason         String   @db.VarChar(500)
  status         String   @default("OPEN") // OPEN, REVIEWED, ACTION_TAKEN
  createdAt      DateTime @default(now()) @map("created_at")
  @@map("conversation_reports")
}
```
Add `NEW_MESSAGE` to the notification event types.

### 6.4 API
| Method | Endpoint | Who | Purpose |
|---|---|---|---|
| POST | `/api/conversations` `{ storeSlug, productId?, orderId? }` | Buyer | Start or get the conversation with a store |
| GET | `/api/conversations?page=` | Buyer / Seller | List my conversations with unread counts |
| GET | `/api/conversations/:id/messages?before=` | Participant | Message history (cursor pagination) |
| POST | `/api/conversations/:id/messages` `{ clientMessageId, body?, imageUrls?, productId?, orderId? }` | Participant | Send a message |
| POST | `/api/conversations/:id/read` | Participant | Mark as read |
| POST | `/api/conversations/:id/block` and `/unblock` | Participant | Block or unblock |
| POST | `/api/conversations/:id/report` `{ reason }` | Participant | Report to admin |
| GET | `/api/admin/conversation-reports` and `/:id` | Admin | Review reported chats (audit logged) |

**Socket.IO:** a new `/chat` namespace authenticated with the JWT. Each user joins the room `user:{id}`. Events are `message:new`, `message:read` and `typing`. The REST send stays the source of truth, and the socket only pushes updates.

### 6.5 Frontend
- `features/chat/ChatButton.tsx`, used on the store page and the product page.
- `features/chat/ConversationList.tsx` and `ChatWindow.tsx`, shared by the buyer `/messages` page and the seller `/seller/messages` page.
- An unread badge on the header message icon and on the Seller Center sidebar.
- A mobile layout that switches between the list and a full-screen chat; Urdu right-to-left support.
- The safety banner, the phone and payment warning chip, and a Report/Block menu.

---

## 7. Store page header (puts 3, 5 and 6 together)

```
[Banner]
[Logo]  Store Name  ✔ Verified Seller      [Chat with seller]
        Category: Clothing · Lahore · Member since 2026
        "Usually replies within 1 hour"
        (f) (ig) (tiktok) (yt) (wa) (web)
        Short description (Read more)
[Products grid]                              [AI store assistant]
```

---

## 8. Task breakdown

### Backend (Abdullah)
1. Prisma migration: `storeCategoryId` and `socialLinks` on `SellerProfile`, plus the `Conversation`, `DirectMessage` and `ConversationReport` tables.
2. Public stores API: list, featured, filter, search and sort, with a Redis cache.
3. Extend store create and update with category and social links (with validation).
4. AI service `/store-description` route, plus the backend endpoint with rate limiting.
5. Conversations module: REST endpoints, ownership checks, idempotent send, phone and payment detection, rate limit, block, report.
6. Socket.IO `/chat` namespace, plus the `NEW_MESSAGE` notification.
7. Admin conversation-reports endpoints with audit logging.
8. Tests: unit and integration tests for each endpoint, including negative cases (another user's conversation, a blocked user, a duplicate `clientMessageId`, an invalid social URL).

### Frontend (Rafia)
1. Home page `StoresSection` and the `/stores` page with category filter, search and sort.
2. `StoreCard` component.
3. Store setup and settings: category picker, social links fields, "Generate with AI" description.
4. Store page header redesign (badge, socials, chat button, response time).
5. Chat UI: button, conversation list, chat window, buyer and seller message pages, unread badges.
6. Admin panel: reported conversations screen.
7. Urdu and English strings for everything above.

---

## 9. Acceptance checklist
- [ ] A seller has exactly one store, and a second create attempt is blocked.
- [ ] The home page shows the Stores section, and "View all stores" opens `/stores`.
- [ ] The category filter on `/stores` shows only matching stores.
- [ ] "Generate with AI" fills an editable Urdu and English store description, and manual entry still works when the AI fails.
- [ ] Social links are saved, validated and shown as icons on the store page.
- [ ] A buyer can chat with a seller from the store or product page, and messages arrive in real time and survive a refresh.
- [ ] Read receipts, the unread count, the safety banner, the phone and payment warning, Report and Block all work.
- [ ] Another user cannot read a conversation they are not part of.
- [ ] Admins see reported chats only, and every view is audit-logged.
- [ ] All new screens work in Urdu (right-to-left) and English, and on mobile.
