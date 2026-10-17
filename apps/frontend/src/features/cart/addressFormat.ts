import type { AddressDTO } from '@karobarai/shared';

// One line for an address, used by the checkout cards, step summary and confirmation.
export function formatAddress(address: AddressDTO): string {
  return [address.line1, address.line2, address.city, address.province].filter(Boolean).join(', ');
}
