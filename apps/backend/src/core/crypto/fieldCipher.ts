import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from 'node:crypto';

import { config } from '../config';

// Field-level encryption for PII at rest (Sec-007): AES-256-GCM for ciphertext columns
// (users.phone/email, later addresses/wallets), HMAC-SHA256 for deterministic blind-index
// columns (phone_bidx/email_bidx) so equality lookups work without decrypting every row.
// Both keys are HKDF-derived from one FIELD_ENCRYPTION_KEY secret using distinct `info` strings,
// so a leak of one derived key doesn't compromise the others. "v1:" prefix on ciphertext is a
// seam for future key rotation (try v2 key, fall back to v1 on decrypt).

const ENC_INFO = 'karobarai:field-enc:v1';
const BIDX_INFO = 'karobarai:field-bidx:v1';
const OTP_PEPPER_INFO = 'karobarai:otp-pepper:v1';

interface DerivedKeys {
  encKey: Buffer;
  bidxKey: Buffer;
  otpPepper: Buffer;
}

let cachedKeys: DerivedKeys | null = null;

// Derivation is lazy (not at import time) so modules that import this file don't crash before
// FIELD_ENCRYPTION_KEY is actually needed (e.g. in tests that don't touch encrypted fields).
function deriveKeys(): DerivedKeys {
  if (cachedKeys) return cachedKeys;

  const masterKey = Buffer.from(config.fieldEncryptionKey, 'base64');
  if (masterKey.length !== 32) {
    throw new Error('FIELD_ENCRYPTION_KEY must decode to exactly 32 bytes (base64)');
  }

  const derive = (info: string): Buffer =>
    Buffer.from(hkdfSync('sha256', masterKey, Buffer.alloc(0), Buffer.from(info), 32));

  cachedKeys = {
    encKey: derive(ENC_INFO),
    bidxKey: derive(BIDX_INFO),
    otpPepper: derive(OTP_PEPPER_INFO),
  };
  return cachedKeys;
}

export function encryptField(plaintext: string): string {
  const { encKey } = deriveKeys();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encKey, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
}

export function decryptField(payload: string): string {
  const { encKey } = deriveKeys();
  const [version, ivB64, tagB64, ciphertextB64] = payload.split(':');
  if (version !== 'v1' || !ivB64 || !tagB64 || !ciphertextB64) {
    throw new Error('Invalid encrypted field payload');
  }

  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const ciphertext = Buffer.from(ciphertextB64, 'base64');

  const decipher = createDecipheriv('aes-256-gcm', encKey, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}

// Deterministic (no IV) — same normalized input always produces the same index, which is what
// makes `WHERE phone_bidx = ?` lookups possible. Only supports equality, never range/substring.
export function blindIndex(plaintext: string): string {
  const { bidxKey } = deriveKeys();
  return createHmac('sha256', bidxKey).update(plaintext).digest('hex');
}

// Used by auth.otp.ts to store OTP codes in Redis as a peppered hash rather than plaintext
// (Sec-006: OTP must be Redis-hashed, not stored raw).
export function otpPepperedHash(code: string): string {
  const { otpPepper } = deriveKeys();
  return createHmac('sha256', otpPepper).update(code).digest('hex');
}

// "0300-1234567", "+923001234567", "923001234567" must all normalize identically, otherwise
// duplicate-detection and login-by-phone silently break.
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, '');
  const stripped = digits.replace(/^\+/, '');

  let national: string;
  if (stripped.startsWith('92')) {
    national = stripped;
  } else if (stripped.startsWith('0')) {
    national = '92' + stripped.slice(1);
  } else {
    national = '92' + stripped;
  }
  return '+' + national;
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}
