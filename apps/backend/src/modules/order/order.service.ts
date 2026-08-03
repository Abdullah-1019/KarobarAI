import { ORDER_STATUS_TABS } from '@karobarai/shared';
import type { OrderDetailDTO, OrderListDTO, OrderListItemDTO } from '@karobarai/shared';
import type { Order, OrderStatus, Prisma, UserRole } from '@prisma/client';
import type { Queue } from 'bullmq';

import { decryptField } from '../../core/crypto/fieldCipher';
import { BusinessRuleError, ForbiddenError, NotFoundError } from '../../core/errors/AppError';
import { logger } from '../../core/logger';
import { prisma } from '../../core/prisma';
import { createQueue } from '../../core/queue';
import { canTransition, isCancellable } from '../../core/state-machines/order.state-machine';
import { restoreStock } from '../catalog/catalog.service';
import type { ListOrdersQueryInput } from './order.dto';

// Feature 7 — extends Feature 6's order/ module with lifecycle logic (Task 1.1's "same module,
// additive" instruction). checkout.service.ts stays scoped to the checkout-creation transaction
// only; this file owns everything after an order row exists. No order.repository.ts — consistent
// with the no-repository-layer convention already established (catalog/cart/address).

// ─────────────────────────────────────────────────────────────────────────────
// Task 2 — Order Retrieval (one shared query builder, two thin role-scoped callers)
// ─────────────────────────────────────────────────────────────────────────────

const ORDER_LIST_INCLUDE = {
  seller: { select: { storeName: true } },
  _count: { select: { items: true } },
} satisfies Prisma.OrderInclude;

type OrderListRow = Prisma.OrderGetPayload<{ include: typeof ORDER_LIST_INCLUDE }>;

async function queryOrders(
  where: Prisma.OrderWhereInput,
  cursor: string | undefined,
  limit: number,
): Promise<{ orders: OrderListRow[]; hasMore: boolean }> {
  const orders = await prisma.order.findMany({
    where: {
      ...where,
      ...(cursor && { orderId: { lt: BigInt(cursor) } }),
    },
    orderBy: { orderId: 'desc' },
    take: limit + 1,
    include: ORDER_LIST_INCLUDE,
  });

  const hasMore = orders.length > limit;
  return { orders: hasMore ? orders.slice(0, limit) : orders, hasMore };
}

function statusFilterFor(tab: ListOrdersQueryInput['tab']): OrderStatus[] | undefined {
  return tab ? [...ORDER_STATUS_TABS[tab]] : undefined;
}

function toListDTO(rows: OrderListRow[], hasMore: boolean, counterpartyName: (row: OrderListRow) => string): OrderListDTO {
  const items: OrderListItemDTO[] = rows.map((row) => ({
    id: row.publicId,
    counterpartyName: counterpartyName(row),
    itemCount: row._count.items,
    totalAmount: row.totalAmount.toFixed(2),
    status: row.status,
    placedAt: row.placedAt.toISOString(),
  }));
  const last = rows[rows.length - 1];
  return { items, nextCursor: hasMore && last ? last.orderId.toString() : null };
}

