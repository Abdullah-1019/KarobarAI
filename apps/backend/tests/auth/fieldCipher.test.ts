import {
  blindIndex,
  decryptField,
  encryptField,
  normalizeEmail,
  normalizePhone,
  otpPepperedHash,
} from '../../src/core/crypto/fieldCipher';

describe('fieldCipher', () => {
  it('round-trips plaintext through encrypt/decrypt', () => {
    const plaintext = '+923001234567';
    const ciphertext = encryptField(plaintext);

    expect(ciphertext).toMatch(/^v1:/);
    expect(decryptField(ciphertext)).toBe(plaintext);
  });

  it('produces different ciphertext for the same plaintext (random IV)', () => {
    const a = encryptField('same-value');
    const b = encryptField('same-value');
    expect(a).not.toBe(b);
  });

  it('throws on a tampered ciphertext (auth tag mismatch)', () => {
    const ciphertext = encryptField('sensitive');
    const tampered = ciphertext.slice(0, -4) + 'abcd';
    expect(() => decryptField(tampered)).toThrow();
  });

  it('produces the same blind index for the same normalized input', () => {
    const a = blindIndex(normalizePhone('0300-1234567'));
    const b = blindIndex(normalizePhone('+92 300 1234567'));
    expect(a).toBe(b);
  });

  it('produces different blind indexes for different inputs', () => {
    expect(blindIndex('a')).not.toBe(blindIndex('b'));
  });

  it('normalizes phone formats to the same E.164-ish value', () => {
    expect(normalizePhone('0300-1234567')).toBe('+923001234567');
    expect(normalizePhone('+923001234567')).toBe('+923001234567');
    expect(normalizePhone('923001234567')).toBe('+923001234567');
  });

  it('normalizes email casing/whitespace', () => {
    expect(normalizeEmail('  Foo@Example.COM ')).toBe('foo@example.com');
  });

  it('produces a deterministic peppered hash for OTP codes', () => {
    expect(otpPepperedHash('123456')).toBe(otpPepperedHash('123456'));
    expect(otpPepperedHash('123456')).not.toBe(otpPepperedHash('654321'));
  });
});
