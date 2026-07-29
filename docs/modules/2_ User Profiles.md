# **KarobarAI — Engineering Execution Playbook**

## **Feature 2: User Profiles**

**Source of truth:** PRD · TRD · App Flow · Backend Schema · Implementation Plan (Docs 1–6). This playbook does not introduce any decision not already present in those documents. Where the source documents are silent or incomplete for this feature, it is flagged explicitly as an **Assumption** or **Recommended Enhancement (Optional)** — never silently invented.

**Depends on:** Feature 0 (Project Foundation) — folder structure, coding standards, envelope/error middleware, adapter layer, theme, routing, and CI must already exist.

## **Table of Contents**

1.  [Feature Overview](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#feature-overview) 0.1. [Documentation Gaps & Assumptions](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#documentation-gaps--assumptions) 0.2. [Profile Management Flow](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#profile-management-flow)
2.  [Task 1 — Profile Foundation](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#task-1--profile-foundation)
3.  [Task 2 — Profile Retrieval](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#task-2--profile-retrieval)
4.  [Task 3 — Profile Update](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#task-3--profile-update)
5.  Task 4 — Profile Picture *(pending)*
6.  Task 5 — Change Password *(pending)*
7.  Task 6 — Account Settings *(pending)*
8.  Task 7 — Profile Validation & Testing *(pending)*

## **Feature Overview**

**What Feature 2 covers:** every screen and endpoint where an authenticated user (Buyer, Seller, Admin) views or manages their own identity data — App Flow **SCR-S10** (Seller Settings/Profile), **SCR-B12** (Buyer Profile/Settings), and the profile-adjacent parts of **SCR-S00** (Store-Setup Wizard fields, reused for edit), plus password/security flows shared with **SCR-A04** (Forgot/Reset Password).

**What it explicitly excludes:**

-   Address book CRUD (part of SCR-B12 UI, but backed by the addresses table — treated as its own feature, only referenced here for the "default address" relationship).
-   Wallet/payout configuration (SCR-S09 — separate feature, financial in nature).
-   Notification channel toggles' *delivery logic* (BullMQ/notification dispatch is Feature 9's concern) — this feature only manages the *preference* records.
-   Registration/OTP/login itself (Feature 1 — Authentication) — this feature assumes an authenticated session already exists.

**Governing tables (Schema Doc §4):** users (4.1), seller\_profiles (4.2), buyer\_profiles (4.3), addresses (4.4, referenced only), notification\_preferences (4.20), refresh\_tokens (4.23, referenced only for password-change session invalidation), audit\_logs (4.24, for admin-relevant actions).

### **Documentation Gaps & Assumptions**

The source documents do not fully specify every sub-requirement listed in the feature brief. Per instruction, these are stated explicitly rather than invented silently:

| **Gap** | **What the docs say** | **Assumption taken** |
| --- | --- | --- |
| **Profile picture — Buyer** | No avatar\_url/profile\_picture column exists on users or buyer\_profiles in Schema Doc §4.1/§4.3. Only seller\_profiles.logo\_url exists (§4.2), scoped to the *store* brand, not a personal photo. | **Assumption:** add a nullable avatar\_url VARCHAR(512) column to users (base identity table, since both Buyer and Seller are users) via an additive migration in Task 1. This does not contradict D1 (single Postgres) or Schema §12 migration strategy (additive, non-breaking). Flagged for supervisor/schema-owner confirmation before merge. |
| --- | --- | --- |
| **Admin Profile screen** | App Flow Doc 3 §5 lists Admin Console screens AD01–AD08; none is a self-profile/settings screen for the admin's own account. PRD §7 (Persona: Sana) and §10–11 confirm Admin is a users row with role=ADMIN, no separate profile table. | **Assumption:** Admin Profile is a minimal variant of the shared profile screen (identity fields + password change only — no store/business fields, no buyer address book). No new route beyond what Task 2 defines is invented; it reuses the generic authenticated-profile pattern already implied by PRD §11's permission matrix (Admin can manage its own account like any role). |
| --- | --- | --- |
| **Profile picture storage mechanism** | TRD §28 names object storage (dev: MinIO, per Feature 0 patch) for "product and return images" specifically; profile pictures are not named. | **Assumption:** the same object-storage adapter (upload(), getUrl() per TRD §28) is reused for profile pictures — no new adapter invented, just a new logical folder/prefix (avatars/) in the same bucket. |
| --- | --- | --- |
| **Seller "business profile" scope** | PRD §11 permission matrix and Schema §4.2 define seller\_profiles fields (store\_name, description, logo, wallets, commission override, fraud rate). Wallets are explicitly **out of scope** here (belongs to SCR-S09, a payments-adjacent feature). | **Assumption:** Feature 2's Seller Profile covers store\_name, store\_description, logo\_url only — **not** jazzcash\_wallet/easypaisa\_wallet/commission\_rate/fraud\_rate\_30d, which are either payout-feature or admin/system-managed fields. |
| --- | --- | --- |

### **Profile Management Flow**

Profile Foundation

(schema additions, module scaffolding, ownership rules)

│

▼

Profile Retrieval

(GET endpoints + read screens: Buyer / Seller / Admin)

│

▼

Profile Update

(Edit Profile — PATCH endpoints + form screens)

│

▼

Profile Picture

(upload / replace / remove via object storage adapter)

│

▼

Change Password

(re-auth required, session/token invalidation)

│

▼

Account Settings

(notification prefs, language, non-identity account config)

│

▼

Profile Validation & Testing

(cross-role QA, security review, DoD sign-off)

Each stage is a hard dependency for the next — Profile Update cannot be built before Retrieval exists (nothing to edit against); Picture upload reuses Update's ownership/validation plumbing; Password change reuses Update's re-auth pattern; Settings reuses the same screen shell as Retrieval/Update; Validation is only meaningful once all prior stages exist.

## **Task 1 — Profile Foundation**

### **Purpose**

-   Extend the Schema Doc's existing users/seller\_profiles/buyer\_profiles tables with the one additive field this feature genuinely needs (avatar\_url), and nothing else — no schema invention beyond the documented gap.
-   Scaffold the profile backend module (controller/service/routes/dto) inside apps/api/src/modules/, following the Feature 0 reference-module pattern exactly.
-   Establish ownership rules for profile data per Schema §9 ("a buyer/seller may read/mutate only their own records") before any endpoint is written.

### **Dependencies**

-   Feature 0 complete (folder structure, envelope helper, error middleware, Zod validation harness, reference module pattern, auth guard mechanism from Task 10 routing — now backed by real JWT auth from Feature 1/Authentication).
-   Feature 1 (Authentication) complete — this feature assumes req.user (authenticated principal with user\_id, role) is available on every request.

### **Expected Deliverables**

-   \[ \] Migration adding avatar\_url VARCHAR(512) NULL to users table
-   \[ \] apps/api/src/modules/profile/ scaffolded (controller, service, repository, routes, dto) per Feature 0's reference pattern
-   \[ \] Ownership middleware applied: a user can only access/mutate WHERE user\_id = req.user.user\_id
-   \[ \] Role-aware service logic stub (Buyer/Seller/Admin branch identified, not yet implemented)

### **Implementation Checklist**

**1.1 — Confirm and add the avatar\_url schema extension**

-   **Objective:** close the documented gap (see Assumptions table) with a minimal, additive, reversible migration.
-   **Action:** Add avatar\_url VARCHAR(512) NULL to the users model in schema.prisma (Schema Doc §4.1 is the base identity table — correct home since both Buyer and Seller inherit from users, avoiding duplicate columns on buyer\_profiles/seller\_profiles). Run prisma migrate dev to generate the migration.
-   **Expected Output:** new migration file; users table has the new nullable column; existing rows unaffected (NULL default).
-   **Verification:** prisma migrate status shows the migration applied; existing seed data unaffected; column confirmed nullable (no backfill needed, per Schema §12's "new NOT NULL columns ship with a default or backfill" rule — not applicable here since it's nullable).
-   **Next Step:** 1.2.

**1.2 — Scaffold the profile module**

-   **Objective:** create the module skeleton matching the Feature 0 reference pattern (catalog/ping equivalent), so this feature's code is structurally identical to every other module.
-   **Action:** Populate apps/api/src/modules/profile/: profile.controller.ts, profile.service.ts, profile.repository.ts, profile.routes.ts, profile.dto.ts (Zod schemas — empty stubs, filled in Tasks 2–3). Register routes under /api/v1/profile in the main router.
-   **Expected Output:** module boots with no real endpoints yet, just structure.
-   **Verification:** apps/api starts cleanly; /api/v1/profile base path reserved with no active route (404 is correct at this point).
-   **Next Step:** 1.3.

**1.3 — Apply ownership middleware**

-   **Objective:** enforce Schema §9's ownership rule at the routing layer, before any handler logic exists, so it's impossible to add an endpoint later that skips it.
-   **Action:** Reuse Feature 0's authenticate + authorize(roles) middleware chain (TRD §8) on all profile routes; add a profile-specific ownSelf check confirming the route's target user\_id (or implicit "self") equals req.user.user\_id — **Admin does not bypass this** for *own* profile actions (Admin bypasses ownership only for *other users'* records via Feature "Admin — User Management", which is out of scope here).
-   **Expected Output:** middleware chain attached to the profile router group.
-   **Verification:** a mocked request with mismatched user\_id is rejected 403 before reaching any controller logic (test with a stub route).
-   **Next Step:** 1.4.

**1.4 — Define the role-branch service stub**

-   **Objective:** establish, at the service layer, that profile logic branches by role (Buyer → buyer\_profiles join, Seller → seller\_profiles join, Admin → users only) — the single place this branching happens, so Tasks 2–3 don't reinvent it per-endpoint.
-   **Action:** In profile.service.ts, create a resolveProfileByRole(userId, role) stub function with the three branches identified (bodies filled in Task 2).
-   **Expected Output:** typed stub function, unimplemented bodies marked // TODO: Task 2.
-   **Verification:** function compiles, is unit-test-stubbed (test file created, assertions deferred).
-   **Next Step:** proceed to Task 2.

### **Common Errors**

| **Error** | **Resolution** |
| --- | --- |
| Migration adds avatar\_url to seller\_profiles and buyer\_profiles separately (duplicated column) | Keep it on users only — both role profiles already join to users via shared PK (Schema §4.2/§4.3), duplicating the column violates normalization and creates a sync problem |
| --- | --- |
| Ownership middleware accidentally lets Admin bypass *own*\-profile checks | Admin's bypass privilege (Schema §9) is for *other* users' records in admin workflows, not a blanket bypass — must still own-check when Admin edits Admin's own profile |
| --- | --- |

## **Task 2 — Profile Retrieval**

### **Purpose**

-   Implement the GET side of profile management for all three roles, giving App Flow SCR-S10/SCR-B12/Admin-profile a real data source.
-   Fill in Task 1's resolveProfileByRole branches with actual Prisma queries, joining users with the correct role-profile table.
-   Establish the response DTO shape once, reused unchanged by Task 3 (Update) so the frontend consumes one consistent contract.

### **Dependencies**

-   Task 1 complete (module scaffold, ownership middleware, schema extension)

### **Expected Deliverables**

-   \[ \] GET /api/v1/profile/me — returns the authenticated user's role-appropriate profile
-   \[ \] Buyer, Seller, Admin response DTOs defined (Zod, exported via packages/shared per Feature 0 Task 5)
-   \[ \] Frontend: profile read screens wired to real data — apps/web/src/features/seller/ProfileSettings, features/buyer/AccountProfile, features/admin/AdminProfile (new, per the Task 0 Assumption)
-   \[ \] Loading/empty/error states implemented per App Flow §0 global states (Feature 0 Task 8 components reused)

### **Implementation Checklist**

**2.1 — Implement GET /api/v1/profile/me (backend)**

-   **Objective:** single endpoint, role-branching internally, rather than three separate routes — keeps the contract simple (/me always means "my own profile, shaped for my role").
-   **Action:** Fill resolveProfileByRole: Buyer → users + buyer\_profiles (default\_address\_id resolved but full address object deferred to the addresses feature — return default\_address\_id only); Seller → users + seller\_profiles (store\_name, store\_description, logo\_url, avatar\_url — **excluding** wallet/commission/fraud fields per the Task 0 Assumption); Admin → users only (no join). Return via the Task 1 envelope helper.
-   **Expected Output:** working endpoint, three distinct response shapes gated by role.
-   **Verification:** integration test (Supertest) — one test per role, asserts correct field set present/absent (e.g., Seller response must **not** contain jazzcash\_wallet).
-   **Next Step:** 2.2.

**2.2 — Define and export shared DTOs**

-   **Objective:** one canonical TypeScript type per role-profile shape, consumed by both apps/api (response typing) and apps/web (query typing) via packages/shared, per Feature 0 Task 5's shared-types convention.
-   **Action:** Add BuyerProfileDTO, SellerProfileDTO, AdminProfileDTO to packages/shared/types/profile.ts.
-   **Expected Output:** typed exports importable from both apps.
-   **Verification:** apps/web TanStack Query hook typed against the DTO with no any.
-   **Next Step:** 2.3.

**2.3 — Build the Buyer profile read screen**

-   **Objective:** implement App Flow **SCR-B12** (read portion) — Addresses tab excluded (separate feature), Profile identity section included.
-   **Action:** Build features/buyer/AccountProfile page at route /account (already stubbed in Feature 0 Task 10); fetch via GET /profile/me, render using Task 8 shared components (BilingualField read-mode where applicable, EmptyState if fetch fails).
-   **Expected Output:** authenticated buyer sees their real name/phone/email/language/avatar.
-   **Verification:** manual test with a seeded buyer account — data matches DB row.
-   **Next Step:** 2.4.

**2.4 — Build the Seller profile read screen**

-   **Objective:** implement App Flow **SCR-S10** (Store/Brand tab, read portion).
-   **Action:** Build features/seller/ProfileSettings at /seller/settings (Feature 0 Task 10 route); render store\_name, description, logo, plus shared identity fields (phone/email/language).
-   **Expected Output:** authenticated seller sees their store profile.
-   **Verification:** manual test with a seeded seller account.
-   **Next Step:** 2.5.

**2.5 — Build the Admin profile read screen (new, per Assumption)**

-   **Objective:** implement the minimal Admin self-profile view identified in the Documentation Gaps table — no App Flow screen ID exists, so this is clearly labeled as net-new.
-   **Action:** Build features/admin/AdminProfile at a new route /admin/profile (add to Feature 0's ROUTES.md under Admin section, tagged **\[Feature 2 — new, not in App Flow Doc 3\]**); render identity fields only (no store/business/address data).
-   **Expected Output:** authenticated admin sees phone/email/language/avatar.
-   **Verification:** manual test with a seeded admin account; confirm route guard (Feature 0 Task 10) restricts this to role=ADMIN.
-   **Next Step:** proceed to Task 3.

### **Common Errors**

| **Error** | **Resolution** |
| --- | --- |
| Seller response leaks wallet/commission fields | Explicitly select only the allowed field set in the Prisma query — never rely on manually stripping fields post-fetch, which is error-prone |
| --- | --- |
| Admin route missing from Feature 0's ROUTES.md | Update ROUTES.md in this task (don't defer) — Feature 0's doc is the single route reference and must stay current as features add routes |
| --- | --- |

*End of Response 1 — Feature Overview, Documentation Gaps, Profile Management Flow, and Tasks 1–3 complete. Awaiting confirmation before continuing with Tasks 4–5 (Profile Picture, Change Password).*

## **Task 4 — Profile Picture**

### **Purpose**

-   Implement upload/replace/remove for the avatar\_url field added in Task 1, reusing the existing object-storage adapter (TRD §28, MinIO in dev per Feature 0's Task 2 patch) rather than inventing new infrastructure.
-   Apply the same client-side compression + server-side validation pattern already established for product images (REQ-F-Store007 / Sec-012), so upload behavior is consistent platform-wide.
-   Close the loop on Task 1's schema addition — this is the only feature that writes to avatar\_url.

### **Dependencies**

-   Task 2 complete (profile read screens exist to display the picture)
-   Task 3 complete (Edit Profile pattern — picture upload is a variant of the same update flow)
-   Feature 0 Task 2 (MinIO patch) and Task 4 (object-storage adapter reachable from api)

### **Expected Deliverables**

-   \[ \] POST /api/v1/profile/me/avatar — upload/replace
-   \[ \] DELETE /api/v1/profile/me/avatar — remove
-   \[ \] Server-side magic-byte + size validation (Sec-012)
-   \[ \] Client-side compression before upload (browser-image-compression, per Feature 0 Task 3)
-   \[ \] Avatar upload UI on Buyer, Seller, and Admin profile screens (reusing one shared component)

### **Implementation Checklist**

**4.1 — Build the shared AvatarUploader component**

-   **Objective:** one reusable upload widget consumed by all three role profile screens, rather than three separate implementations.
-   **Action:** Create apps/web/src/components/AvatarUploader/ (new addition to Feature 0's Task 8 component catalogue — update COMPONENTS.md). Props: current avatarUrl, onUploadSuccess, onRemove. Internally: file picker → browser-image-compression (target well under the object-storage practical limit; mirror the spirit of REQ-F-Store007's <200KB target for consistency, even though no PRD requirement names avatars specifically) → preview → confirm → POST.
-   **Expected Output:** typed, reusable component.
-   **Verification:** imports cleanly into all three profile screens with no per-screen logic duplication.
-   **Next Step:** 4.2.

**4.2 — Implement POST /api/v1/profile/me/avatar (backend)**

-   **Objective:** validate, store, and persist the new avatar URL, using the same adapter interface product images already use.
-   **Action:** In profile.controller.ts/profile.service.ts: accept multipart upload → server-side validate file type via magic bytes and size limit (Sec-012, mirroring the product-image validation pattern — do not re-derive a new limit; **Assumption:** reuse the 10MB accept-then-compress ceiling from REQ-F-Store001 as the practical upload cap, since no avatar-specific limit is defined) → call the object-storage adapter's upload() (TRD §28) with an avatars/{user\_id}/{uuid}.ext key → on success, update users.avatar\_url via the repository → return updated profile DTO.
-   **Expected Output:** working upload endpoint; old avatar file is **not** auto-deleted on replace at this step (handled in 4.3, to avoid orphaned-reference race conditions if delete-then-fail occurs).
-   **Verification:** integration test — valid image uploads and persists; oversized/wrong-type file rejected with correct error code; users.avatar\_url reflects the new CDN URL.
-   **Next Step:** 4.3.

**4.3 — Implement replace and remove semantics**

-   **Objective:** handle the "replace" case (old file becomes orphaned) and the explicit "remove" case (revert to no avatar) cleanly.
-   **Action:** On successful re-upload (4.2), enqueue a best-effort deletion of the previous object-storage key (do not block the response on this — log failures, don't fail the request per REQ-NF-Safety-004's graceful-degradation spirit). Implement DELETE /api/v1/profile/me/avatar: sets users.avatar\_url = NULL, best-effort deletes the stored object.
-   **Expected Output:** both endpoints functioning; orphan cleanup is fire-and-forget, never blocking.
-   **Verification:** replace flow — old key absent from bucket after a delay; remove flow — avatar\_url NULL, UI reverts to default placeholder avatar (Task 8 EmptyState-style fallback icon).
-   **Next Step:** 4.4.

**4.4 — Wire the uploader into all three profile screens**

-   **Objective:** complete the visible feature — Buyer, Seller, Admin can all manage their picture from Task 2's screens.
-   **Action:** Mount AvatarUploader in AccountProfile, ProfileSettings, and AdminProfile (Task 2.3–2.5), wired to the Task 4.2/4.3 endpoints via a TanStack Query mutation, invalidating the profile/me query cache on success so the display updates immediately.
-   **Expected Output:** upload/replace/remove works end-to-end from the UI on all three roles.
-   **Verification:** manual test per role — upload, confirm preview + persisted state after refresh, remove, confirm placeholder returns.
-   **Next Step:** proceed to Task 5.

### **Common Errors**

| **Error** | **Resolution** |
| --- | --- |
| Old avatar orphaned in bucket after repeated replaces, silently accumulating storage | Confirm the fire-and-forget deletion job (4.3) actually runs and is logged on failure — don't let "best-effort" become "never happens" |
| --- | --- |
| Avatar upload bypasses magic-byte validation because it reuses a generic multer config without the check | Explicitly attach the same magic-byte validator used for product images (Sec-012) — do not assume a shared multer instance already enforces it |
| --- | --- |

## **Task 5 — Change Password**

### **Purpose**

-   Implement secure password change for authenticated users, reusing Feature 1 (Authentication)'s bcrypt/JWT/refresh-token infrastructure exactly — this task does **not** re-implement auth primitives.
-   Enforce re-authentication before a password change succeeds, per TRD §16 (Sec-004/Sec-003) and the App Flow SCR-S10/B12 "Security (change password, re-auth)" note.
-   Invalidate existing sessions on successful change, consistent with the same session-revocation pattern used for suspension (REQ-F-Auth006, Schema §11).

### **Dependencies**

-   Feature 1 (Authentication) complete — bcrypt hashing, JWT issuance, refresh\_tokens table, Redis jti denylist all exist and are reused, not rebuilt.
-   Task 1 (ownership middleware) complete.

### **Expected Deliverables**

-   \[ \] POST /api/v1/profile/me/password — current password + new password, re-auth enforced
-   \[ \] Password complexity validated server-side against REQ-F-Auth002's rule (reused, not redefined)
-   \[ \] All other active sessions revoked on success (refresh tokens + jti denylist)
-   \[ \] Change Password UI on Buyer, Seller, Admin profile/settings screens

### **Implementation Checklist**

**5.1 — Define the change-password DTO and validation**

-   **Objective:** enforce the exact password rule already established in Auth (≥8 chars, upper/lower/digit/special, REQ-F-Auth002) — reused, never redefined with different rules.
-   **Action:** In profile.dto.ts, add a Zod schema: currentPassword (required), newPassword (same complexity regex/validator as Feature 1's registration DTO — **import it from Feature 1's shared validator, do not duplicate the regex**), confirmNewPassword (must match newPassword).
-   **Expected Output:** typed, validated DTO.
-   **Verification:** unit test — weak password rejected with the same error message users see at registration (consistency check).
-   **Next Step:** 5.2.

**5.2 — Implement POST /api/v1/profile/me/password (backend)**

-   **Objective:** verify current password, hash and persist the new one, using Feature 1's bcrypt(12) utility unchanged.
-   **Action:** In profile.service.ts: load users.password\_hash for req.user.user\_id → bcrypt.compare(currentPassword, hash) → on mismatch, throw AuthError(401) (Feature 0 Task 11 error hierarchy) with a generic message (no hinting) → on match, bcrypt.hash(newPassword, 12) → update users.password\_hash.
-   **Expected Output:** working endpoint; wrong current password correctly rejected.
-   **Verification:** integration test — correct current password + valid new password succeeds; wrong current password → 401; weak new password → 400 (from 5.1's validator).
-   **Next Step:** 5.3.

**5.3 — Revoke sessions on successful change**

-   **Objective:** apply the same "invalidate all sessions" pattern used for suspension (REQ-F-Auth006, Schema §11) — a password change is a security-sensitive event and should not leave old sessions alive.
-   **Action:** On successful password update (5.2), within the same transaction/flow: mark all of the user's rows in refresh\_tokens as revoked\_at = now(), and add their jti values to the Redis denylist (reusing Feature 1's exact revocation utility — do not write a second implementation). Issue a **fresh** access+refresh token pair for the *current* session only, so the user isn't immediately logged out of the device they just used.
-   **Expected Output:** all other devices/sessions log out; current session continues seamlessly with new tokens.
-   **Verification:** test with two simulated sessions (two refresh tokens for the same user) — after password change, the non-current session's refresh attempt fails (401); the current session's next request succeeds with the newly issued token.
-   **Next Step:** 5.4.

**5.4 — Wire the Change Password UI**

-   **Objective:** implement the "Security (change password)" tab named in App Flow SCR-S10 and SCR-B12, reused identically for Admin (per the Task 0 Assumption).
-   **Action:** Add a ChangePasswordForm (React Hook Form + Zod, sharing the 5.1 schema via packages/shared) to the Security tab of ProfileSettings, AccountProfile, and AdminProfile. On success, show a toast and, since other sessions are revoked, surface a clear confirmation message ("You've been logged out of all other devices").
-   **Expected Output:** functional change-password form on all three role screens.
-   **Verification:** manual test per role — correct flow succeeds, wrong current password shows inline error, weak new password blocked client-side before submit.
-   **Next Step:** proceed to Task 6.

### **Common Errors**

| **Error** | **Resolution** |
| --- | --- |
| New password hashed with a different bcrypt cost than registration | Reuse Feature 1's exact bcrypt utility/constant (BCRYPT\_COST=12, Feature 0 .env.example) — never hardcode 12 again locally in this module |
| --- | --- |
| Session revocation only clears the Redis denylist but not the refresh\_tokens DB rows (or vice versa) | Both must happen together, exactly mirroring Feature 1's suspension-revocation implementation (Schema §11) — treat that code path as the canonical reference, call it, don't reimplement half of it |
| --- | --- |
| Current session accidentally revoked along with others, logging the user out mid-flow | Explicitly exclude the requesting session's jti from the bulk revocation, then issue it a fresh pair — confirm this with a dedicated test case (5.3) |
| --- | --- |

*End of Response 2 — Tasks 4–5 complete. Awaiting confirmation before continuing with Tasks 6–7 (Account Settings, Profile Validation & Testing), followed by the final Table of Contents update and cross-reference verification.*

## **Task 6 — Account Settings**

### **Purpose**

-   Implement the non-identity account configuration named in App Flow SCR-S10/SCR-B12 "Settings" tabs — notification preferences and language — building on the notification\_preferences table (Schema §4.20) already reserved for this purpose.
-   Enforce the "critical notifications non-disableable" rule (REQ-F-Notif004) at the same layer for all three roles, rather than trusting the frontend alone.
-   Wire language switching to persist server-side (users.preferred\_language, Schema §4.1) so Feature 0 Task 9's client-only toggle becomes a real, saved user preference.

### **Dependencies**

-   Task 2 complete (profile screens exist to host the Settings tab)
-   Feature 0 Task 9 (Theme Configuration — live UR/EN switch mechanism) — this task persists the *preference*, reusing the existing client-side switch mechanism unchanged.

### **Expected Deliverables**

-   \[ \] GET /api/v1/profile/me/settings — returns notification preferences + language
-   \[ \] PATCH /api/v1/profile/me/settings — updates both, critical toggles server-enforced
-   \[ \] Settings tab UI on Buyer and Seller screens (Admin — language only, per Assumption below)
-   \[ \] Language change persists to users.preferred\_language and immediately re-applies the Feature 0 Task 9 switch mechanism

### **Implementation Checklist**

**6.1 — Define the settings DTO**

-   **Objective:** one shared contract covering notification\_preferences (Schema §4.20: sms\_enabled, whatsapp\_enabled, email\_enabled, inapp\_enabled) plus users.preferred\_language.
-   **Action:** Add AccountSettingsDTO to packages/shared/types/profile.ts (extends Task 2's DTO pattern). Mark which fields are **critical/locked** in a shared constant (not per-screen logic) — per REQ-F-Notif004, critical transactional notifications cannot be disabled; **Assumption:** since the source docs don't enumerate which channels are "critical" at the per-channel level, treat inapp\_enabled and at least one always-on delivery channel (SMS, MVP's primary channel per PRD §12.12) as non-disableable for critical event types, while allowing user toggling of whatsapp\_enabled \[R1.1\] and email\_enabled (optional channel per TRD §28) — this mirrors the notification architecture's channel priority without inventing new channels.
-   **Expected Output:** typed DTO + a shared CRITICAL\_CHANNELS constant.
-   **Verification:** reviewed against PRD REQ-F-Notif004 wording; flagged in code comments as the interpretation taken.
-   **Next Step:** 6.2.

**6.2 — Implement GET /api/v1/profile/me/settings**

-   **Objective:** surface current preferences, joining notification\_preferences (1:1 on user\_id, Schema §4.20) with users.preferred\_language.
-   **Action:** Extend profile.service.ts with a getSettings(userId) method; if no notification\_preferences row exists yet (edge case — e.g., account created before this feature shipped), return the schema's defaults (D true per Schema §4.20) rather than erroring.
-   **Expected Output:** working endpoint, default-safe.
-   **Verification:** test both with and without a pre-existing notification\_preferences row.
-   **Next Step:** 6.3.

**6.3 — Implement PATCH /api/v1/profile/me/settings with server-side critical-toggle enforcement**

-   **Objective:** make REQ-F-Notif004 unbypassable — even if the frontend has a bug or a malicious client sends a raw request, critical channels cannot be turned off.
-   **Action:** In the service layer, before persisting: strip/reject any attempt to disable a CRITICAL\_CHANNELS entry (from 6.1) — either silently force it back to true and note it in the response, or reject with BusinessRuleError(422) (Feature 0 Task 11 error hierarchy); **Assumption:** silently force-true is the better UX (matches "locked" toggle framing in App Flow's UI description) rather than a hard error, since the frontend already disables the control — a 422 would only occur on direct API misuse, which the force-true approach neutralizes without punishing legitimate client bugs. Persist language change to users.preferred\_language via upsert on notification\_preferences + update on users, in one transaction.
-   **Expected Output:** working endpoint; direct API attempts to disable critical channels are neutralized, not merely blocked by UI.
-   **Verification:** integration test — API call attempting inapp\_enabled: false returns success but the persisted value remains true; language change persists and is reflected on next GET.
-   **Next Step:** 6.4.

**6.4 — Build the Settings tab UI (Buyer, Seller)**

-   **Objective:** implement the "Notifications | Language | Security" tab structure from App Flow SCR-S10/SCR-B12 (Security sub-tab already built in Task 5).
-   **Action:** Add a SettingsTab section to ProfileSettings and AccountProfile: notification toggles (critical ones rendered visually locked/disabled, per App Flow's UI spec, reusing Task 8's shared toggle pattern if one exists or a standard AntD Switch with disabled for critical rows), language selector (UR/EN) wired to both the Feature 0 Task 9 client-side switch (immediate effect) **and** the 6.3 PATCH (persisted effect) in the same action.
-   **Expected Output:** functional settings tab on both role screens.
-   **Verification:** toggle a non-critical channel → persists across reload; attempt to interact with a critical toggle → visually disabled, no request sent; change language → UI flips immediately (Task 9 mechanism) and persists after refresh.
-   **Next Step:** 6.5.

**6.5 — Build the Admin Settings variant (language only)**

-   **Objective:** apply the same minimal-scope reasoning as Task 2.5 — Admin has no seller/buyer-specific notification needs documented, so only language is exposed, consistent with the Task 0 Assumption keeping Admin Profile deliberately minimal.
-   **Action:** Add a reduced SettingsTab (language selector only) to AdminProfile, calling the same 6.3 endpoint (notification fields simply omitted from the Admin form payload — backend defaults/existing values remain untouched for fields not sent, standard PATCH semantics).
-   **Expected Output:** Admin can change language; no notification toggles shown.
-   **Verification:** manual test — Admin language change persists; no notification UI rendered.
-   **Next Step:** proceed to Task 7.

### **Common Errors**

| **Error** | **Resolution** |
| --- | --- |
| Critical toggle enforcement only implemented client-side, API accepts the disable | Confirm 6.3's server-side force-true logic actually runs — write the direct-API-bypass test explicitly, don't rely on UI-only manual testing |
| --- | --- |
| Language PATCH updates users.preferred\_language but Feature 0's client-side i18n context isn't re-synced, causing a stale UI after reload | On GET /profile/me/settings (or app bootstrap), initialize the Task 9 i18n mechanism from the persisted preferred\_language, not just local storage/session state |
| --- | --- |

## **Task 7 — Profile Validation & Testing**

### **Purpose**

-   Independently re-verify Tasks 1–6 against their own Definition-of-Done-equivalent deliverables, the way Feature 0's Task 12 closed out that feature — nothing in Feature 2 is "done" until this task confirms it end-to-end.
-   Run the security-sensitive paths (password change, ownership checks, critical-toggle enforcement) through explicit adversarial tests, not just happy-path checks.
-   Produce the sign-off artifact that lets Feature 3 begin with a known-solid profile layer underneath it.

### **Dependencies**

-   Tasks 1–6 complete

### **Expected Deliverables**

-   \[ \] Full integration test suite for the profile module (all endpoints, all three roles)
-   \[ \] Ownership/authorization adversarial test set (cross-user access attempts)
-   \[ \] Security review checklist for password-change and avatar-upload paths
-   \[ \] FEATURE\_2\_CHECKLIST.md — consolidated sign-off, evidenced per task
-   \[ \] Coverage confirmed ≥80% for the profile module specifically (REQ-NF-Quality-003)

### **Implementation Checklist**

**7.1 — Run the full cross-role integration suite**

-   **Objective:** confirm every endpoint from Tasks 2–6 behaves correctly for Buyer, Seller, and Admin, not just one role tested in isolation during development.
-   **Action:** Execute (or write, if gaps found) Supertest suites covering: GET /profile/me (3 roles, correct field sets per 2.1's assertion), PATCH /profile/me (Task 3, all editable fields per role), avatar upload/replace/remove (Task 4, all 3 roles), password change happy + failure paths (Task 5), settings GET/PATCH incl. critical-toggle enforcement (Task 6).
-   **Expected Output:** green test suite, one describe-block per task, per role.
-   **Verification:** pnpm --filter api test -- profile — all pass; coverage report shows the profile module ≥80% (REQ-NF-Quality-003).
-   **Next Step:** 7.2.

**7.2 — Run ownership/authorization adversarial tests**

-   **Objective:** prove Task 1.3's ownership middleware and Task 5's session-scoping actually hold under deliberate misuse, per Schema §9's ownership rule and TRD §8's authorization strategy.
-   **Action:** Write/execute tests: User A's token attempting to GET/PATCH User B's profile via any manipulated ID → 403; unauthenticated request to any /profile/\* route → 401 (Feature 0 Task 10/11 pattern); Seller-role token attempting to hit Admin-only surface (if any exists in this feature — confirm none does, since Admin Profile is self-only per the Task 0 Assumption) → 403; password-change with a stale/already-revoked refresh token on a second device → confirmed rejected (Task 5.3's core guarantee).
-   **Expected Output:** all adversarial cases correctly rejected, documented as explicit test cases (not just "trust the middleware").
-   **Verification:** test suite green; manually spot-check one case end-to-end via API client (e.g., Postman/curl) as an extra sanity layer beyond automated tests.
-   **Next Step:** 7.3.

**7.3 — Security review: password change & avatar upload paths**

-   **Objective:** apply a focused version of TRD §16's OWASP-mapped controls specifically to this feature's two most sensitive flows, ahead of the full Phase 11 OWASP review.
-   **Action:** Checklist review: password change — current-password verification cannot be skipped by omitting the field (Zod required, Task 5.1); no password value ever appears in logs (pino redaction, TRD §15 — confirm profile module doesn't log request bodies containing currentPassword/newPassword); bcrypt cost matches the shared constant (Task 5, Common Errors). Avatar upload — magic-byte validation actually rejects a renamed malicious file (e.g., a .exe renamed .jpg), not just extension-checking; uploaded files are not directly executable from the storage bucket (standard object-storage behavior, verify MinIO/S3 config doesn't serve with executable content-type); orphan-cleanup failures are logged, not silently swallowed (Task 4.3).
-   **Expected Output:** a completed checklist with pass/fail per item; any failing item fixed before sign-off.
-   **Verification:** each item has a concrete test or manual verification step performed, not just "looks fine."
-   **Next Step:** 7.4.

**7.4 — Cross-check against App Flow UI states**

-   **Objective:** confirm the frontend implementation actually matches App Flow's documented error/empty/loading/success states for SCR-S10 and SCR-B12, not just the backend contract.
-   **Action:** Manually walk both screens against App Flow Doc 3's spec: loading skeletons appear during fetch (Feature 0 Task 8 Skeleton); save-per-section pattern honored (App Flow SCR-S10: "Buttons: Save per section" — confirm Tasks 3/5/6 didn't collapse this into one giant form); toasts on save (Task 8 ToastProvider); re-auth requirement on password change is visually clear.
-   **Expected Output:** a short pass/fail note per screen against the App Flow spec.
-   **Verification:** any mismatch found is fixed here, not deferred.
-   **Next Step:** 7.5.

**7.5 — Consolidate FEATURE\_2\_CHECKLIST.md**

-   **Objective:** produce the single sign-off artifact for Feature 2, mirroring Feature 0 Task 12's pattern.
-   **Action:** Create FEATURE\_2\_CHECKLIST.md — one section per Task (1–7), each Expected Deliverable checked off with a one-line evidence note (test name, screenshot reference, or manual-verification note); include the Documentation Gaps & Assumptions table (from Feature Overview) with a final "confirmed / needs schema-owner sign-off" status per row.
-   **Expected Output:** committed, fully checked-off checklist.
-   **Verification:** both developers review and sign off; any unresolved Assumption is explicitly flagged as an open item for Feature 3 planning, not silently carried forward.
-   **Next Step:** Feature 2 complete.

### **Common Errors**

| **Error** | **Resolution** |
| --- | --- |
| Coverage measured at the whole-repo level, masking a low-coverage profile module | Run coverage scoped to the module specifically (--testPathPattern=profile or equivalent) before declaring 7.1 done |
| --- | --- |
| Assumptions from the Feature Overview never actually get resolved/confirmed, just repeated in the checklist | Task 7.5 must produce a real status per assumption — if the schema owner hasn't signed off on avatar\_url, that's an open risk carried into Feature 3, not a closed item |
| --- | --- |

## **Final Consistency Pass**

### **1\. Table of Contents (updated, final)**

1.  [Feature Overview](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#feature-overview) 0.1. [Documentation Gaps & Assumptions](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#documentation-gaps--assumptions) 0.2. [Profile Management Flow](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#profile-management-flow)
2.  [Task 1 — Profile Foundation](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#task-1--profile-foundation)
3.  [Task 2 — Profile Retrieval](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#task-2--profile-retrieval)
4.  [Task 3 — Profile Update](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#task-3--profile-update)
5.  [Task 4 — Profile Picture](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#task-4--profile-picture)
6.  [Task 5 — Change Password](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#task-5--change-password)
7.  [Task 6 — Account Settings](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#task-6--account-settings)
8.  [Task 7 — Profile Validation & Testing](https://claude.ai/chat/b61a4907-8f73-46c8-8472-4817a43bb107#task-7--profile-validation--testing)

### **2\. Cross-Reference Verification**

| **Check** | **Result** |
| --- | --- |
| Every task builds strictly on the previous (per required dependency chain: Foundation → Retrieval → Update → Picture → Password → Settings → Validation) | ✅ Each task's "Dependencies" section names the exact prior task(s); no forward references |
| --- | --- |
| No task duplicates another task's explanation | ✅ Task 4 references Task 2's screens instead of re-describing them; Task 5 explicitly reuses Feature 1's bcrypt/JWT/revocation code rather than re-specifying it; Task 6 reuses Task 9 (Feature 0)'s language-switch mechanism |
| --- | --- |
| All schema usage traces to Schema Doc §4 | ✅ users (4.1), seller\_profiles (4.2), buyer\_profiles (4.3), notification\_preferences (4.20) all correctly referenced; only one net-new column (avatar\_url) introduced, flagged as an Assumption, not silently added |
| --- | --- |
| All documentation gaps stated explicitly, not invented silently | ✅ Four gaps identified in the Feature Overview (avatar\_url column, Admin Profile screen, avatar storage mechanism, Seller profile scope) — each carried through to Task 7.5 for final sign-off status |
| --- | --- |
| Recommended-but-unsourced practices labeled correctly | ✅ No "Recommended Enhancement (Optional)" items were introduced in this feature — every deviation from literal doc text was a **documented Assumption** instead, since each was a genuine gap-fill rather than an optional nice-to-have; this distinction is preserved correctly per the instruction |
| --- | --- |
| Security-sensitive flows (password change, avatar upload, ownership) receive explicit adversarial testing, not just happy-path coverage | ✅ Task 7.2/7.3 dedicated to this |
| --- | --- |
| No scope creep into adjacent features (Addresses, Wallets, Notification delivery, Admin User Management) | ✅ Explicitly excluded in Feature Overview and re-confirmed at each relevant task boundary (e.g., Task 2.1 excludes wallet fields, Task 1.3 excludes Admin's other-user bypass) |
| --- | --- |
| Every endpoint routed under the versioned, enveloped, error-handled API structure from Feature 0 | ✅ All profile routes use /api/v1, the envelope helper, and the typed error hierarchy — no new conventions introduced |
| --- | --- |

**Feature 2.md — User Profiles Engineering Execution Playbook is complete.** All 7 tasks follow the required dependency sequence, are cross-referenced against the five binding source documents, and every deviation from literal document text is transparently logged as an Assumption pending sign-off in FEATURE\_2\_CHECKLIST.md. Ready for the team to execute following Feature 0 and Feature 1 (Authentication).

—--------------------------------------------------------------------------------------------------------------------------------------------------------------------

## **Before moving on**

I would make **three edits**:

1.  **Remove the avatar\_url implementation**. Keep it as a documented schema gap requiring approval instead of instructing developers to add the column.
2.  **Don't create /admin/profile** unless the PRD/App Flow explicitly defines it. Leave it as an unresolved assumption or ask for clarification.
3.  **Move all store-related fields** (store\_name, store\_description, logo\_url, business information) out of Feature 2 and make them the responsibility of **Feature 3 – Store Management**. Feature 2 should focus only on the user's personal account/profile.

Once those three issues are fixed, I'd consider Feature 2 ready for approval. From what you've shared so far, it's significantly stronger and more consistent than the original Feature 0.

Before finalizing this feature, review the entire document against the PRD, TRD, App Flow, Database Schema, and Implementation Plan. Remove any implementation that introduces undocumented schema changes, routes, screens, APIs, or business logic. If a required capability is not explicitly supported by the project documents, classify it as a **Documentation Gap** or **Pending Clarification** rather than implementing it. Also verify that every responsibility belongs to the correct feature and move any out-of-scope functionality to its appropriate feature instead of keeping it in the current one.

| **Issue Identified** | **Why It Is a Problem** | **Required Resolution** |
| --- | --- | --- |
| **Profile Picture implementation (avatar upload, avatar APIs, AvatarUploader, object storage integration)** | The PRD, TRD, App Flow, and Database Schema do not define support for user profile pictures or an avatar\_url field. Implementing this introduces undocumented functionality and changes the approved schema. | Remove the implementation and treat profile pictures as a **Documentation Gap**. Do not create new database fields, APIs, routes, or UI components unless they are explicitly approved in the project documents. |
| --- | --- | --- |
| **Admin Profile (/admin/profile, AdminProfile screen, Admin settings)** | The source documents define the Admin role but do not define a dedicated Admin self-profile interface or route. Creating one expands the documented scope of the project. | Remove all Admin profile-related functionality. If administrator self-profile management is required, document it as an unresolved requirement instead of implementing it. |
| --- | --- | --- |
| **Seller business information included in User Profiles** | Fields such as **store\_name**, **store\_description**, **logo\_url**, branding, and other business information belong to **Store Management**, not **User Profiles**. Mixing these responsibilities violates feature boundaries and reduces maintainability. | Keep Feature 2 limited to the authenticated user's personal account information (e.g., name, phone, email, password, language, notification preferences). Move all store/business-related functionality to **Feature 3 – Store Management**. |
| --- | --- | --- |
| **Implementation of undocumented requirements through assumptions** | Some assumptions in the current document create new functionality instead of simply documenting missing requirements. This conflicts with the project's rule that the PRD, TRD, App Flow, Database Schema, and Implementation Plan are the single source of truth. | Where documentation is incomplete, record the item as a **Documentation Gap** or **Pending Clarification** only. Do not implement new schema elements, APIs, screens, workflows, or business rules without explicit support from the source documents. |
| --- | --- | --- |