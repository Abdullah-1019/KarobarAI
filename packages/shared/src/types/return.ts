// Feature 10 (Returns & Refunds) DTOs — Schema §4.15/4.16/4.17 (returns/return_images/disputes).

export type ReturnStatus =
  | 'INITIATED'
  | 'IMAGES_SUBMITTED'
  | 'UNDER_AI_REVIEW'
  | 'MANUAL_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'PICKUP_BOOKED'
  | 'REFUND_ISSUED'
  | 'UNDER_DISPUTE'
  | 'CLOSED';

// MANUAL exists in the DB enum (Schema §3) but is never written by any code path in this
// feature — reserved, presumably, for an R1.1 AI-vs-human provenance distinction the source
// documents don't elaborate on. Included here only for type parity with the Prisma enum.
export type ReturnDecisionValue = 'APPROVED' | 'REJECTED' | 'MANUAL';

export type DisputeStatus = 'OPEN' | 'RESOLVED_APPROVED' | 'RESOLVED_REJECTED';

export interface ReturnImageDTO {
  id: string;
  cdnUrl: string;
}

export interface DisputeDTO {
  status: DisputeStatus;
  buyerReason: string | null;
  resolutionReason: string | null;
  adminReason: string | null;
  resolvedAt: string | null;
}

export interface AuditTrailEntryDTO {
  action: string;
  reason: string | null;
  createdAt: string;
}

// Task 7.5 — one shared shape across buyer/seller/admin history + Task 2/4/5 detail reads,
// differing only by which fields are populated (e.g. sellerId isn't meaningful to hide, but
// admin-only fields like the dispute detail are simply null/omitted for buyer/seller reads).
export interface ReturnDetailDTO {
  id: string; // returnId, stringified — Return has no publicId column (Schema §4.15)
  orderId: string; // the order's publicId
  productId?: string | null;
  orderNumber?: string;
  productName?: string | null;
  itemQuantity?: number | null;
  productImage?: string | null;
  itemResolution?: 'PURCHASED' | 'RETURNED' | 'EXCHANGED' | null;
  inspection?: {
    state: string;
    status: string | null;
    similarityScore: number | null;
    reasonCode: string | null;
    referenceImageCount: number;
    returnImageCount: number;
    pairs: Array<{ index: number; similarityScore: number }>;
    evidenceSufficient: boolean;
    comparisonAvailable: boolean;
    policyVersion: string;
    provider: string | null;
    model: string | null;
    revision: string | null;
    processedAt: string | null;
    aiDecision: {
      status: 'APPROVED' | 'REJECTED' | 'MANUAL_REVIEW';
      reason: string;
      similarityScore: number | null;
      acceptThreshold: number;
      reviewThreshold: number;
      decidedAt: string;
    } | null;
  } | null;
  referenceImages: Array<{ id: string; url: string }>;
  status: ReturnStatus;
  reason: string;
  decision: ReturnDecisionValue | null;
  decisionSource: 'AI' | 'SELLER' | 'ADMIN' | null;
  sellerOverrideReason: string | null;
  decisionReason?: string | null;
  // Return-leg shipment only. The order's outbound courier/tracking is never reused here.
  returnShipping: {
    status: string;
    courier: string | null;
    bookingReference: string | null;
    trackingNumber: string | null;
    trackingUrl: string | null;
    estimatedPickupAt: string | null;
    estimatedDeliveryAt: string | null;
  };
  shipments?: Array<{
    leg: 'RETURN' | 'REPLACEMENT'; status: string; simulated: boolean;
    courier: string | null; bookingReference: string | null; trackingNumber: string | null;
    bookedAt: string | null; deliveredAt: string | null; estimatedDeliveryAt: string | null;
    events: Array<{ status: string; description: string; eventTime: string }>;
  }>;
  fulfillment?: {
    status: string; receiptCondition: string | null; receiptConfirmedAt: string | null;
    replacementBuyerConfirmedAt: string | null;
    replacementPackedAt: string | null;
    inventoryReconciledAt: string | null; replacementProductId: string | null;
    replacementProductName: string | null; refundProposalStatus: string;
    refundProposalReason: string | null; refundProposedAt: string | null;
    buyerRespondedAt: string | null;
  } | null;
  exchangeFeedback?: { rating: number; comment: string | null } | null;
  images: ReturnImageDTO[];
  dispute: DisputeDTO | null;
  refundStatus: 'NOT_ISSUED' | 'ISSUED';
  refundedAt: string | null;
  createdAt: string;
  decidedAt: string | null;
  // Populated only for admin detail reads (Task 5.2) — buyer/seller responses omit this.
  auditTrail?: AuditTrailEntryDTO[];
}

export interface ReturnListItemDTO {
  id: string;
  orderId: string;
  orderNumber?: string;
  productName?: string | null;
  productImage?: string | null;
  fulfillmentStatus?: string | null;
  status: ReturnStatus;
  reason: string;
  imageCount: number;
  createdAt: string;
}

export interface ReturnListDTO {
  items: ReturnListItemDTO[];
  nextCursor: string | null;
}