// Task 3.4 — read-only gate: delivered within platform_config.return_window_days (never
// hardcoded, same discipline Feature 6 Task 4.3 required for min_order_value_pkr) AND no
// existing returns row for the order (Return.orderId is unique). Batched, not N+1 — a list page
// is at most `limit` orders, one extra query total, not one per row.
async function getReturnEligibilityByOrderId(orders: OrderListRow[]): Promise<Map<bigint, boolean>> {
  const deliveredOrderIds = orders.filter((o) => o.status === 'DELIVERED' || o.status === 'COMPLETED').map((o) => o.orderId);
  if (deliveredOrderIds.length === 0) return new Map();

  const [configRow, existingReturns, fullOrders] = await Promise.all([
    prisma.platformConfig.findUnique({ where: { configKey: 'return_window_days' } }),
    prisma.return.findMany({ where: { orderId: { in: deliveredOrderIds } }, select: { orderId: true } }),
    prisma.order.findMany({ where: { orderId: { in: deliveredOrderIds } }, select: { orderId: true, deliveredAt: true } }),
  ]);

  const windowDays = configRow ? Number(configRow.value) : 14;
  const hasReturn = new Set(existingReturns.map((r) => r.orderId.toString()));
  const deliveredAtById = new Map(fullOrders.map((o) => [o.orderId.toString(), o.deliveredAt]));

  const result = new Map<bigint, boolean>();
  for (const orderId of deliveredOrderIds) {
    const deliveredAt = deliveredAtById.get(orderId.toString());
    const withinWindow = deliveredAt
      ? Date.now() <= deliveredAt.getTime() + windowDays * 24 * 60 * 60 * 1000
      : false;
    result.set(orderId, withinWindow && !hasReturn.has(orderId.toString()));
  }
  return result;
}

export async function getOrdersForBuyer(buyerId: bigint, filters: ListOrdersQueryInput): Promise<OrderListDTO> {
  const limit = filters.limit ?? 20;
  const status = statusFilterFor(filters.tab);
  const { orders, hasMore } = await queryOrders(
    { buyerId, ...(status && { status: { in: status } }) },
    filters.cursor,
    limit,
  );
  const eligibility = await getReturnEligibilityByOrderId(orders);

  // Buyer's list shows the seller's store name, plus the return-eligibility gate.
  const dto = toListDTO(orders, hasMore, (row) => row.seller.storeName);
  return {
    ...dto,
    items: dto.items.map((item, i) => ({
      ...item,
      returnEligible: eligibility.get(orders[i]?.orderId ?? -1n) ?? false,
    })),
  };
}

export async function getOrdersForSeller(sellerId: bigint, filters: ListOrdersQueryInput): Promise<OrderListDTO> {
  const limit = filters.limit ?? 20;
  const status = statusFilterFor(filters.tab);
  const { orders, hasMore } = await queryOrders(
    { sellerId, ...(status && { status: { in: status } }) },
    filters.cursor,
    limit,
  );
  // Seller's list shows the order's snapshotted recipient name — a summary, not the buyer's full
  // PII (phone/full address), which stays Order-Detail-only (Task 4.3's "masked/summary" rule).
  return toListDTO(orders, hasMore, (row) => row.shipName);
}

const ORDER_DETAIL_INCLUDE = {
  items: { include: { product: { select: { publicId: true } } } },
  payment: true,
  trackingEvents: { orderBy: { eventTime: 'asc' as const } },
} satisfies Prisma.OrderInclude;

