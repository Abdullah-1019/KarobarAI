import {
  CreateBucketCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

import { config } from '../../core/config';
import { logger } from '../../core/logger';
import type { StorageAdapter, UploadParams } from './index';

function publicReadPolicy(bucket: string): string {
  return JSON.stringify({
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: '*',
        Action: ['s3:GetObject'],
        Resource: [`arn:aws:s3:::${bucket}/*`],
      },
    ],
  });
}

// S3-compatible: works against MinIO (dev, via endpoint+forcePathStyle) or real S3 (prod) with
// no code change, only config. Cloudinary (TRD §28's third named option) is NOT implemented here
// — it's a different, non-S3 API; would need its own live-cloudinary.ts if chosen later.
export class LiveStorageAdapter implements StorageAdapter {
  private readonly client: S3Client;
  private bucketReady: Promise<void> | null = null;

  constructor() {
    this.client = new S3Client({
      endpoint: config.storage.endpoint,
      region: config.storage.region,
      credentials: {
        accessKeyId: config.storage.accessKeyId,
        secretAccessKey: config.storage.secretAccessKey,
      },
      forcePathStyle: config.storage.forcePathStyle,
    });
  }

  // Idempotent: creates the bucket + a public-read policy on first real use, so a fresh MinIO
  // instance needs no manual bucket-policy step before avatars are viewable.
  private ensureBucket(): Promise<void> {
    if (!this.bucketReady) {
      this.bucketReady = (async () => {
        try {
          await this.client.send(new HeadBucketCommand({ Bucket: config.storage.bucket }));
        } catch {
          await this.client.send(new CreateBucketCommand({ Bucket: config.storage.bucket }));
        }

        try {
          await this.client.send(
            new PutBucketPolicyCommand({
              Bucket: config.storage.bucket,
              Policy: publicReadPolicy(config.storage.bucket),
            }),
          );
        } catch (err) {
          // Non-fatal: some managed providers reject bucket-policy calls (e.g. public access
          // already configured a different way) — log and continue rather than fail every
          // upload over a policy call that may simply not apply there.
          logger.warn({ err }, 'Could not set public-read bucket policy (continuing anyway)');
        }
      })();
    }
    return this.bucketReady;
  }

  async upload(params: UploadParams): Promise<{ key: string; url: string }> {
    await this.ensureBucket();
    await this.client.send(
      new PutObjectCommand({
        Bucket: config.storage.bucket,
        Key: params.key,
        Body: params.buffer,
        ContentType: params.contentType,
      }),
    );
    return { key: params.key, url: this.getUrl(params.key) };
  }

  getUrl(key: string): string {
    return `${config.storage.publicBaseUrl}/${config.storage.bucket}/${key}`;
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: config.storage.bucket, Key: key }));
  }
}
