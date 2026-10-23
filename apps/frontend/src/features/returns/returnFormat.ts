import type { TFunction } from 'i18next';
import type { ReturnListItemDTO } from '@karobarai/shared';

// Reason codes are stored as the code itself, or "OTHER: <buyer text>".
export function reasonLabel(t: TFunction, reason: string): string {
  return reason.startsWith('OTHER: ')
    ? `${t('returns:reasons.OTHER')}: ${reason.slice(7)}`
    : t(`returns:reasons.${reason}`, { defaultValue: reason });
}

const SELLER_STATUSES = new Set(['MANUAL_REVIEW', 'UNDER_DISPUTE']);
const SELLER_FULFILLMENT = new Set(['AWAITING_SELLER_RECEIPT', 'REPLACEMENT_PENDING', 'REPLACEMENT_PACKED']);

/** Returns waiting on the seller: a decision, an appeal, or the next exchange step. */
export function needsSeller(item: Pick<ReturnListItemDTO, 'status' | 'fulfillmentStatus'>): boolean {
  return SELLER_STATUSES.has(item.status) || (!!item.fulfillmentStatus && SELLER_FULFILLMENT.has(item.fulfillmentStatus));
}