// Task 2.3 — tri-mode ownership: the requester's userId must equal the order's buyer_id OR
// seller_id, OR the requester's role must be Admin/Support (PRD §11's read-access matrix).
export async function getOrderById(
  orderPublicId: string,
  requester: { userId: bigint; role: UserRole },
): Promise<OrderDetailDTO> {
  const order = await prisma.order.findUnique({
    where: { publicId: orderPublicId },
    include: ORDER_DETAIL_INCLUDE,
  });
  if (!order) {
    throw new NotFoundError('Order not found', undefined, 'ORDER_NOT_FOUND');
  }

  const isBuyer = order.buyerId === requester.userId;
  const isSeller = order.sellerId === requester.userId;
  const isAdmin = requester.role === 'ADMIN' || requester.role === 'SUPPORT';
  if (!isBuyer && !isSeller && !isAdmin) {
    throw new ForbiddenError('This order does not belong to you', undefined, 'ORDER_NOT_OWNED');
  }

  // App Flow SCR-B05: commission is never shown to the Buyer. Literal reading of Task 5.1: shown
  // only when the requester IS the order's own Seller — not Admin either.
  const commission = isSeller
    ? {
        rate: order.commissionRateSnapshot.toFixed(4),
        amount: order.subtotal.times(order.commissionRateSnapshot).toFixed(2),
      }
    : null;

  return {
    id: order.publicId,
    status: order.status,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.payment?.status ?? 'PENDING',
    subtotal: order.subtotal.toFixed(2),
    shippingFee: order.shippingFee.toFixed(2),
    totalAmount: order.totalAmount.toFixed(2),
    commission,
    items: order.items.map((item) => ({
      productId: item.product.publicId,
      titleSnapshot: item.titleSnapshot,
      unitPrice: item.unitPrice.toFixed(2),
      quantity: item.quantity,
    })),
    // Decrypted server-side for an already-authorized viewer only — never sent as ciphertext,
    // and always the order's own snapshot (Schema §4.10), never the buyer's current address.
    shipping: {
      recipientName: order.shipName,
      line1: decryptField(order.shipLine1),
      line2: order.shipLine2 ? decryptField(order.shipLine2) : null,
      city: order.shipCity,
      province: order.shipProvince,
      postalCode: order.shipPostal,
      phone: decryptField(order.shipPhone),
    },
    // Feature 7's Task 7 patch: courier assignment is entirely Feature 8's scope — always
    // "not_booked" here, never populated with real booking data by this feature.
    courierStatus: 'not_booked',
    timeline: order.trackingEvents.map((event) => ({
      status: event.status,
      description: event.description,
      eventTime: event.eventTime.toISOString(),
    })),
    cancellable: isCancellable(order.status),
    placedAt: order.placedAt.toISOString(),
    deliveredAt: order.deliveredAt ? order.deliveredAt.toISOString() : null,
  };
}

// Exposed for invoice.service.ts (Task 8) and tests — the raw Order row, tri-mode-ownership-
// checked, without the DTO shaping. Avoids a second Prisma query for the same ownership check.
export async function getOwnedOrderRow(
  orderPublicId: string,
  requester: { userId: bigint; role: UserRole },
): Promise<Order> {
  const order = await prisma.order.findUnique({ where: { publicId: orderPublicId } });
  if (!order) throw new NotFoundError('Order not found', undefined, 'ORDER_NOT_FOUND');
  const isBuyer = order.buyerId === requester.userId;
  const isSeller = order.sellerId === requester.userId;
  const isAdmin = requester.role === 'ADMIN' || requester.role === 'SUPPORT';
  if (!isBuyer && !isSeller && !isAdmin) {
    throw new ForbiddenError('This order does not belong to you', undefined, 'ORDER_NOT_OWNED');
  }
  return order;
}

// ─────────────────────────────────────────────────────────────────────────────
// Task 6 — Order Status Management. transitionOrderStatus is the SINGLE entry point for every
// status change in this codebase — nothing else ever writes orders.status directly (TRD §3's
// single-source-of-truth requirement, grep-audited in the test suite).
// ─────────────────────────────────────────────────────────────────────────────

