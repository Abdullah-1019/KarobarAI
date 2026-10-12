# Feature 20: Courier Auto-Selection — Verification & Demo-Readiness Hardening

> **Audit correction:** The Feature 8 code had TCS, Leopards, and Trax mock profiles, but no PostEx registration. It had configurable weights under the legacy keys `cost/time/reliability/coverage`, manual booking with retries and fallback, and quote rows that were replaced on refresh. Feature 20 extends that architecture; the original assumption that all four providers and durable history already existed was incorrect.

---

## 1. Goal

Confirm (or bring up to spec) the automated courier selection flow, and produce a clean, demonstrable sequence for the FYP panel: **Order confirmed → couriers evaluated → best courier auto-selected → shipment booked**, running entirely on mock adapters, with the scoring logic being real, tested computation.

---

## 2. Why mock adapters are the correct choice (not a compromise — state this plainly in documentation)

Courier companies (TCS, Leopards, Trax, PostEx) require business accounts and commercial agreements for API access — unavailable to a student project. The architecture decision already recorded in the SRS ("adapter pattern with mock adapters," decision D2) exists specifically to make the *scoring and decision logic* — which is the actual thing being evaluated — independent of which courier's HTTP endpoint is behind it. This is standard practice, not a shortcut.

---

## 3. `CourierAdapter` Interface (verify this exists; if not, this is the gap to close)

```typescript
interface CourierAdapter {
  courierName: string;
  getQuote(params: { weightKg: number; originCity: string; destCity: string }): Promise<{
    cost: number;          // PKR
    etaHours: number;
    slaScore: number;      // 0-1, historical on-time rate
    ratingScore: number;   // 0-1, aggregate past performance/damage rate
  }>;
  bookShipment(order: Order, quote: Quote): Promise<{ trackingId: string; bookingReference: string }>;
  trackShipment(trackingId: string): Promise<CourierTrackingEvent[]>;
}
```

Each of `TraxAdapter`, `LeopardsAdapter`, `TCSAdapter`, `PostExAdapter` implements this with **realistic simulated data** — not random numbers. Cost should vary sensibly by weight/distance (e.g., a base rate + per-kg + per-100km), ETA should vary by courier "speed tier," SLA/rating should be fixed per-courier constants reflecting a plausible reputation difference (e.g., TCS slightly higher cost but higher reliability, a budget courier cheaper but lower SLA) — this realism is what makes the demo convincing; uniform random data looks fake under questioning.

---

## 4. Scoring Engine (verify this matches; this is the core "agentic decision" artifact)

```typescript
function scoreCourier(quote: CourierQuote, allQuotes: CourierQuote[]): number {
  const normCost = normalize(quote.cost, allQuotes.map(q => q.cost), lowerIsBetter = true);
  const normSpeed = normalize(quote.etaHours, allQuotes.map(q => q.etaHours), lowerIsBetter = true);
  const normSLA = quote.slaScore; // already 0-1
  const normRating = quote.ratingScore; // already 0-1

  return 0.40 * normCost + 0.30 * normSpeed + 0.20 * normSLA + 0.10 * normRating;
}

function selectBestCourier(quotes: CourierQuote[]): CourierQuote {
  return quotes.reduce((best, q) => scoreCourier(q, quotes) > scoreCourier(best, quotes) ? q : best);
}
```

`normalize()` should min-max normalize across the set of quotes actually returned for this order (not fixed global bounds), so the scoring stays meaningful regardless of which couriers are configured. Weights (0.40/0.30/0.20/0.10) should be read from `PlatformConfig` (reuse existing dynamic config table), not hardcoded — this lets you demonstrate to the panel that the weighting is configurable, not a magic number, and directly supports the SRS's Method B talking point (swap to an ML-trained weighting later without touching the calling code).

---

## 5. Flow (verify this sequence exists end-to-end)

1. Seller clicks "Select Courier" on a confirmed order.
2. Backend calls `getQuote()` on every registered adapter in parallel (`Promise.all`).
3. Backend scores all returned quotes (Section 4).
4. Backend calls `bookShipment()` on the winning adapter only.
5. Backend creates a `CourierShipment` record with the winning courier, quote, score, and `bookingReference`.
6. Seller sees a one-click confirmation showing which courier was picked and why (expose the score breakdown — see Section 6).
7. Background BullMQ poller (already built per Feature 8) begins polling `trackShipment()` on the interval already configured.

