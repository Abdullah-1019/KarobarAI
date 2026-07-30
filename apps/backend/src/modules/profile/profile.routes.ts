import { Router } from 'express';
import multer from 'multer';

import { authenticate } from '../../core/middleware/authenticate';
import { authorize } from '../../core/middleware/authorize';
import { validateBody } from '../../core/middleware/validate';
import {
  changePasswordHandler,
  createStoreHandler,
  getMeHandler,
  getSettingsHandler,
  getStoreStatusHandler,
  removeAvatarHandler,
  removeStoreBannerHandler,
  removeStoreLogoHandler,
  setDefaultAddressHandler,
  updateSellerProfileHandler,
  updateSettingsHandler,
  uploadAvatarHandler,
  uploadStoreBannerHandler,
  uploadStoreLogoHandler,
} from './profile.controller';
import {
  changePasswordSchema,
  createStoreSchema,
  setDefaultAddressSchema,
  updateSellerProfileSchema,
  updateSettingsSchema,
} from './profile.dto';

// 10MB ceiling (profile.service.ts's AVATAR_MAX_BYTES) — rejected here by multer before the
// buffer is even fully read, not just re-checked in the service.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

export const profileRouter = Router();

// Every profile route is authenticated; all are inherently "self" routes (no :userId param is
// ever accepted from the client) — ownership is enforced by construction, except
// setDefaultAddress, which references another resource (an address) and is checked explicitly
// in profile.service.ts.
profileRouter.use(authenticate);

/**
 * @swagger
 * /api/v1/profile/me:
 *   get:
 *     summary: Get the authenticated user's own profile (role-branched response)
 *     tags: [Profile]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: BuyerProfileDTO, SellerProfileDTO, or AdminProfileDTO depending on role
 *       401:
 *         description: Missing/invalid/expired access token
 */
profileRouter.get('/me', getMeHandler);

/**
 * @swagger
 * /api/v1/profile/me:
 *   patch:
 *     summary: Update the seller's business-info fields (Seller only, requires completed onboarding)
 *     description: logoUrl/bannerUrl are NOT settable here — use POST /profile/me/store/logo and /banner instead (validated uploads, not arbitrary URLs).
 *     tags: [Profile]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               storeName: { type: string }
 *               storeDescription: { type: string, nullable: true }
 *     responses:
 *       200:
 *         description: Updated SellerProfileDTO
 *       403:
 *         description: Caller is not a Seller
 *       422:
 *         description: Store onboarding not yet completed (STORE_NOT_ONBOARDED)
 */
profileRouter.patch(
  '/me',
  authorize('SELLER'),
  validateBody(updateSellerProfileSchema),
  updateSellerProfileHandler,
);

/**
 * @swagger
 * /api/v1/profile/me/default-address:
 *   patch:
 *     summary: Set the buyer's default address (Buyer only) — transactional swap
 *     tags: [Profile]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               addressId: { type: string, description: BigInt address id as a numeric string }
 *     responses:
 *       200:
 *         description: Updated BuyerProfileDTO
 *       403:
 *         description: Caller is not a Buyer, or the address belongs to another buyer (ADDRESS_NOT_OWNED)
 *       404:
 *         description: Address does not exist (ADDRESS_NOT_FOUND)
 */
profileRouter.patch(
  '/me/default-address',
  authorize('BUYER'),
  validateBody(setDefaultAddressSchema),
  setDefaultAddressHandler,
);

// Feature 3 (Store Management) — store sub-routes. Tighter role gate than the rest of this
// router (Seller-only, not shared with Buyer/Admin): this feature extends the profile module
// rather than building a parallel store module (see profile.service.ts's Task 1.2 boundary note).

/**
 * @swagger
 * /api/v1/profile/me/store:
 *   post:
 *     summary: Complete store onboarding (the SCR-S00 wizard's "Finish" action) — Seller only
 *     description: >
 *       A seller_profiles row already exists as a placeholder from account activation; this
 *       completes it exactly once (guarded update, not an insert) and captures at least one
 *       payout wallet (encrypted at rest).
 *     tags: [Profile, Store]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               storeName: { type: string }
 *               storeDescription: { type: string, nullable: true }
 *               jazzcashAccountNumber: { type: string, description: At least one of jazzcash/easypaisa is required }
 *               easypaisaAccountNumber: { type: string }
 *     responses:
 *       201:
 *         description: SellerProfileDTO with hasStore now true
 *       409:
 *         description: Onboarding was already completed (ONBOARDING_ALREADY_COMPLETE)
 */
profileRouter.post('/me/store', authorize('SELLER'), validateBody(createStoreSchema), createStoreHandler);

