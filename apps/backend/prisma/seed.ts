import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// §4.25 platform_config seed keys — admin-tunable business parameters (SRS §5.5: never hardcode).
const platformConfig = [
  {
    configKey: 'commission_rate_default',
    value: 0.05,
    description: 'Default platform commission rate applied to new sellers (per-seller override in seller_profiles.commission_rate).',
  },
  {
    configKey: 'courier_weights',
    value: { cost: 0.4, time: 0.3, reliability: 0.2, coverage: 0.1 },
    description: 'Weighted scoring factors for automatic courier selection (TRD §3 Strategy pattern).',
  },
  {
    configKey: 'return_window_days',
    value: 14,
    description: 'Number of days after delivery a buyer may initiate a return.',
  },
  {
    configKey: 'min_order_value_pkr',
    value: 100,
    description: 'Minimum order subtotal (PKR) enforced at checkout.',
  },
  {
    configKey: 'returns_confidence_threshold',
    value: 0.85,
    description: 'ReturnsAI confidence floor (D3) — below this, a return is routed to manual review.',
  },
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
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
