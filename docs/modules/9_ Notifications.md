# **KarobarAI — Engineering Execution Playbook**

## **Feature 9: Notifications**

**Source of truth:** PRD · TRD · App Flow · Backend Schema · Implementation Plan (Docs 1–6). No architecture, schema, API contract, business rule, workflow, or folder structure is invented beyond what these documents specify. Gaps are marked **Assumption**; reuse-vs-extend calls are marked **Engineering Decision**.

**Depends on:** Feature 0 (Foundation — BullMQ/Redis wiring, envelope, error hierarchy), Feature 1 (Authentication — the **mock SmsAdapter** was already scaffolded here for OTP delivery, TRD §7), Feature 6 (Cart & Checkout — enqueues order-placed/payment-related notification jobs), Feature 7 (Orders — enqueues order-status-milestone jobs), Feature 8 (Courier & Tracking — enqueues delivery-milestone, manual-logistics-alert, and poll-failure-alert jobs).

**Feeds:** Feature 10 (Returns & Refunds — return-decision/refund-issued notifications), Feature 12 (Payments & Admin Operations — admin broadcast tool, R1.1), Feature 16 (External APIs — real SMS/Email/WhatsApp provider swap-in).

## **Table of Contents**

-   Feature Overview
    -   0.1. Pre-Generation Reuse Review
    -   0.2. Documentation Gaps & Assumptions
    -   0.3. Notification Flow
-   Task 1 — Notification Foundation
-   Task 2 — Notification Event Registration
-   Task 3 — In-App Notification Engine
-   Task 4 — Notification Center *(pending)*
-   Task 5 — Email Notifications *(pending)*
-   Task 6 — SMS Notifications *(pending)*
-   Task 7 — WhatsApp Notifications *(pending)*
-   Task 8 — Validation & Testing *(pending)*

## **Feature Overview**

