import fs from 'node:fs';
import path from 'node:path';

// Task 8's Validation & Testing "Regression" row — a deliberate grep pass, matching the
// discipline established in Features 5/6/7/8/9/10.

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
const analyticsModuleFiles = allSourceFiles.filter((file) => file.includes(`${path.sep}modules${path.sep}analytics${path.sep}`));

describe('Feature 11 reuse/scope audit', () => {
  it('the analytics module never writes to orders/order_items/settlements/products/categories — read-only by construction', () => {
    const writePatterns = [
      /\.order\.(create|update|updateMany|delete|deleteMany|upsert)\(/,
      /\.orderItem\.(create|update|updateMany|delete|deleteMany|upsert)\(/,
      /\.settlement\.(create|update|updateMany|delete|deleteMany|upsert)\(/,
      /\.product\.(create|update|updateMany|delete|deleteMany|upsert)\(/,
      /\.category\.(create|update|updateMany|delete|deleteMany|upsert)\(/,
    ];
    const hits = analyticsModuleFiles.filter((file) => {
      const content = fs.readFileSync(file, 'utf-8');
      return writePatterns.some((pattern) => pattern.test(content));
    });
    expect(hits).toEqual([]);
  });

  it('no class-based repository was introduced — plain exported functions only, consistent with every other module', () => {
    const repoFile = analyticsModuleFiles.find((file) => file.endsWith('analytics.repository.ts'));
    expect(repoFile).toBeDefined();
    const content = fs.readFileSync(repoFile as string, 'utf-8');
    expect(content).not.toMatch(/class\s+\w*Repository/);
  });

  it('no seller_daily_stats/seller_recommendations write exists — Task 3\'s daily trend is computed live from orders, not a pre-aggregation job (deliberately deferred, see handoff doc)', () => {
    const hits = analyticsModuleFiles.filter((file) => {
      const content = fs.readFileSync(file, 'utf-8');
      return content.includes('.sellerDailyStat.') || content.includes('.sellerRecommendation.');
    });
    expect(hits).toEqual([]);
  });

  it('caching is TTL-based only — no event-driven cache-bust hook was added to any other feature\'s files', () => {
    const otherFeatureDirs = ['order', 'tracking', 'returns', 'notification'];
    for (const dir of otherFeatureDirs) {
      const files = allSourceFiles.filter((file) => file.includes(`${path.sep}modules${path.sep}${dir}${path.sep}`));
      const hits = files.filter((file) => fs.readFileSync(file, 'utf-8').includes('analytics.cache'));
      expect(hits).toEqual([]);
    }
  });

  it('every metric endpoint goes through the shared getOrCompute cache helper — no metric bypasses caching ad hoc', () => {
    const serviceFile = analyticsModuleFiles.find((file) => file.endsWith('analytics.service.ts'));
    const content = fs.readFileSync(serviceFile as string, 'utf-8');
    const getOrComputeCalls = content.match(/getOrCompute\(/g) ?? [];
    expect(getOrComputeCalls.length).toBe(6); // revenue, sales-trend, category-breakdown, orders, customers, top-products
  });

  it('no new Prisma model was added for this feature — settlements/orders/products/categories already existed', () => {
    const schema = fs.readFileSync(path.join(SRC_ROOT, '../prisma/schema.prisma'), 'utf-8');
    expect(schema).toMatch(/model Settlement \{/);
    expect(schema).not.toMatch(/model (AnalyticsSnapshot|SellerKpi|RevenueLedger) \{/);
  });
});
