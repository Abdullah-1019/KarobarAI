import { readFileSync, readdirSync } from 'fs';
import path from 'path';

import dotenv from 'dotenv';

import { catalog } from './store-catalog-data';

// Creates the 5 demo stores and their products from the photos in apps/stores/<Store name>/
// (data in ./store-catalog-data.ts), then staggers createdAt across stores so the home feed is
// mixed. Idempotent: existing stores are updated in place (city,
// banner, description) and existing products (same store + English title) are skipped, so it is
// safe to re-run. Image keys are deterministic, so a re-run overwrites the same objects.
//
// Runs from the host without Docker, against the DATABASE_URL and Neon object storage in the root
// .env (the same mapping infra/docker-compose.shared.yml gives the API):
//   cd apps/backend && pnpm exec ts-node --transpile-only prisma/seed-store-catalog.ts
// Product embeddings (AI search / store chatbot) are not created here; they need Ollama:
//   scripts/backfill-product-embeddings.ts inside the api container.
const REPO_ROOT = path.resolve(__dirname, '../../..');
dotenv.config({ path: path.join(REPO_ROOT, '.env') });
const env = process.env;
if (env.AWS_ENDPOINT_URL_S3 && !env.MINIO_ENDPOINT) {
  env.MINIO_ENDPOINT = env.AWS_ENDPOINT_URL_S3;
  env.S3_PUBLIC_BASE_URL ||= env.AWS_ENDPOINT_URL_S3;
  env.S3_ACCESS_KEY_ID ||= env.AWS_ACCESS_KEY_ID;
  env.S3_SECRET_ACCESS_KEY ||= env.AWS_SECRET_ACCESS_KEY;
  env.S3_REGION ||= env.AWS_REGION;
  env.MINIO_BUCKET ||= 'karobarai-media';
  env.S3_BUCKET = '';
}

const PHOTOS = path.join(REPO_ROOT, 'apps', 'stores');
const PASSWORD = 'Seller@123';

function sniff(buffer: Buffer): { type: string; ext: string } {
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return { type: 'image/jpeg', ext: 'jpg' };
  if (buffer.subarray(0, 4).toString('hex') === '89504e47') return { type: 'image/png', ext: 'png' };
  if (buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP') {
    return { type: 'image/webp', ext: 'webp' };
  }
  throw new Error('Unsupported image format');
}