---

## 6. Explainability — the single highest-value addition for your defense

If not already present, add a `scoreBreakdown` field persisted on `CourierShipment` (or returned in the booking API response, even if not persisted — whichever is less invasive given the schema-immutability rule):

```json
{
  "selectedCourier": "TCS",
  "scoreBreakdown": {
    "TCS":      { "cost": 0.72, "speed": 0.65, "sla": 0.91, "rating": 0.88, "total": 0.758 },
    "Leopards": { "cost": 0.90, "speed": 0.55, "sla": 0.70, "rating": 0.65, "total": 0.722 },
    "Trax":     { "cost": 0.60, "speed": 0.80, "sla": 0.75, "rating": 0.70, "total": 0.685 }
  }
}
```

Surface this breakdown in the seller-facing UI (even a small expandable "why this courier?" row) and absolutely surface it in your defense demo. This single artifact — a visible, numeric, explainable decision — is what turns "we auto-select couriers" into a credible claim rather than a black box a panelist might assume is hardcoded. If this doesn't already exist, it's the one real addition this feature makes to Feature 8's existing implementation — everything else in this doc is likely already built and just needs confirming.

**Note:** if adding `scoreBreakdown` requires a schema change (a new JSON column on `CourierShipment`), that's the one schema change this feature proposes — flag it for explicit approval per the project's schema-immutability rule rather than assuming it's pre-approved like Features 16-19's changes were.

---

## 7. Numbered Implementation Tasks

**Task 1 — Audit existing Feature 8 implementation.** Locate `CourierAdapter` interface, the four mock adapters, and the scoring function in the current codebase. Produce a short written diff against Sections 3-4 above: what matches, what's missing, what's implemented differently.

**Task 2 — Close any interface/realism gaps found.** If adapters return flat/random data instead of realistic variation per Section 3, fix this — it's the difference between a convincing demo and an obviously-fake one.

**Task 3 — Make scoring weights configurable via `PlatformConfig`** if currently hardcoded.

**Task 4 — Add `scoreBreakdown` explainability output** per Section 6 (flag the schema question per the note above before implementing).

**Task 5 — Seller UI: "why this courier?" breakdown display.**

**Task 6 — Tests.** Confirm existing courier/scoring tests still pass; add a test asserting the scoring function picks the mathematically correct winner for a known set of quotes (hand-calculate expected scores for a fixed test input, assert the function matches).

**Task 7 — Demo script.** A short, written step-by-step for the live defense: seed 2-3 orders with different weight/distance profiles so different couriers win in different cases (don't let the same courier win every demo order — that looks suspicious even when it's legitimately the best score each time; varied outcomes make the scoring look real).

---

## 8. Definition of Done

- [x] The existing shared mock adapter returns differentiated simulated quotes for all four providers.
- [x] Scoring weights are configurable through `PlatformConfig`.
- [x] The seller component renders the score breakdown; production build passed. Browser rendering remains to be checked in a manual demo.
- [x] A hand-calculated test case confirms the scoring math.
- [x] The isolated three-order demo test produces varied winners from the scorer.
- [x] The final isolated backend Jest summary reports every executed test passing (see evidence below).

## Implementation and verification notes (2026-10-12)

