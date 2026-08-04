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
  status: ReturnStatus;
  reason: string;
  decision: ReturnDecisionValue | null;
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
  status: ReturnStatus;
  reason: string;
  imageCount: number;
  createdAt: string;
}

export interface ReturnListDTO {
  items: ReturnListItemDTO[];
  nextCursor: string | null;
}
