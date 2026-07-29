import type { StorageAdapter, UploadParams } from './index';

// In-memory test double — never reachable via getStorageAdapter(). Tests substitute this in via
// jest.mock('../../adapters/storage'), the same pattern used for the sms/email adapters in Auth.
export class MockStorageAdapter implements StorageAdapter {
  private readonly store = new Map<string, Buffer>();

  async upload(params: UploadParams): Promise<{ key: string; url: string }> {
    this.store.set(params.key, params.buffer);
    return { key: params.key, url: this.getUrl(params.key) };
  }

  getUrl(key: string): string {
    return `mock://storage/${key}`;
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }
}
