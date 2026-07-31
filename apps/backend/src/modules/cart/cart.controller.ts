import { asyncHandler } from '../../core/http/asyncHandler';
import { ok } from '../../core/http/envelope';
import { parseBigIntParam } from '../../core/http/parseBigIntParam';
import { resolveUserId } from '../../core/http/resolveUserId';
import * as cartService from './cart.service';
import type { AddCartItemInput, UpdateCartItemInput } from './cart.dto';

export const getCartHandler = asyncHandler(async (req, res) => {
  const buyerId = await resolveUserId(req.user!.sub);
  const cart = await cartService.getCart(buyerId);
  res.status(200).json(ok(cart));
});

export const addCartItemHandler = asyncHandler(async (req, res) => {
  const buyerId = await resolveUserId(req.user!.sub);
  const input = req.body as AddCartItemInput;
  const cart = await cartService.addCartItem(buyerId, input.productId, input.quantity);
  res.status(201).json(ok(cart));
});

export const updateCartItemHandler = asyncHandler(async (req, res) => {
  const buyerId = await resolveUserId(req.user!.sub);
  const input = req.body as UpdateCartItemInput;
  const itemId = parseBigIntParam(req.params.itemId, 'CART_ITEM_NOT_FOUND');
  const cart = await cartService.updateCartItemQuantity(buyerId, itemId, input.quantity);
  res.status(200).json(ok(cart));
});

export const removeCartItemHandler = asyncHandler(async (req, res) => {
  const buyerId = await resolveUserId(req.user!.sub);
  const itemId = parseBigIntParam(req.params.itemId, 'CART_ITEM_NOT_FOUND');
  const cart = await cartService.removeCartItem(buyerId, itemId);
  res.status(200).json(ok(cart));
});
