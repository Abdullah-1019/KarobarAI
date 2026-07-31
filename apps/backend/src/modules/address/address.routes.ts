import { Router } from 'express';

import { authenticate } from '../../core/middleware/authenticate';
import { authorize } from '../../core/middleware/authorize';
import { validateBody } from '../../core/middleware/validate';
import {
  createAddressHandler,
  deleteAddressHandler,
  listAddressesHandler,
  updateAddressHandler,
} from './address.controller';
import { createAddressSchema, updateAddressSchema } from './address.dto';

// Buyer-only, mirrors cart's authenticate + authorize('BUYER') pattern exactly (Task 5.1).
export const addressRouter = Router();
addressRouter.use(authenticate, authorize('BUYER'));

/**
 * @swagger
 * /api/v1/addresses:
 *   get:
 *     summary: List the buyer's addresses (default first)
 *     tags: [Address]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: AddressDTO[]
 *   post:
 *     summary: Create an address — the buyer's first address auto-becomes their default
 *     tags: [Address]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               label: { type: string, nullable: true }
 *               line1: { type: string }
 *               line2: { type: string, nullable: true }
 *               city: { type: string }
 *               province: { type: string }
 *               postalCode: { type: string, nullable: true }
 *               contactPhone: { type: string, nullable: true }
 *     responses:
 *       201:
 *         description: Created AddressDTO
 */
addressRouter.get('/', listAddressesHandler);
addressRouter.post('/', validateBody(createAddressSchema), createAddressHandler);

/**
 * @swagger
 * /api/v1/addresses/{addressId}:
 *   patch:
 *     summary: Edit an address's fields (never toggles is_default — see PATCH /profile/me/default-address)
 *     tags: [Address]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Updated AddressDTO
 *       403:
 *         description: Address belongs to a different buyer (ADDRESS_NOT_OWNED)
 *   delete:
 *     summary: Soft-delete an address — blocked if it's the buyer's only remaining address
 *     tags: [Address]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: "{ deleted: true }"
 *       422:
 *         description: This is the buyer's last remaining address (LAST_ADDRESS_CANNOT_BE_DELETED)
 */
addressRouter.patch('/:addressId', validateBody(updateAddressSchema), updateAddressHandler);
addressRouter.delete('/:addressId', deleteAddressHandler);
