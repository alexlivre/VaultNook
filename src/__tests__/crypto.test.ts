import { describe, it, expect } from 'vitest';
import {
  encrypt, decrypt, hashPassword, generateSalt, deriveKey,
  generateMasterKey, encryptKey, decryptKey, generateRecoveryPhrase,
  validateRecoveryPhrase,
} from '../main/services/crypto';

describe('crypto', () => {
  describe('encrypt/decrypt', () => {
    it('should encrypt and decrypt correctly', async () => {
      const salt = generateSalt();
      const key = await deriveKey('TestPassword123!', salt);
      const plaintext = 'sk_live_abc123xyz';
      const decrypted = decrypt(encrypt(plaintext, key), key);
      expect(decrypted).toBe(plaintext);
    });

    it('should fail to decrypt with wrong key', async () => {
      const salt = generateSalt();
      const key1 = await deriveKey('Password1!', salt);
      const key2 = await deriveKey('Password2!', salt);
      expect(() => decrypt(encrypt('secret', key1), key2)).toThrow();
    });

    it('should generate different ciphertext for same plaintext', async () => {
      const salt = generateSalt();
      const key = await deriveKey('Password1!', salt);
      const enc1 = encrypt('secret', key);
      const enc2 = encrypt('secret', key);
      expect(enc1.iv).not.toBe(enc2.iv);
      expect(enc1.ciphertext).not.toBe(enc2.ciphertext);
    });
  });

  describe('hashPassword', () => {
    it('should be consistent for same input', async () => {
      const salt = generateSalt();
      const h1 = await hashPassword('Password1!', salt);
      const h2 = await hashPassword('Password1!', salt);
      expect(h1.toString('base64')).toBe(h2.toString('base64'));
    });

    it('should be different for different passwords', async () => {
      const salt = generateSalt();
      const h1 = await hashPassword('Password1!', salt);
      const h2 = await hashPassword('Password2!', salt);
      expect(h1.toString('base64')).not.toBe(h2.toString('base64'));
    });
  });

  describe('generateSalt', () => {
    it('should generate 32 bytes', () => {
      expect(generateSalt().length).toBe(32);
    });
  });

  describe('deriveKey', () => {
    it('should derive a zeroizable 32-byte key', async () => {
      const salt = generateSalt();
      const key = await deriveKey('Password1!', salt);
      expect(key.key.length).toBe(32);
      key.zeroize();
      expect(key.key.every((b: number) => b === 0)).toBe(true);
    });
  });

  describe('key wrap', () => {
    it('should wrap and unwrap a master key', () => {
      const master = generateMasterKey();
      const wrapping = generateMasterKey();
      const wrapped = encryptKey(master, wrapping);
      const unwrapped = decryptKey(wrapped, wrapping);
      expect(unwrapped.equals(master)).toBe(true);
    });

    it('should fail to unwrap with wrong wrapping key', () => {
      const master = generateMasterKey();
      const wrapped = encryptKey(master, generateMasterKey());
      expect(() => decryptKey(wrapped, generateMasterKey())).toThrow();
    });
  });

  describe('generateRecoveryPhrase', () => {
    it('should generate 12 valid BIP39 words', () => {
      const phrase = generateRecoveryPhrase();
      expect(phrase.split(' ')).toHaveLength(12);
      expect(validateRecoveryPhrase(phrase)).toBe(true);
    });

    it('should reject invalid phrase', () => {
      expect(validateRecoveryPhrase('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon')).toBe(false);
    });
  });
});
