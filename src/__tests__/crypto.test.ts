import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, hashPassword, generateSalt, deriveKey, generateRecoveryPhrase } from '../main/services/crypto';

describe('crypto', () => {
  describe('encrypt/decrypt', () => {
    it('should encrypt and decrypt correctly', () => {
      const salt = generateSalt();
      const key = deriveKey('TestPassword123!', salt);
      const plaintext = 'sk_live_abc123xyz';
      const encrypted = encrypt(plaintext, key);
      const decrypted = decrypt(encrypted, key);
      expect(decrypted).toBe(plaintext);
    });

    it('should fail to decrypt with wrong key', () => {
      const salt = generateSalt();
      const key1 = deriveKey('Password1!', salt);
      const key2 = deriveKey('Password2!', salt);
      const encrypted = encrypt('secret', key1);
      expect(() => decrypt(encrypted, key2)).toThrow();
    });

    it('should generate different ciphertext for same plaintext', () => {
      const salt = generateSalt();
      const key = deriveKey('Password1!', salt);
      const enc1 = encrypt('secret', key);
      const enc2 = encrypt('secret', key);
      expect(enc1.iv).not.toBe(enc2.iv);
      expect(enc1.ciphertext).not.toBe(enc2.ciphertext);
    });
  });

  describe('hashPassword', () => {
    it('should generate consistent hash for same input', () => {
      const salt = generateSalt();
      const hash1 = hashPassword('Password1!', salt);
      const hash2 = hashPassword('Password1!', salt);
      expect(hash1.toString('base64')).toBe(hash2.toString('base64'));
    });

    it('should generate different hash for different passwords', () => {
      const salt = generateSalt();
      const hash1 = hashPassword('Password1!', salt);
      const hash2 = hashPassword('Password2!', salt);
      expect(hash1.toString('base64')).not.toBe(hash2.toString('base64'));
    });
  });

  describe('generateSalt', () => {
    it('should generate 32 bytes', () => {
      const salt = generateSalt();
      expect(salt.length).toBe(32);
    });

    it('should generate unique salts', () => {
      const salt1 = generateSalt();
      const salt2 = generateSalt();
      expect(salt1.toString('base64')).not.toBe(salt2.toString('base64'));
    });
  });

  describe('deriveKey', () => {
    it('should derive key that can be zeroized', () => {
      const salt = generateSalt();
      const key = deriveKey('Password1!', salt);
      expect(key.key.length).toBe(32);
      key.zeroize();
      expect(key.key.every((b: number) => b === 0)).toBe(true);
    });
  });

  describe('generateRecoveryPhrase', () => {
    it('should generate 12 words', () => {
      const phrase = generateRecoveryPhrase();
      expect(phrase.length).toBe(12);
    });

    it('should generate unique words', () => {
      const phrase = generateRecoveryPhrase();
      const uniqueWords = new Set(phrase);
      expect(uniqueWords.size).toBe(12);
    });

    it('should generate different phrases each time', () => {
      const phrase1 = generateRecoveryPhrase();
      const phrase2 = generateRecoveryPhrase();
      expect(phrase1.join(' ')).not.toBe(phrase2.join(' '));
    });
  });
});
