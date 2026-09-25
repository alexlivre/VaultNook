import { describe, it, expect } from 'vitest';
import { ImportedVaultSchema } from '../main/handlers/schemas';

const encrypted = { iv: 'aXY=', ciphertext: 'Y3Q=', tag: 'dGFn' };

const validV3 = {
  version: '0.2.0',
  formatVersion: 3,
  passwordHash: 'aGFzaA==',
  salt: 'c2FsdA==',
  recoveryHash: 'aGFzaA==',
  masterKeyWrap: encrypted,
  recoveryKeyWrap: encrypted,
  items: [
    { id: '1', category: 'api', value: encrypted, name: encrypted, description: encrypted },
  ],
};

describe('ImportedVaultSchema', () => {
  it('accepts a valid v3 vault', () => {
    expect(ImportedVaultSchema.safeParse(validV3).success).toBe(true);
  });

  it('accepts a legacy vault with plaintext items', () => {
    const legacy = {
      version: '0.1.0',
      formatVersion: 1,
      passwordHash: 'aGFzaA==',
      salt: 'c2FsdA==',
      items: [{ id: '1', category: 'prompt', value: 'plain text', name: 'Legacy' }],
    };
    expect(ImportedVaultSchema.safeParse(legacy).success).toBe(true);
  });

  it('rejects a vault missing the salt', () => {
    const { salt, ...broken } = validV3;
    void salt;
    expect(ImportedVaultSchema.safeParse(broken).success).toBe(false);
  });

  it('rejects items with an unknown category', () => {
    const broken = { ...validV3, items: [{ ...validV3.items[0], category: 'unknown' }] };
    expect(ImportedVaultSchema.safeParse(broken).success).toBe(false);
  });

  it('rejects items without a value', () => {
    const broken = { ...validV3, items: [{ id: '1', category: 'api' }] };
    expect(ImportedVaultSchema.safeParse(broken).success).toBe(false);
  });
});
