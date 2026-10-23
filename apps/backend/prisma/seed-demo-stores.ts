import { readFileSync } from 'fs';
import path from 'path';

import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

import { getStorageAdapter } from '../src/adapters/storage';
import { config } from '../src/core/config';
import { blindIndex, encryptField, normalizeEmail } from '../src/core/crypto/fieldCipher';

// Development/demo fixture: 5 realistic stores with 20 bilingual products and real photos
// (see prisma/demo-assets/ATTRIBUTION.md). Idempotent: existing stores/products are skipped.
// Run inside the api container:
//   docker exec karobarai-api-1 sh -c "cd /workspace/apps/backend && pnpm exec ts-node --transpile-only prisma/seed-demo-stores.ts"
const prisma = new PrismaClient();
const storage = getStorageAdapter();
const ASSETS = path.join(__dirname, 'demo-assets');
const PASSWORD = 'Seller@123';

type Product = {
  en: string; ur: string; descEn: string; descUr: string;
  price: number; stock: number; category: string; tags: string[]; images: string[];
};
type Store = {
  name: string; slug: string; email: string; category: string;
  descEn: string; descUr: string; social: Record<string, string>; banner: string; products: Product[];
};

const stores: Store[] = [
  {
    name: 'Zainab Fashion House', slug: 'zainab-fashion-house', email: 'zainab.fashion@karobarai.pk', category: 'fashion-clothing',
    descEn: 'Home-based clothing store from Faisalabad offering unstitched lawn, chiffon dupattas, kurtas and winter shawls at fair prices.',
    descUr: 'فیصل آباد سے گھریلو کپڑوں کا اسٹور جہاں ان سلی لان، شیفون دوپٹے، کرتے اور سردیوں کی شالیں مناسب قیمت پر دستیاب ہیں۔',
    social: { instagram: 'https://www.instagram.com/zainabfashionhouse', facebook: 'https://www.facebook.com/zainabfashionhouse' },
    banner: 'lawn-suit-1.jpg',
    products: [
      { en: 'Embroidered Lawn 3-Piece Suit (Unstitched)', ur: 'کڑھائی والا لان تھری پیس سوٹ (ان سلا)',
        descEn: 'Unstitched 3-piece lawn suit with embroidered front, printed back and sleeves, and a chiffon dupatta. Shirt 3 m, trouser 2.5 m.',
        descUr: 'ان سلا تھری پیس لان سوٹ، کڑھائی والا فرنٹ، پرنٹڈ بیک اور آستینیں، ساتھ شیفون دوپٹہ۔ قمیض 3 میٹر، شلوار 2.5 میٹر۔',
        price: 4850, stock: 12, category: 'clothing', tags: ['lawn', 'unstitched', 'summer', 'embroidered'], images: ['lawn-suit-1.jpg'] },
      { en: 'Printed Chiffon Dupatta', ur: 'پرنٹڈ شیفون دوپٹہ',
        descEn: 'Soft printed chiffon dupatta, approx. 2.5 m long. Light and flowy, pairs well with plain suits.',
        descUr: 'نرم پرنٹڈ شیفون دوپٹہ، تقریباً 2.5 میٹر لمبا۔ ہلکا پھلکا اور سادہ سوٹ کے ساتھ خوبصورت لگتا ہے۔',
        price: 1450, stock: 25, category: 'clothing', tags: ['dupatta', 'chiffon', 'printed'], images: ['chiffon-dupatta-1.jpg', 'chiffon-dupatta-2.jpg'] },
      { en: "Men's White Cotton Kurta", ur: 'مردانہ سفید کاٹن کرتا',
        descEn: 'Stitched white cotton kurta with light embroidery on the collar. Breathable fabric for daily and Friday wear. Sizes S to XL.',
        descUr: 'سفید کاٹن کا سلا ہوا کرتا، کالر پر ہلکی کڑھائی۔ روزمرہ اور جمعہ کے لیے آرام دہ کپڑا۔ سائز S سے XL۔',
        price: 2650, stock: 15, category: 'clothing', tags: ['kurta', 'men', 'cotton'], images: ['mens-kurta-1.jpg'] },
      { en: 'Kashmiri Embroidered Shawl', ur: 'کشمیری کڑھائی والی شال',
        descEn: 'Warm wool-blend shawl with colourful hand-style floral embroidery. Approx. 2.2 m x 1 m. Ideal for winter weddings.',
        descUr: 'رنگین پھولدار کڑھائی والی گرم اونی شال، تقریباً 2.2 میٹر بائی 1 میٹر۔ سردیوں کی شادیوں کے لیے بہترین۔',
        price: 6500, stock: 6, category: 'clothing', tags: ['shawl', 'winter', 'kashmiri'], images: ['kashmiri-shawl-1.jpg', 'kashmiri-shawl-2.jpg'] },
    ],
  },
  {
    name: 'Lahore Kitchen Mart', slug: 'lahore-kitchen-mart', email: 'kitchen.mart@karobarai.pk', category: 'home-kitchen',
    descEn: 'Quality cookware and crockery from Lahore. Pressure cookers, pans, tea sets and dinner sets for every Pakistani kitchen.',
    descUr: 'لاہور سے معیاری کچن کا سامان۔ پریشر ککر، فرائی پین، ٹی سیٹ اور ڈنر سیٹ ہر پاکستانی کچن کے لیے۔',
    social: { facebook: 'https://www.facebook.com/lahorekitchenmart', website: 'https://lahorekitchenmart.pk' },
    banner: 'dinner-plates-1.jpg',
    products: [
      { en: 'Floral Bone China Tea Set (15 Pieces)', ur: 'پھولدار بون چائنا ٹی سیٹ (15 پیس)',
        descEn: 'Elegant floral tea set with 6 cups, 6 saucers, teapot, milk jug and sugar pot. Perfect for guests.',
        descUr: 'خوبصورت پھولدار ٹی سیٹ: 6 کپ، 6 پرچ، چائے دانی، دودھ دان اور چینی دان۔ مہمانوں کے لیے بہترین۔',
        price: 5900, stock: 8, category: 'home-kitchen', tags: ['tea set', 'crockery', 'bone china'], images: ['floral-tea-set-1.jpg'] },
      { en: 'Stainless Steel Pressure Cooker - 7 Litre', ur: 'اسٹین لیس اسٹیل پریشر ککر - 7 لیٹر',
        descEn: 'Heavy-gauge stainless steel pressure cooker with safety valve and locking lid. Cooks meat and lentils in half the time.',
        descUr: 'موٹے اسٹین لیس اسٹیل کا پریشر ککر، سیفٹی والو اور لاکنگ ڈھکن کے ساتھ۔ گوشت اور دالیں آدھے وقت میں تیار۔',
        price: 7800, stock: 10, category: 'home-kitchen', tags: ['pressure cooker', 'cookware'], images: ['pressure-cooker-1.jpg', 'pressure-cooker-2.jpg'] },
      { en: 'Cast Iron Frying Pan - 26 cm', ur: 'کاسٹ آئرن فرائی پین - 26 سینٹی میٹر',
        descEn: 'Pre-seasoned cast iron pan that holds heat evenly. Great for parathas, eggs and shallow frying. Lasts for years.',
        descUr: 'پہلے سے تیار شدہ کاسٹ آئرن پین جو گرمی برابر رکھتا ہے۔ پراٹھے، انڈے اور تلنے کے لیے بہترین۔ سالوں چلتا ہے۔',
        price: 3450, stock: 14, category: 'home-kitchen', tags: ['frying pan', 'cast iron'], images: ['cast-iron-pan-1.jpg', 'cast-iron-pan-2.jpg'] },
      { en: 'White Dinner Plate Set - 12 Pieces', ur: 'سفید ڈنر پلیٹ سیٹ - 12 پیس',
        descEn: 'Set of 6 full plates and 6 quarter plates in durable white ceramic with a dark rim. Microwave safe.',
        descUr: '6 بڑی اور 6 چھوٹی پلیٹوں کا سیٹ، مضبوط سفید سرامک اور گہرے کنارے کے ساتھ۔ مائیکروویو میں استعمال کے قابل۔',
        price: 4200, stock: 9, category: 'home-kitchen', tags: ['dinner set', 'plates', 'ceramic'], images: ['dinner-plates-1.jpg'] },
    ],
  },
  {
    name: 'TechZone Karachi', slug: 'techzone-karachi', email: 'techzone.khi@karobarai.pk', category: 'electronics',
    descEn: 'Trusted gadget shop from Karachi with original earbuds, power banks, smart watches and speakers. Checked before dispatch.',
    descUr: 'کراچی کی قابلِ اعتماد گیجٹ شاپ جہاں اصلی ایئربڈز، پاور بینک، اسمارٹ واچ اور اسپیکر دستیاب ہیں۔ بھیجنے سے پہلے چیک کیے جاتے ہیں۔',
    social: { instagram: 'https://www.instagram.com/techzonekarachi', youtube: 'https://www.youtube.com/@techzonekarachi' },
    banner: 'wireless-earbuds-1.jpg',
    products: [
      { en: 'Wireless Earbuds with Charging Case', ur: 'وائرلیس ایئربڈز چارجنگ کیس کے ساتھ',
        descEn: 'Bluetooth 5.3 earbuds with touch controls, clear calls and up to 24 hours total playback with the case. USB-C charging.',
        descUr: 'بلوٹوتھ 5.3 ایئربڈز، ٹچ کنٹرول، صاف کالز اور کیس کے ساتھ 24 گھنٹے تک چلنے والے۔ USB-C چارجنگ۔',
        price: 5499, stock: 20, category: 'mobile-accessories', tags: ['earbuds', 'bluetooth', 'wireless'], images: ['wireless-earbuds-1.jpg', 'wireless-earbuds-2.jpg'] },
      { en: 'Power Bank 10000 mAh - Fast Charging', ur: 'پاور بینک 10000 mAh - فاسٹ چارجنگ',
        descEn: 'Slim 10000 mAh power bank with 20 W fast charging, USB-C and USB-A ports. Charges most phones two times.',
        descUr: 'پتلا 10000 mAh پاور بینک، 20 واٹ فاسٹ چارجنگ، USB-C اور USB-A پورٹس۔ زیادہ تر فون دو بار چارج کرتا ہے۔',
        price: 4299, stock: 18, category: 'mobile-accessories', tags: ['power bank', 'charging'], images: ['power-bank-1.jpg', 'power-bank-2.jpg'] },
      { en: 'Smart Watch with Heart Rate Monitor', ur: 'اسمارٹ واچ ہارٹ ریٹ مانیٹر کے ساتھ',
        descEn: 'Smart watch with call and message alerts, step counter, heart rate and sleep tracking. Up to 5 days battery.',
        descUr: 'کال اور میسج الرٹ، قدم گننے، دل کی دھڑکن اور نیند ٹریک کرنے والی اسمارٹ واچ۔ 5 دن تک بیٹری۔',
        price: 8999, stock: 7, category: 'electronics', tags: ['smart watch', 'fitness'], images: ['smart-watch-1.jpg', 'smart-watch-2.jpg'] },
      { en: 'Portable Bluetooth Speaker - Waterproof', ur: 'پورٹیبل بلوٹوتھ اسپیکر - واٹر پروف',
        descEn: 'Compact waterproof speaker with deep bass and 12 hours of playback. Easy to carry for picnics and travel.',
        descUr: 'چھوٹا واٹر پروف اسپیکر، گہری بیس اور 12 گھنٹے تک چلنے والا۔ پکنک اور سفر کے لیے آسانی سے ساتھ لے جائیں۔',
        price: 6750, stock: 11, category: 'electronics', tags: ['speaker', 'bluetooth', 'waterproof'], images: ['bluetooth-speaker-1.jpg'] },
    ],
  },
  {
    name: 'Glow Beauty by Hira', slug: 'glow-beauty-by-hira', email: 'glow.hira@karobarai.pk', category: 'beauty-personal-care',
    descEn: 'Beauty and personal care store run by Hira from Islamabad. Lipsticks, serums, hair oils and nail colours that suit Pakistani skin.',
    descUr: 'اسلام آباد سے حرا کا بیوٹی اسٹور۔ لپ اسٹک، سیرم، ہیئر آئل اور نیل پالش جو پاکستانی جلد کے لیے موزوں ہیں۔',
    social: { instagram: 'https://www.instagram.com/glowbeautybyhira', tiktok: 'https://www.tiktok.com/@glowbeautybyhira' },
    banner: 'face-serum-1.jpg',
    products: [
      { en: 'Matte Lipstick Set - 3 Shades', ur: 'میٹ لپ اسٹک سیٹ - 3 رنگ',
        descEn: 'Long-lasting matte lipsticks in nude, rose and berry shades. Smooth, non-drying formula.',
        descUr: 'دیرپا میٹ لپ اسٹکس نیوڈ، روز اور بیری رنگوں میں۔ نرم فارمولا جو ہونٹ خشک نہیں کرتا۔',
        price: 2400, stock: 30, category: 'beauty-personal-care', tags: ['lipstick', 'matte', 'makeup'], images: ['lipstick-set-1.jpg'] },
      { en: 'Vitamin C Face Serum - 30 ml', ur: 'وٹامن سی فیس سیرم - 30 ملی لیٹر',
        descEn: 'Brightening vitamin C serum with hyaluronic acid. Helps reduce dullness and dark spots. Use in the morning before sunscreen.',
        descUr: 'ہائیلورونک ایسڈ کے ساتھ وٹامن سی سیرم جو چہرے کو نکھارتا اور داغ کم کرنے میں مدد دیتا ہے۔ صبح سن اسکرین سے پہلے لگائیں۔',
        price: 2950, stock: 22, category: 'beauty-personal-care', tags: ['serum', 'skincare', 'vitamin c'], images: ['face-serum-1.jpg', 'face-serum-2.jpg'] },
      { en: 'Organic Argan Hair Oil - 100 ml', ur: 'آرگینک آرگن ہیئر آئل - 100 ملی لیٹر',
        descEn: 'Pure argan oil for dry and frizzy hair. Adds shine and softness without making hair greasy.',
        descUr: 'خشک اور الجھے بالوں کے لیے خالص آرگن آئل۔ بالوں کو چکنا کیے بغیر چمک اور نرمی دیتا ہے۔',
        price: 1850, stock: 16, category: 'beauty-personal-care', tags: ['hair oil', 'argan', 'organic'], images: ['argan-hair-oil-1.jpg'] },
      { en: 'Gel Nail Polish - Cherry Red', ur: 'جیل نیل پالش - چیری ریڈ',
        descEn: 'High-shine cherry red nail polish with a gel finish. Quick drying and chip resistant for up to a week.',
        descUr: 'چمکدار چیری ریڈ جیل نیل پالش۔ جلدی سوکھتی ہے اور ایک ہفتے تک نہیں اترتی۔',
        price: 650, stock: 40, category: 'beauty-personal-care', tags: ['nail polish', 'red'], images: ['nail-polish-1.jpg'] },
    ],
  },
  {
    name: 'Sialkot Sports Hub', slug: 'sialkot-sports-hub', email: 'sports.hub@karobarai.pk', category: 'sports-outdoors',
    descEn: 'Sports goods straight from Sialkot. Hand-stitched footballs, cricket balls, rackets and fitness gear at factory prices.',
    descUr: 'سیالکوٹ سے براہِ راست کھیلوں کا سامان۔ ہاتھ سے سلے فٹبال، کرکٹ گیندیں، ریکٹ اور فٹنس کا سامان فیکٹری قیمت پر۔',
    social: { facebook: 'https://www.facebook.com/sialkotsportshub', instagram: 'https://www.instagram.com/sialkotsportshub' },
    banner: 'cricket-ball-1.jpg',
    products: [
      { en: 'Hand-Stitched Football - Size 5', ur: 'ہاتھ سے سلا فٹبال - سائز 5',
        descEn: 'Match-quality hand-stitched football made in Sialkot. Durable PU cover suitable for grass and ground play.',
        descUr: 'سیالکوٹ کا بنا ہاتھ سے سلا میچ کوالٹی فٹبال۔ مضبوط پی یو کور، گھاس اور گراؤنڈ دونوں کے لیے موزوں۔',
        price: 3200, stock: 25, category: 'sports-outdoors', tags: ['football', 'sialkot', 'hand stitched'], images: ['football-1.jpg'] },
      { en: 'Leather Hard Cricket Ball', ur: 'لیدر ہارڈ کرکٹ بال',
        descEn: 'Four-piece leather cricket ball with raised seam, for club and practice matches. Standard 156 g weight.',
        descUr: 'چار حصوں والی لیدر کرکٹ بال، ابھری ہوئی سلائی کے ساتھ، کلب اور پریکٹس میچز کے لیے۔ معیاری وزن 156 گرام۔',
        price: 1650, stock: 35, category: 'sports-outdoors', tags: ['cricket', 'ball', 'leather'], images: ['cricket-ball-1.jpg', 'cricket-ball-2.jpg'] },
      { en: 'Lightweight Badminton Racket', ur: 'ہلکا پھلکا بیڈمنٹن ریکٹ',
        descEn: 'Carbon-frame badminton racket weighing about 85 g, pre-strung with a cover included. Good for beginners and club players.',
        descUr: 'تقریباً 85 گرام وزنی کاربن فریم بیڈمنٹن ریکٹ، تار لگا ہوا اور کور کے ساتھ۔ نئے اور کلب کھلاڑیوں کے لیے بہترین۔',
        price: 2800, stock: 14, category: 'sports-outdoors', tags: ['badminton', 'racket'], images: ['badminton-racket-1.jpg', 'badminton-racket-2.jpg'] },
      { en: 'Adjustable Dumbbell Set - 10 kg', ur: 'ایڈجسٹ ایبل ڈمبل سیٹ - 10 کلو',
        descEn: 'Pair of adjustable dumbbells with removable plates totalling 10 kg. Ideal for home workouts.',
        descUr: 'ایڈجسٹ ایبل ڈمبلز کی جوڑی، اتارنے والی پلیٹوں کے ساتھ کل وزن 10 کلو۔ گھر پر ورزش کے لیے بہترین۔',
        price: 5600, stock: 9, category: 'sports-outdoors', tags: ['dumbbells', 'fitness', 'gym'], images: ['dumbbells-1.jpg', 'dumbbells-2.jpg'] },
    ],
  },
];

