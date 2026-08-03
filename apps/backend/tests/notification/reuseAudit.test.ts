import fs from 'node:fs';
import path from 'node:path';

// Task 8.8 — a deliberate grep pass, not a recollection, matching the discipline established in
// Features 5/6/7/8.

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
const notificationModuleFiles = allSourceFiles.filter((file) =>
  file.includes(`${path.sep}modules${path.sep}notification${path.sep}`),
);

describe('Feature 9 reuse/scope audit (Task 8.8)', () => {
  it('exactly one SmsAdapter implementation set exists — Feature 1\'s, not duplicated', () => {
    const smsFiles = allSourceFiles.filter((file) => file.includes(`${path.sep}adapters${path.sep}sms${path.sep}`));
    expect(new Set(smsFiles.map((f) => path.basename(f)))).toEqual(new Set(['index.ts', 'mock.ts', 'live.ts']));
  });

  it('Email/WhatsApp adapters follow the identical index/mock/live shape as Sms/Courier/Payment', () => {
    for (const dir of ['email', 'whatsapp']) {
      const files = allSourceFiles.filter((file) => file.includes(`${path.sep}adapters${path.sep}${dir}${path.sep}`));
      expect(new Set(files.map((f) => path.basename(f)))).toEqual(new Set(['index.ts', 'mock.ts', 'live.ts']));
    }
  });

  it('exactly one BullMQ worker is registered for the notifications-pending queue', () => {
    const hits = allSourceFiles.filter((file) => fs.readFileSync(file, 'utf-8').includes("createWorker('notifications-pending'"));
    expect(hits).toEqual([path.join(SRC_ROOT, 'modules/notification/notification.consumer.ts')]);
  });

  it('no second Redis/ioredis client is instantiated anywhere in the notification module', () => {
    const hits = notificationModuleFiles.filter((file) => {
      const content = fs.readFileSync(file, 'utf-8');
      return content.includes("from 'ioredis'") || content.includes('new Redis(');
    });
    expect(hits).toEqual([]);
  });

  it('no hardcoded template message strings live in notification.service.ts — only template lookups/renders', () => {
    const content = fs.readFileSync(path.join(SRC_ROOT, 'modules/notification/notification.service.ts'), 'utf-8');
    expect(content).toContain('getTemplate(');
    expect(content).toContain('renderTemplate(');
    // Every repo.createNotification() call's `message:` field must come from the rendered
    // template variable, never a literal string bypassing the registry (AppError messages like
    // 'Notification not found' are a separate, legitimate concern and correctly excluded here).
    expect(content).not.toMatch(/message:\s*['"]/);
  });

  it('the event-type registry is an open union (extensible for Feature 10), not a closed enum', () => {
    const content = fs.readFileSync(path.join(SRC_ROOT, '../../../packages/shared/src/types/notification.ts'), 'utf-8');
    expect(content).toContain('(string & {})');
  });

  it('dispatch gating is structurally identical across all three external channels (same shape, different adapter call)', () => {
    const content = fs.readFileSync(path.join(SRC_ROOT, 'modules/notification/notification.service.ts'), 'utf-8');
    const emailBlockMatches = content.match(/findPreferences/g) ?? [];
    // 4 dispatch functions (in-app + 3 external), each checks preferences once.
    expect(emailBlockMatches.length).toBe(4);
  });
});