export async function transitionOrderStatus(
  orderId: bigint,
  targetStatus: OrderStatus,
  actor: 'system' | 'seller',
  description?: string,
  // Feature 8 addition — every courier-driven milestone its poll job records also doubles as a
  // canonical status transition (its mock adapter's tracking call maps 1:1 onto OrderStatus
  // values), so routing location data through this single tracking_events insert avoids a
  // second, duplicate row per milestone (one from here, one from a separate write) — the same
  // "extend with an optional param, old callers unaffected" pattern Feature 6 used to add an
  // optional transaction client to Feature 4's decrementStock/restoreStock.
  location?: { lat: number; lng: number },
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { orderId } });

    if (!canTransition(order.status, targetStatus)) {
      throw new BusinessRuleError(
        `Cannot transition an order from ${order.status} to ${targetStatus}`,
        { from: order.status, to: targetStatus },
        'INVALID_STATUS_TRANSITION',
      );
    }

    await tx.order.update({
      where: { orderId },
      data: {
        status: targetStatus,
        ...(targetStatus === 'DELIVERED' && { deliveredAt: new Date() }),
      },
    });

    await tx.trackingEvent.create({
      data: {
        orderId,
        status: targetStatus,
        description: description ?? `Order status changed to ${targetStatus}`,
        eventTime: new Date(),
        locationLat: location?.lat,
        locationLng: location?.lng,
      },
    });

    // Entry action — Gap #3: cancelling from any pre-shipment state restores stock (REQ-F-Inv-004),
    // reusing Feature 4's existing method, never a second increment implementation.
    if (targetStatus === 'CANCELLED') {
      const items = await tx.orderItem.findMany({ where: { orderId } });
      for (const item of items) {
        // eslint-disable-next-line no-await-in-loop -- must serialize within this transaction
        await restoreStock(item.productId, item.quantity, tx);
      }
    }

    // Entry action — Gap #4: delivery IS the COD payment-confirmation event. The cod_remittances
    // ledger row itself is never written here (Feature 6 Gap #3 / Feature 7 Gap #4 — deferred to
    // Feature 8).
    if (targetStatus === 'DELIVERED' && order.paymentMethod === 'COD') {
      await tx.payment.updateMany({
        where: { orderId },
        data: { status: 'CONFIRMED', confirmedAt: new Date() },
      });
    }

    logger.info({ orderId: orderId.toString(), from: order.status, to: targetStatus, actor }, 'Order status transitioned');
  });
}

// Task 7 (patched — "Courier Hand-off Stub"): a generic queue, no consumer written here. Feature
// 8 owns the actual courier-scoring/booking job that reads from this queue.
//
// Lazily constructed (not a top-level const) — every test file that imports server.ts pulls in
// this module, and a BullMQ Queue opens its own Redis connection on construction; eagerly
// creating one per Jest module registry (one per test file) left dozens of connections open with
// nothing to close them, hanging the process after a full-suite run. Lazy + closeable (below)
// means only tests that actually call confirmPayment ever open one.
let courierHandoffQueue: Queue | undefined;

function getCourierHandoffQueue(): Queue {
  courierHandoffQueue ??= createQueue('courier-assignment-pending');
  return courierHandoffQueue;
}

// Exposed for test teardown only — mirrors the existing `redis.quit()` convention every test
// file's afterAll already follows.
export async function closeCourierHandoffQueue(): Promise<void> {
  if (courierHandoffQueue) {
    await courierHandoffQueue.close();
    courierHandoffQueue = undefined;
  }
}

// Gap #1 — this feature owns the state machine and this transition function; Feature 8's future
// webhook handler is the actual TRIGGER that will call this. Never implements webhook/HMAC
// verification itself.
export async function confirmPayment(orderId: bigint): Promise<void> {
  await transitionOrderStatus(orderId, 'PAYMENT_CONFIRMED', 'system', 'Payment confirmed');
  await getCourierHandoffQueue().add('assign', { orderId: orderId.toString() });
}

// Gap #3 — Seller-only manual action, from any pre-shipment state.
export async function cancelOrder(sellerId: bigint, orderPublicId: string): Promise<void> {
  const order = await prisma.order.findUnique({ where: { publicId: orderPublicId } });
  if (!order) {
    throw new NotFoundError('Order not found', undefined, 'ORDER_NOT_FOUND');
  }
  if (order.sellerId !== sellerId) {
    throw new ForbiddenError('This order does not belong to you', undefined, 'ORDER_NOT_OWNED');
  }
  if (!isCancellable(order.status)) {
    throw new BusinessRuleError(
      'Order cannot be cancelled from its current status',
      { status: order.status },
      'ORDER_NOT_CANCELLABLE',
    );
  }

  await transitionOrderStatus(order.orderId, 'CANCELLED', 'seller', 'Cancelled by seller');
}