const uploaded = new Map<string, string>();
async function upload(file: string): Promise<string> {
  const cached = uploaded.get(file);
  if (cached) return cached;
  const { url } = await storage.upload({
    key: `products/demo/${file}`, buffer: readFileSync(path.join(ASSETS, file)), contentType: 'image/jpeg',
  });
  uploaded.set(file, url);
  return url;
}

async function category(slug: string) {
  return (await prisma.category.findUniqueOrThrow({ where: { slug } })).categoryId;
}

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, config.bcryptCost);
  let newStores = 0;
  let newProducts = 0;
  for (const store of stores) {
    let seller = await prisma.sellerProfile.findUnique({ where: { storeSlug: store.slug } });
    if (!seller) {
      const email = normalizeEmail(store.email);
      const banner = await upload(store.banner);
      const storeCategoryId = await category(store.category);
      seller = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({ data: {
          email: encryptField(email), emailBidx: blindIndex(email), passwordHash,
          role: 'SELLER', status: 'ACTIVE', preferredLanguage: 'EN',
        } });
        return tx.sellerProfile.create({ data: {
          userId: user.userId, storeName: store.name, storeSlug: store.slug,
          storeDescription: store.descEn, storeDescriptionUr: store.descUr, storeCategoryId,
          socialLinks: store.social, bannerUrl: banner,
          onboardingStep: 3, onboardingCompletedAt: new Date(),
        } });
      });
      newStores++;
    }
    for (const p of store.products) {
      const exists = await prisma.product.findFirst({ where: { sellerId: seller.userId, titleEn: p.en, deletedAt: null } });
      if (exists) continue;
      const urls = [];
      for (const img of p.images) urls.push(await upload(img));
      await prisma.product.create({ data: {
        sellerId: seller.userId, categoryId: await category(p.category),
        titleEn: p.en, titleUr: p.ur, descriptionEn: p.descEn, descriptionUr: p.descUr,
        price: p.price, stock: p.stock, status: 'LIVE', condition: 'NEW', tags: p.tags,
        images: { create: urls.map((cdnUrl, position) => ({ cdnUrl, position })) },
      } });
      newProducts++;
    }
  }
  console.log(`Created ${newStores} stores and ${newProducts} products. Seller password: ${PASSWORD}`);
  for (const s of stores) console.log(`  ${s.name}: ${s.email}`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
