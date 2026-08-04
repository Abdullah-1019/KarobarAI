import type { CourierQuotesDTO, TrackingDTO } from '@karobarai/shared';
import type { CourierQuote, Order, OrderStatus, Prisma, UserRole } from '@prisma/client';

import type { CourierCode, QuoteResult } from '../../adapters/courier';
import { ALL_COURIERS, getCourierAdapter } from '../../adapters/courier';
import { config } from '../../core/config';
import { BusinessRuleError, ConflictError, NotFoundError } from '../../core/errors/AppError';
import { logger } from '../../core/logger';
import { prisma } from '../../core/prisma';
import type { Worker } from 'bullmq';

import { createQueue, createWorker } from '../../core/queue';
import { emitTrackingUpdate } from '../../core/socket';
import { enqueueNotification } from '../notification';
import { getOrderById, getOwnedOrderRow, transitionOrderStatus } from '../order/order.service';
import * as repo from './tracking.repository';

// Feature 8 — extends nothing (Feature 7's order/ module owns order rows; this is the one new
// module TRD §12 always intended, per the Feature 7 Task 7 patch). All order-status writes route
// exclusively through Feature 7's transitionOrderStatus (Task 1.5's reuse-audit requirement) —
// this file writes only courier_quotes/tracking_events directly, plus the non-status order
// columns (courier/tracking_no/courier_overridden) Schema §4.10 reserved for this feature.

// ─────────────────────────────────────────────────────────────────────────────
// Task 2 — Shipment Initialization
// ─────────────────────────────────────────────────────────────────────────────

export async function initializeShipment(orderId: bigint): Promise<void> {
  const order = await repo.findOrderRowById(orderId);
  if (!order) {
    logger.warn({ orderId: orderId.toString() }, '[tracking] initializeShipment: order not found, skipping');
    return;
  }
  // Gap #4 + Task 2.3 — redelivery-safe no-op: a BullMQ retry landing after the order has already
  // moved on (booked, cancelled, ...) is a legitimate no-op, not an error.
  if (order.status !== 'PAYMENT_CONFIRMED' || order.courier !== null) {
    logger.info(
      { orderId: orderId.toString(), status: order.status, courier: order.courier },
      '[tracking] initializeShipment: order no longer eligible, skipping',
    );
    return;
  }

  const existingQuotes = await repo.findQuotesByOrder(orderId);
  if (existingQuotes.length > 0) {
    // Gap #2 — scoring is idempotent-per-order; a Seller reopening Order Detail before booking
    // must not trigger a second score/second set of courier_quotes rows.
    logger.info({ orderId: orderId.toString() }, '[tracking] initializeShipment: quotes already exist, skipping');
    return;
  }

  await scoreCouriers(order.orderId, { city: order.shipCity, province: order.shipProvince }, order.paymentMethod === 'COD');
}

// ─────────────────────────────────────────────────────────────────────────────
// Task 3 — Courier Selection
// ─────────────────────────────────────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error('Courier adapter call timed out')), ms);
    }),
  ]);
}

async function getCourierWeights(): Promise<{ cost: number; time: number; reliability: number; coverage: number }> {
  const row = await prisma.platformConfig.findUnique({ where: { configKey: 'courier_weights' } });
  const value = row?.value as { cost?: number; time?: number; reliability?: number; coverage?: number } | undefined;
  return {
    cost: value?.cost ?? 0.4,
    time: value?.time ?? 0.3,
    reliability: value?.reliability ?? 0.2,
    coverage: value?.coverage ?? 0.1,
  };
}

function normalizeInverse(values: number[], value: number): number {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return 1;
  return 1 - (value - min) / (max - min);
}

