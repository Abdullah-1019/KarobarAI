import type { AddressDTO } from '@karobarai/shared';
import type { Address } from '@prisma/client';

import { decryptField, encryptField } from '../../core/crypto/fieldCipher';
import { BusinessRuleError, ForbiddenError, NotFoundError } from '../../core/errors/AppError';
import { prisma } from '../../core/prisma';
import type { CreateAddressInput, UpdateAddressInput } from './address.dto';

// Feature 6 Task 5 — this feature's first claim on the addresses table (Schema §4.4); no
// address.repository.ts, consistent with the no-repository-layer convention already established
// in catalog (Feature 4). line1/line2/contact_phone are encrypted at rest (Schema §4.4 notes) —
// reuses the exact field-encryption helper built in Feature 1, never a second implementation.

function toAddressDTO(address: Address): AddressDTO {
  return {
    id: address.addressId.toString(),
    label: address.label,
    recipientName: address.recipientName,
    line1: decryptField(address.line1),
    line2: address.line2 ? decryptField(address.line2) : null,
    city: address.city,
    province: address.province,
    postalCode: address.postalCode,
    contactPhone: address.contactPhone ? decryptField(address.contactPhone) : null,
    isDefault: address.isDefault,
  };
}

export async function listAddresses(buyerId: bigint): Promise<AddressDTO[]> {
  const rows = await prisma.address.findMany({
    where: { buyerId, deletedAt: null },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  });
  return rows.map(toAddressDTO);
}

// A buyer's very first address auto-becomes their default (a genuinely new behavior this
// feature introduces) — explicitly changing which *existing* address is default remains
// Feature 2's PATCH /profile/me/default-address (its own transactional unset-old/set-new swap),
// not duplicated here.
export async function createAddress(buyerId: bigint, input: CreateAddressInput): Promise<AddressDTO> {
  const existingCount = await prisma.address.count({ where: { buyerId, deletedAt: null } });
  const isFirstAddress = existingCount === 0;

  const address = await prisma.$transaction(async (tx) => {
    const created = await tx.address.create({
      data: {
        buyerId,
        label: input.label ?? null,
        recipientName: input.recipientName,
        line1: encryptField(input.line1),
        line2: input.line2 ? encryptField(input.line2) : null,
        city: input.city,
        province: input.province,
        postalCode: input.postalCode ?? null,
        contactPhone: input.contactPhone ? encryptField(input.contactPhone) : null,
        isDefault: isFirstAddress,
      },
    });
    if (isFirstAddress) {
      await tx.buyerProfile.update({
        where: { userId: buyerId },
        data: { defaultAddressId: created.addressId },
      });
    }
    return created;
  });

  return toAddressDTO(address);
}

async function loadOwnedAddress(buyerId: bigint, addressId: bigint): Promise<Address> {
  const address = await prisma.address.findUnique({ where: { addressId } });
  if (!address || address.deletedAt) {
    throw new NotFoundError('Address not found', undefined, 'ADDRESS_NOT_FOUND');
  }
  if (address.buyerId !== buyerId) {
    throw new ForbiddenError('This address does not belong to you', undefined, 'ADDRESS_NOT_OWNED');
  }
  return address;
}

export async function updateAddress(
  buyerId: bigint,
  addressId: bigint,
  input: UpdateAddressInput,
): Promise<AddressDTO> {
  await loadOwnedAddress(buyerId, addressId);

  const updated = await prisma.address.update({
    where: { addressId },
    data: {
      ...(input.label !== undefined && { label: input.label }),
      ...(input.recipientName !== undefined && { recipientName: input.recipientName }),
      ...(input.line1 !== undefined && { line1: encryptField(input.line1) }),
      ...(input.line2 !== undefined && { line2: input.line2 ? encryptField(input.line2) : null }),
      ...(input.city !== undefined && { city: input.city }),
      ...(input.province !== undefined && { province: input.province }),
      ...(input.postalCode !== undefined && { postalCode: input.postalCode }),
      ...(input.contactPhone !== undefined && {
        contactPhone: input.contactPhone ? encryptField(input.contactPhone) : null,
      }),
    },
  });

  return toAddressDTO(updated);
}

// Task 5.4 — deleting a buyer's only address is blocked with a clear message, per App Flow
// SCR-B12's edge case, rather than silently leaving zero addresses.
export async function deleteAddress(buyerId: bigint, addressId: bigint): Promise<void> {
  await loadOwnedAddress(buyerId, addressId);

  const remainingCount = await prisma.address.count({ where: { buyerId, deletedAt: null } });
  if (remainingCount <= 1) {
    throw new BusinessRuleError(
      'Add a replacement address before deleting your last one',
      undefined,
      'LAST_ADDRESS_CANNOT_BE_DELETED',
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.address.update({ where: { addressId }, data: { deletedAt: new Date() } });
    // If this was the buyer's default, clear the pointer rather than auto-promoting another
    // address — an unrequested default change would be a surprising side effect of a delete.
    await tx.buyerProfile.updateMany({
      where: { userId: buyerId, defaultAddressId: addressId },
      data: { defaultAddressId: null },
    });
  });
}

// Consumed by checkout.service.ts (modules/order, Task 7) for the orders.ship_* snapshot fields
// — returns decrypted values since they're being copied into another encrypted-at-rest column,
// not displayed raw; re-encryption happens on the order side, not here.
export async function getOwnedAddressForOrder(
  buyerId: bigint,
  addressId: bigint,
): Promise<{
  recipientName: string;
  line1: string;
  line2: string | null;
  city: string;
  province: string;
  postalCode: string | null;
  contactPhone: string | null;
}> {
  const address = await loadOwnedAddress(buyerId, addressId);
  return {
    recipientName: address.recipientName,
    line1: decryptField(address.line1),
    line2: address.line2 ? decryptField(address.line2) : null,
    city: address.city,
    province: address.province,
    postalCode: address.postalCode,
    contactPhone: address.contactPhone ? decryptField(address.contactPhone) : null,
  };
}
