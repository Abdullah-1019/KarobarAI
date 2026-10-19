import { NotFoundError } from '../../core/errors/AppError';
import { prisma } from '../../core/prisma';
import * as cartService from '../cart/cart.service';
import { publicSocialLinks } from '../profile/store-social-links';

export interface BuyerStoreContext {
  storeId: bigint;
  store: {
    slug: string;
    publicId: string;
    name: string;
    description: string | null;
    descriptionUr: string | null;
    logoUrl: string | null;
    bannerUrl: string | null;
    category: { id: string; slug: string; nameEn: string; nameUr: string } | null;
    city: string | null;
    memberSince: string;
    socialLinks: ReturnType<typeof publicSocialLinks>;
    policies: { returns: null; shipping: null; payment: null };
  };
  cart: Awaited<ReturnType<typeof cartService.getCart>> | null;
}

async function findPublicStore(storeSlug: string) {
  const seller = await prisma.sellerProfile.findUnique({
    where: { storeSlug },
    include: { storeCategory: true, user: { select: { publicId: true, status: true, role: true, deletedAt: true } } },
  });
  if (
    !seller ||
    seller.deletedAt ||
    !seller.onboardingCompletedAt ||
    seller.user.status !== 'ACTIVE' || seller.user.role !== 'SELLER' || seller.user.deletedAt
  ) {
    throw new NotFoundError('Store not found', undefined, 'STORE_NOT_FOUND');
  }
  return seller;
}

function toPublicStore(seller: Awaited<ReturnType<typeof findPublicStore>>) {
  return {
    slug: seller.storeSlug,
    publicId: seller.user.publicId,
    name: seller.storeName,
    description: seller.storeDescription,
    descriptionUr: seller.storeDescriptionUr,
    logoUrl: seller.logoUrl,
    bannerUrl: seller.bannerUrl,
    category: seller.storeCategory ? {
      id: seller.storeCategory.categoryId.toString(),
      slug: seller.storeCategory.slug,
      nameEn: seller.storeCategory.nameEn,
      nameUr: seller.storeCategory.nameUr,
    } : null,
    city: seller.city,
    memberSince: seller.createdAt.toISOString(),
    socialLinks: publicSocialLinks(seller.socialLinks),
    // The current seller profile schema has no store-specific policy fields. Null means
    // "not provided" and tools must state that, never infer marketplace policy.
    policies: { returns: null, shipping: null, payment: null } as const,
  };
}

export async function resolveBuyerStore(storeSlug: string) {
  const seller = await findPublicStore(storeSlug);
  return { storeId: seller.userId, store: toPublicStore(seller) };
}

export async function buildBuyerContext(storeSlug: string, buyerUserId?: bigint): Promise<BuyerStoreContext> {
  const seller = await findPublicStore(storeSlug);
  const cart = buyerUserId ? await cartService.getCart(buyerUserId) : null;
  return {
    storeId: seller.userId,
    store: toPublicStore(seller),
    // CartService returns all seller groups; only this store's group is exposed to its agent.
    cart: cart
      ? { ...cart, sellerGroups: cart.sellerGroups.filter((group) => group.sellerId === seller.user.publicId) }
      : null,
  };
}

export async function getPublicStorefront(storeSlug: string) {
  const seller = await findPublicStore(storeSlug);
  const products = await prisma.product.findMany({
    where: { sellerId: seller.userId, status: 'LIVE', deletedAt: null },
    orderBy: [{ createdAt: 'desc' }, { productId: 'desc' }],
    take: 24,
    include: {
      category: { select: { slug: true, nameEn: true, nameUr: true } },
      images: { where: { position: 0 }, take: 1, select: { cdnUrl: true } },
    },
  });
  return {
    store: toPublicStore(seller),
    products: products.map((product) => ({
      id: product.publicId,
      titleEn: product.titleEn,
      titleUr: product.titleUr,
      descriptionEn: product.descriptionEn,
      descriptionUr: product.descriptionUr,
      price: product.price.toString(),
      stock: product.stock,
      imageUrl: product.images[0]?.cdnUrl ?? null,
      category: product.category,
    })),
  };
}

export async function getStoreForLiveProduct(productPublicId: string) {
  const product = await prisma.product.findFirst({
    where: { publicId: productPublicId, status: 'LIVE', deletedAt: null },
    select: { seller: { select: { storeSlug: true, storeName: true, deletedAt: true, onboardingCompletedAt: true, user: { select: { status: true } } } } },
  });
  if (!product || product.seller.deletedAt || !product.seller.onboardingCompletedAt || product.seller.user.status !== 'ACTIVE') {
    throw new NotFoundError('Store not found', undefined, 'STORE_NOT_FOUND');
  }
  return { slug: product.seller.storeSlug, name: product.seller.storeName };
}