async function scoreCandidates(
  destination: { city: string; province: string },
  isCOD: boolean,
): Promise<Array<{ courier: CourierCode; quote: QuoteResult }>> {
  const adapter = getCourierAdapter();

  // Task 3.1 — COD-coverage filter BEFORE scoring (never wastes a getQuote() call on a courier
  // that can't actually serve COD at this destination).
  const coverageChecks = await Promise.all(
    ALL_COURIERS.map(async (courier) => ({
      courier,
      coverage: await adapter.checkCoverage({ courier, destinationCity: destination.city, isCOD }),
    })),
  );
  const eligibleCouriers = coverageChecks.filter((c) => c.coverage.covered).map((c) => c.courier);

  // Task 3.2 — parallel getQuote(), 10s timeout per call, never a serial waterfall.
  return Promise.all(
    eligibleCouriers.map(async (courier) => ({
      courier,
      quote: await withTimeout(
        adapter.getQuote({ courier, destinationCity: destination.city, destinationProvince: destination.province }),
        10_000,
      ),
    })),
  );
}

async function computeScores(
  candidates: Array<{ courier: CourierCode; quote: QuoteResult }>,
): Promise<Array<{ courier: CourierCode; quote: QuoteResult; score: number }>> {
  const weights = await getCourierWeights();
  const costs = candidates.map((c) => c.quote.cost);
  const etaHours = candidates.map((c) => c.quote.etaHours);

  // Coverage score is uniformly 1 here — candidates already passed the coverage pre-filter above;
  // the weight still contributes (per platform_config.courier_weights), it just can't
  // differentiate among survivors of that filter. Documented as this feature's own reading of
  // Task 3.3, since no source document specifies a finer-grained coverage scoring signal.
  return candidates.map((c) => ({
    ...c,
    score:
      weights.cost * normalizeInverse(costs, c.quote.cost) +
      weights.time * normalizeInverse(etaHours, c.quote.etaHours) +
      weights.reliability * c.quote.reliability +
      weights.coverage * 1,
  }));
}

export async function scoreCouriers(
  orderId: bigint,
  destination: { city: string; province: string },
  isCOD: boolean,
): Promise<void> {
  const candidates = await scoreCandidates(destination, isCOD);
  const scored = await computeScores(candidates);
  await repo.replaceCourierQuotes(
    orderId,
    scored.map((s) => ({ courier: s.courier, cost: s.quote.cost, etaHours: s.quote.etaHours, score: s.score })),
  );
  logger.info({ orderId: orderId.toString(), candidateCount: scored.length }, '[tracking] courier scoring complete');
}

function toQuoteDTO(row: CourierQuote): { courier: CourierCode; cost: string; etaHours: number; score: string; selected: boolean } {
  return {
    courier: row.courier as CourierCode,
    cost: row.cost ? row.cost.toFixed(2) : '0.00',
    etaHours: row.etaHours ?? 0,
    score: row.score ? row.score.toFixed(3) : '0.000',
    selected: row.selected,
  };
}

export async function getCourierQuotesForSeller(orderPublicId: string, sellerId: bigint): Promise<CourierQuotesDTO> {
  const order = await getOwnedOrderRow(orderPublicId, { userId: sellerId, role: 'SELLER' });
  const quotes = await repo.findQuotesByOrder(order.orderId);
  if (quotes.length === 0) {
    throw new BusinessRuleError('Courier quotes are not ready yet for this order', undefined, 'COURIER_QUOTES_NOT_READY');
  }
  return { quotes: quotes.map(toQuoteDTO) };
}

// Task 3.7 — the one legitimate exception to Gap #2's idempotency default.
export async function refreshCourierRates(orderPublicId: string, sellerId: bigint): Promise<CourierQuotesDTO> {
  const order = await getOwnedOrderRow(orderPublicId, { userId: sellerId, role: 'SELLER' });
  assertCourierSelectionEligible(order);
  await scoreCouriers(order.orderId, { city: order.shipCity, province: order.shipProvince }, order.paymentMethod === 'COD');
  const quotes = await repo.findQuotesByOrder(order.orderId);
  return { quotes: quotes.map(toQuoteDTO) };
}

