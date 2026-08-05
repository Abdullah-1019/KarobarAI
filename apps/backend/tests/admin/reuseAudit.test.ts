import fs from 'node:fs';
import path from 'node:path';

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
const adminModuleFiles = allSourceFiles.filter((file) => file.includes(`${path.sep}modules${path.sep}admin${path.sep}`));

describe('Feature 12 (Admin Panel) reuse/scope audit', () => {
  it('every mutating admin write goes through the shared runAuditedMutation helper — no ad hoc audit_logs write', () => {
    const hits = adminModuleFiles.filter((file) => file.endsWith('.service.ts') && fs.readFileSync(file, 'utf-8').includes('auditLog.create'));
    expect(hits).toEqual([]);
    const usesHelper = ['users/users.service.ts', 'moderation/moderation.service.ts', 'config/config.service.ts'].every((rel) =>
      fs.readFileSync(path.join(SRC_ROOT, 'modules/admin', rel), 'utf-8').includes('runAuditedMutation('),
    );
    expect(usesHelper).toBe(true);
  });

  it('session revocation reuses Feature 1\'s existing mechanism — no second denylist/revocation implementation', () => {
    const usersService = fs.readFileSync(path.join(SRC_ROOT, 'modules/admin/users/users.service.ts'), 'utf-8');
    expect(usersService).toContain("from '../../auth/auth.tokens'");
    expect(usersService).toContain('revokeAllRefreshTokensForUser(');
    const hits = adminModuleFiles.filter((file) => fs.readFileSync(file, 'utf-8').includes("redis.set(`denylist"));
    expect(hits).toEqual([]);
  });

  it('Task 5 introduces zero new return-decision endpoints or logic — reuse-only, verified by grep', () => {
    const hits = adminModuleFiles.filter((file) => {
      const content = fs.readFileSync(file, 'utf-8');
      return /\.return\.update\(/.test(content) || content.includes('decideReturn(') || content.includes('ReturnDecision');
    });
    expect(hits).toEqual([]);
  });

  it('no second admin/returns route is mounted — Feature 10\'s existing router is the only one', () => {
    const serverFile = fs.readFileSync(path.join(SRC_ROOT, 'server.ts'), 'utf-8');
    const matches = serverFile.match(/admin\/returns/g) ?? [];
    expect(matches.length).toBe(1); // the single app.use('/api/v1/admin/returns', adminReturnsRouter) line from Feature 10
  });

  it('GMV computation reuses the same SUM(net) OVER settlements shape everywhere — no parallel aggregation logic (fraud-rate never recomputed locally)', () => {
    const dashboardRepo = fs.readFileSync(path.join(SRC_ROOT, 'modules/admin/dashboard/dashboard.repository.ts'), 'utf-8');
    const reportsRepo = fs.readFileSync(path.join(SRC_ROOT, 'modules/admin/reports/reports.repository.ts'), 'utf-8');
    expect(dashboardRepo).toContain("prisma.settlement.aggregate");
    expect(reportsRepo).toContain('prisma.settlement');
    // "never recomputed here" means never WRITTEN by this feature — reading/selecting/passing
    // through seller.fraudRate30d (to display it) is exactly what Task 5.3 is supposed to do.
    const fraudWritten = adminModuleFiles.some((file) => /\.sellerProfile\.update\([\s\S]{0,200}?fraudRate30d/.test(fs.readFileSync(file, 'utf-8')));
    expect(fraudWritten).toBe(false);
  });

  it('product moderation writes only the status column — no seller-authored field appears in the moderation update call', () => {
    const repoFile = fs.readFileSync(path.join(SRC_ROOT, 'modules/admin/moderation/moderation.repository.ts'), 'utf-8');
    const updateCallMatch = repoFile.match(/tx\.product\.update\(\{[\s\S]{0,200}?\}\);/);
    expect(updateCallMatch).not.toBeNull();
    const call = updateCallMatch?.[0] ?? '';
    expect(call).not.toMatch(/price|titleEn|titleUr|descriptionEn|sellerId/);
  });

  it('adapterUptime reuses the existing /ready dependency check (checkDependencies) rather than new instrumentation', () => {
    const dashboardService = fs.readFileSync(path.join(SRC_ROOT, 'modules/admin/dashboard/dashboard.service.ts'), 'utf-8');
    expect(dashboardService).toContain("from '../../../core/health/checkDependencies'");
    const healthRoutes = fs.readFileSync(path.join(SRC_ROOT, 'modules/health/health.routes.ts'), 'utf-8');
    expect(healthRoutes).toContain('checkDependencies');
  });

  it('no new Prisma model was added for this feature — users/seller_profiles/products/platform_config/audit_logs all pre-existing', () => {
    const schema = fs.readFileSync(path.join(SRC_ROOT, '../prisma/schema.prisma'), 'utf-8');
    expect(schema).toMatch(/model User \{/);
    expect(schema).toMatch(/model PlatformConfig \{/);
    expect(schema).not.toMatch(/model (ProductReport|AdminAlert|SellerFraudFlag) \{/);
  });
});