function keyName(file: string): string {
  return path
    .parse(file)
    .name.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function main() {
  const { PrismaClient } = await import('@prisma/client');
  const bcrypt = (await import('bcrypt')).default;
  const { getStorageAdapter } = await import('../src/adapters/storage');
  const { config } = await import('../src/core/config');
  const { blindIndex, encryptField, normalizeEmail } = await import('../src/core/crypto/fieldCipher');

  const prisma = new PrismaClient();
  const storage = getStorageAdapter();
  const categoryIds = new Map<string, bigint>();
  const category = async (slug: string) => {
    if (!categoryIds.has(slug)) {
      categoryIds.set(slug, (await prisma.category.findUniqueOrThrow({ where: { slug } })).categoryId);
    }
    return categoryIds.get(slug)!;
  };

  async function upload(folder: string, file: string, keyPrefix: string): Promise<string> {
    const buffer = readFileSync(path.join(PHOTOS, folder, file));
    const { type, ext } = sniff(buffer);
    const { url } = await storage.upload({ key: `${keyPrefix}/${keyName(file)}.${ext}`, buffer, contentType: type });
    return url;
  }

  try {
    const passwordHash = await bcrypt.hash(PASSWORD, config.bcryptCost);
    let newStores = 0;
    let newProducts = 0;
    let skipped = 0;

    // Check every photo before writing anything, so a bad file can't leave a half-seeded store.
    for (const store of catalog) {
      const files = new Set(readdirSync(path.join(PHOTOS, store.folder)));
      for (const file of [store.banner, ...store.products.map((product) => product.file)]) {
        if (!files.has(file)) throw new Error(`${store.name}: photo not found: ${file}`);
        sniff(readFileSync(path.join(PHOTOS, store.folder, file)));
      }
    }

    for (const store of catalog) {
      const bannerUrl = await upload(store.folder, store.banner, `store-banners/catalog/${store.slug}`);
      const storeCategoryId = await category(store.category);
      const profile = {
        storeName: store.name,
        storeDescription: store.descEn,
        storeDescriptionUr: store.descUr,
        storeCategoryId,
        city: store.city,
        socialLinks: store.social,
        bannerUrl,
        onboardingStep: 3,
      };

      let seller = await prisma.sellerProfile.findUnique({ where: { storeSlug: store.slug } });
      if (seller) {
        seller = await prisma.sellerProfile.update({ where: { userId: seller.userId }, data: profile });
      } else {
        const email = normalizeEmail(store.email);
        const emailBidx = blindIndex(email);
        if (await prisma.user.findFirst({ where: { emailBidx } })) {
          throw new Error(`${store.name}: ${store.email} already belongs to another account`);
        }
        seller = await prisma.$transaction(async (tx) => {
          const user = await tx.user.create({
            data: {
              email: encryptField(email),
              emailBidx,
              passwordHash,
              role: 'SELLER',
              status: 'ACTIVE',
              preferredLanguage: 'EN',
            },
          });
          return tx.sellerProfile.create({
            data: { ...profile, userId: user.userId, storeSlug: store.slug, onboardingCompletedAt: new Date() },
          });
        });
        newStores++;
      }

      for (const product of store.products) {
        const exists = await prisma.product.findFirst({
          where: { sellerId: seller.userId, titleEn: product.en, deletedAt: null },
        });
        if (exists) {
          skipped++;
          continue;
        }
        const cdnUrl = await upload(store.folder, product.file, `products/catalog/${store.slug}`);
        await prisma.product.create({
          data: {
            sellerId: seller.userId,
            categoryId: await category(product.category ?? store.productCategory),
            titleEn: product.en,
            titleUr: product.ur,
            descriptionEn: product.descEn,
            descriptionUr: product.descUr,
            price: product.price,
            stock: product.stock,
            status: 'LIVE',
            condition: 'NEW',
            tags: product.tags,
            images: { create: [{ cdnUrl, position: 0 }] },
          },
        });
        newProducts++;
      }
      console.log(`  ${store.name} (${store.email}): ${store.products.length} products checked`);
    }

    // The home feed is "most recent LIVE products", so products created store by store would fill
    // it with whichever store was seeded last. Stagger createdAt round-robin across the stores
    // (fashion, kitchen, tech, beauty, sports, fashion, …) so the newest 12 are a real mix.
    const sellers = await prisma.sellerProfile.findMany({
      where: { storeSlug: { in: catalog.map((store) => store.slug) } },
      select: { userId: true, storeSlug: true },
    });
    const perStore = await Promise.all(
      catalog.map(async (store) => {
        const seller = sellers.find((s) => s.storeSlug === store.slug)!;
        const rows = await prisma.product.findMany({
          where: { sellerId: seller.userId, deletedAt: null, titleEn: { in: store.products.map((product) => product.en) } },
          select: { productId: true, titleEn: true },
        });
        const order = new Map(store.products.map((product, index) => [product.en, index]));
        return rows.sort((x, y) => order.get(x.titleEn)! - order.get(y.titleEn)!);
      }),
    );
    const now = Date.now();
    let rank = 0;
    for (let round = 0; perStore.some((rows) => rows.length > round); round++) {
      for (const rows of perStore) {
        const row = rows[round];
        if (!row) continue;
        await prisma.product.update({
          where: { productId: row.productId },
          data: { createdAt: new Date(now - rank * 7 * 60_000) },
        });
        rank++;
      }
    }

    console.log(`Created ${newStores} stores and ${newProducts} products (${skipped} already existed). Seller password: ${PASSWORD}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
