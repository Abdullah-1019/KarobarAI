import fs from 'node:fs';
import path from 'node:path';

// Task 8.8 — a deliberate grep pass, not a recollection, matching the discipline established in
// Features 5/6/7/8/9.

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
const returnsModuleFiles = allSourceFiles.filter((file) => file.includes(`${path.sep}modules${path.sep}returns${path.sep}`));

describe('Feature 10 reuse/scope audit (Task 8.8)', () => {
  it('transitionReturnStatus is the only place in the returns module that writes returns.status', () => {
    const hits = returnsModuleFiles.filter((file) => {
      if (file.endsWith('returns.repository.ts') || file.endsWith('returns.service.ts')) return false;
      return /\.return\.update\(\{[\s\S]{0,300}?status\s*:/.test(fs.readFileSync(file, 'utf-8'));
    });
    expect(hits).toEqual([]);
  });

  it('no direct payments/settlements table write exists anywhere in the returns module (Task 6 — refunds only via PaymentAdapter)', () => {
    const hits = returnsModuleFiles.filter((file) => {
      const content = fs.readFileSync(file, 'utf-8');
      return content.includes('.payment.update') || content.includes('.settlement.update') || content.includes('.settlement.create');
    });
    expect(hits).toEqual([]);
  });

  it('no second CourierAdapter/PaymentAdapter/SmsAdapter/EmailAdapter implementation exists — the returns module only imports the existing factories', () => {
    const adapterDirs = ['courier', 'payment', 'sms', 'email'];
    for (const dir of adapterDirs) {
      const files = allSourceFiles.filter((file) => file.includes(`${path.sep}adapters${path.sep}${dir}${path.sep}`));
      expect(new Set(files.map((f) => path.basename(f)))).toEqual(new Set(['index.ts', 'mock.ts', 'live.ts']));
    }
  });

  it('the returns module only writes audit_logs through core/audit\'s createAuditLog, never a raw prisma.auditLog.create', () => {
    const hits = returnsModuleFiles.filter((file) => fs.readFileSync(file, 'utf-8').includes('auditLog.create'));
    expect(hits).toEqual([]);
    const usesHelper = returnsModuleFiles.some((file) => fs.readFileSync(file, 'utf-8').includes('createAuditLog('));
    expect(usesHelper).toBe(true);
  });

  it('seller and admin decision endpoints share the same underlying decideReturn() function (Task 5\'s Engineering Decision — no duplicated approval logic)', () => {
    const sellerService = fs.readFileSync(path.join(SRC_ROOT, 'modules/returns/seller/seller.service.ts'), 'utf-8');
    const adminService = fs.readFileSync(path.join(SRC_ROOT, 'modules/returns/admin/admin.service.ts'), 'utf-8');
    expect(sellerService).toContain("from '../decision.service'");
    expect(adminService).toContain("from '../decision.service'");
    expect(sellerService).toContain('decideReturn(');
    expect(adminService).toContain('decideReturn(');
  });

  it('no new Prisma model was added for this feature — returns/return_images/disputes already existed', () => {
    const schema = fs.readFileSync(path.join(SRC_ROOT, '../prisma/schema.prisma'), 'utf-8');
    expect(schema).toMatch(/model Return \{/);
    expect(schema).toMatch(/model ReturnImage /);
    expect(schema).toMatch(/model Dispute /);
    expect(schema).not.toMatch(/model (RefundRequest|ReturnAudit|CodRefundWallet) /);
  });

  it('the courier/payment adapter calls in decision.service.ts reuse the existing factories, not a bespoke booking/refund implementation', () => {
    const content = fs.readFileSync(path.join(SRC_ROOT, 'modules/returns/decision.service.ts'), 'utf-8');
    expect(content).toContain("from '../../adapters/courier'");
    expect(content).toContain("from '../../adapters/payment'");
    expect(content).toContain('getCourierAdapter()');
    expect(content).toContain('getPaymentAdapter()');
  });
});