**What Feature 9 covers:** the **consumer/dispatch side** of every notification job already **enqueued** (but never processed) by Features 1, 6, 7, and 8 — plus the in-app Notification Center (App Flow §0's "notification bell with unread count," referenced across SCR-S01, SCR-B01, SCR-B07/08). It implements REQ-F-Notif001–005 in full, and closes the loop on the mock SmsAdapter Feature 1 already introduced for OTP.

**What it explicitly excludes:**

-   **Event *sources*** — this feature does not decide *when* a notification fires (order placed, delivered, courier failed, etc.) — those enqueue calls already exist in Features 6/7/8's code. Feature 9 only builds what happens **after** a job lands in the queue.
-   **Return-decision/refund-issued notifications** — the enqueue call for these doesn't exist yet since Returns (Feature 10) isn't built; Feature 9 builds the **channel/dispatch infrastructure** generically enough that Feature 10 can plug into it without any changes here.
-   **Admin broadcast tool** (SCR-AD07, REQ-F-Admin-007) — explicitly R1.1/Feature 12 scope, not built here.
-   **Real provider integration** (Twilio/AWS SNS, SendGrid/SES, Meta Cloud API) — mock only (D2); Feature 16's job.

**Governing tables (Schema Doc §4):** notifications (4.19), notification\_preferences (4.20) — both fully specified, zero new columns needed.

### **0.1. Pre-Generation Reuse Review**

| **Feature 0–8 Asset** | **Exists At** | **Feature 9 Usage** |
| --- | --- | --- |
| Envelope helper, typed error hierarchy, Zod validation harness | Feature 0 | Reused unchanged for every new notification endpoint |
| --- | --- | --- |
| authenticate + ownership middleware | Feature 1 | Reused — in-app notifications are ownership-scoped (user\_id = self, Schema §9-style rule extended to this table) |
| --- | --- | --- |
| **Mock SmsAdapter** | Feature 1 (TRD §7, OTP dispatch) | **Reused directly** — this feature does not scaffold a new SMS adapter; it extends the **same interface** Feature 1 already calls for OTP, now also called for lifecycle events |
| --- | --- | --- |
| BullMQ/Redis queue wiring | Feature 0/2 (architecture phase) | Reused — this feature adds **consumers** on queues that Features 6/7/8 already **produce** to; no new queue infrastructure |
| --- | --- | --- |
| Enqueue calls already made | Feature 6 (order placed, payment fail/cancel), Feature 7 (status milestones — implicit via tracking\_events/state transitions), Feature 8 (delivery milestones, manual-logistics alert, 3-poll-failure alert) | **This feature's Task 2 must inventory and formalize these exact call sites** — it does not invent new event names independently |
| --- | --- | --- |
| Repository/service/controller layered pattern | Feature 2, established in Features 4/6/7/8 | New notification/ module follows the identical shape |
| --- | --- | --- |
| Skeleton, EmptyState, ToastProvider | Feature 0 | Reused for Notification Center's loading/empty states |
| --- | --- | --- |
| CourierAdapter, PaymentAdapter (D2 pattern) | Feature 0/2, Features 6/8 | **Pattern reused, not the adapters themselves** — this feature's Email/Sms/WhatsAppAdapter interfaces follow the identical Adapter-pattern shape (interface + MockAdapter + later LiveAdapter), per TRD §2/§28 |
| --- | --- | --- |
| Routing (/notifications, bell icon on all shells) | Feature 0 Task 10 | Route/UI-slot already reserved |
| --- | --- | --- |

**Conclusion of review:** Feature 9 introduces exactly one new backend module — notification/ (TRD §12 already names it: "BullMQ producers/consumers") — plus three adapter implementations (SmsAdapter extended, EmailAdapter new, WhatsAppAdapter new) following D2's existing pattern. It does **not** touch Features 1/6/7/8's enqueue call sites beyond confirming their job/event shape.

**Engineering Decision — Module & Adapter Boundaries:**

| **Decision** | **Selected Option** | **Reason** |
| --- | --- | --- |
| Backend module structure | Single apps/api/src/modules/notification/ per TRD §12 — repository, service (producer-facing methods already partially called by F6/7/8), consumer/worker layer, controller (for Notification Center reads), routes, DTOs | TRD §12 already names this exact folder and scope |
| --- | --- | --- |
| SMS adapter | **Extend** Feature 1's existing mock SmsAdapter interface (same sendSms(to, templateKey, vars, lang) signature per TRD §28) — do not create a second SMS interface | Two SMS-calling conventions (OTP's vs. lifecycle-events') would violate D2's "one interface per provider domain" pattern |
| --- | --- | --- |
| Email/WhatsApp adapters | New interfaces (EmailAdapter, WhatsAppAdapter), built fresh since no prior feature touched them, but shaped identically to the existing PaymentAdapter/CourierAdapter/SmsAdapter pattern (interface + mock + later live, ADAPTER\_MODE factory) | TRD §2's Adapter pattern is the established convention — new adapters must match it, not invent a new integration style |
| --- | --- | --- |
| Template storage | Templates decoupled from code (TRD §12: "bilingual templates decoupled from code," REQ-F-Notif003) — a template registry (JSON/DB-seeded key→UR/EN string map), not hardcoded strings in service logic | Matches TRD's explicit instruction and REQ-F-Notif003's "all templates in UR/EN, by recipient preference" |
| --- | --- | --- |

### **0.2. Documentation Gaps & Assumptions**

| **Gap** | **What the docs say** | **Assumption taken** |
| --- | --- | --- |
| **#1 — Email's scope tag** | TRD §28's adapter table marks Email as **"optional"** with scope "optional" (not MVP, not explicitly R1.1 either — genuinely ambiguous). PRD §12.12/§15 (F18/F19) name only SMS (MVP) and WhatsApp (R1.1) as the two channels — **Email is not named as a PRD functional requirement at all.** | **Assumption:** Email is built as the "optional" channel TRD flags it as — same adapter pattern, mock-first, but **not gated behind any MVP/R1.1 requirement ID** since none exists. It's included because your brief explicitly asks for it, but flagged here since no REQ-F-Notif ID governs it. If schedule pressure hits, Email is the safest channel to cut first (no traced requirement depends on it). |
| --- | --- | --- |
| **#2 — WhatsApp is PRD R1.1, but this brief asks for it now** | PRD §12.12 (REQ-F-Notif001) and §15 (F19) explicitly scope WhatsApp as **R1.1**, not MVP. Your brief for this feature includes it as one of five items to build now. | **Assumption:** built now per your explicit instruction, using the same WhatsAppAdapter pattern (Meta Cloud API, mocked per D2) — this is **not a contradiction of the PRD's scope tag**, since R1.1 features are buildable whenever the team schedules them (Implementation Plan §17 shows R1.1 as weeks 13–14, not "never"); it just means this feature is doing Feature 9's MVP work **and** pulling forward a piece of R1.1 ahead of its originally planned slot. Flagged so it's a conscious choice, not a silent scope violation. |
| --- | --- | --- |
| **#3 — Exact existing enqueue job names/payloads from Features 6/7/8** | Those features' playbooks describe enqueue calls in prose ("enqueue a Seller notification via the existing Notification producer interface") but never fixed an exact job-name string or payload schema, since that interface didn't exist yet when they were written. | **Assumption:** Task 2 of this feature is the **first place** those job names/payloads become concrete. This feature defines the canonical event-type enum and payload shape; Features 6/7/8's enqueue calls are treated as already conceptually correct and are matched against this feature's consumer, not rewritten. If a mismatch surfaces (e.g., a payload field this feature's consumer expects wasn't actually included by F7/F8's enqueue call), it is logged as an integration defect against the earlier feature, not silently patched around here. |
| --- | --- | --- |
| **#4 — In-app "read" semantics vs. Schema's notification\_status** | Schema §4.19's notification\_status enum is QUEUED|SENT|DELIVERED|FAILED|READ — a single linear status column, not a separate boolean/timestamp pair for delivery vs. read, even though read\_at/sent\_at timestamp columns also exist on the same row. | **Assumption:** status tracks the **dispatch lifecycle** (queued→sent→delivered/failed) for **outbound channels** (SMS/Email/WhatsApp); for **in-app** notifications specifically, status transitions directly QUEUED→SENT on creation (no real "delivery" concept for an in-app row) and then to READ when the Buyer/Seller opens/dismisses it, with read\_at set at that moment. This reconciles the single-enum design with in-app's simpler lifecycle without adding a new column. |
| --- | --- | --- |

### **0.3. Notification Flow**

Notification Foundation

(notification/ module scaffold; formalize BullMQ consumer wiring on

top of Features 6/7/8's existing enqueue calls)

│

▼

Notification Event Registration

(canonical event-type enum + payload schema; inventory every existing

enqueue call site from F1/F6/F7/F8; template registry, UR/EN)

│

▼

In-App Notification Engine

(consumer writes \`notifications\` rows for channel=IN\_APP; critical

vs. non-critical gating per REQ-F-Notif004)

│

▼

Notification Center

(bell icon, unread count, chronological list, read/unread sync)

│

▼

Email Notifications

(EmailAdapter interface + mock, per Gap #1's optional-channel framing)

│

▼

SMS Notifications

(extend Feature 1's existing SmsAdapter to lifecycle events, beyond OTP)

│

▼

WhatsApp Notifications

(WhatsAppAdapter interface + mock, pulled forward per Gap #2)

│

▼

Validation & Testing

(reuse-audit · critical-non-disableable adversarial tests · bilingual

template checks · cross-check against Features 1/6/7/8's enqueue sites)

Each stage depends on the one before it: Event Registration needs the module scaffold to attach consumers to; the In-App Engine is built first among the four channels since it has no external adapter dependency and validates the consumer pipeline end-to-end cheaply; Notification Center needs in-app rows to exist before it can render anything; Email/SMS/WhatsApp are added incrementally once the core dispatch pipeline is proven; Validation is only meaningful once all four channels and the Center exist.

## **Task 1 — Notification Foundation**

### **Purpose**

-   Scaffold the notification/ module (repository, service, consumer/worker layer, controller, routes, DTOs) per TRD §12's folder layout.
-   Confirm notifications (Schema §4.19) and notification\_preferences (Schema §4.20) require **zero new migrations**.
-   Register BullMQ consumer infrastructure that will process the job(s) Features 6/7/8 already enqueue — reusing, not duplicating, the existing Redis/BullMQ connection from the architecture phase.

### **Dependencies**

-   Feature 0 complete (BullMQ/Redis wiring, envelope, error hierarchy)
-   Feature 1 complete (mock SmsAdapter interface, already in use for OTP)
-   Features 6/7/8 complete (existing enqueue call sites to be consumed)

### **Expected Deliverables**

-   \[ \] apps/api/src/modules/notification/notification.repository.ts — Prisma-backed, methods for notifications/notification\_preferences
-   \[ \] apps/api/src/modules/notification/notification.service.ts
-   \[ \] apps/api/src/modules/notification/notification.consumer.ts — BullMQ worker(s)
-   \[ \] apps/api/src/modules/notification/notification.controller.ts + .routes.ts (Notification Center reads, Task 4)
-   \[ \] apps/api/src/modules/notification/notification.dto.ts
-   \[ \] Confirmed: zero new Prisma models, zero new migrations

### **Implementation Checklist**

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 1.1 | Scaffold notification.repository.ts: createNotification(userId, orderId?, channel, eventType, message, language), findNotificationsByUser(userId, pagination), markAsRead(notificationId, userId), getUnreadCount(userId), findPreferences(userId), updatePreferences(userId, prefs) | New repository file, zero schema changes | Migration diff empty |
| --- | --- | --- | --- |
| 1.2 | Scaffold notification.service.ts — pass-through only at this stage | New service file | Unit test: methods return repository output unmodified for now |
| --- | --- | --- | --- |
| 1.3 | Register a BullMQ worker (notification.consumer.ts) on the existing Redis connection (architecture phase) — one worker process/function, routing by eventType (formalized in Task 2), not one worker per event type | Single consumer entry point | Grep confirms no second Redis client instantiated |
| --- | --- | --- | --- |
| 1.4 | Register /api/v1/notifications\* route group behind authenticate (Notification Center is always personal/ownership-scoped — no guest access) | Route group mounted | No-token request → 401 |
| --- | --- | --- | --- |
| 1.5 | Confirm Feature 0's stubbed /notifications (or equivalent bell-icon panel) frontend surface resolves — no new route registration needed beyond what's already reserved across every shell (Seller/Buyer/Admin all show a bell icon per App Flow's global UI states) | No route-table changes | ROUTES.md requires no edits |
| --- | --- | --- | --- |

### **Common Errors**

| **Error** | **Resolution** |
| --- | --- |
| A second BullMQ/Redis connection instantiated for the notification worker | Reuse the exact client/config from the architecture phase — matches the same discipline enforced in Feature 8 Task 2.1 |
| --- | --- |
| A separate SMS-sending interface built here instead of extending Feature 1's existing mock SmsAdapter | Feature 1 already established sendSms(to, templateKey, vars, lang) for OTP — this feature must call the same interface for lifecycle events, not a parallel one (formalized fully in Task 6) |
| --- | --- |

## **Task 2 — Notification Event Registration**

### **Purpose**

-   Define the canonical event-type enum and payload shape this feature's consumer expects — the first concrete specification of what Features 6/7/8's prose-described enqueue calls actually produce (Gap #3).
-   Build the bilingual template registry (REQ-F-Notif003) — templates decoupled from code, keyed by event type, in UR/EN.
-   Inventory every existing enqueue call site across Features 1/6/7/8 and confirm/align payload shape — flagging, not silently fixing, any mismatch found.

### **Dependencies**

-   Task 1 complete (module scaffold, consumer entry point)

### **Expected Deliverables**

-   \[ \] event-types.ts (shared, importable by earlier features if a mismatch requires their enqueue call to be adjusted) — canonical enum: OTP\_REQUESTED (Feature 1), ORDER\_PLACED, ORDER\_PAYMENT\_CONFIRMED, ORDER\_CANCELLED (Feature 6/7), ORDER\_PICKED\_UP, ORDER\_IN\_TRANSIT, ORDER\_OUT\_FOR\_DELIVERY, ORDER\_DELIVERED (Feature 7/8), COURIER\_MANUAL\_LOGISTICS (Feature 8 Task 4.5), TRACKING\_POLL\_FAILURE (Feature 8 Task 6.5) — **no** RETURN\_DECISION/REFUND\_ISSUED yet (Feature 10 not built; registry structured to accept them later without a schema change)
-   \[ \] Payload schema per event type (Zod), validated at consumer entry
-   \[ \] Template registry: templates/{eventType}.json or DB-seeded rows — { en: string, ur: string } per event, with {{variable}} interpolation
-   \[ \] Inventory table (in code comments / FEATURE\_9\_EVENT\_INVENTORY.md) cross-referencing each event type to its exact enqueue call site (file + line/function) in Features 1/6/7/8

### **Implementation Checklist**

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 2.1 | Define event-types.ts with the enum above — structured as an **open** set (new values addable without breaking existing consumers), since Feature 10 will need to add return/refund events later | Shared enum module | Import works from notification/ and is available for Feature 10 to extend later |
| --- | --- | --- | --- |
| 2.2 | Define a Zod payload schema per event type (e.g., ORDER\_DELIVERED: { orderId, userId, language }) — validated at the top of the consumer (Task 1.3) before any processing | Payload validation at the consumer boundary | Malformed/legacy job payloads (missing a required field) are rejected with a clear error, not a silent crash mid-processing |
| --- | --- | --- | --- |
| 2.3 | Audit Feature 6's checkout code for its notification-enqueue call (order placed) — confirm the job's eventType/payload matches 2.1/2.2's schema; if Feature 6's actual enqueue call used a different shape or name, **log the mismatch explicitly** (do not silently rewrite Feature 6's code without flagging it) | Documented match/mismatch per event | FEATURE\_9\_EVENT\_INVENTORY.md row for ORDER\_PLACED shows ✅ match or ⚠️ flagged discrepancy |
| --- | --- | --- | --- |
| 2.4 | Repeat 2.3 for Feature 7 (status-milestone-implied notification points — confirm these were actually enqueued as jobs, not just written as tracking\_events rows with no accompanying notification job) and Feature 8 (delivery milestone, manual-logistics alert, poll-failure alert) | Documented match/mismatch per event, full inventory | Every event type in 2.1 has a corresponding ✅/⚠️ row; any ⚠️ is escalated as a defect against the earlier feature, not patched here |
| --- | --- | --- | --- |
| 2.5 | Build the template registry: one UR/EN pair per event type, with placeholder interpolation (e.g., "Your order #{{orderId}} has been delivered" / Urdu equivalent) — decoupled from service code per TRD §12 | Registry file(s)/seed rows, zero hardcoded strings in notification.service.ts | Changing a template's wording requires editing only the registry, not redeploying service logic |
| --- | --- | --- | --- |
| 2.6 | Confirm OTP\_REQUESTED is included in the registry, reusing Feature 1's **existing** OTP template content (do not rewrite Feature 1's OTP copy — just formalize it into this feature's registry structure for consistency) | OTP event correctly represented | Feature 1's OTP flow, if re-routed through this registry, produces byte-identical message content to what it already sends |
| --- | --- | --- | --- |

### **Common Errors**

| **Error** | **Resolution** |
| --- | --- |
| Feature 6/7/8's actual enqueue payloads silently "fixed" to match this feature's expectations without documentation | Any mismatch must be logged in FEATURE\_9\_EVENT\_INVENTORY.md as a flagged discrepancy — silent patching across feature boundaries breaks traceability |
| --- | --- |
| Templates hardcoded as string literals inside notification.service.ts | Violates TRD §12's explicit "templates decoupled from code" instruction — must live in a registry file/table |
| --- | --- |
| Event-type enum built as a closed/exhaustive switch that would require a code change to add RETURN\_DECISION later | Must be structured as an open, extensible registry (Task 2.1) so Feature 10 can add entries without touching this feature's core dispatch logic |
| --- | --- |

## **Task 3 — In-App Notification Engine**

### **Purpose**

-   Implement the consumer path for channel=IN\_APP: every registered event type (Task 2) results in a notifications row, dispatched immediately (no external adapter needed for in-app).
-   Enforce REQ-F-Notif004: critical transactional notifications cannot be disabled; non-critical are gated by notification\_preferences.
-   Establish the QUEUED→SENT→READ lifecycle for in-app rows per Gap #4's Assumption.

### **Dependencies**

-   Task 2 complete (event types, payload schemas, templates)

### **Expected Deliverables**

-   \[ \] dispatchInApp(eventType, userId, payload, language) — resolves the template (Task 2.5), creates a notifications row (channel=IN\_APP, status=SENT), respects notification\_preferences.inapp\_enabled **unless** the event is flagged critical
-   \[ \] Critical-event allowlist (order placed/confirmed/delivered, return decision, refund issued, OTP) per REQ-F-Notif004 — non-disableable regardless of preference row
-   \[ \] markAsRead(notificationId, userId) — transitions status→READ, sets read\_at
-   \[ \] getUnreadCount(userId) — for the bell icon badge (Task 4 consumes this)

### **Implementation Checklist**

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 3.1 | Define the critical-event allowlist as a constant set (not a DB flag, since it's a fixed business rule, not admin-configurable per any source doc): {ORDER\_PLACED, ORDER\_PAYMENT\_CONFIRMED, ORDER\_DELIVERED, ORDER\_CANCELLED, COURIER\_MANUAL\_LOGISTICS, OTP\_REQUESTED} plus (reserved, not yet used) RETURN\_DECISION/REFUND\_ISSUED for Feature 10 | Shared constant, importable | A non-critical event (e.g., a future "promo" type) is gate-checked against preferences; a critical one always dispatches |
| --- | --- | --- | --- |
| 3.2 | Implement dispatchInApp(): look up notification\_preferences.inapp\_enabled for the user — if false **and** the event is not in the critical allowlist, skip creation entirely; otherwise render the template (Task 2.5, correct language per user's preferred\_language) and insert the notifications row with status=SENT, sent\_at=now() | Correctly gated dispatch | A Buyer with inapp\_enabled=false still receives ORDER\_DELIVERED (critical) but not a hypothetical non-critical event |
| --- | --- | --- | --- |
| 3.3 | Wire the consumer (Task 1.3) to call dispatchInApp() for every job matching a registered event type — this is the first channel processed per job, independent of whether Email/SMS/WhatsApp (Tasks 5–7) also fire for the same event | In-app dispatch fires for every event, regardless of other channel outcomes | An event with all three external channels mocked-failing still produces a correct in-app row |
| --- | --- | --- | --- |
| 3.4 | Implement markAsRead(notificationId, userId) — ownership-checked (row's user\_id = self), transitions status: SENT→READ, sets read\_at=now() (Gap #4) | Working read-transition | A third-party user's token cannot mark another user's notification as read (403) |
| --- | --- | --- | --- |
| 3.5 | Implement getUnreadCount(userId) — counts rows where status != READ for that user | Correct badge count | Marking one of 5 unread notifications as read decrements the count from 5 to 4 |
| --- | --- | --- | --- |

### **Common Errors**

| **Error** | **Resolution** |
| --- | --- |
| Critical notifications silently skipped when inapp\_enabled=false | REQ-F-Notif004 is explicit: critical notifications are **non-disableable** — the allowlist check (3.1) must override the preference check, not the other way around |
| --- | --- |
| notifications row created with status=DELIVERED for in-app channel | Per Gap #4's Assumption, in-app has no separate "delivered" concept distinct from "sent" — use SENT immediately, reserve DELIVERED for external channels where it's meaningful (Email/SMS/WhatsApp, Tasks 5–7) |
| --- | --- |
| Ownership check omitted on markAsRead "since it's just a read-status toggle" | Still a mutation on another user's row if unchecked — enforce ownership identically to every other user-scoped table in this series |
| --- | --- |

*End of Response 1 — Title, Table of Contents, Feature Overview, Notification Flow, and Tasks 1–3 complete. Awaiting confirmation before continuing with Tasks 4–6 (Notification Center, Email Notifications, SMS Notifications).*

## **Task 4 — Notification Center**

### **Purpose**

-   Build the user-facing bell-icon dropdown/panel + full notification list screen (App Flow's global UI state: "notification bell with unread count and chronological list," referenced across SCR-S01, SCR-B01, SCR-B07/08).
-   Consume Task 3's getUnreadCount/findNotificationsByUser/markAsRead — no new query logic, purely a UI layer over what Task 1–3 already built.
-   Wire per-notification click-through to the relevant order/return context (e.g., clicking "Order Delivered" navigates to that order's detail/tracking page).

### **Dependencies**

-   Task 3 complete (in-app dispatch, unread count, mark-as-read)

### **Expected Deliverables**

-   \[ \] GET /api/v1/notifications — paginated, chronological, ownership-scoped list (reuses Task 1.1's repository method, TRD §9 pagination convention)
-   \[ \] GET /api/v1/notifications/unread-count — for the bell badge
-   \[ \] PATCH /api/v1/notifications/:id/read — wraps Task 3.4's markAsRead
-   \[ \] Bell-icon component (shared across Seller/Buyer/Admin shells, Feature 0's shared-component convention) — badge count, dropdown preview (last 5), "View all" link
-   \[ \] Full Notification Center screen — chronological list, unread/read visual distinction, click-through navigation
-   \[ \] Empty state ("No notifications yet") and loading skeleton (Feature 0's shared components)

### **Implementation Checklist**

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 4.1 | Implement GET /notifications controller — calls Task 1.1's findNotificationsByUser(userId, pagination), no new query logic | Working paginated endpoint | Buyer A's token never returns Buyer B's notifications (ownership, spot-checked here, fully adversarial-tested at Task 8) |
| --- | --- | --- | --- |
| 4.2 | Implement GET /notifications/unread-count — calls Task 3.5's getUnreadCount | Working badge-count endpoint | Count matches the actual number of non-READ rows for that user |
| --- | --- | --- | --- |
| 4.3 | Implement PATCH /notifications/:id/read — calls Task 3.4's markAsRead, ownership-checked | Working read-transition endpoint | Marking read decrements the badge count on next fetch |
| --- | --- | --- | --- |
| 4.4 | Build the shared bell-icon component (Feature 0's shared-component layer) — badge shows unread count, dropdown shows the 5 most recent (any channel, but only IN\_APP rows are rendered here — Email/SMS/WhatsApp are external, not shown in-app), "View all" navigates to the full Center | Functional bell icon, reused across all three shells (Seller/Buyer/Admin) | Same component instance used in Seller Dashboard (SCR-S01), Buyer Home (SCR-B01), and Admin Dashboard (SCR-AD01) — no per-shell duplicate |
| --- | --- | --- | --- |
| 4.5 | Build the full Notification Center screen: chronological list, visual read/unread distinction (e.g., bold vs. muted), per-item click-through (e.g., an ORDER\_DELIVERED notification navigates to /orders/:id/track, reusing Feature 7/8's existing routes — no new navigation logic invented) | Functional full-list screen | Clicking a notification both marks it read (4.3) and navigates correctly |
| --- | --- | --- | --- |
| 4.6 | Build empty state ("No notifications yet") and skeleton loader using Feature 0's shared EmptyState/Skeleton | Correct empty/loading UI | New user with zero notifications sees the documented message, not a blank panel |
| --- | --- | --- | --- |

### **Common Errors**

| **Error** | **Resolution** |
| --- | --- |
| A separate bell-icon component built per role (Seller/Buyer/Admin) instead of one shared component | Violates the reuse-first discipline held since Feature 0 — one component, reused across all three shells |
| --- | --- |
| Click-through builds a new navigation/routing scheme instead of reusing existing order/tracking routes | An ORDER\_DELIVERED notification must link to Feature 7/8's already-existing /orders/:id or /orders/:id/track routes, not a new notification-specific detail page |
| --- | --- |

## **Task 5 — Email Notifications**

### **Purpose**

-   Implement the EmailAdapter interface + mock (D2 pattern) — the "optional" channel per Gap #1, built fresh since no prior feature touched Email.
-   Wire the consumer (Task 1.3) to dispatch Email for events where notification\_preferences.email\_enabled=true (or the event is critical, per Task 3.1's allowlist).
-   Confirm Email's notifications row uses channel=EMAIL and progresses through the full QUEUED→SENT→DELIVERED/FAILED lifecycle (unlike in-app's simplified SENT→READ, per Gap #4).

### **Dependencies**

-   Task 3 complete (critical-allowlist, dispatch-gating pattern established for in-app — Email reuses the identical gating logic, different channel)
-   Feature 0/2 complete (Adapter pattern, ADAPTER\_MODE factory)

### **Expected Deliverables**

-   \[ \] adapters/email/index.ts (interface: sendEmail(to, templateKey, vars, lang)), mock.ts — new adapter pair, following the exact shape of existing adapters (D2)
-   \[ \] dispatchEmail(eventType, userId, payload, language) — mirrors Task 3.2's dispatchInApp structure, gated identically by critical-allowlist + preferences
-   \[ \] notifications row per email sent (channel=EMAIL, status progressing QUEUED→SENT→DELIVERED on mock success, →FAILED on simulated mock failure)
-   \[ \] Confirmed: Email is flagged as the "optional, no traced requirement" channel per Gap #1 — documented in code comments

### **Implementation Checklist**

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 5.1 | Scaffold adapters/email/index.ts (interface) + mock.ts (deterministic mock, incl. simulated failure per D2's "mocks emulate failures to exercise degradation paths") — register in the existing ADAPTER\_MODE factory (architecture phase), not a new factory | New adapter pair, correctly factory-registered | ADAPTER\_MODE=mock resolves EmailAdapter to the mock implementation, consistent with how PaymentAdapter/CourierAdapter already resolve |
| --- | --- | --- | --- |
| 5.2 | Implement dispatchEmail(): check notification\_preferences.email\_enabled (skip unless critical, same allowlist as Task 3.1) → render template (Task 2.5, en/ur per user's language) → call EmailAdapter.sendEmail() → insert notifications row with channel=EMAIL, status=QUEUED initially, updated to SENT on adapter acceptance | Correctly gated dispatch, mirrors in-app's gating exactly | A user with email\_enabled=false still receives a critical event's email but not a non-critical one |
| --- | --- | --- | --- |
| 5.3 | On mock adapter success, transition status→DELIVERED (simulating a delivery confirmation); on simulated mock failure, transition status→FAILED — this is the first channel in this feature to actually use DELIVERED/FAILED (in-app never does, per Gap #4) | Full lifecycle exercised for an external channel | Simulated failure produces a FAILED row, not a silently-dropped notification |
| --- | --- | --- | --- |
| 5.4 | Wire the consumer (Task 1.3) to call dispatchEmail() alongside dispatchInApp() for every applicable event — independent execution (Email failing does not block in-app from succeeding, and vice versa) | Channels dispatch independently | Forcing Email's mock to fail does not prevent the same event's in-app row from being created correctly |
| --- | --- | --- | --- |
| 5.5 | Confirm no PRD/TRD requirement ID gates Email (Gap #1) — add a code comment flagging this so a future scope-trim conversation doesn't need to re-derive the finding | Documented, traceable flag | notification/email/ module header comment states the gap explicitly |
| --- | --- | --- | --- |

### **Common Errors**

| **Error** | **Resolution** |
| --- | --- |
| A second ADAPTER\_MODE factory or adapter-registration mechanism built for Email | Reuse the exact factory pattern already established for PaymentAdapter/CourierAdapter/SmsAdapter — one factory, one more registered adapter type |
| --- | --- |
| Email dispatch failure blocks/throws inside the same consumer call that also handles in-app dispatch | Each channel's dispatch must be independently try/caught — a failure in one channel must never prevent others from completing (TRD §14's graceful-degradation principle applied at the channel level) |
| --- | --- |

## **Task 6 — SMS Notifications**

### **Purpose**

-   **Extend** Feature 1's existing mock SmsAdapter (already used for OTP) to also handle lifecycle-event SMS — per the Engineering Decision in the Feature Overview, this is not a new adapter.
-   Confirm SMS remains the one channel explicitly named MVP in the PRD (REQ-F-Notif001's "SMS (MVP)") — no scope ambiguity here, unlike Email/WhatsApp.
-   Reuse the identical dispatch-gating pattern from Tasks 3/5, with SMS's own sms\_enabled preference flag (Schema §4.20).

### **Dependencies**

-   Task 5 complete (confirms the dispatch-gating + adapter-factory pattern works for a second external channel before extending a third)
-   Feature 1 complete (existing mock SmsAdapter, sendSms(to, templateKey, vars, lang))

### **Expected Deliverables**

-   \[ \] dispatchSms(eventType, userId, payload, language) — calls Feature 1's **existing** SmsAdapter.sendSms(), no new adapter file created
-   \[ \] notifications row per SMS sent (channel=SMS, full QUEUED→SENT→DELIVERED/FAILED lifecycle, same pattern as Task 5.3)
-   \[ \] Confirmed: sms\_enabled preference (Schema §4.20) gates non-critical events; critical events (order placed/confirmed/delivered, OTP) always send regardless
-   \[ \] REQ-F-Track004's exact milestone list (Confirmed, Picked Up, In Transit, Out for Delivery, Delivered) verified as fully wired through this dispatch path

### **Implementation Checklist**

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 6.1 | Confirm Feature 1's SmsAdapter interface/mock is imported directly — **no new file created under adapters/sms/** | Zero new adapter code | Grep confirms dispatchSms() imports from Feature 1's existing adapter path, not a new one |
| --- | --- | --- | --- |
| 6.2 | Implement dispatchSms(): identical structure to dispatchEmail() (Task 5.2) — check notification\_preferences.sms\_enabled (skip unless critical) → render template → call the existing sendSms() → insert notifications row (channel=SMS) | Correctly gated dispatch, mirrors Email's pattern | A user with sms\_enabled=false still receives OTP and critical order events |
| --- | --- | --- | --- |
| 6.3 | Verify REQ-F-Track004's five milestones (ORDER\_PAYMENT\_CONFIRMED→"Confirmed", ORDER\_PICKED\_UP, ORDER\_IN\_TRANSIT, ORDER\_OUT\_FOR\_DELIVERY, ORDER\_DELIVERED) are all present in Task 2's event registry and all correctly trigger dispatchSms() — this is the PRD's one explicitly-named MVP SMS requirement, so it gets a dedicated verification step | All 5 milestones confirmed wired | A simulated full order lifecycle (via Feature 8's mock poll job) produces exactly 5 SMS dispatch attempts at the correct milestones, no more, no fewer |
| --- | --- | --- | --- |
| 6.4 | Confirm OTP (OTP\_REQUESTED, Feature 1) still works correctly if re-routed through this feature's template registry (Task 2.6) — i.e., this task does not accidentally break Feature 1's existing OTP flow while extending the adapter's usage | Feature 1's OTP flow regression-tested | OTP SMS content/behavior unchanged after this feature's changes |
| --- | --- | --- | --- |

### **Common Errors**

| **Error** | **Resolution** |
| --- | --- |
| A second SMS adapter/interface created "to keep lifecycle events separate from OTP" | Explicitly forbidden by the Engineering Decision — one SmsAdapter, two calling contexts (OTP from Feature 1, lifecycle from this feature) |
| --- | --- |
| Feature 1's OTP flow broken by refactoring SmsAdapter usage to fit this feature's dispatch pattern | Regression-test OTP explicitly (Step 6.4) — extending, not replacing, the interface's usage |
| --- | --- |
| One of REQ-F-Track004's five milestones missing from the actual dispatch path (e.g., "Picked Up" silently not wired) | Step 6.3 exists specifically to catch this — verify all five, not just the ones that happen to already work |
| --- | --- |

*End of Response 2 — Tasks 4–6 complete. Awaiting confirmation before continuing with Tasks 7–8 (WhatsApp Notifications, Validation & Testing), followed by the final Table of Contents update, cross-reference verification, and full consistency review against Features 0–8.*

## **Task 7 — WhatsApp Notifications**

### **Purpose**

-   Implement the WhatsAppAdapter interface + mock (D2 pattern) — built fresh, following the identical adapter-factory shape as Email (Task 5) and the existing SmsAdapter.
-   Confirm this channel is being pulled forward from its PRD-scoped R1.1 slot per Gap #2 — documented as a conscious choice, not a silent scope violation.
-   Reuse the identical dispatch-gating pattern (critical-allowlist + whatsapp\_enabled preference, Schema §4.20) established in Tasks 3/5/6 — the fourth and final channel to follow this exact shape.

### **Dependencies**

-   Task 6 complete (confirms the dispatch-gating + adapter-factory pattern works consistently across in-app, Email, and SMS before extending to a fourth channel)
-   Feature 0/2 complete (Adapter pattern, ADAPTER\_MODE factory)

### **Expected Deliverables**

-   \[ \] adapters/whatsapp/index.ts (interface: sendTemplate(to, template, vars), per TRD §28's exact method name), mock.ts — new adapter pair, registered in the existing ADAPTER\_MODE factory
-   \[ \] dispatchWhatsApp(eventType, userId, payload, language) — mirrors Task 5.2/6.2's structure exactly
-   \[ \] notifications row per WhatsApp message (channel=WHATSAPP, full QUEUED→SENT→DELIVERED/FAILED lifecycle)
-   \[ \] Confirmed: WhatsApp is R1.1-scoped per PRD §12.12/§15 (F19) but built now per explicit instruction — documented in code comments (Gap #2)

### **Implementation Checklist**

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 7.1 | Scaffold adapters/whatsapp/index.ts (interface, sendTemplate(to, template, vars) per TRD §28) + mock.ts (deterministic, incl. simulated failure) — register in the existing ADAPTER\_MODE factory, not a new one | New adapter pair, correctly factory-registered | ADAPTER\_MODE=mock resolves WhatsAppAdapter to the mock, consistent with Email/SMS/Courier/Payment resolution |
| --- | --- | --- | --- |
| 7.2 | Implement dispatchWhatsApp(): identical structure to dispatchEmail()/dispatchSms() — check notification\_preferences.whatsapp\_enabled (skip unless critical) → render template (Task 2.5) → call WhatsAppAdapter.sendTemplate() → insert notifications row (channel=WHATSAPP) | Correctly gated dispatch, mirrors the established pattern | A user with whatsapp\_enabled=false still receives critical events only |
| --- | --- | --- | --- |
| 7.3 | Wire the consumer (Task 1.3) to call dispatchWhatsApp() alongside dispatchInApp()/dispatchEmail()/dispatchSms() for every applicable event — fully independent per-channel execution (a WhatsApp mock failure never blocks the other three channels) | All four channels dispatch independently for a single event | Forcing WhatsApp's mock to fail does not prevent in-app/Email/SMS from succeeding for the same event |
| --- | --- | --- | --- |
| 7.4 | Add a code-comment flag confirming this channel is R1.1-scoped in the PRD but built now per explicit direction (Gap #2) — so a future scope-review doesn't mistake this for an undocumented scope creep | Documented, traceable flag | notification/whatsapp/ module header comment states the gap explicitly, mirroring Task 5.5's Email flag |
| --- | --- | --- | --- |
| 7.5 | Confirm Meta Cloud API's real-world approval/onboarding requirement (TRD §28: "Business approval" for live mode) is noted as a live-mode blocker, not something this task needs to resolve — mock mode has no such dependency | Documented deferral | Code comment or FEATURE\_9\_CHECKLIST.md note confirms real WhatsApp integration requires Meta Business approval, deferred to Feature 16 |
| --- | --- | --- | --- |

### **Common Errors**

| **Error** | **Resolution** |
| --- | --- |
| WhatsApp built with a different dispatch-gating structure than Email/SMS "since it's a different provider" | The gating logic (critical-allowlist check, preference check, template render, adapter call, row insert) must be structurally identical across all three external channels — only the adapter method differs |
| --- | --- |
| Real Meta Cloud API credentials or onboarding flow attempted/stubbed in this task | Explicitly out of scope — mock only, per D2; live integration is Feature 16's job |
| --- | --- |

## **Task 8 — Validation & Testing**

### **Purpose**

-   Independently re-verify Tasks 1–7 against this feature's core guarantees: critical notifications are never disableable, all four channels dispatch independently, and every event from Features 1/6/7/8 is correctly consumed with no payload mismatches left silently unresolved.
-   Run adversarial tests on ownership (Notification Center), preference-gating (critical vs. non-critical), and cross-channel failure isolation.
-   Produce the sign-off artifact confirming Feature 9 is a clean consumer of Features 1/6/7/8's existing enqueue calls, before Feature 10 (Returns) adds its own event types to this same registry.

### **Dependencies**

-   Tasks 1–7 complete

### **Expected Deliverables**

-   \[ \] Integration test suite for notification/ module (consumer, all four dispatch functions, Notification Center endpoints)
-   \[ \] Critical-non-disableable adversarial test set (every critical event still fires with all preferences off)
-   \[ \] Cross-channel failure-isolation test set (one channel's mock failure never blocks another)
-   \[ \] Ownership adversarial test set (Notification Center reads/mark-as-read)
-   \[ \] Bilingual template test set (every event type renders correctly in both en and ur)
-   \[ \] Full reuse audit — grep-level confirmation against Feature 1 (SmsAdapter not duplicated), Features 6/7/8 (event payload matches, per Task 2's inventory), and the architecture phase (adapter factory, BullMQ)
-   \[ \] FEATURE\_9\_CHECKLIST.md — consolidated sign-off, including the finalized FEATURE\_9\_EVENT\_INVENTORY.md match/mismatch table
-   \[ \] Coverage confirmed ≥80% for all new notification/ module code

### **Implementation Checklist**

| **Step** | **Action** | **Expected Output** | **Verify** |
| --- | --- | --- | --- |
| 8.1 | Integration-test the full happy path: an ORDER\_DELIVERED event fires (simulated, matching Feature 8's actual enqueue shape) → in-app row created → Email/SMS/WhatsApp all dispatch → Notification Center shows the new item → mark-as-read decrements badge | Green test suite | End-to-end matches the Notification Flow diagram exactly |
| --- | --- | --- | --- |
| 8.2 | Critical-non-disableable adversarial test: set all four preference flags (inapp/email/sms/whatsapp\_enabled) to false for a test user, then fire a critical event (ORDER\_PLACED, OTP\_REQUESTED) | All four channels still dispatch despite preferences being off | Confirms Task 3.1's allowlist correctly overrides Tasks 5/6/7's preference checks in every channel |
| --- | --- | --- | --- |
| 8.3 | Non-critical gating test (once Feature 10 or a future non-critical event type exists as a test fixture): confirm a non-critical event **does** respect false preferences | Correctly gated for non-critical | Distinguishes "critical always sends" from "everything always sends" — the latter would be a bug |
| --- | --- | --- | --- |
| 8.4 | Cross-channel failure-isolation test: force each channel's mock adapter to fail independently (one at a time) and confirm the other three channels + the underlying event's notifications rows are unaffected | All four channels fail/succeed independently | Matches Task 5.4/7.3's independent-dispatch requirement |
| --- | --- | --- | --- |
| 8.5 | Ownership adversarial test: User B's token attempts to read User A's notification list, fetch User A's unread count, or mark User A's notification as read | All rejected 403/404 | Matches the ownership discipline held since Feature 6 |
| --- | --- | --- | --- |
| 8.6 | Bilingual template test: for every event type in the registry (Task 2.1), render both en and ur versions and confirm no missing/empty template entries | Complete template coverage | A registry entry missing a language variant is caught here, not discovered in production |
| --- | --- | --- | --- |
| 8.7 | Finalize FEATURE\_9\_EVENT\_INVENTORY.md (started in Task 2.3/2.4) — every event type from Features 1/6/7/8 shown with a final ✅/⚠️ status; any unresolved ⚠️ is escalated as a named defect against the source feature, not silently closed here | Complete, honest inventory | Reviewed by both developers; any ⚠️ carried into the Unresolved Gaps table below, not hidden |
| --- | --- | --- | --- |
| 8.8 | Full reuse audit — grep for: a second SmsAdapter, a second BullMQ/Redis connection, a second bell-icon component, hardcoded template strings inside service logic, a closed/non-extensible event-type enum | Zero matches (or each justified) | Recorded verbatim in FEATURE\_9\_CHECKLIST.md, matching the discipline established in Features 5/6/7/8 |
| --- | --- | --- | --- |
| 8.9 | Cross-check against App Flow's documented notification-related states (bell icon across all shells, chronological list, critical-non-disableable toggle UI in Settings screens SCR-S10/SCR-B12) | Pass/fail note per screen | Consistent with Feature 0's shared component conventions |
| --- | --- | --- | --- |

### **Common Errors**

| **Error** | **Resolution** |
| --- | --- |
| Coverage gate measured against Features 1/6/7/8's already-covered enqueue-side code, masking whether this feature's new consumer/dispatch code is actually tested | Scope coverage specifically to the new notification/ module files |
| --- | --- |
| A ⚠️ payload mismatch found in Task 2 quietly "fixed" by adjusting this feature's schema to match whatever Feature 7/8 actually sent, without documenting it | Must be logged as a named cross-feature defect in the inventory — silent accommodation breaks traceability for future debugging |
| --- | --- |
| Reuse audit skipped as "obviously fine" | Must be a deliberate grep pass per the discipline established in Features 5/6/7/8 — not a recollection |
| --- | --- |

## **Final Consistency Pass**

### **1\. Table of Contents (updated, final)**

-   Feature Overview
    -   0.1. Pre-Generation Reuse Review
    -   0.2. Documentation Gaps & Assumptions
    -   0.3. Notification Flow
-   Task 1 — Notification Foundation
-   Task 2 — Notification Event Registration
-   Task 3 — In-App Notification Engine
-   Task 4 — Notification Center
-   Task 5 — Email Notifications
-   Task 6 — SMS Notifications
-   Task 7 — WhatsApp Notifications
-   Task 8 — Validation & Testing

### **2\. Cross-Reference Verification**

| **Check** | **Result** |
| --- | --- |
| Organized by implementation dependency, not the feature-brief's list order | ✅ Foundation → Event Registration → In-App → Center → Email → SMS → WhatsApp → Validation; every task's Dependencies field names exact prior task(s) |
| --- | --- |
| Zero new Prisma models/migrations | ✅ notifications (§4.19), notification\_preferences (§4.20) fully pre-specified; confirmed at Task 1.1 |
| --- | --- |
| SMS adapter extended, not duplicated | ✅ Task 6.1 — explicit "zero new adapter code" requirement, verified via grep |
| --- | --- |
| Email/WhatsApp follow the identical adapter-factory pattern | ✅ Tasks 5.1/7.1 — same ADAPTER\_MODE factory, same interface shape |
| --- | --- |
| Templates decoupled from code (TRD §12) | ✅ Task 2.5 — registry-based, verified at Task 8.6 |
| --- | --- |
| Critical notifications non-disableable (REQ-F-Notif004) | ✅ Task 3.1's allowlist, enforced identically across all four channels, adversarial-tested at Task 8.2 |
| --- | --- |
| Bilingual (UR/EN) per REQ-F-Notif003 | ✅ Task 2.5's template registry, tested at Task 8.6 |
| --- | --- |
| Async/queue-based dispatch (REQ-F-Notif005) | ✅ Task 1.3's BullMQ consumer, reused unchanged from the architecture phase |
| --- | --- |
| Existing business modules unmodified | ✅ Feature Overview's exclusions; Task 2.3/2.4 only *audits* F6/7/8's enqueue calls, never edits them; Task 6.4 explicitly regression-tests Feature 1's OTP flow |
| --- | --- |
| Event registry open/extensible for Feature 10 | ✅ Task 2.1 — structured so RETURN\_DECISION/REFUND\_ISSUED can be added without touching this feature's core |
| --- | --- |
| Ownership enforced on Notification Center | ✅ Task 4.1/4.3, adversarial-tested at Task 8.5 |
| --- | --- |
| Cross-channel failure isolation | ✅ Tasks 5.4/6/7.3, adversarial-tested at Task 8.4 |
| --- | --- |
| Feeds Feature 10 correctly | ✅ Open event registry + template pattern ready for return/refund events |
| --- | --- |

### **3\. Assumptions Made (full list)**

| **#** | **Assumption** | **Task** |
| --- | --- | --- |
| 1 | Email is built as an "optional," non-requirement-traced channel per TRD §28 — safest to cut first under schedule pressure | Task 5 |
| --- | --- | --- |
| 2 | WhatsApp (PRD R1.1) is consciously pulled forward into this feature per explicit instruction, not a silent scope violation | Task 7 |
| --- | --- | --- |
| 3 | Task 2 is the first place Features 6/7/8's prose-described enqueue calls become concrete; any mismatch found is logged as a cross-feature defect, not silently patched | Task 2 |
| --- | --- | --- |
| 4 | In-app notifications use a simplified QUEUED→SENT→READ lifecycle (no DELIVERED concept); external channels use the full QUEUED→SENT→DELIVERED/FAILED lifecycle | Task 3, 5, 6, 7 |
| --- | --- | --- |

### **4\. Engineering Decisions Made (full list)**

| **#** | **Decision** | **Task** |
| --- | --- | --- |
| 1 | Single notification/ module (repository/service/consumer/controller) per TRD §12 — no per-channel module split | Task 1 |
| --- | --- | --- |
| 2 | SMS extends Feature 1's existing SmsAdapter interface — no second SMS adapter | Task 1, 6 |
| --- | --- | --- |
| 3 | Email/WhatsApp are new adapters but follow the identical interface+mock+factory shape already established for Payment/Courier/SMS (D2) | Task 5, 7 |
| --- | --- | --- |
| 4 | Templates stored in a decoupled registry (file/DB-seeded), never hardcoded in service logic | Task 2 |
| --- | --- | --- |

### **5\. Unresolved Documentation Gaps (carried forward, not closed by this feature)**

| **#** | **Gap** | **Status** | **Needs** |
| --- | --- | --- | --- |
| 1 | Any ⚠️ payload mismatch discovered in Task 2.3/2.4/8.7 between this feature's expected event shape and what Features 6/7/8 actually enqueued | Logged in FEATURE\_9\_EVENT\_INVENTORY.md, not resolved here | A targeted patch to the specific earlier feature's enqueue call, decided case-by-case once the inventory is reviewed |
| --- | --- | --- | --- |
| 2 | Real Email/SMS/WhatsApp provider integration (SendGrid/SES, Twilio/AWS SNS, Meta Cloud API) | Explicitly deferred | Feature 16 (External APIs) |
| --- | --- | --- | --- |
| 3 | Admin broadcast tool (SCR-AD07, REQ-F-Admin-007) | Explicitly deferred | Feature 12 (Payments & Admin Operations) |
| --- | --- | --- | --- |
| 4 | RETURN\_DECISION/REFUND\_ISSUED event types — registry structured to accept them, but not yet defined/dispatched | Explicitly deferred | Feature 10 (Returns & Refunds) — must add these event types + templates, reusing this feature's dispatch pipeline unchanged |
| --- | --- | --- | --- |
| 5 | Meta Business approval requirement for live WhatsApp mode | Documented as a live-mode blocker only | Feature 16, when swapping to LiveAdapter |
| --- | --- | --- | --- |

**Feature 9.md — Notifications Engineering Execution Playbook is complete.** All 8 tasks follow the required dependency sequence, correctly consume (never modify) the enqueue calls already made by Features 1/6/7/8, extend Feature 1's existing SmsAdapter rather than duplicating it, build Email/WhatsApp on the identical D2 adapter-factory pattern, enforce REQ-F-Notif003/004/005 in full, and leave the event registry open for Feature 10's return/refund events (confirmed via the Task 8.8 reuse audit). Every Assumption, Engineering Decision, and open gap is logged above and carried into FEATURE\_9\_CHECKLIST.md for sign-off. Ready for the team to execute following Features 0–8.