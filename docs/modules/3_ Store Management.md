# **KarobarAI — Engineering Execution Playbook**

## **Feature 3: Store Management**

**Source of truth:** PRD · TRD · App Flow · Backend Schema · Implementation Plan (Docs 1–6). This playbook does not introduce any decision not already present in those documents. Where the source documents are silent, incomplete, or where reuse of a prior feature changes the expected shape of this feature, it is flagged explicitly as an **Assumption**, an **Engineering Decision**, or a **Recommended Enhancement (Optional)** — never silently invented.

**Depends on:** Feature 0 (Project Foundation), Feature 1 (Authentication — assumed complete per the reuse instruction), Feature 2 (User Profiles). This feature **extends** Feature 2's profile module rather than building a parallel one — see Task 1's Engineering Decision.

## **Table of Contents**

1.  [Feature Overview](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#feature-overview) 0.1. [Documentation Gaps & Assumptions](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#documentation-gaps--assumptions) 0.2. [Store Management Flow](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#store-management-flow)
2.  [Task 1 — Store Foundation](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#task-1--store-foundation)
3.  [Task 2 — Create Store](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#task-2--create-store)
4.  [Task 3 — Business Information](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#task-3--business-information)
5.  Task 4 — Store Branding (Logo & Banner) *(pending)*
6.  Task 5 — Store Settings *(pending)*
7.  Task 6 — Store Status Management *(pending)*
8.  Task 7 — Validation & Testing *(pending)*

## **Feature Overview**

**What Feature 3 covers:** the seller's store identity and lifecycle — App Flow **SCR-S00** (Store-Setup Wizard, its persistence layer specifically), **SCR-S10** (Seller Settings — "Store/Brand" tab), and the store-existence gate referenced across /seller/\* routes. Governed by **Schema §4.2 seller\_profiles** (1:1 with users) and **users.status** (§4.1, §3 enum) for status display.

**What it explicitly excludes:**

-   Payout wallet **management** (editing wallets after onboarding, settlement history) — SCR-S09, a dedicated Wallet & Payout feature. Wallet is captured **once**, at creation, per REQ-F-Auth005's onboarding requirement — see Task 2.
-   Commission rate override, fraud rate (seller\_profiles.commission\_rate, fraud\_rate\_30d) — system/admin-managed fields (PRD §11: Admin-only via config panel, BR-006), not seller-editable.
-   Product listings and inventory — the AI Store Builder / Catalog feature, a separate domain (products table, not seller\_profiles).
-   Suspend/ban **mutation** — Admin-only action (SCR-AD02, REQ-F-Admin-001); this feature only **reads and displays** the resulting status.

### **Documentation Gaps & Assumptions**

| **Gap** | **What the docs say** | **Assumption / Decision taken** |
| --- | --- | --- |
| **Store Banner field** | Schema §4.2 seller\_profiles has logo\_url only — no banner\_url column. App Flow doesn't separately spec a banner upload screen, but the feature brief requires one. | **Assumption:** add a nullable banner\_url VARCHAR(512) to seller\_profiles via an additive migration (Task 1), mirroring Feature 2's avatar\_url precedent exactly. |
| --- | --- | --- |
| **"Create Store" vs. the Store-Setup Wizard** | SCR-S00 (Store-Setup Wizard) already exists in App Flow as the first-login onboarding flow (REQ-F-Auth005), typically gated by the Auth feature. | **Engineering Decision:** the wizard's **UI/gate** (redirect-on-first-login logic) remains Auth's responsibility (Feature 1); this feature owns the **persistence endpoint** the wizard's "Finish" button calls. No duplicate creation flow is built. |
| --- | --- | --- |
| **Overlap with Feature 2's Edit Profile** | Feature 2 Task 3 already implemented PATCH /api/v1/profile/me for the Seller role, covering store\_name, store\_description, logo\_url (Feature 2 Task 2.1's documented field scope). | **Engineering Decision:** Feature 3 does **not** build a parallel store module or duplicate CRUD stack. It **extends** Feature 2's existing profile module with store-scoped sub-resources (create, branding upload, status read). This is a direct application of the instruction to reuse rather than repeat. |
| --- | --- | --- |
| **Payout wallet at creation time** | REQ-F-Auth005 requires the wizard to collect "≥1 payout wallet" before a seller can sell. Feature 2 explicitly excluded wallet fields from ongoing profile management (SCR-S09 boundary). | **Assumption:** wallet capture happens **once**, as part of the Task 2 creation payload only (satisfying REQ-F-Auth005), not as an editable field anywhere in this feature. Post-creation wallet changes remain fully out of scope, deferred to the Wallet & Payout feature. |
| --- | --- | --- |
| **Store Status** | No store\_status enum/column exists anywhere in Schema Doc §3/§4.2. The only relevant enum is user\_status (PENDING\_VERIFICATION | ACTIVE | SUSPENDED | BANNED | DEACTIVATED, §4.1), and suspension is an **Admin-only, account-level** action (SCR-AD02), not store-specific. | **Assumption:** "Store Status" is a **derived, read-only view** of the seller's users.status. No new status field is introduced. The seller cannot self-mutate this status — only Admin can (out of scope here, per Feature Overview exclusions). |
| --- | --- | --- |
| **"Store Settings" as a distinct data domain** | App Flow SCR-S10 groups "Store/Brand" under one tab alongside Notifications/Security/Language (the latter three already built in Feature 2 Task 6). No additional store-configuration fields exist in Schema §4.2 beyond name/description/logo(/banner). | **Assumption:** Task 5 ("Store Settings") is a **screen-composition** task — assembling Business Info (Task 3) + Branding (Task 4) into the SCR-S10 "Store/Brand" tab — not a new backend data domain. |
| --- | --- | --- |

### **Store Management Flow**

Store Foundation

(schema: banner\_url · module extension boundary · ownership rules)

│

▼

Create Store

(onboarding-time creation, single-store enforcement, wallet capture)

│

▼

Business Information

(edit store\_name / store\_description — extends Feature 2 Task 3)

│

▼

Store Branding (Logo & Banner)

(upload / replace / remove — extends Feature 2 Task 4's uploader pattern)

│

▼

Store Settings

(SCR-S10 "Store/Brand" tab composition — assembles the above)

│

▼

Store Status Management

(read-only status derived from users.status, seller-facing display)

│

▼

Validation & Testing

(cross-check against Feature 2 boundary, single-store constraint, security review)

Each stage is a hard dependency for the next — Create Store needs Task 1's schema/module boundary settled first; Business Information and Branding both act on a row that must already exist (Task 2); Settings is pure composition of Tasks 3–4; Status Management is independent data but is sequenced after the store exists so the UI has something to attach the status badge to; Validation is only meaningful once every prior stage is real.

## **Task 1 — Store Foundation**

### **Purpose**

-   Extend seller\_profiles (Schema §4.2) with the one additive field this feature needs (banner\_url) — no other schema invention.
-   Formally settle the module-ownership boundary between Feature 1's wizard gate, Feature 2's existing profile module, and this feature's store-scoped additions, so no duplicate stack gets built.
-   Confirm/tighten ownership + role middleware for store-specific routes to **Seller-only** (unlike Feature 2's profile routes, which are shared across all three roles).

### **Dependencies**

-   Feature 0 complete (module conventions, envelope, error middleware, ownership-middleware pattern).
-   Feature 1 (Authentication) complete — JWT auth, RBAC, and the SCR-S00 wizard's first-login redirect gate.
-   Feature 2 complete — the profile module (controller/service/repository/routes/dto), its Seller-branch DTO, and its ownership middleware are the base this feature builds on.

### **Expected Deliverables**

-   \[ \] Migration adding banner\_url VARCHAR(512) NULL to seller\_profiles
-   \[ \] Documented module-boundary decision (this task's Engineering Decision, committed to apps/api/src/modules/profile/README.md or equivalent)
-   \[ \] profile module extended with store-scoped sub-routes reserved (/store, /store/logo, /store/banner, /store/status) — role-gated to SELLER only
-   \[ \] Feature 2's Seller DTO extended with banner\_url and a hasStore: boolean flag

### **Implementation Checklist**

**1.1 — Add the banner\_url schema extension**

-   **Objective:** close the documented gap with a minimal, additive, reversible migration, exactly matching Feature 2's avatar\_url precedent.
-   **Action:** Add banner\_url VARCHAR(512) NULL to the SellerProfile model in schema.prisma. Run prisma migrate dev.
-   **Expected Output:** new migration; seller\_profiles has the new nullable column; existing rows unaffected.
-   **Verification:** prisma migrate status shows applied; column confirmed nullable, no backfill required.
-   **Next Step:** 1.2.

**1.2 — Formalize the module-ownership boundary**

-   **Objective:** make explicit, in writing, that no parallel store module is being built — prevents a second developer from independently scaffolding one out of habit (as Feature 0/2 both did for their own domains).
-   **Action:** Add a short note to the profile module (README or top-of-file comment in profile.routes.ts): *"Store data lives in seller\_profiles, owned by this module. Feature 1's Store-Setup Wizard UI calls POST /profile/me/store (Task 2) on completion; it does not own store persistence. See Feature 3 playbook Task 1 for rationale."*
-   **Expected Output:** committed boundary note.
-   **Verification:** both developers acknowledge the note before Task 2 begins (avoids duplicate-module risk on a 2-person team).
-   **Next Step:** 1.3.

**1.3 — Reserve and role-gate the store sub-routes**

-   **Objective:** extend Feature 2's profile.routes.ts with the new sub-paths, locked to SELLER role only — distinct from profile's shared multi-role routes.
-   **Action:** Register (unimplemented handlers, 501 stubs) under /api/v1/profile/me/store: POST (Task 2), PATCH (Task 3), POST /logo DELETE /logo POST /banner DELETE /banner (Task 4), GET /status (Task 6). Apply Feature 2's authenticate + authorize(\['SELLER'\]) + ownSelf chain to all of them — **tighter than profile's base routes**, which allow Buyer/Admin too.
-   **Expected Output:** routes exist, correctly role-gated, return 501 Not Implemented via the envelope helper until filled in.
-   **Verification:** a Buyer or Admin token hitting any /store/\* sub-route → 403 (role gate fires before the 501 stub).
-   **Next Step:** 1.4.

**1.4 — Extend the Seller DTO**

-   **Objective:** add banner\_url and a hasStore flag to Feature 2's existing SellerProfileDTO, rather than defining a new type.
-   **Action:** In packages/shared/types/profile.ts, add bannerUrl: string | null and hasStore: boolean to SellerProfileDTO. Update Feature 2's GET /profile/me service logic (2.1) to compute hasStore (does a seller\_profiles row exist for this user?) and return bannerUrl — gracefully handling the case where no row exists yet (all store fields null, hasStore: false), since a Seller can now be authenticated but pre-onboarding.
-   **Expected Output:** GET /profile/me no longer assumes a seller\_profiles row always exists.
-   **Verification:** integration test — a freshly-registered Seller (no store yet) calling GET /profile/me gets hasStore: false and no 500 error (this is the regression Feature 2 didn't need to handle, since onboarding was assumed complete by the time Feature 2 was tested).
-   **Next Step:** proceed to Task 2.

### **Common Errors**

| **Error** | **Resolution** |
| --- | --- |
| A second store module gets scaffolded under modules/store/ out of habit | Delete it — Task 1.2's boundary note is the single source of truth; store logic lives in modules/profile/ |
| --- | --- |
| GET /profile/me crashes for a not-yet-onboarded Seller | This is exactly the regression 1.4 fixes — confirm the null-row-safe query path is actually exercised in tests, not just assumed |
| --- | --- |

## **Task 2 — Create Store**

### **Purpose**

-   Implement the single persistence endpoint the SCR-S00 wizard calls on completion, satisfying REQ-F-Auth005 (store name, description, ≥1 payout wallet).
-   Enforce "exactly one store per seller" using the schema's own 1:1 shared-PK design (Schema §4.2) as the source of truth, not just an app-level check.
-   Capture the payout wallet **once**, at creation, per the Documentation Gaps boundary — no wallet editing surface is built here.

### **Dependencies**

-   Task 1 complete (schema, route reservation, DTO)

### **Expected Deliverables**

-   \[ \] POST /api/v1/profile/me/store — creates the seller\_profiles row
-   \[ \] Duplicate-creation attempts rejected with 409 Conflict, not a generic 500
-   \[ \] Wizard (Feature 1's SCR-S00 UI) wired to call this endpoint on "Finish"
-   \[ \] /seller/\* route guard (Feature 0 Task 10) confirmed to check hasStore before allowing access beyond /seller/setup

### **Implementation Checklist**

**2.1 — Implement the create-store service logic**

-   **Objective:** persist the minimum onboarding fields, relying on the DB's own unique-PK constraint to enforce single-store, per Schema §4.2 (user\_id is both PK and FK).
-   **Action:** In profile.service.ts, add createStore(userId, payload): validates store\_name (required), store\_description (optional), and **at least one** of jazzcash\_wallet/easypaisa\_wallet (required per REQ-F-Auth005) via Zod (Task 1.3's DTO). Attempts a Prisma create on seller\_profiles; catches the unique-constraint violation (row already exists for this user\_id) and rethrows as ConflictError(409) (Feature 0 Task 11 error hierarchy) — **do not** pre-check-then-insert (race-condition-prone); let the DB constraint be authoritative.
-   **Expected Output:** working creation path; race-safe duplicate rejection.
-   **Verification:** integration test — first call succeeds (201); an immediate second call (simulating a double-submit) returns 409, not a duplicate row or a 500.
-   **Next Step:** 2.2.

**2.2 — Wire the wizard's "Finish" action**

-   **Objective:** connect Feature 1's existing SCR-S00 UI to this feature's real endpoint (per Task 1.2's boundary — the wizard's frontend flow is Auth's, the call target is this feature's).
-   **Action:** In the wizard's step-3 "Finish" handler (owned by Feature 1's codebase), point the mutation at POST /profile/me/store with the collected fields. On success, redirect to /seller (Seller Dashboard) per App Flow SCR-S00's documented navigation.
-   **Expected Output:** completing the wizard actually creates the store row.
-   **Verification:** end-to-end manual test — register a new Seller, complete the wizard, confirm seller\_profiles row exists in DB with correct fields.
-   **Next Step:** 2.3.

**2.3 — Confirm the /seller/\* route guard checks hasStore**

-   **Objective:** enforce SCR-S00's documented behavior — "blocks access to selling features until complete" — at the routing layer, reusing Feature 0 Task 10's guard mechanism rather than building a new one.
-   **Action:** Extend Feature 0 Task 10's RequireRole (Seller variant) to additionally check the hasStore flag (Task 1.4) from the auth/profile context; if false, redirect to /seller/setup regardless of which /seller/\* path was requested (except /seller/setup itself).
-   **Expected Output:** a Seller without a store cannot reach /seller, /seller/products/new, etc. — always bounced to setup first.
-   **Verification:** manual test — a newly-registered, non-onboarded Seller attempts to navigate directly to /seller/products/new via URL → redirected to /seller/setup.
-   **Next Step:** 2.4.

**2.4 — Handle partial/abandoned wizard sessions**

-   **Objective:** honor App Flow SCR-S00's edge case — "partial completion persists; revisiting resumes at last step" — without contradicting the single-creation-call design of 2.1.
-   **Action:** **Assumption:** since seller\_profiles has no draft/partial state in the schema (it's created complete-or-not-at-all per 2.1's single POST), wizard step progress (which step the user was on) is a **frontend-only** concern (local component state or a lightweight client-side draft), not persisted server-side. The server only ever sees the final, complete submission. This is consistent with Schema §4.2 having no partial/draft columns and avoids inventing a new state model.
-   **Expected Output:** documented assumption; wizard UI (Feature 1) retains step state client-side only.
-   **Verification:** noted in FEATURE\_3\_CHECKLIST.md (Task 7) as a confirmed interpretation, not left ambiguous.
-   **Next Step:** proceed to Task 3.

### **Common Errors**

| **Error** | **Resolution** |
| --- | --- |
| Duplicate-submit (double-click "Finish") creates two rows or crashes | Confirm 2.1's DB-constraint-first approach is actually in place — a naive "check-then-insert" pattern is race-condition-prone under concurrent requests |
| --- | --- |
| Route guard checks role === SELLER but not hasStore, letting non-onboarded sellers through | This is the exact regression 2.3 exists to close — write the explicit direct-navigation test, don't rely on the wizard's own redirect alone |
| --- | --- |

## **Task 3 — Business Information**

### **Purpose**

-   Enable editing store\_name/store\_description post-creation, **reusing** Feature 2 Task 3's existing PATCH /api/v1/profile/me rather than building a new update endpoint (per Task 1's Engineering Decision).
-   Close any validation gaps Feature 2 didn't need to handle for these specific fields (length limits per Schema §4.2, required-field behavior on update vs. create).
-   Confirm the SCR-S10 "Store/Brand" tab's business-info fields are correctly wired to this shared endpoint.

### **Dependencies**

-   Task 2 complete (a store must exist to edit)
-   Feature 2 Task 3 (PATCH /api/v1/profile/me) — reused, not rebuilt

### **Expected Deliverables**

-   \[ \] Feature 2's Seller update DTO confirmed/extended to enforce store\_name (VARCHAR(120), Schema §4.2) and store\_description (TEXT, nullable) constraints
-   \[ \] PATCH /profile/me confirmed to reject updates from a Seller with hasStore: false (nothing to edit yet)
-   \[ \] Business Information fields wired into the SCR-S10 "Store/Brand" tab UI (extending Feature 2's ProfileSettings screen)

### **Implementation Checklist**

**3.1 — Extend length/required validation on the existing DTO**

-   **Objective:** ensure Feature 2's Seller-branch update schema enforces the exact column constraints Schema §4.2 defines, which Feature 2 (built without store-editing as its focus) may not have tightened.
-   **Action:** In profile.dto.ts, confirm/add: store\_name max length 120 (matches VARCHAR(120)), required on update if present in payload (Zod .optional() for partial PATCH semantics — standard PATCH behavior, not full-replace); store\_description optional, no hard max (matches TEXT).
-   **Expected Output:** validation matches the DB column definitions exactly.
-   **Verification:** unit test — a 121-character store name is rejected client- and server-side; a valid partial update (description only) succeeds without requiring store\_name to be resent.
-   **Next Step:** 3.2.

**3.2 — Guard against editing a non-existent store**

-   **Objective:** prevent a Seller who hasn't completed Task 2 from hitting PATCH /profile/me with store fields and generating a confusing error or a silent no-op.
-   **Action:** In profile.service.ts's Seller-branch update logic, check hasStore (Task 1.4) before attempting the seller\_profiles update; if false, throw BusinessRuleError(422) with a clear message directing the user to complete onboarding first.
-   **Expected Output:** clear, correct error instead of a Prisma "record not found" crash.
-   **Verification:** integration test — a non-onboarded Seller's PATCH attempt with store\_name returns 422, not 500.
-   **Next Step:** 3.3.

**3.3 — Wire the SCR-S10 "Store/Brand" tab UI**

-   **Objective:** confirm/complete the frontend form for store\_name/store\_description, using Feature 2's ProfileSettings screen shell (SCR-S10) and its established "Save per section" pattern.
-   **Action:** In features/seller/ProfileSettings, ensure the "Store/Brand" tab section (separate from the "Security"/"Notifications"/"Language" sections Feature 2 already built) submits only store\_name/store\_description via the shared PATCH /profile/me mutation, scoped to its own Save button per SCR-S10's per-section save pattern.
-   **Expected Output:** functional business-info edit form, isolated from other settings sections.
-   **Verification:** manual test — editing store name and saving does not affect notification/language settings in the same screen (confirms section isolation, per Feature 2 Task 7.4's cross-check pattern).
-   **Next Step:** proceed to Task 4.

### **Common Errors**

| **Error** | **Resolution** |
| --- | --- |
| Business Info form accidentally submits the entire profile object (including notification/language fields) on every save | Confirm the "Store/Brand" section's mutation payload is scoped to only store\_name/store\_description — respects SCR-S10's per-section save contract |
| --- | --- |
| store\_description max-length assumed to mirror store\_name's 120-char limit | Schema §4.2 defines store\_description as TEXT (effectively unbounded) — don't impose an invented limit not in the schema |
| --- | --- |

*End of Response 1 — Feature Overview, Documentation Gaps, Store Management Flow, and Tasks 1–3 complete. Awaiting confirmation before continuing with Tasks 4–5 (Store Branding, Store Settings).*

## **Task 4 — Store Branding (Logo & Banner)**

### **Purpose**

-   Implement upload/replace/remove for logo\_url (already in Schema §4.2) and banner\_url (added in Task 1), reusing Feature 2 Task 4's AvatarUploader pattern and the same object-storage adapter — no new upload infrastructure invented.
-   Distinguish logo vs. banner purely by upload target/key prefix and (optionally) aspect-ratio guidance — not by a different technical mechanism.
-   Guard branding uploads behind hasStore (Task 1.4/3.2), consistent with Business Information's rule.

### **Dependencies**

-   Task 3 complete (a store must exist; the same hasStore guard applies)
-   Feature 2 Task 4 (AvatarUploader component, object-storage upload()/magic-byte validation pattern) — reused, extended, not rebuilt

### **Expected Deliverables**

-   \[ \] POST/DELETE /api/v1/profile/me/store/logo — upload/replace/remove
-   \[ \] POST/DELETE /api/v1/profile/me/store/banner — upload/replace/remove
-   \[ \] A generalized ImageUploader component (Feature 2's AvatarUploader refactored into a shared base, or reused directly with a variant prop) — team decision documented below
-   \[ \] Logo + Banner upload UI wired into the SCR-S10 "Store/Brand" tab (same tab as Task 3.3's business info)

### **Implementation Checklist**

**4.1 — Decide: extend AvatarUploader or generalize it**

-   **Objective:** avoid a third near-identical upload component when logo/banner makes it two-going-on-three (avatar, logo, banner) — settle this once, in writing, before writing code.
-   **Action:** **Engineering Decision:** generalize Feature 2's AvatarUploader into a shared ImageUploader component (apps/web/src/components/ImageUploader/) accepting targetField (avatar | logo | banner), currentUrl, onUploadSuccess, onRemove, and an optional aspectRatioHint (visual guidance only, e.g., banner suggests wide format — **Recommended Enhancement (Optional):** client-side crop/aspect enforcement before upload, since no PRD/TRD requirement specifies exact banner dimensions). Keep AvatarUploader as a thin wrapper calling ImageUploader with targetField="avatar" so Feature 2's existing call sites don't need changes.
-   **Expected Output:** one generalized component; Feature 2's usage untouched.
-   **Verification:** AvatarUploader's existing tests (Feature 2 Task 7.1) still pass unmodified after the refactor.
-   **Next Step:** 4.2.

**4.2 — Implement logo upload/replace/remove (backend)**

-   **Objective:** mirror Feature 2 Task 4.2/4.3 exactly, targeting seller\_profiles.logo\_url instead of users.avatar\_url.
-   **Action:** In profile.service.ts, add uploadStoreLogo(userId, file): hasStore guard (Task 3.2's pattern) → magic-byte + size validation (Sec-012, same limits as Feature 2) → object-storage upload() with key store-logos/{user\_id}/{uuid}.ext → update seller\_profiles.logo\_url → fire-and-forget delete of the previous object on replace (Feature 2 Task 4.3 pattern, reused). DELETE sets logo\_url = NULL.
-   **Expected Output:** working logo endpoints.
-   **Verification:** integration test mirroring Feature 2 Task 4's — valid upload persists, oversized/wrong-type rejected, replace cleans up the old key (best-effort), remove nulls the field.
-   **Next Step:** 4.3.

**4.3 — Implement banner upload/replace/remove (backend)**

-   **Objective:** identical mechanism to 4.2, targeting seller\_profiles.banner\_url, key prefix store-banners/.
-   **Action:** Add uploadStoreBanner(userId, file) — same shape as 4.2, different field/prefix. **Assumption:** reuse the same 10MB-accept / compress-before-upload ceiling as logo and avatar (Feature 2 Task 4.2's assumption) since no banner-specific limit exists in any source document.
-   **Expected Output:** working banner endpoints.
-   **Verification:** same test pattern as 4.2, scoped to banner\_url.
-   **Next Step:** 4.4.

**4.4 — Wire both into the SCR-S10 "Store/Brand" tab**

-   **Objective:** complete the visible feature — Seller manages logo and banner from the same tab as Task 3.3's business info fields.
-   **Action:** Mount two ImageUploader instances (targetField="logo", targetField="banner") in the "Store/Brand" section of ProfileSettings, each wired to its own TanStack Query mutation (4.2/4.3 endpoints), invalidating the profile/me query cache on success — consistent with Feature 2 Task 4.4's cache-invalidation pattern.
-   **Expected Output:** functional logo + banner management in one UI section.
-   **Verification:** manual test — upload both, confirm persistence after refresh, confirm storefront-facing consumers (out of scope here, but note: logo\_url is also read by the Catalog/Storefront feature) aren't broken by the field still being nullable.
-   **Next Step:** proceed to Task 5.

### **Common Errors**

| **Error** | **Resolution** |
| --- | --- |
| Logo/banner upload built as a copy-pasted near-duplicate of AvatarUploader instead of using the 4.1 generalization | Re-derive from ImageUploader; a third divergent copy is exactly the drift Task 4.1 exists to prevent |
| --- | --- |
| Branding upload allowed before hasStore is true | Apply the same guard as Task 3.2 — a Seller mid-wizard has no seller\_profiles row to attach logo\_url/banner\_url to |
| --- | --- |

## **Task 5 — Store Settings**

### **Purpose**

-   Compose Tasks 3 (Business Information) and 4 (Branding) into the single SCR-S10 "Store/Brand" tab as one coherent screen section, per the Documentation Gaps table's framing of this task as composition, not new data.
-   Confirm section isolation against Feature 2 Task 6's existing "Notifications | Language | Security" tabs on the same screen — no cross-section save leakage.
-   Close out the seller-facing store-configuration surface before Status Management (Task 6) adds the read-only status badge on top.

### **Dependencies**

-   Task 3 and Task 4 complete (both sub-sections exist independently)
-   Feature 2 Task 6 (Account Settings — the sibling tabs on the same ProfileSettings screen)

### **Expected Deliverables**

-   \[ \] SCR-S10 screen confirmed to render four independent, isolated tab sections: Store/Brand (Tasks 3+4), Notifications (Feature 2), Language (Feature 2), Security (Feature 2)
-   \[ \] Store/Brand tab has its own loading/empty/error states per App Flow §0 global states
-   \[ \] Pre-store (not-yet-onboarded, theoretically unreachable per Task 2.3's guard, but defensively handled) empty state confirmed

### **Implementation Checklist**

**5.1 — Confirm tab composition and isolation**

-   **Objective:** verify the "Store/Brand" tab (Business Info + Logo + Banner) renders alongside, and does not interfere with, Feature 2's three existing tabs on ProfileSettings.
-   **Action:** Review features/seller/ProfileSettings tab container: confirm each tab's mutations (Task 3's business-info PATCH, Task 4's logo/banner uploads, Feature 2's settings PATCH, Feature 2's password change) are independently triggered and independently invalidate only their relevant query keys — not a shared "save everything" action.
-   **Expected Output:** confirmed 4-tab structure with isolated save actions.
-   **Verification:** manual test — editing and saving Store/Brand does not trigger a Notifications save call (network tab inspection), and vice versa; matches Feature 2 Task 7.4's cross-check discipline.
-   **Next Step:** 5.2.

**5.2 — Implement Store/Brand tab-level loading/empty/error states**

-   **Objective:** apply App Flow §0's global UI states (skeleton on fetch, toast on save, error retry) specifically to this tab, reusing Feature 0 Task 8 components.
-   **Action:** Wrap the Store/Brand tab content in Feature 0's Skeleton during the initial GET /profile/me fetch (shared fetch with the other tabs — one loading state for the whole screen, per Feature 2's existing pattern, not duplicated per-tab); on business-info or branding save success, fire Feature 0's ToastProvider; on save failure, inline error with retry (matches App Flow's per-screen "Error" state convention).
-   **Expected Output:** consistent state handling matching the rest of the screen.
-   **Verification:** simulate a failed PATCH (e.g., network throttling/mock failure) — inline error + retry appears, no silent failure.
-   **Next Step:** 5.3.

**5.3 — Defensive empty-state for a theoretically-unreachable no-store case**

-   **Objective:** since Task 2.3's route guard should make it impossible for a non-onboarded Seller to reach /seller/settings, this is a defensive check, not a primary flow — but worth confirming rather than assuming.
-   **Action:** If hasStore: false is somehow encountered on this screen (guard bypass, stale client cache, direct API testing), render Feature 0's EmptyState with a "Complete your store setup first" message and a link to /seller/setup, rather than a broken form or a crash.
-   **Expected Output:** graceful fallback, never a hard error, for this edge case.
-   **Verification:** manually force hasStore: false in a test build (bypass the route guard in a test harness) and confirm the fallback renders correctly.
-   **Next Step:** proceed to Task 6.

### **Common Errors**

| **Error** | **Resolution** |
| --- | --- |
| Store/Brand tab silently assumes seller\_profiles data is always present, crashing on null fields | Confirm all Task 3/4 field reads are null-safe (a fresh store may have logo\_url/banner\_url still null even though hasStore is true) |
| --- | --- |
| Screen-wide save button re-introduced (e.g., a global "Save Changes" button spanning all tabs) | Contradicts App Flow SCR-S10's explicit "Save per section" pattern, already enforced in Feature 2 and Task 3.3 — do not regress this in the Task 5 composition pass |
| --- | --- |

*End of Response 2 — Tasks 4–5 complete. Awaiting confirmation before continuing with Tasks 6–7 (Store Status Management, Validation & Testing), followed by the final Table of Contents update and cross-reference verification.*

## **Task 6 — Store Status Management**

### **Purpose**

-   Surface the seller-facing **read-only** view of store status, derived strictly from users.status (Schema §4.1/§3), per the Documentation Gaps table's finding that no separate store-status field exists.
-   Confirm the seller cannot self-mutate this status anywhere in this feature — mutation remains exclusively Admin's (SCR-AD02, REQ-F-Admin-001), out of scope here.
-   Ensure the status badge correctly reflects the fraud-suspension pathway (BR-006) and general account states, so a seller always understands why their store may be inactive.

### **Dependencies**

-   Task 5 complete (the SCR-S10 screen exists to host the status badge; the store exists per Task 2)

### **Expected Deliverables**

-   \[ \] GET /api/v1/profile/me/store/status — returns derived, read-only status
-   \[ \] Status badge rendered on Seller Dashboard (SCR-S01) and SCR-S10, using Feature 0 Task 8's StatusChip component
-   \[ \] No mutation endpoint exists for store status anywhere in this feature (explicit negative verification)
-   \[ \] Suspended/banned states correctly restrict /seller/\* write actions (cross-check with Task 2.3's route guard)

### **Implementation Checklist**

**6.1 — Implement the read-only status endpoint**

-   **Objective:** expose users.status in a store-specific shape, without adding any new schema or mutation surface.
-   **Action:** Fill the Task 1.3 GET /profile/me/store/status stub: reads users.status for the authenticated Seller, maps the user\_status enum (PENDING\_VERIFICATION | ACTIVE | SUSPENDED | BANNED | DEACTIVATED, Schema §3) to a seller-facing label + tone (e.g., ACTIVE → green "Active", SUSPENDED → red "Suspended — contact support"). **Assumption:** the label/tone mapping is a presentation-layer concern (frontend StatusChip config), not a new backend field — the API returns the raw enum value, the frontend maps to color/copy, keeping the backend contract stable if wording changes later.
-   **Expected Output:** working read-only endpoint returning { status: user\_status, since: timestamp } — since sourced from users.updated\_at as the closest available signal (no dedicated status-change-timestamp column exists in Schema §4.1; flagged as an approximation, not an exact "status changed at" audit value — the precise history lives in audit\_logs, §4.24, out of scope for this seller-facing read).
-   **Verification:** integration test — Seller with status=ACTIVE gets "ACTIVE"; a test row manually set to SUSPENDED reflects correctly.
-   **Next Step:** 6.2.

**6.2 — Confirm no mutation path exists (negative verification)**

-   **Objective:** explicitly prove this feature never lets a Seller change their own status — a security-relevant absence, not just an oversight to hope for.
-   **Action:** Grep the profile module's store sub-routes (Task 1.3) — confirm only GET /store/status exists, no PATCH/POST/PUT variant. Add an explicit adversarial test: Seller token attempts PATCH /profile/me/store/status with a status payload → route doesn't exist → 404, and separately, confirm the generic PATCH /profile/me (Feature 2/Task 3) DTO does **not** accept a status field even if included in the request body (Zod's "reject unknown fields" per TRD §9 should already strip it — verify, don't assume).
-   **Expected Output:** confirmed absence of any seller-facing mutation path.
-   **Verification:** both tests pass; documented in FEATURE\_3\_CHECKLIST.md (Task 7) as an explicitly-verified security boundary.
-   **Next Step:** 6.3.

**6.3 — Render the status badge on Seller Dashboard and Settings**

-   **Objective:** surface status where the seller actually needs to see it — App Flow SCR-S01 (Dashboard) doesn't explicitly list a status badge, but PRD's fraud-suspension flow (BR-006) implies the seller needs visibility into why features might be restricted.
-   **Action:** Add Feature 0 Task 8's StatusChip to SCR-S01 (Dashboard header) and SCR-S10 (Store/Brand tab or screen header), wired to Task 6.1's endpoint. **Assumption:** placement on the Dashboard header is a reasonable interpretation of "seller needs visibility" since App Flow doesn't specify an exact widget location for this — flagged for UX confirmation, not treated as a hard spec.
-   **Expected Output:** status visible in two places, consistent styling via StatusChip.
-   **Verification:** manual test across all five user\_status enum values (seed test data or mock the endpoint response) — badge renders correctly for each.
-   **Next Step:** 6.4.

**6.4 — Cross-check restricted actions against suspended/banned status**

-   **Objective:** confirm that a suspended/banned Seller's write actions (Business Info edit, Branding upload — Tasks 3–4) are actually blocked, not just visually flagged.
-   **Action:** Extend Feature 0 Task 10's route guard (already checking role and hasStore per Task 2.3) to also deny write actions when users.status !== ACTIVE; **read access remains available** (a suspended seller should still see their dashboard/status, per REQ-F-Auth006's "suspension invalidates sessions immediately" — note this is actually stronger than a soft block, since Feature 1's suspension logic revokes the session entirely, making this check largely defensive/belt-and-suspenders for any window before session revocation propagates).
-   **Expected Output:** write endpoints (Task 3's PATCH, Task 4's uploads) reject if status is non-active, independent of the session-revocation mechanism.
-   **Verification:** integration test — manually set a test user to SUSPENDED without revoking their token (simulating a propagation-delay edge case) → PATCH/upload attempts correctly rejected with 403/422.
-   **Next Step:** proceed to Task 7.

### **Common Errors**

| **Error** | **Resolution** |
| --- | --- |
| A PATCH /store/status endpoint gets accidentally scaffolded "for completeness" during Task 1.3's route reservation | Remove it — Task 6.2's negative verification exists precisely to catch this; status mutation is Admin-only and belongs to a different feature entirely |
| --- | --- |
| Status badge hardcodes color/copy per status in multiple places (Dashboard AND Settings each defining their own mapping) | Centralize the enum→label/tone mapping once in StatusChip's config (Feature 0 Task 8), consumed by both placements — avoids drift if wording changes |
| --- | --- |

## **Task 7 — Validation & Testing**

### **Purpose**

-   Independently re-verify Tasks 1–6 against their own deliverables, mirroring Feature 0 Task 12 and Feature 2 Task 7's closing pattern.
-   Specifically test the single-store constraint, the hasStore gating logic, and the status read-only boundary under adversarial conditions — the three security/integrity-critical guarantees this feature makes.
-   Produce the sign-off artifact enabling the next feature (Catalog / AI Store Builder, which depends on a store existing) to begin safely.

### **Dependencies**

-   Tasks 1–6 complete

### **Expected Deliverables**

-   \[ \] Full integration test suite for all store sub-routes
-   \[ \] Single-store-constraint adversarial test (concurrent creation attempts)
-   \[ \] hasStore gating adversarial test (direct navigation + direct API calls, pre- and post-onboarding)
-   \[ \] Status read-only adversarial test (Task 6.2, re-confirmed here as part of the full suite)
-   \[ \] FEATURE\_3\_CHECKLIST.md — consolidated sign-off, evidenced per task
-   \[ \] Coverage confirmed ≥80% for the extended profile module (REQ-NF-Quality-003)

### **Implementation Checklist**

**7.1 — Run the full store sub-route integration suite**

-   **Objective:** confirm every endpoint from Tasks 2–6 behaves correctly, isolated and in combination.
-   **Action:** Execute/write Supertest suites: POST /store (Task 2, happy path + duplicate-conflict), PATCH /profile/me store fields (Task 3, valid/invalid lengths, pre-store 422), logo/banner upload/replace/remove (Task 4, all validation paths), GET /store/status (Task 6, all five enum values).
-   **Expected Output:** green suite, one describe-block per task.
-   **Verification:** pnpm --filter api test -- profile (extended suite from Feature 2) — all pass; coverage report confirms profile module (now including store logic) ≥80%.
-   **Next Step:** 7.2.

**7.2 — Concurrent single-store-creation adversarial test**

-   **Objective:** prove Task 2.1's DB-constraint-first design actually prevents duplicate stores under real concurrency, not just sequential double-submits.
-   **Action:** Fire two near-simultaneous POST /store requests (same authenticated Seller, same token) using Promise.all in the test — confirm exactly one succeeds (201) and the other receives 409, with exactly one seller\_profiles row in the DB afterward.
-   **Expected Output:** race-condition-safe behavior confirmed under load, not just under naive sequential testing.
-   **Verification:** test asserts row count === 1 post-execution.
-   **Next Step:** 7.3.

**7.3 — hasStore gating adversarial test**

-   **Objective:** confirm Task 2.3's route guard and Task 3.2's service-layer guard both independently hold — defense in depth, not a single point of failure.
-   **Action:** Test matrix: (a) non-onboarded Seller, direct browser navigation to /seller/products/new → redirected to /seller/setup (frontend guard, Task 2.3); (b) non-onboarded Seller, direct API call to PATCH /profile/me with store fields, **bypassing the frontend entirely** → 422 from the service-layer guard (Task 3.2), confirming the frontend redirect isn't the only protection; (c) same for logo/banner upload endpoints (Task 4).
-   **Expected Output:** both layers independently verified — a frontend bug alone cannot expose store-mutation to a non-onboarded seller.
-   **Verification:** all three sub-cases pass as distinct test cases.
-   **Next Step:** 7.4.

**7.4 — Re-confirm status read-only boundary (full suite integration)**

-   **Objective:** fold Task 6.2's negative verification into the consolidated suite so it's continuously regression-tested going forward, not a one-time manual check.
-   **Action:** Add Task 6.2's two adversarial cases (no PATCH /store/status route; generic profile PATCH strips unknown status field) as permanent, named test cases in the suite.
-   **Expected Output:** these cases run on every future CI execution of the profile test suite.
-   **Verification:** confirmed present in the committed test file, not just previously run ad hoc.
-   **Next Step:** 7.5.

**7.5 — Cross-check against App Flow UI states and Feature 2 boundary**

-   **Objective:** confirm the SCR-S10 screen composition (Task 5) still honors Feature 2's per-section save discipline and App Flow's loading/empty/error states, after all of Feature 3's additions.
-   **Action:** Manually walk the full SCR-S10 screen: all four tabs (Store/Brand, Notifications, Language, Security) save independently; loading skeleton covers initial fetch once, not per-tab; toasts fire correctly per section; defensive empty-state (Task 5.3) confirmed reachable only via forced test conditions, never in normal flow.
-   **Expected Output:** pass/fail note per screen area.
-   **Verification:** any regression found (e.g., Task 4's branding uploads accidentally triggering a Notifications-tab re-fetch) is fixed here.
-   **Next Step:** 7.6.

**7.6 — Consolidate FEATURE\_3\_CHECKLIST.md**

-   **Objective:** produce the sign-off artifact, mirroring Feature 0 Task 12 / Feature 2 Task 7's pattern exactly.
-   **Action:** Create FEATURE\_3\_CHECKLIST.md — one section per Task (1–7), each Expected Deliverable checked off with evidence; include the Documentation Gaps & Assumptions table with final status per row (particularly: banner\_url schema addition, wizard-draft-state-is-frontend-only assumption, status-badge-placement assumption — each needs explicit confirmed/open status).
-   **Expected Output:** committed, fully checked-off checklist.
-   **Verification:** both developers sign off; any unresolved assumption flagged as an open item for the next feature (Catalog / AI Store Builder), which depends on seller\_profiles existing correctly.
-   **Next Step:** Feature 3 complete.

### **Common Errors**

| **Error** | **Resolution** |
| --- | --- |
| 7.2's concurrency test flakes intermittently instead of reliably reproducing the race | Ensure both requests are genuinely fired without await between them (Promise.all, not sequential await calls) — a sequential test doesn't actually exercise the race condition |
| --- | --- |
| Coverage measured at whole-repo level again (same pitfall as Feature 2 Task 7) | Scope coverage explicitly to the profile module before sign-off |
| --- | --- |

## **Final Consistency Pass**

### **1\. Table of Contents (updated, final)**

1.  [Feature Overview](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#feature-overview) 0.1. [Documentation Gaps & Assumptions](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#documentation-gaps--assumptions) 0.2. [Store Management Flow](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#store-management-flow)
2.  [Task 1 — Store Foundation](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#task-1--store-foundation)
3.  [Task 2 — Create Store](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#task-2--create-store)
4.  [Task 3 — Business Information](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#task-3--business-information)
5.  [Task 4 — Store Branding (Logo & Banner)](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#task-4--store-branding-logo--banner)
6.  [Task 5 — Store Settings](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#task-5--store-settings)
7.  [Task 6 — Store Status Management](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#task-6--store-status-management)
8.  [Task 7 — Validation & Testing](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#task-7--validation--testing)

### **2\. Cross-Reference Verification**

| **Check** | **Result** |
| --- | --- |
| Every task builds strictly on the previous (Foundation → Create → Business Info → Branding → Settings → Status → Validation) | ✅ Each task's "Dependencies" names exact prior task(s); no forward references |
| --- | --- |
| No parallel/duplicate module built alongside Feature 2's profile module | ✅ Task 1.2's boundary decision enforced throughout; all store logic extends profile.service.ts/profile.routes.ts, never a separate store module |
| --- | --- |
| No parallel upload component built alongside Feature 2's AvatarUploader | ✅ Task 4.1's generalization decision (ImageUploader) reused for logo + banner; AvatarUploader preserved as a thin wrapper |
| --- | --- |
| All schema usage traces to Schema Doc §4.2 / §4.1 / §3 | ✅ seller\_profiles (name, description, logo — pre-existing) + one net-new column (banner\_url) flagged as Assumption; users.status reused read-only, no new enum invented |
| --- | --- |
| Wallet, commission, fraud-rate fields correctly excluded | ✅ Confirmed absent from every DTO/endpoint in Tasks 2–6; wallet captured once at creation only (Task 2.1), per REQ-F-Auth005, never editable here |
| --- | --- |
| Store status never seller-mutable | ✅ Task 6.2 dedicated negative-verification test; Task 7.4 folds it into the permanent regression suite |
| --- | --- |
| Single-store constraint enforced at the DB layer, not just app logic | ✅ Task 2.1's design; Task 7.2's concurrency test proves it |
| --- | --- |
| hasStore gating enforced at both frontend (routing) and backend (service) layers | ✅ Task 2.3 (frontend) + Task 3.2/4.2 (backend); Task 7.3 tests both independently |
| --- | --- |
| App Flow §0 global states (loading/empty/error/toast) applied consistently | ✅ Task 5.2/5.3 reuse Feature 0 Task 8 components; Task 7.5 cross-checks the composed screen |
| --- | --- |
| Recommended-but-unsourced practices correctly labeled | ✅ Task 4.1's aspect-ratio-hint/crop enforcement explicitly marked **Recommended Enhancement (Optional)** — the only such item in this feature, correctly distinguished from the Assumptions (gap-fills) elsewhere |
| --- | --- |
| Every endpoint routed under the versioned, enveloped, error-handled API structure from Feature 0, reusing Feature 2's role/ownership middleware pattern | ✅ All /store/\* sub-routes under /api/v1/profile/me, Seller-role-gated (tighter than Feature 2's shared routes), using the same envelope/error hierarchy |
| --- | --- |

**Feature 3.md — Store Management Engineering Execution Playbook is complete.** All 7 tasks follow the required dependency sequence, explicitly reuse Feature 0/1/2 infrastructure per instruction rather than duplicating it, and every deviation from literal document text is transparently logged as an Assumption or Engineering Decision pending sign-off in FEATURE\_3\_CHECKLIST.md. Ready for the team to execute following Features 0–2.