// Gap #4 — courier-selection-eligible only when PAYMENT_CONFIRMED and not yet booked. Orders
// that landed in PENDING_MANUAL_LOGISTICS after an all-couriers-fail (Task 4.5) are NOT
// re-eligible through this automated path — that status is a deliberate terminal-for-this-
// feature state requiring human (Admin/Support) intervention, not an automatic retry seam.
function assertCourierSelectionEligible(order: Order): void {
  if (order.status !== 'PAYMENT_CONFIRMED') {
    throw new BusinessRuleError('Order is not eligible for courier selection', { status: order.status }, 'ORDER_NOT_COURIER_ELIGIBLE');
  }
  if (order.courier !== null) {
    throw new ConflictError('This order already has a booked courier', undefined, 'COURIER_ALREADY_BOOKED');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Task 4 — Shipment Booking
// ─────────────────────────────────────────────────────────────────────────────

const MAX_BOOKING_ATTEMPTS = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function attemptBookWithRetry(courier: CourierCode, orderPublicId: string, destinationCity: string) {
  const adapter = getCourierAdapter();
  for (let attempt = 1; attempt <= MAX_BOOKING_ATTEMPTS; attempt += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop -- sequential retries, 30s apart, by design (REQ-F-Logistics-005)
      return await adapter.book({ courier, orderId: orderPublicId, destinationCity });
    } catch (err) {
      logger.warn(
        { courier, attempt, error: (err as Error).message },
        '[tracking] courier booking attempt failed',
      );
      if (attempt < MAX_BOOKING_ATTEMPTS) {
        // eslint-disable-next-line no-await-in-loop -- delayed retry, not a blocking sleep in a request thread's hot path (this runs inside the async booking flow itself, per Task 4's own Common Errors note about not blocking the *process* — a single in-flight booking request awaiting its own retry timer does not block other requests, since Node's event loop keeps serving them)
        await sleep(config.courier.retryDelayMs);
      }
    }
  }
  return null;
}

export async function bookCourier(
  orderPublicId: string,
  sellerId: bigint,
  requestedCourier: CourierCode,
) {
  const order = await getOwnedOrderRow(orderPublicId, { userId: sellerId, role: 'SELLER' });
  assertCourierSelectionEligible(order);

  const quotes = await repo.findQuotesByOrder(order.orderId);
  if (quotes.length === 0) {
    throw new BusinessRuleError('Courier quotes are not ready yet for this order', undefined, 'COURIER_QUOTES_NOT_READY');
  }
  const requestedIndex = quotes.findIndex((q) => q.courier === requestedCourier);
  if (requestedIndex === -1) {
    throw new BusinessRuleError(
      "Selected courier was not among this order's scored options",
      undefined,
      'INVALID_COURIER_SELECTION',
    );
  }
  const topScoredCourier = quotes[0]!.courier as CourierCode;
  const isOverride = requestedCourier !== topScoredCourier;

  // Task 4.3 — fallback starts at the requested courier, then continues down the ranked list
  // (never a random/first-remaining pick).
  const bookingOrder = [quotes[requestedIndex]!, ...quotes.filter((_, i) => i !== requestedIndex)];

  for (const candidate of bookingOrder) {
    const courier = candidate.courier as CourierCode;
    // eslint-disable-next-line no-await-in-loop -- sequential fallback across couriers, by design
    const result = await attemptBookWithRetry(courier, order.publicId, order.shipCity);
    if (result) {
      await prisma.$transaction([
        prisma.order.update({
          where: { orderId: order.orderId },
          data: { courier, trackingNo: result.trackingNo, courierOverridden: isOverride },
        }),
        prisma.courierQuote.updateMany({ where: { orderId: order.orderId, courier }, data: { selected: true } }),
      ]);
      await transitionOrderStatus(order.orderId, 'PROCESSING', 'system', `Courier booked: ${courier}`);
      return getOrderById(orderPublicId, { userId: sellerId, role: 'SELLER' });
    }
  }

  // Task 4.5 — every candidate's retries exhausted.
  await transitionOrderStatus(order.orderId, 'PENDING_MANUAL_LOGISTICS', 'system', 'All couriers failed booking');
  await enqueueNotification({
    userId: order.sellerId.toString(),
    type: 'COURIER_MANUAL_LOGISTICS',
    orderId: order.publicId,
    vars: { orderId: order.publicId },
  });
  return getOrderById(orderPublicId, { userId: sellerId, role: 'SELLER' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Task 5 — Tracking Registration (reads)
// ─────────────────────────────────────────────────────────────────────────────

const DELIVERY_STAGE_LABELS: Record<OrderStatus, string> = {
  PAYMENT_PENDING: 'Awaiting payment',
  PAYMENT_CONFIRMED: 'Payment confirmed',
  PROCESSING: 'Preparing your order',
  PENDING_MANUAL_LOGISTICS: 'Arranging courier',
  PICKED_UP: 'Picked up by courier',
  IN_TRANSIT: 'In transit',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

async function toTrackingDTO(order: Order): Promise<TrackingDTO> {
  const events = await repo.findTrackingEventsByOrder(order.orderId);
  const latest = events[events.length - 1];
  return {
    status: order.status,
    courier: order.courier as CourierCode | null,
    trackingNo: order.trackingNo,
    deliveryStageLabel: DELIVERY_STAGE_LABELS[order.status],
    lastLocation:
      latest?.locationLat != null && latest?.locationLng != null
        ? { lat: latest.locationLat.toFixed(6), lng: latest.locationLng.toFixed(6) }
        : null,
    timeline: events.map((e) => ({
      status: e.status,
      description: e.description,
      eventTime: e.eventTime.toISOString(),
    })),
  };
}

// Task 5.2 — deliberately minimal, no PII. Same DTO shape as the authenticated read below: even
// the authenticated version never includes full shipping address/phone (that stays Order-
// Detail-only, Feature 7), so there is no meaningful "extra" to add for the authenticated case.
export async function getPublicTracking(token: string): Promise<TrackingDTO> {
  const order = await repo.findOrderByTrackingToken(token);
  if (!order) {
    throw new NotFoundError('Tracking information not found', undefined, 'TRACKING_TOKEN_INVALID');
  }
  return toTrackingDTO(order);
}

// Task 5.3 — authenticated (Buyer, Seller, or Admin/Support of the order), reuses Feature 7's
// tri-mode ownership check directly rather than reimplementing it.
export async function getAuthenticatedTracking(
  orderPublicId: string,
  requester: { userId: bigint; role: UserRole },
): Promise<TrackingDTO> {
  const order = await getOwnedOrderRow(orderPublicId, requester);
  return toTrackingDTO(order);
}

// ─────────────────────────────────────────────────────────────────────────────
// Task 6 — Shipment Timeline (5-min poll job)
// ─────────────────────────────────────────────────────────────────────────────

// In-memory, per-process — REQ-F-Track006's 3-consecutive-failure counter has no dedicated
// schema column/table (and adding one would violate this feature's zero-new-migrations
// constraint), so a process-local counter is the pragmatic choice. Resets on any successful poll.
const pollFailureCounts = new Map<string, number>();

function recordPollFailure(orderId: bigint): number {
  const key = orderId.toString();
  const next = (pollFailureCounts.get(key) ?? 0) + 1;
  pollFailureCounts.set(key, next);
  return next;
}

function clearPollFailures(orderId: bigint): void {
  pollFailureCounts.delete(orderId.toString());
}

export async function pollOneOrder(order: Order): Promise<void> {
  if (!order.courier || !order.trackingNo) return; // defensive — query already filters to booked shipments

  const adapter = getCourierAdapter();
  const latestEvent = await repo.findLatestTrackingEvent(order.orderId);

  let result;
  try {
    result = await adapter.track({
      courier: order.courier as CourierCode,
      trackingNo: order.trackingNo,
      previousStatus: latestEvent?.status ?? null,
    });
    clearPollFailures(order.orderId);
  } catch (err) {
    const failures = recordPollFailure(order.orderId);
    logger.warn({ orderId: order.orderId.toString(), failures, error: (err as Error).message }, '[tracking] poll failed');
    if (failures === 3) {
      await enqueueNotification({
        userId: order.sellerId.toString(),
        type: 'TRACKING_POLL_FAILURE',
        orderId: order.publicId,
        vars: { orderId: order.publicId },
      });
    }
    return;
  }

  try {
    // Task 6.2 — only a genuine milestone change gets a new tracking_events row.
    if (latestEvent && latestEvent.status === result.status) return;

    // Task 6.3 — status advancement exclusively via Feature 7's transitionOrderStatus, which
    // already inserts the tracking_events row for this transition (Feature 7 Task 6.1) — passing
    // location here (a Feature 8 addition to that function) avoids a second, duplicate row for
    // the same milestone rather than calling a separate repo insert first.
    await transitionOrderStatus(order.orderId, result.status, 'system', result.description, {
      lat: result.locationLat,
      lng: result.locationLng,
    });

    // Task 6.4 — Socket.IO push on the existing /tracking namespace.
    emitTrackingUpdate(order.publicId, 'order_status_update', { status: result.status });
    emitTrackingUpdate(order.publicId, 'tracking_location_update', {
      lat: result.locationLat,
      lng: result.locationLng,
    });

    // Task 7.3's final delivery notification (and every other milestone's) now fires from inside
    // transitionOrderStatus itself (order.service.ts's STATUS_NOTIFICATION_EVENTS map) — a
    // second, explicit enqueue here would double-notify the buyer on every DELIVERED transition.
  } catch (err) {
    // One order's bad transition must not fail the whole poll cycle for every other order.
    logger.error({ orderId: order.orderId.toString(), error: (err as Error).message }, '[tracking] poll cycle error for order');
  }
}

// Task 7.1 — the candidate query itself excludes DELIVERED/COMPLETED/CANCELLED, so an order
// self-terminates from future poll cycles the moment it reaches DELIVERED; no separate stop-flag.
export async function runPollCycle(): Promise<void> {
  const orders = await repo.findActiveShipmentOrders();
  await Promise.all(orders.map((order) => pollOneOrder(order)));
}

// ─────────────────────────────────────────────────────────────────────────────
// Process-startup wiring — BullMQ consumer + recurring poll job. Only ever called from
// server.ts's `require.main === module` bootstrap guard, never during tests (tests call
// initializeShipment/runPollCycle directly, same pattern Feature 7 used for confirmPayment/
// transitionOrderStatus with no real trigger of its own).
// ─────────────────────────────────────────────────────────────────────────────

let courierAssignmentWorker: Worker<{ orderId: string }> | undefined;
let pollWorker: Worker | undefined;
let pollQueue: ReturnType<typeof createQueue> | undefined;

export function startCourierAssignmentConsumer(): void {
  courierAssignmentWorker ??= createWorker<{ orderId: string }>('courier-assignment-pending', async (job) => {
    await initializeShipment(BigInt(job.data.orderId));
  });
}

const POLL_INTERVAL_MS = 5 * 60 * 1000;

export async function startTrackingPollJob(): Promise<void> {
  pollQueue ??= createQueue('tracking-poll');
  await pollQueue.add('poll', {}, { repeat: { every: POLL_INTERVAL_MS }, jobId: 'tracking-poll-recurring' });
  pollWorker ??= createWorker('tracking-poll', async () => {
    await runPollCycle();
  });
}
