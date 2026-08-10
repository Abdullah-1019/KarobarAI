import { S3Client } from '@aws-sdk/client-s3';

import { LiveStorageAdapter } from '../../src/adapters/storage/live';

// Regression test for a real bug found testing Returns image uploads against a running stack:
// ensureBucket() cached its readiness Promise unconditionally — including when that Promise
// rejected — so a single MinIO outage on the very first upload wedged every future upload for
// the lifetime of the process (LiveStorageAdapter is a process-wide singleton via
// getStorageAdapter()), fixable only by restarting the backend. Fixed by resetting the cached
// Promise back to null on failure so the next call retries from scratch.
describe('LiveStorageAdapter.ensureBucket — failure caching (bug fix)', () => {
  it('does not permanently cache a failed bucket-readiness check — a later call retries once the dependency recovers', async () => {
    // S3Client.send's overloaded signature defeats jest.spyOn's type inference for
    // mockRejectedValue/mockResolvedValue — cast to a plain jest.Mock, same escape hatch used
    // elsewhere in this codebase for overloaded methods (e.g. Queue.prototype.add).
    const sendSpy = jest.spyOn(S3Client.prototype, 'send') as unknown as jest.Mock;
    sendSpy.mockRejectedValue(new Error('MinIO unreachable'));
    const adapter = new LiveStorageAdapter();

    await expect(
      adapter.upload({ key: 'products/staging/x.jpg', buffer: Buffer.from('x'), contentType: 'image/jpeg' }),
    ).rejects.toThrow('MinIO unreachable');
    const callsDuringOutage = sendSpy.mock.calls.length;
    expect(callsDuringOutage).toBeGreaterThan(0);

    // "MinIO comes back online" — without the fix, this second call would immediately replay
    // the first call's stale rejection instead of ever touching S3Client.send again.
    sendSpy.mockResolvedValue({} as never);
    const result = await adapter.upload({ key: 'products/staging/y.jpg', buffer: Buffer.from('y'), contentType: 'image/jpeg' });
    expect(result.key).toBe('products/staging/y.jpg');
    expect(sendSpy.mock.calls.length).toBeGreaterThan(callsDuringOutage); // proves a retry actually happened, not a cached rejection

    sendSpy.mockRestore();
  });

  it('a successful bucket-readiness check IS cached — a second upload does not re-run Head/Create/PutBucketPolicy', async () => {
    const sendSpy = jest.spyOn(S3Client.prototype, 'send') as unknown as jest.Mock;
    sendSpy.mockResolvedValue({});
    const adapter = new LiveStorageAdapter();

    await adapter.upload({ key: 'products/staging/a.jpg', buffer: Buffer.from('a'), contentType: 'image/jpeg' });
    const callsAfterFirstUpload = sendSpy.mock.calls.length; // HeadBucket + PutBucketPolicy + PutObject

    await adapter.upload({ key: 'products/staging/b.jpg', buffer: Buffer.from('b'), contentType: 'image/jpeg' });
    const callsAfterSecondUpload = sendSpy.mock.calls.length;

    // Only one additional call (PutObject) — bucket setup was not repeated.
    expect(callsAfterSecondUpload - callsAfterFirstUpload).toBe(1);

    sendSpy.mockRestore();
  });
});
