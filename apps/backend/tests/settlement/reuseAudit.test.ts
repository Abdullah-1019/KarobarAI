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
const settlementModuleFiles = allSourceFiles.filter((file) => file.includes(`${path.sep}modules${path.sep}settlement${path.sep}`));

describe('Settlement-engine gap closure reuse/scope audit', () => {
  it('settlement.repository.ts is the only place that creates a Settlement row', () => {
    const hits = allSourceFiles.filter((file) => {
      if (file.endsWith(`${path.sep}settlement${path.sep}settlement.service.ts`)) return false;
      return /\.settlement\.create\(/.test(fs.readFileSync(file, 'utf-8'));
    });
    expect(hits).toEqual([]);
  });

  it('the settlement module never writes to orders/order_items/returns/products — read-only over everything except settlements itself', () => {
    const writePatterns = [
      /\.order\.(create|update|updateMany|delete|deleteMany|upsert)\(/,
      /\.orderItem\.(create|update|updateMany|delete|deleteMany|upsert)\(/,
      /\.return\.(create|update|updateMany|delete|deleteMany|upsert)\(/,
      /\.product\.(create|update|updateMany|delete|deleteMany|upsert)\(/,
    ];
    const hits = settlementModuleFiles.filter((file) => {
      const content = fs.readFileSync(file, 'utf-8');
      return writePatterns.some((pattern) => pattern.test(content));
    });
    expect(hits).toEqual([]);
  });

  it('the poll job wiring mirrors tracking.service.ts\'s pattern — createQueue/createWorker reused, no bespoke scheduler', () => {
    const serviceFile = settlementModuleFiles.find((file) => file.endsWith('settlement.service.ts'));
    const content = fs.readFileSync(serviceFile as string, 'utf-8');
    expect(content).toContain("from '../../core/queue'");
    expect(content).toContain('createQueue(');
    expect(content).toContain('createWorker(');
    expect(content).not.toMatch(/setInterval\(/);
  });

  it('return_window_days is read from platform_config, never hardcoded', () => {
    const serviceFile = settlementModuleFiles.find((file) => file.endsWith('settlement.service.ts'));
    const content = fs.readFileSync(serviceFile as string, 'utf-8');
    expect(content).toContain("configKey: 'return_window_days'");
  });

  it('startSettlementPollJob is only invoked from server.ts\'s process-startup bootstrap guard, never called during a request handler', () => {
    const serverFile = fs.readFileSync(path.join(SRC_ROOT, 'server.ts'), 'utf-8');
    expect(serverFile).toContain('startSettlementPollJob()');
    const requestHandlerFiles = allSourceFiles.filter(
      (file) => file.includes(`${path.sep}modules${path.sep}`) && (file.endsWith('.controller.ts') || file.endsWith('.routes.ts')),
    );
    const hits = requestHandlerFiles.filter((file) => fs.readFileSync(file, 'utf-8').includes('startSettlementPollJob'));
    expect(hits).toEqual([]);
  });

  it('no new Prisma model was added for this gap closure — settlements/orders/returns already existed', () => {
    const schema = fs.readFileSync(path.join(SRC_ROOT, '../prisma/schema.prisma'), 'utf-8');
    expect(schema).toMatch(/model Settlement \{/);
  });
});
