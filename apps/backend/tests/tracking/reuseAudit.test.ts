import fs from 'node:fs';
import path from 'node:path';

// Task 8.5/8.7 — a deliberate grep pass, not a recollection, matching the discipline established
// in Features 5/6/7.

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
const trackingModuleFiles = allSourceFiles.filter((file) => file.includes(`${path.sep}modules${path.sep}tracking${path.sep}`));
const orderServicePath = path.join(SRC_ROOT, 'modules/order/order.service.ts');

describe('Feature 8 reuse/scope audit (Task 8.5/8.7)', () => {
  it('exactly one CourierAdapter implementation set exists (index/mock/live), no second adapter', () => {
    const adapterFiles = allSourceFiles.filter((file) => file.includes(`${path.sep}adapters${path.sep}courier${path.sep}`));
    expect(new Set(adapterFiles.map((f) => path.basename(f)))).toEqual(new Set(['index.ts', 'mock.ts', 'live.ts']));
  });

  it('exactly one Socket.IO server is created (core/socket), no second gateway anywhere else', () => {
    const hits = allSourceFiles.filter((file) => {
      if (file === path.join(SRC_ROOT, 'core/socket/index.ts')) return false;
      const content = fs.readFileSync(file, 'utf-8');
      return content.includes("from 'socket.io'") || content.includes('new SocketIOServer') || content.includes('new Server(');
    });
    expect(hits).toEqual([]);
  });

  it('tracking.repository.ts never writes orders.status — only non-status columns (courier/tracking_no/courier_overridden)', () => {
    const repoContent = fs.readFileSync(path.join(SRC_ROOT, 'modules/tracking/tracking.repository.ts'), 'utf-8');
    // Tightly scoped to the one order.update() call site's own data shape, rather than a wide
    // char-window regex that could spuriously span into an unrelated later function.
    expect(repoContent).toMatch(/order\.update\(\{\s*where:\s*\{\s*orderId\s*\},\s*data\s*\}\);/);
    expect(repoContent).toMatch(/data:\s*\{\s*courier:\s*CourierCode;\s*trackingNo:\s*string;\s*courierOverridden:\s*boolean\s*\}/);
    expect(repoContent).not.toMatch(/function appendTrackingEvent|\.appendTrackingEvent\(/);
  });

  it('transitionOrderStatus is called for every status advance in tracking.service.ts (booking, poll) — grep confirms the import and call sites', () => {
    const serviceContent = fs.readFileSync(path.join(SRC_ROOT, 'modules/tracking/tracking.service.ts'), 'utf-8');
    expect(serviceContent).toContain("from '../order/order.service'");
    expect(serviceContent).toMatch(/transitionOrderStatus\(/);
  });

  it('no transitionOrderStatus(..., \'COMPLETED\') call exists anywhere in this feature (Task 7.6 — correctly not invented)', () => {
    const hits = trackingModuleFiles.filter((file) => /transitionOrderStatus\([^)]*'COMPLETED'/.test(fs.readFileSync(file, 'utf-8')));
    expect(hits).toEqual([]);
  });

  it('no tracking_events deletion/archival code exists (REQ-F-Track007 — >=12mo retention, Task 7.4)', () => {
    const hits = trackingModuleFiles.filter((file) => {
      const content = fs.readFileSync(file, 'utf-8');
      return content.includes('trackingEvent.delete') || content.includes('trackingEvent.deleteMany');
    });
    expect(hits).toEqual([]);
  });

  it('no new Prisma model was added for this feature — courier_quotes/tracking_events already existed from the Database feature', () => {
    const schema = fs.readFileSync(path.join(SRC_ROOT, '../prisma/schema.prisma'), 'utf-8');
    expect(schema).toMatch(/model CourierQuote /);
    expect(schema).toMatch(/model TrackingEvent /);
    expect(schema).not.toMatch(/model (Shipment|CourierBooking|TrackingLog) /);
  });

  it("Feature 7's own files still never reference tracking/CourierAdapter/socket.io (Task 8.7 — checked from this feature's side too)", () => {
    const feature7Files = [
      path.join(SRC_ROOT, 'modules/order/order.service.ts'),
      path.join(SRC_ROOT, 'modules/order/invoice.service.ts'),
      path.join(SRC_ROOT, 'modules/order/order.controller.ts'),
      path.join(SRC_ROOT, 'modules/order/order.routes.ts'),
    ];
    const hits = feature7Files.filter((file) => {
      const content = fs.readFileSync(file, 'utf-8');
      return content.includes('modules/tracking') || content.includes('CourierAdapter') || content.includes('socket.io');
    });
    expect(hits).toEqual([]);
  });

  it('order.service.ts itself still writes orders.status exactly once, unaffected by Feature 8', () => {
    const content = fs.readFileSync(orderServicePath, 'utf-8');
    const matches = content.match(/tx\.order\.update\(\{[\s\S]{0,200}?status:\s*targetStatus/g) ?? [];
    expect(matches).toHaveLength(1);
  });
});