- `MockCourierAdapter` implements four named, deterministic simulated profiles: TCS, Leopards, Trax, and PostEx. Rates use a documented synthetic distance table and parcel weight. No courier HTTP API is contacted. The existing checkout shipping fee is separate from the comparison quote.
- The existing `PlatformConfig.courier_weights` row remains the configuration source. Legacy keys `time/reliability/coverage` map to speed/SLA/rating. Defaults are 0.40/0.30/0.20/0.10. Invalid weights fail closed. Cost and ETA use inverse min-max normalization among valid quotes; equal values each receive a factor of 1. Scores use six decimals in the breakdown, three in ranking; a three-decimal tie sorts by courier code alphabetically.
- Seller-only `POST /api/v1/orders/:id/auto-select-courier` evaluates eligible quotes and books the top-ranked simulated courier once. `GET /api/v1/orders/:id/courier-selection` retrieves the durable result. The manual selection route remains separate and now uses the same single-call booking safety rules. `GET /api/v1/orders/courier-performance` reports seller-scoped groups by origin, destination, parcel weight band, courier, and source.
- `CourierShipment` has a unique order reference and explicit `SIMULATED`/`REAL` source. A row claim serializes concurrent requests; a repeated successful request returns the stored shipment. A definitive failure may be retried by a new seller click. An uncertain response or persistence failure locks the order for reconciliation. There is no automatic fallback or second booking call. Cancellation is blocked while the booking outcome is unresolved. A durable booking whose local order-status transition failed can resume that local transition without a second booking.
- Quote refresh appends a new evaluation and retains earlier quotes. Shipment history stores route, parcel estimate, selected courier, score snapshot, booking and tracking IDs, failure state, milestone timestamps, and on-time result. Tracking milestones use the existing order transition and event pipeline. Historical rates require at least five measured deliveries in one route/weight/source group; missing outcomes do not count as failures. Synthetic and real groups remain separate. This is descriptive analytics, not model training.
- The current schema has no seller origin or product weight/dimensions. Simulated selection uses Karachi as origin and 0.5 kg per unit, saved with the evaluation. These are demo estimates, not verified physical shipment measurements. The existing order state machine has no return workflow; `RETURNED` is reserved in the shipment status enum but has no automatic producer.
- Migration: `20261012000000_feature20_courier_history`. After confirming `DATABASE_URL` points to the intended isolated or reviewed target, run `corepack pnpm --filter @karobarai/backend exec prisma migrate deploy --schema prisma/schema.prisma`, then `corepack pnpm --filter @karobarai/backend exec prisma migrate status --schema prisma/schema.prisma`. During development this migration was applied only to a disposable isolated PostgreSQL database, never to the shared development database.

### Reproducible isolated demo

1. Start disposable PostgreSQL and Redis instances. Set `DATABASE_URL` and `REDIS_URL` for **that test process only**; confirm the PostgreSQL database name is disposable. Deploy migrations and seed configuration into that disposable database.
2. Run `corepack pnpm --filter @karobarai/backend exec jest --runInBand --runTestsByPath tests/tracking/autoSelect.test.ts tests/tracking/courier-scoring.unit.test.ts` with those isolated variables. The three-order test creates synthetic Karachi (2 units), Lahore (2 units), and Peshawar (10 units) orders, explicitly posts the seller action, checks each stored ranking and single selected quote, and requires at least two different winners. It does not hardcode a winner into the service.
3. For a browser defense demo, separately prepare an isolated seller login and three synthetic confirmed orders with those routes and quantities. Open each order, click **Auto Select Courier**, expand “Why this courier?”, and show the simulated badge, booking reference, tracking ID, and tracking timeline. The automated test creates its own disposable records; it does not provision a reusable browser login. A real browser demonstration has not yet been recorded.

### Test evidence and limits

- Focused tracking suite on disposable PostgreSQL and Redis: 6 suites, 47 tests passed. The final targeted rerun covering buyer order routes, both architecture audits, auto-selection (including the three-order demo), and scoring passed 5 suites / 66 tests. The date-range suite passed 9/9 with `TZ=Asia/Karachi`.
- Final full backend Jest summary on disposable PostgreSQL/Redis with `TZ=Asia/Karachi`: 96 suites passed, 3 skipped; 885 tests passed, 7 skipped. The PowerShell `Select-String` output-filter wrapper returned exit code 1 even for a separate passing one-suite run, so the Jest summary is the test-result evidence; the wrapper exit code is not interpreted as a Jest failure. The first run in the host US timezone had 17 failures, including a date-boundary expectation and route/architecture tests subsequently corrected and rerun.
- Backend and frontend typechecks and production builds passed. Frontend build retains existing bundle-size/PWA precache warnings. Both configured lint scripts only print “no lint rules configured.” Prisma generation, validation, migration deployment, and `migrate status` succeeded against the disposable database.
- `git diff --check` passed. UI behavior is build-checked but has no configured component-test runner, and no browser interaction is claimed.