/**
 * @swagger
 * /api/v1/profile/me/store/logo:
 *   post:
 *     summary: Upload/replace the store logo — Seller only, requires completed onboarding
 *     tags: [Profile, Store]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               logo: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Updated SellerProfileDTO with the new logoUrl
 *       422:
 *         description: Store onboarding not yet completed (STORE_NOT_ONBOARDED)
 */
profileRouter.post(
  '/me/store/logo',
  authorize('SELLER'),
  upload.single('logo'),
  uploadStoreLogoHandler,
);

/**
 * @swagger
 * /api/v1/profile/me/store/logo:
 *   delete:
 *     summary: Remove the store logo — Seller only, requires completed onboarding
 *     tags: [Profile, Store]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Updated SellerProfileDTO with logoUrl null
 */
profileRouter.delete('/me/store/logo', authorize('SELLER'), removeStoreLogoHandler);

/**
 * @swagger
 * /api/v1/profile/me/store/banner:
 *   post:
 *     summary: Upload/replace the store banner — Seller only, requires completed onboarding
 *     tags: [Profile, Store]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               banner: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Updated SellerProfileDTO with the new bannerUrl
 *       422:
 *         description: Store onboarding not yet completed (STORE_NOT_ONBOARDED)
 */
profileRouter.post(
  '/me/store/banner',
  authorize('SELLER'),
  upload.single('banner'),
  uploadStoreBannerHandler,
);

/**
 * @swagger
 * /api/v1/profile/me/store/banner:
 *   delete:
 *     summary: Remove the store banner — Seller only, requires completed onboarding
 *     tags: [Profile, Store]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Updated SellerProfileDTO with bannerUrl null
 */
profileRouter.delete('/me/store/banner', authorize('SELLER'), removeStoreBannerHandler);

/**
 * @swagger
 * /api/v1/profile/me/store/status:
 *   get:
 *     summary: Read-only store status, derived from users.status — Seller only
 *     description: There is no mutation endpoint for store status anywhere in this feature — status changes are Admin-only (a separate feature) and only ever read here.
 *     tags: [Profile, Store]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: "StoreStatusDTO: { status, since }"
 */
profileRouter.get('/me/store/status', authorize('SELLER'), getStoreStatusHandler);

/**
 * @swagger
 * /api/v1/profile/me/avatar:
 *   post:
 *     summary: Upload/replace the authenticated user's avatar
 *     tags: [Profile]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               avatar: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Updated profile with the new avatarUrl
 *       400:
 *         description: File too large (AVATAR_TOO_LARGE) or not a valid JPEG/PNG/WEBP (AVATAR_INVALID_FILE)
 */
profileRouter.post('/me/avatar', upload.single('avatar'), uploadAvatarHandler);

/**
 * @swagger
 * /api/v1/profile/me/avatar:
 *   delete:
 *     summary: Remove the authenticated user's avatar
 *     tags: [Profile]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Updated profile with avatarUrl null
 */
profileRouter.delete('/me/avatar', removeAvatarHandler);

/**
 * @swagger
 * /api/v1/profile/me/password:
 *   post:
 *     summary: Change password (re-auth required) — revokes every other session
 *     tags: [Profile]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               currentPassword: { type: string }
 *               newPassword: { type: string }
 *               confirmNewPassword: { type: string }
 *     responses:
 *       200:
 *         description: New access token + rotated refresh cookie for the current session only
 *       401:
 *         description: Current password incorrect (INVALID_CURRENT_PASSWORD)
 */
profileRouter.post('/me/password', validateBody(changePasswordSchema), changePasswordHandler);

/**
 * @swagger
 * /api/v1/profile/me/settings:
 *   get:
 *     summary: Get notification preferences + language
 *     tags: [Profile]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: AccountSettingsDTO
 */
profileRouter.get('/me/settings', getSettingsHandler);

/**
 * @swagger
 * /api/v1/profile/me/settings:
 *   patch:
 *     summary: Update notification preferences and/or language
 *     description: Critical channels (in-app, SMS) cannot be disabled — a direct API attempt is silently forced back to true, per REQ-F-Notif004.
 *     tags: [Profile]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               smsEnabled: { type: boolean }
 *               whatsappEnabled: { type: boolean }
 *               emailEnabled: { type: boolean }
 *               inappEnabled: { type: boolean }
 *               preferredLanguage: { type: string, enum: [EN, UR] }
 *     responses:
 *       200:
 *         description: Updated AccountSettingsDTO
 */
profileRouter.patch('/me/settings', validateBody(updateSettingsSchema), updateSettingsHandler);
