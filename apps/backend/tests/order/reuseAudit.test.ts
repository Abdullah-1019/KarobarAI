import fs from 'node:fs';
import path from 'node:path';

// Feature 7's module doc patch is explicit about what must NOT exist in this feature's codebase
// (Task 7's "Explicit confirmation" list, Task 9's correction). These are structural, not
// behavioral, guarantees — a static source scan is the right tool, not an HTTP/DB test.

const SRC_ROOT = path.join(__dirname, '../../src');

function listTsFiles(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return listTsFiles(fullPath);
    return entry.name.endsWith('.ts') ? [fullPath] : [];
  });
}

const allSourceFiles = listTsFiles(SRC_ROOT);
const orderServicePath = path.join(SRC_ROOT, 'modules/order/order.service.ts');

const FEATURE_7_OWN_FILES = [
  path.join(SRC_ROOT, 'modules/order/order.service.ts'),
  path.join(SRC_ROOT, 'modules/order/invoice.service.ts'),
  path.join(SRC_ROOT, 'modules/order/order.controller.ts'),
  path.join(SRC_ROOT, 'modules/order/order.routes.ts'),
];

describe('Feature 7 reuse/scope audit (module doc Task 7 patch + Task 9)', () => {
  // Feature 8 (Courier & Tracking) has since filled in modules/tracking/ for real, exactly as
  // Feature 7's own patch deferred it to — these checks were always about Feature 7's OWN files
  // never reaching into tracking/CourierAdapter/Socket.IO, never about those things not existing
  // anywhere in the codebase forever. Scoped accordingly (matching the CourierAdapter check below,
  // which was always correctly scoped this way).
  it('Feature 7\'s own files never import from modules/tracking or reference tracking.service', () => {
    const hits = FEATURE_7_OWN_FILES.filter((file) => {
      const content = fs.readFileSync(file, 'utf-8');
      return content.includes('modules/tracking') || content.includes('tracking.service');
    });
    expect(hits).toEqual([]);
  });

  it('Feature 7\'s own files never reference Socket.IO / the /tracking namespace', () => {
    const hits = FEATURE_7_OWN_FILES.filter((file) => {
      const content = fs.readFileSync(file, 'utf-8');
      return content.includes('socket.io') || content.includes('core/socket');
    });
    expect(hits).toEqual([]);
  });

  it('Feature 7\'s own new files (order.service.ts, invoice.service.ts) never call CourierAdapter', () => {
    // checkout.service.ts (Feature 6, pre-existing) legitimately calls getCourierAdapter() for
    // checkout-time shipping-fee estimation — that usage predates and is untouched by Feature 7;
    // only this feature's own additions are in scope for the "no courier adapter calls" rule.
    const feature7Files = [
      path.join(SRC_ROOT, 'modules/order/order.service.ts'),
      path.join(SRC_ROOT, 'modules/order/invoice.service.ts'),
      path.join(SRC_ROOT, 'modules/order/order.controller.ts'),
      path.join(SRC_ROOT, 'modules/order/order.routes.ts'),
    ];
    const hits = feature7Files.filter((file) => fs.readFileSync(file, 'utf-8').includes('CourierAdapter'));
    expect(hits).toEqual([]);
  });

  it('no courier_quotes / CourierQuote writes exist anywhere under modules/order', () => {
    const orderModuleFiles = allSourceFiles.filter((file) => file.includes(`${path.sep}modules${path.sep}order${path.sep}`));
    const hits = orderModuleFiles.filter((file) => {
      const content = fs.readFileSync(file, 'utf-8');
      return content.includes('courierQuote.create') || content.includes('courierQuote.update');
    });
    expect(hits).toEqual([]);
  });

  it('transitionOrderStatus is the only place in src/ that writes orders.status', () => {
    const hits = allSourceFiles.filter((file) => {
      if (file === orderServicePath) return false; // the one legitimate write site, checked separately below
      const content = fs.readFileSync(file, 'utf-8');
      // Matches Prisma `.order.update(`/`.order.updateMany(` calls whose data payload sets `status`.
      return /\.order\.(update|updateMany)\(\{[\s\S]{0,400}?status\s*:/m.test(content);
    });
    expect(hits).toEqual([]);
  });

  it('order.service.ts itself writes orders.status exactly once (inside transitionOrderStatus)', () => {
    const content = fs.readFileSync(orderServicePath, 'utf-8');
    const matches = content.match(/tx\.order\.update\(\{[\s\S]{0,200}?status:\s*targetStatus/g) ?? [];
    expect(matches).toHaveLength(1);
  });

  it('no invoices table/model was added — invoice.service.ts contains zero direct Prisma calls', () => {
    const invoiceServicePath = path.join(SRC_ROOT, 'modules/order/invoice.service.ts');
    const content = fs.readFileSync(invoiceServicePath, 'utf-8');
    expect(content).not.toMatch(/prisma\.\w+\.(find|create|update|delete)/);

    const schemaPath = path.join(SRC_ROOT, '../prisma/schema.prisma');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    expect(schema).not.toMatch(/model Invoice/);
  });

  it('order.service.ts reuses restoreStock from catalog.service rather than writing a second stock-increment', () => {
    const content = fs.readFileSync(orderServicePath, 'utf-8');
    const incrementSites = content.match(/stock:\s*\{\s*increment/g) ?? [];
    expect(incrementSites).toHaveLength(0); // the only increment lives inside catalog.service.ts's restoreStock
    expect(content).toContain("from '../catalog/catalog.service'");
  });
});
