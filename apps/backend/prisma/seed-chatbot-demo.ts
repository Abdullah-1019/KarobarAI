import { PrismaClient } from '@prisma/client';

import { blindIndex, encryptField } from '../src/core/crypto/fieldCipher';

// Development fixture only. No model-generated copy, credentials, or destructive cleanup.
// Re-running creates missing rows and leaves existing demo products unchanged.
const prisma = new PrismaClient();
const marker = 'chatbot-demo-fixture-v1';

type Item = [name: string, description: string, price: number, stock: number];
type Store = { name: string; slug: string; category: string; items: Item[] };

const stores: Store[] = [
  { name: 'Afzal Fabrics', slug: 'demo-afzal-fabrics', category: 'fashion-clothing', items: [
    ['Cotton Lawn Fabric - Sky Blue', 'Unstitched sky blue cotton lawn fabric, 3 metres, suitable for a summer shirt.', 1450, 8],
    ['Printed Lawn Fabric - Floral', 'Unstitched floral print lawn fabric, 3 metres, for everyday wear.', 1650, 5],
    ['White Cotton Cambric', 'Plain white cotton cambric fabric, 2.5 metres, suitable for shirts.', 1200, 10],
    ['Navy Blue Khaddar', 'Unstitched navy blue khaddar fabric, 3 metres, for cooler weather.', 2100, 4],
    ['Beige Linen Blend', 'Beige linen blend fabric, 3 metres, with a plain weave.', 2300, 3],
    ['Black Wash and Wear Suit Fabric', 'Black wash and wear fabric, 4 metres, for a men’s suit.', 2800, 6],
    ['Pink Chiffon Dupatta', 'Pink chiffon dupatta with a plain border, approximately 2.5 metres long.', 950, 12],
    ['Maroon Jacquard Fabric', 'Maroon jacquard fabric, 3 metres, with a woven pattern.', 3200, 2],
    ['Grey Cotton Trouser Fabric', 'Plain grey cotton fabric, 2 metres, suitable for trousers.', 1100, 9],
    ['Olive Green Winter Shawl', 'Olive green woven winter shawl for everyday use.', 1750, 1],
  ] },
  { name: 'Ahmad Shoes', slug: 'demo-ahmad-shoes', category: 'fashion-clothing', items: [
    ['Men’s Black Lace-Up Shoes', 'Black lace-up shoes with a synthetic upper; sizes 40 to 44.', 4200, 5],
    ['Men’s Brown Casual Loafers', 'Brown slip-on loafers with a synthetic upper; sizes 40 to 44.', 3850, 4],
    ['Women’s White Sneakers', 'White low-top sneakers with laces; sizes 36 to 40.', 3600, 6],
    ['Women’s Tan Flat Sandals', 'Tan flat sandals with an adjustable ankle strap; sizes 36 to 40.', 2200, 7],
    ['Kids’ Blue School Shoes', 'Blue school shoes with hook-and-loop fastening; sizes 28 to 34.', 1950, 8],
    ['Men’s Grey Running Shoes', 'Grey lace-up sports shoes with a cushioned sole; sizes 40 to 44.', 4900, 3],
    ['Women’s Black Formal Heels', 'Black block-heel shoes with a closed toe; sizes 36 to 40.', 4350, 2],
    ['Men’s Leather-Look Peshawari Chappal', 'Brown leather-look Peshawari chappal; sizes 40 to 44.', 3100, 5],
    ['Kids’ Pink Canvas Shoes', 'Pink lace-up canvas shoes; sizes 28 to 34.', 1750, 9],
    ['Men’s Navy Slide Sandals', 'Navy open-toe slide sandals; sizes 40 to 44.', 1450, 1],
  ] },
  { name: 'Noor Home Essentials', slug: 'demo-noor-home', category: 'home-kitchen', items: [
    ['Ceramic Tea Mug - White', 'White ceramic mug with a 300 ml capacity.', 650, 12],
    ['Glass Water Jug - 1.5 L', 'Clear glass water jug with a 1.5 litre capacity.', 1350, 6],
    ['Cotton Cushion Cover - Beige', 'Beige cotton cushion cover, 45 by 45 cm; insert not included.', 850, 10],
    ['Stainless Steel Mixing Bowl', 'Stainless steel mixing bowl with a 2 litre capacity.', 1200, 7],
    ['Wooden Serving Tray', 'Rectangular wooden serving tray, 35 by 25 cm.', 1850, 3],
    ['Kitchen Towel Set - 3 Pack', 'Three cotton kitchen towels in assorted neutral colours.', 750, 11],
    ['Nonstick Frying Pan - 24 cm', '24 cm nonstick frying pan with a heat-resistant handle.', 2850, 4],
    ['Plastic Storage Box - 5 L', 'Lidded plastic storage box with a 5 litre capacity.', 950, 8],
    ['Cotton Table Runner - Blue', 'Blue cotton table runner, 150 by 35 cm.', 1250, 2],
    ['Bedside LED Lamp', 'Compact bedside lamp with an LED bulb and plug-in power.', 2450, 1],
  ] },
  { name: 'Bilal Electronics', slug: 'demo-bilal-electronics', category: 'electronics', items: [
    ['USB-C Charging Cable - 1 m', 'One-metre USB-C to USB-A charging cable.', 550, 15],
    ['Wireless Mouse - Black', 'Black wireless optical mouse with a USB receiver.', 1450, 8],
    ['Wired Keyboard - Full Size', 'Full-size wired keyboard with a USB connection.', 2250, 5],
    ['LED Desk Light', 'Adjustable LED desk light with USB power.', 1950, 6],
    ['Bluetooth Speaker - Mini', 'Small portable Bluetooth speaker with USB charging.', 3200, 4],
    ['USB Flash Drive - 32 GB', '32 GB USB flash drive for file storage.', 1750, 9],
    ['Laptop Sleeve - 14 Inch', 'Padded sleeve for laptops up to 14 inches.', 2100, 3],
    ['HDMI Cable - 2 m', 'Two-metre HDMI cable for compatible displays.', 850, 11],
    ['Wired Earphones - Black', 'Black in-ear wired earphones with a 3.5 mm connector.', 1050, 7],
    ['Power Strip - 4 Sockets', 'Four-socket power strip with a 1.5 metre cable.', 2350, 2],
  ] },
  { name: 'Sana Beauty Corner', slug: 'demo-sana-beauty', category: 'beauty-personal-care', items: [
    ['Aloe Vera Hand Cream - 100 ml', 'Aloe vera scented hand cream in a 100 ml tube.', 850, 10],
    ['Rose Water Face Mist - 120 ml', 'Rose water face mist in a 120 ml spray bottle.', 650, 8],
    ['Cotton Makeup Pads - 80 Pack', 'Pack of 80 round cotton makeup pads.', 390, 16],
    ['Lip Balm - Strawberry', 'Strawberry-scented lip balm in a twist-up tube.', 450, 12],
    ['Hair Brush - Paddle', 'Wide paddle hair brush with a plastic handle.', 1050, 7],
    ['Nail File Set - 4 Pack', 'Four reusable nail files in assorted colours.', 420, 9],
    ['Body Lotion - Unscented 250 ml', 'Unscented body lotion in a 250 ml bottle.', 1150, 5],
    ['Shampoo - Coconut 300 ml', 'Coconut-scented shampoo in a 300 ml bottle.', 1250, 6],
    ['Face Towel - Pink', 'Soft pink cotton face towel, 30 by 30 cm.', 380, 11],
    ['Travel Toiletry Pouch', 'Zip-close toiletry pouch with a wipe-clean lining.', 980, 2],
  ] },
  { name: 'Hamza Mobile Hub', slug: 'demo-hamza-mobile', category: 'mobile-accessories', items: [
    ['USB-C Wall Charger - 20 W', '20 W USB-C wall charger; cable sold separately.', 1950, 7],
    ['Phone Stand - Adjustable', 'Adjustable desktop phone stand with a folding base.', 850, 12],
    ['Tempered Glass Protector - 6.5 Inch', 'Clear tempered glass protector for compatible 6.5-inch screens.', 450, 14],
    ['USB-C to USB-C Cable - 1 m', 'One-metre USB-C to USB-C charging cable.', 750, 10],
    ['Car Phone Holder', 'Dashboard phone holder with an adjustable grip.', 1650, 5],
    ['Power Bank - 10000 mAh', 'Portable power bank with a stated 10000 mAh capacity.', 3900, 3],
    ['Wired USB-C Earbuds', 'In-ear wired earbuds with a USB-C connector.', 1350, 6],
    ['Phone Ring Grip - Silver', 'Adhesive silver ring grip for the back of a phone case.', 390, 15],
    ['MicroSD Card - 64 GB', '64 GB microSD memory card for compatible devices.', 2250, 4],
    ['Universal Phone Pouch', 'Zip-close fabric pouch for phones up to 6.7 inches.', 950, 1],
  ] },
  { name: 'Ayesha Books and Stationery', slug: 'demo-ayesha-books', category: 'books-stationery', items: [
    ['A5 Ruled Notebook - 100 Pages', 'A5 notebook with 100 ruled pages and a soft cover.', 320, 20],
    ['Blue Ballpoint Pens - 10 Pack', 'Pack of ten blue ink ballpoint pens.', 450, 18],
    ['HB Pencils - 12 Pack', 'Pack of twelve HB writing pencils.', 390, 15],
    ['Sticky Notes - Yellow', 'Yellow square sticky notes, 100 sheets.', 280, 14],
    ['Geometry Box - Metal', 'Metal geometry box with ruler, compass, and set squares.', 850, 8],
    ['A4 Drawing Pad - 30 Sheets', 'A4 drawing pad with 30 plain white sheets.', 550, 11],
    ['Highlighter Set - 4 Colours', 'Four chisel-tip highlighters in assorted colours.', 720, 9],
    ['Eraser and Sharpener Set', 'Two white erasers and one plastic pencil sharpener.', 180, 17],
    ['Hardcover Journal - Black', 'Black hardcover journal with 160 lined pages.', 1200, 5],
    ['Document Folder - A4', 'A4 plastic document folder with a snap closure.', 260, 2],
  ] },
  { name: 'Khan Sports Store', slug: 'demo-khan-sports', category: 'sports-outdoors', items: [
    ['Cricket Tennis Ball - Red', 'Red tennis ball for casual cricket practice.', 350, 15],
    ['Badminton Shuttlecocks - 6 Pack', 'Pack of six synthetic shuttlecocks for recreational play.', 950, 8],
    ['Skipping Rope - Adjustable', 'Adjustable skipping rope with plastic handles.', 650, 10],
    ['Yoga Mat - Blue', 'Blue exercise mat, approximately 6 mm thick.', 2250, 4],
    ['Water Bottle - 750 ml', 'Reusable plastic sports bottle with a 750 ml capacity.', 850, 12],
    ['Resistance Band - Medium', 'Medium-resistance elastic exercise band.', 1050, 7],
    ['Football - Size 5', 'Size 5 stitched football for recreational use.', 2950, 3],
    ['Cricket Bat Grip - Black', 'Black rubber replacement grip for a cricket bat handle.', 450, 9],
    ['Gym Towel - Grey', 'Grey cotton gym towel, 40 by 80 cm.', 620, 6],
    ['Sports Cap - Navy', 'Navy adjustable sports cap with a curved brim.', 1100, 1],
  ] },
  { name: 'Zara Grocery Mart', slug: 'demo-zara-grocery', category: 'grocery', items: [
    ['Basmati Rice - 1 kg', 'One-kilogram sealed pack of basmati rice.', 520, 12],
    ['Red Lentils - 1 kg', 'One-kilogram sealed pack of red lentils.', 430, 10],
    ['Chickpeas - 1 kg', 'One-kilogram sealed pack of dried chickpeas.', 460, 8],
    ['Black Tea - 250 g', '250 gram pack of loose black tea leaves.', 650, 11],
    ['White Sugar - 1 kg', 'One-kilogram pack of white granulated sugar.', 210, 15],
    ['Iodized Salt - 800 g', '800 gram pack of iodized table salt.', 120, 18],
    ['Cooking Oil - 1 L', 'One-litre bottle of cooking oil.', 580, 7],
    ['Cumin Seeds - 100 g', '100 gram sealed pack of whole cumin seeds.', 260, 9],
    ['Turmeric Powder - 100 g', '100 gram sealed pack of ground turmeric.', 190, 6],
    ['Oats - 500 g', '500 gram pack of plain rolled oats.', 470, 2],
  ] },
  { name: 'Raza Fashion Accessories', slug: 'demo-raza-accessories', category: 'fashion-clothing', items: [
    ['Canvas Tote Bag - Cream', 'Cream canvas tote bag with two shoulder straps.', 1250, 8],
    ['Cotton Scarf - Teal', 'Teal cotton scarf, approximately 180 by 70 cm.', 990, 6],
    ['Leather-Look Belt - Black', 'Black synthetic leather belt with a metal buckle.', 1450, 5],
    ['Sunglasses - Brown Frame', 'Brown-frame sunglasses with tinted plastic lenses.', 1750, 4],
    ['Hair Clips - 6 Pack', 'Pack of six small plastic hair clips.', 350, 12],
    ['Wallet - Navy', 'Navy synthetic leather bifold wallet with card slots.', 1600, 3],
    ['Embroidered Cap - Black', 'Black adjustable cap with simple front embroidery.', 1150, 7],
    ['Cotton Socks - 3 Pairs', 'Pack of three pairs of plain cotton blend socks.', 780, 11],
    ['Canvas Backpack - Grey', 'Grey canvas backpack with one main compartment.', 2850, 2],
    ['Wristwatch Strap - Brown', 'Brown synthetic replacement watch strap, 20 mm wide.', 890, 1],
  ] },
];

