import { CreateBucketCommand, DeleteObjectCommand, GetBucketPolicyCommand, GetObjectCommand, HeadBucketCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

import { config } from '../../core/config';

// Separate bucket: LiveStorageAdapter makes the product bucket public-read.
// Never put return/dispatch evidence into that bucket.
const bucket = `${config.storage.bucket}-returns-private`;
const client = new S3Client({
  endpoint: config.storage.endpoint,
  region: config.storage.region,
  credentials: { accessKeyId: config.storage.accessKeyId, secretAccessKey: config.storage.secretAccessKey },
  forcePathStyle: config.storage.forcePathStyle,
});
let ready: Promise<void> | undefined;

async function ensureBucket(): Promise<void> {
  ready ??= (async () => {
    try {
      await client.send(new HeadBucketCommand({ Bucket: bucket }));
    } catch (error) {
      // Only create a missing bucket; an authorization/transport failure must not be masked.
      if ((error as { name?: string }).name !== 'NotFound' && (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode !== 404) throw error;
      await client.send(new CreateBucketCommand({ Bucket: bucket }));
    }
    // Refuse to use an existing bucket with any policy: it might grant public read access.
    try {
      const policy = await client.send(new GetBucketPolicyCommand({ Bucket: bucket }));
      if (policy.Policy) throw new Error('Private evidence bucket has a bucket policy');
    } catch (error) {
      const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      if (status !== 404 && (error as { name?: string }).name !== 'NoSuchBucketPolicy') throw error;
    }
  })().catch((error) => { ready = undefined; throw error; });
  await ready;
}

export async function savePrivateEvidence(key: string, buffer: Buffer, contentType: string): Promise<void> {
  await ensureBucket();
  await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer, ContentType: contentType }));
}

export async function readPrivateEvidence(key: string): Promise<{ buffer: Buffer; contentType: string }> {
  if (!/^(returns|dispatch)\/[a-zA-Z0-9/_-]+\.(jpg|jpeg|png|webp)$/.test(key)) throw new Error('Invalid evidence key');
  const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!object.Body) throw new Error('Evidence is empty');
  const bytes = await object.Body.transformToByteArray();
  if (bytes.length > 10 * 1024 * 1024) throw new Error('Evidence is too large');
  return { buffer: Buffer.from(bytes), contentType: object.ContentType ?? 'application/octet-stream' };
}

export async function deletePrivateEvidence(key: string): Promise<void> {
  if (!/^(returns|dispatch)\/[a-zA-Z0-9/_-]+\.(jpg|jpeg|png|webp)$/.test(key)) throw new Error('Invalid evidence key');
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
