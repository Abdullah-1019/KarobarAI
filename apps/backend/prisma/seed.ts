// KarobarAI — Prisma seed.
//
// Two independent blocks:
//   1. Reference data (platform_config + starter categories) — always seeded.
//   2. Demo catalogue (one seller + 16 products + placeholder images) — DEVELOPMENT ONLY, guarded
//      by NODE_ENV, so a production `prisma db seed` never injects fake listings. Images point at
//      the frontend's own /public/demo/products/*.svg placeholders (served at the web origin), and
//      every product's description says "demo listing" so seeded rows are never mistaken for real.
//
// Idempotent: platform_config/categories upsert on their natural keys, products upsert on a fixed
// publicId, and a product's images are replaced each run.
import {
  Language,
  PrismaClient,
  ProductCondition,
  ProductStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';

const prisma = new PrismaClient();

const platformConfig = [
  { configKey: 'commission_rate_default', value: 0.05, description: 'Default seller commission rate' },
  { configKey: 'courier_weights', value: { cost: 0.4, time: 0.3, reliability: 0.2, coverage: 0.1 }, description: 'Courier ranking weights (must sum to 1.0)' },
  { configKey: 'return_window_days', value: 14, description: 'Buyer return window after delivery (days)' },
  { configKey: 'min_order_value_pkr', value: 100, description: 'Minimum order subtotal (PKR)' },
  { configKey: 'returns_confidence_threshold', value: 0.85, description: 'AI returns auto-approval confidence threshold (read-only, R1.1)' },
];

// Starter category set (bilingual EN/UR, flat — no parent categories yet).
const categories = [
  { slug: 'electronics', nameEn: 'Electronics', nameUr: 'الیکٹرانکس' },
  { slug: 'fashion-clothing', nameEn: 'Fashion & Clothing', nameUr: 'فیشن اور ملبوسات' },
  { slug: 'home-kitchen', nameEn: 'Home & Kitchen', nameUr: 'گھر اور کچن' },
  { slug: 'beauty-personal-care', nameEn: 'Beauty & Personal Care', nameUr: 'خوبصورتی اور ذاتی نگہداشت' },
  { slug: 'mobile-accessories', nameEn: 'Mobile & Accessories', nameUr: 'موبائل اور لوازمات' },
  { slug: 'grocery', nameEn: 'Grocery', nameUr: 'گروسری' },
  { slug: 'books-stationery', nameEn: 'Books & Stationery', nameUr: 'کتابیں اور اسٹیشنری' },
  { slug: 'sports-outdoors', nameEn: 'Sports & Outdoors', nameUr: 'کھیل اور آؤٹ ڈور' },
];

interface DemoProduct {
  publicId: string;
  categorySlug: string;
  titleEn: string;
  titleUr: string;
  price: number;
  stock: number;
  condition: ProductCondition;
  aiGenerated: boolean;
  /** Days before "now" the product was listed — staggers the NEW badge (14-day window). */
  createdDaysAgo: number;
}

// 16 products across the 8 categories; two per category. One (the screen protector) is seeded with
// zero stock so the out-of-stock card state is visible without manual edits.
const demoProducts: DemoProduct[] = [
  { publicId: 'd3000000-0000-4000-8000-000000000001', categorySlug: 'electronics', titleEn: 'Wireless Earbuds Pro', titleUr: 'وائرلیس ائیر بڈز پرو', price: 3999, stock: 25, condition: ProductCondition.NEW, aiGenerated: true, createdDaysAgo: 1 },
  { publicId: 'd3000000-0000-4000-8000-000000000002', categorySlug: 'electronics', titleEn: '1080p Security Camera', titleUr: '1080p سیکیورٹی کیمرہ', price: 5499, stock: 12, condition: ProductCondition.NEW, aiGenerated: false, createdDaysAgo: 45 },
  { publicId: 'd3000000-0000-4000-8000-000000000003', categorySlug: 'fashion-clothing', titleEn: 'Hand-Embroidered Cotton Kurta', titleUr: 'ہاتھ سے کڑھائی والا سوتی کرتا', price: 2450, stock: 18, condition: ProductCondition.NEW, aiGenerated: true, createdDaysAgo: 3 },
  { publicId: 'd3000000-0000-4000-8000-000000000004', categorySlug: 'fashion-clothing', titleEn: 'Embroidered Lawn Dupatta', titleUr: 'کڑھائی والا لان دوپٹہ', price: 1800, stock: 30, condition: ProductCondition.NEW, aiGenerated: false, createdDaysAgo: 60 },
  { publicId: 'd3000000-0000-4000-8000-000000000005', categorySlug: 'home-kitchen', titleEn: 'Stainless Steel Pressure Cooker 5L', titleUr: 'اسٹینلیس اسٹیل پریشر ککر 5 لیٹر', price: 3200, stock: 9, condition: ProductCondition.NEW, aiGenerated: false, createdDaysAgo: 6 },
  { publicId: 'd3000000-0000-4000-8000-000000000006', categorySlug: 'home-kitchen', titleEn: 'Non-Stick Frying Pan Set', titleUr: 'نان اسٹک فرائینگ پین سیٹ', price: 2750, stock: 14, condition: ProductCondition.LIKE_NEW, aiGenerated: false, createdDaysAgo: 90 },
  { publicId: 'd3000000-0000-4000-8000-000000000007', categorySlug: 'beauty-personal-care', titleEn: 'Vitamin C Face Serum', titleUr: 'وٹامن سی فیس سیرم', price: 1250, stock: 40, condition: ProductCondition.NEW, aiGenerated: true, createdDaysAgo: 2 },
  { publicId: 'd3000000-0000-4000-8000-000000000008', categorySlug: 'beauty-personal-care', titleEn: 'Argan Hair Oil 100ml', titleUr: 'آرگن ہیئر آئل 100ml', price: 899, stock: 55, condition: ProductCondition.NEW, aiGenerated: false, createdDaysAgo: 75 },
  { publicId: 'd3000000-0000-4000-8000-000000000009', categorySlug: 'mobile-accessories', titleEn: 'Fast Charge Power Bank 10000mAh', titleUr: 'فاسٹ چارج پاور بینک 10000mAh', price: 2299, stock: 22, condition: ProductCondition.NEW, aiGenerated: false, createdDaysAgo: 8 },
  { publicId: 'd3000000-0000-4000-8000-000000000010', categorySlug: 'mobile-accessories', titleEn: 'Tempered Glass Screen Protector', titleUr: 'ٹیمپرڈ گلاس اسکرین پروٹیکٹر', price: 399, stock: 0, condition: ProductCondition.NEW, aiGenerated: false, createdDaysAgo: 30 },
  { publicId: 'd3000000-0000-4000-8000-000000000011', categorySlug: 'grocery', titleEn: 'Premium Basmati Rice 5kg', titleUr: 'پریمیم باسمتی چاول 5 کلو', price: 1899, stock: 60, condition: ProductCondition.NEW, aiGenerated: true, createdDaysAgo: 4 },
  { publicId: 'd3000000-0000-4000-8000-000000000013', categorySlug: 'books-stationery', titleEn: 'Urdu Poetry Collection', titleUr: 'اردو شاعری کا مجموعہ', price: 650, stock: 35, condition: ProductCondition.NEW, aiGenerated: false, createdDaysAgo: 10 },
  { publicId: 'd3000000-0000-4000-8000-000000000012', categorySlug: 'grocery', titleEn: 'Organic Himalayan Pink Salt 1kg', titleUr: 'آرگینک ہمالیائی گلابی نمک 1 کلو', price: 349, stock: 80, condition: ProductCondition.NEW, aiGenerated: false, createdDaysAgo: 120 },
  { publicId: 'd3000000-0000-4000-8000-000000000014', categorySlug: 'books-stationery', titleEn: 'A5 Dotted Notebook Set of 3', titleUr: 'A5 ڈاٹڈ نوٹ بک سیٹ (3 عدد)', price: 550, stock: 48, condition: ProductCondition.NEW, aiGenerated: false, createdDaysAgo: 20 },
  { publicId: 'd3000000-0000-4000-8000-000000000015', categorySlug: 'sports-outdoors', titleEn: 'Match Football Size 5', titleUr: 'میچ فٹبال سائز 5', price: 1450, stock: 16, condition: ProductCondition.NEW, aiGenerated: true, createdDaysAgo: 5 },
  { publicId: 'd3000000-0000-4000-8000-000000000016', categorySlug: 'sports-outdoors', titleEn: 'Yoga Mat 6mm', titleUr: 'یوگا میٹ 6mm', price: 1199, stock: 26, condition: ProductCondition.NEW, aiGenerated: false, createdDaysAgo: 55 },
];

async function seedDemoCatalogue() {
  const seller = await prisma.user.upsert({
    where: { publicId: 'd1000000-0000-4000-8000-000000000001' },
    update: {},
    create: {
      publicId: 'd1000000-0000-4000-8000-000000000001',
      email: 'demo-seller@karobarai.local',
      emailBidx: 'demo-seller@karobarai.local',
      role: UserRole.SELLER,
      status: UserStatus.ACTIVE,
      preferredLanguage: Language.UR,
    },
  });

  await prisma.sellerProfile.upsert({
    where: { userId: seller.userId },
    update: { storeName: 'KarobarAI Demo Store' },
    create: {
      userId: seller.userId,
      storeName: 'KarobarAI Demo Store',
      storeDescription: 'Demo store seeded for local development — not a real seller.',
      onboardingCompletedAt: new Date(),
    },
  });

  for (const product of demoProducts) {
    const category = await prisma.category.findUnique({ where: { slug: product.categorySlug } });
    const createdAt = new Date(Date.now() - product.createdDaysAgo * 24 * 60 * 60 * 1000);

    const saved = await prisma.product.upsert({
      where: { publicId: product.publicId },
      update: {
        categoryId: category?.categoryId ?? null,
        titleEn: product.titleEn,
        titleUr: product.titleUr,
        price: product.price,
        stock: product.stock,
        condition: product.condition,
        status: ProductStatus.LIVE,
        aiGenerated: product.aiGenerated,
        createdAt,
      },
      create: {
        publicId: product.publicId,
        sellerId: seller.userId,
        categoryId: category?.categoryId ?? null,
        titleEn: product.titleEn,
        titleUr: product.titleUr,
        descriptionEn: `${product.titleEn} — demo listing seeded for local development.`,
        descriptionUr: `${product.titleUr} — مقامی ترقی کے لیے ڈیمو لسٹنگ۔`,
        price: product.price,
        stock: product.stock,
        condition: product.condition,
        status: ProductStatus.LIVE,
        aiGenerated: product.aiGenerated,
        createdAt,
      },
    });

    await prisma.productImage.deleteMany({ where: { productId: saved.productId } });
    await prisma.productImage.create({
      data: { productId: saved.productId, cdnUrl: `/demo/products/${product.categorySlug}.svg`, position: 0 },
    });
  }

  console.log(`Seeded 1 demo seller + ${demoProducts.length} demo products (development only).`);
}

async function main() {
  for (const config of platformConfig) {
    await prisma.platformConfig.upsert({
      where: { configKey: config.configKey },
      update: { value: config.value, description: config.description },
      create: config,
    });
  }

  for (const category of categories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: { nameEn: category.nameEn, nameUr: category.nameUr },
      create: category,
    });
  }

  console.log(`Seeded ${platformConfig.length} platform_config keys and ${categories.length} categories.`);

  if (process.env.NODE_ENV !== 'production') {
    await seedDemoCatalogue();
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