async function main() {
  const database = new URL(process.env.DATABASE_URL ?? '');
  if (!['localhost', '127.0.0.1'].includes(database.hostname) || database.pathname !== '/karobarai') {
    throw new Error('Demo seed requires the local karobarai development database');
  }

  let createdStores = 0;
  let createdProducts = 0;
  for (const store of stores) {
    const email = `${store.slug}@example.invalid`;
    const category = await prisma.category.findUnique({ where: { slug: store.category } });
    const existing = await prisma.sellerProfile.findUnique({ where: { storeSlug: store.slug } });
    if (existing && existing.storeDescription !== marker) {
      throw new Error(`Store slug ${store.slug} belongs to a non-demo record`);
    }
    if (!existing) {
      await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({ data: {
          email: encryptField(email), emailBidx: blindIndex(email), role: 'SELLER', status: 'ACTIVE', preferredLanguage: 'EN',
        } });
        await tx.sellerProfile.create({ data: {
          userId: user.userId, storeName: store.name, storeSlug: store.slug,
          storeDescription: marker, onboardingStep: 3, onboardingCompletedAt: new Date(),
        } });
      });
      createdStores++;
    }
    const seller = await prisma.sellerProfile.findUniqueOrThrow({ where: { storeSlug: store.slug } });
    for (const [name, description, price, stock] of store.items) {
      const found = await prisma.product.findFirst({ where: { sellerId: seller.userId, titleEn: name, deletedAt: null } });
      if (found) continue;
      await prisma.product.create({ data: {
        sellerId: seller.userId, categoryId: category?.categoryId, titleEn: name,
        descriptionEn: description, price, stock, status: 'LIVE', condition: 'NEW',
        tags: [marker, store.category], aiGenerated: false,
      } });
      createdProducts++;
    }
  }
  console.log(`Created ${createdStores} demo stores and ${createdProducts} manually described demo products.`);
  const results = await prisma.sellerProfile.findMany({
    where: { storeDescription: marker }, select: { storeName: true, storeSlug: true, _count: { select: { products: true } } }, orderBy: { storeSlug: 'asc' },
  });
  for (const row of results) console.log(`${row.storeName} / ${row.storeSlug}: ${row._count.products} products`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
