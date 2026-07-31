import { asyncHandler } from '../../core/http/asyncHandler';
import { ok } from '../../core/http/envelope';
import { parseBigIntParam } from '../../core/http/parseBigIntParam';
import { resolveUserId } from '../../core/http/resolveUserId';
import * as addressService from './address.service';
import type { CreateAddressInput, UpdateAddressInput } from './address.dto';

export const listAddressesHandler = asyncHandler(async (req, res) => {
  const buyerId = await resolveUserId(req.user!.sub);
  const addresses = await addressService.listAddresses(buyerId);
  res.status(200).json(ok(addresses));
});

export const createAddressHandler = asyncHandler(async (req, res) => {
  const buyerId = await resolveUserId(req.user!.sub);
  const input = req.body as CreateAddressInput;
  const address = await addressService.createAddress(buyerId, input);
  res.status(201).json(ok(address));
});

export const updateAddressHandler = asyncHandler(async (req, res) => {
  const buyerId = await resolveUserId(req.user!.sub);
  const input = req.body as UpdateAddressInput;
  const addressId = parseBigIntParam(req.params.addressId, 'ADDRESS_NOT_FOUND');
  const address = await addressService.updateAddress(buyerId, addressId, input);
  res.status(200).json(ok(address));
});

export const deleteAddressHandler = asyncHandler(async (req, res) => {
  const buyerId = await resolveUserId(req.user!.sub);
  const addressId = parseBigIntParam(req.params.addressId, 'ADDRESS_NOT_FOUND');
  await addressService.deleteAddress(buyerId, addressId);
  res.status(200).json(ok({ deleted: true }));
});
