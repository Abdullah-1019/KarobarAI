import { NotFoundError } from '../../core/errors/AppError';
import { prisma } from '../../core/prisma';

export interface SellerAssistantContext {
  sellerId: bigint;
  storeName: string;
}

/** The caller must pass req.sellerContext.userId, resolved by requireActiveSeller. */
export async function buildSellerContext(sellerId: bigint): Promise<SellerAssistantContext> {
  const seller = await prisma.sellerProfile.findUnique({
    where: { userId: sellerId },
    select: { userId: true, storeName: true, deletedAt: true, onboardingCompletedAt: true },
  });
  if (!seller || seller.deletedAt || !seller.onboardingCompletedAt) {
    throw new NotFoundError('Seller store not found', undefined, 'SELLER_STORE_NOT_FOUND');
  }
  return { sellerId: seller.userId, storeName: seller.storeName };
}
