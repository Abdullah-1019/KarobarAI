import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';

// Env vars live in one root .env (Playbook Task 2 decision), not per-app files. Since this module
// is loaded from both `src` (ts-node-dev) and `dist` (compiled) at the same nesting depth, and
// commands may run from the repo root or from inside apps/backend, we walk up from this file
// until we find pnpm-workspace.yaml rather than assuming a fixed relative depth or CWD.
function findRepoRoot(startDir: string): string {
  let dir = startDir;
  while (!fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
    const parent = path.dirname(dir);
    if (parent === dir) return startDir;
    dir = parent;
  }
  return dir;
}

dotenv.config({ path: path.join(findRepoRoot(__dirname), '.env') });

// .env stores PEM keys with literal "\n" escapes (a real newline would break .env parsing);
// un-escape on load so jsonwebtoken gets a proper multi-line PEM string.
function unescapePem(value: string | undefined): string {
  return (value ?? '').replace(/\\n/g, '\n');
}

export const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT_API ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? '',
  redisUrl: process.env.REDIS_URL ?? '',
  corsAllowedOrigins: (process.env.CORS_ALLOWED_ORIGINS ?? '').split(',').filter(Boolean),
  adapterMode: (process.env.ADAPTER_MODE ?? 'mock') as 'mock' | 'live',
  bcryptCost: Number(process.env.BCRYPT_COST ?? 12),
  fieldEncryptionKey: process.env.FIELD_ENCRYPTION_KEY ?? '',
  jwt: {
    privateKey: unescapePem(process.env.JWT_PRIVATE_KEY),
    publicKey: unescapePem(process.env.JWT_PUBLIC_KEY),
    accessTtlSeconds: Number(process.env.JWT_ACCESS_TTL ?? 3600),
    refreshTtlSeconds: Number(process.env.JWT_REFRESH_TTL ?? 604800),
    issuer: process.env.JWT_ISSUER ?? 'karobarai-api',
    audience: process.env.JWT_AUDIENCE ?? 'karobarai-web',
  },
  // Object storage (TRD §28): MinIO in dev, real S3/Cloudinary-S3 in prod — one S3-compatible
  // adapter serves both, differentiated only by these values. Falls back to MinIO's dev
  // credentials whenever S3_* is blank (i.e. always, until prod creds are actually configured).
  storage: {
    endpoint: process.env.S3_BUCKET ? undefined : process.env.MINIO_ENDPOINT ?? 'http://localhost:9000',
    region: process.env.S3_REGION || 'us-east-1',
    accessKeyId: process.env.S3_ACCESS_KEY_ID || process.env.MINIO_ROOT_USER || 'karobarai',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || process.env.MINIO_ROOT_PASSWORD || 'karobarai123',
    bucket: process.env.S3_BUCKET || process.env.MINIO_BUCKET || 'karobarai-dev',
    forcePathStyle: !process.env.S3_BUCKET, // MinIO needs path-style; real S3 uses virtual-hosted style
    // No attempt to synthesize a real-S3 public URL pattern here — a prod deployment behind
    // real S3/Cloudinary should set this explicitly (e.g. a CDN domain in front of the bucket).
    publicBaseUrl:
      process.env.S3_PUBLIC_BASE_URL ?? process.env.MINIO_ENDPOINT ?? 'http://localhost:9000',
  },
};
