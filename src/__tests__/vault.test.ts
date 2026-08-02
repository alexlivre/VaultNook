import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';

const testDir = join(tmpdir(), 'devvault-test-' + Date.now());
vi.mock('electron', () => ({
  app: {
    getPath: () => testDir,
    getVersion: () => '0.0.0-test',
  },
}));

import * as vault from '../main/services/vault';
import { hashPassword } from '../main/services/crypto';

const vaultsDir = () => join(testDir, 'vaults');

function singleVaultFile(): string {
  const files = readdirSync(vaultsDir()).filter((f) => f.endsWith('.json'));
  expect(files).toHaveLength(1);
  return join(vaultsDir(), files[0]);
}

const makeItem = (overrides: Record<string, unknown> = {}) => ({
  id: 'test-id',
  name: 'Test API',
  value: 'sk_test_123',
  description: '',
  category: 'api' as const,
  favorite: false,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  ...overrides,
});

describe('vault v3', () => {
  beforeEach(() => {
    mkdirSync(vaultsDir(), { recursive: true });
  });

  afterEach(() => {
    vault.lockVault();
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('createVault', () => {
    it('should create vault and return BIP39 phrase', async () => {
      const result = await vault.createVault('Password1!', 'hint');
      expect(result.recoveryPhrase.split(' ')).toHaveLength(12);
      expect(result.vaultId).toBeDefined();
    });
  });

  describe('unlockVault', () => {
    it('should unlock with correct password', async () => {
      await vault.createVault('Password1!');
      vault.lockVault();
      const success = await vault.unlockVault('Password1!');
      expect(success.ok).toBe(true);
      expect(success.recoveryPhrase).toBeUndefined();
    });

    it('should fail with wrong password', async () => {
      await vault.createVault('Password1!');
      vault.lockVault();
      const success = await vault.unlockVault('WrongPassword!');
      expect(success.ok).toBe(false);
    });
  });

  describe('metadata encryption', () => {
    it('should store name and description encrypted at rest', async () => {
      await vault.createVault('Password1!');
      await vault.addItem(makeItem({ name: 'Stripe Live', description: 'conta principal' }));
      const raw = JSON.parse(readFileSync(singleVaultFile(), 'utf-8'));
      const stored = raw.items[0];
      expect(typeof stored.name).toBe('object');
      expect(stored.name.ciphertext).toBeDefined();
      expect(typeof stored.description).toBe('object');
    });

    it('should decrypt name/value/description on getAllItems', async () => {
      await vault.createVault('Password1!');
      await vault.addItem(makeItem({ name: 'Stripe Live', description: 'conta principal' }));
      const items = await vault.getAllItems();
      expect(items[0].name).toBe('Stripe Live');
      expect(items[0].description).toBe('conta principal');
      expect(items[0].value).toBe('sk_test_123');
    });
  });

  describe('migration v2 -> v3', () => {
    it('should migrate a v2 vault and return a new recovery phrase', async () => {
      const salt = randomBytes(32);
      const passwordHash = await hashPassword('OldPassword1!', salt);
      const legacy = {
        version: '0.1.0',
        formatVersion: 2,
        createdAt: Date.now(),
        passwordHash: passwordHash.toString('base64'),
        salt: salt.toString('base64'),
        recoveryHash: 'x',
        hint: '',
        items: [
          {
            id: 'old-1',
            name: 'Legacy API',
            value: 'plaintext-value',
            description: 'legacy desc',
            category: 'api',
            favorite: false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        ],
        settings: { autoLockTimer: 60 },
      };
      writeFileSync(join(vaultsDir(), 'old-vault.json'), JSON.stringify(legacy));
      await vault.loadVault('old-vault');
      const result = await vault.unlockVault('OldPassword1!');
      expect(result.ok).toBe(true);
      expect(result.recoveryPhrase).toBeDefined();
      const items = await vault.getAllItems();
      expect(items[0].name).toBe('Legacy API');
      expect(items[0].value).toBe('plaintext-value');
      const raw = JSON.parse(readFileSync(join(vaultsDir(), 'old-vault.json'), 'utf-8'));
      expect(raw.formatVersion).toBe(3);
      expect(typeof raw.items[0].name).toBe('object');
    });
  });

  describe('recovery', () => {
    it('should recover with phrase and new password', async () => {
      const created = await vault.createVault('Password1!');
      await vault.addItem(makeItem());
      const phrase = created.recoveryPhrase;
      vault.lockVault();

      const ok = await vault.recoverVault(created.vaultId, phrase, 'NewPassword1!');
      expect(ok).toBe(true);
      const items = await vault.getAllItems();
      expect(items[0].value).toBe('sk_test_123');

      vault.lockVault();
      const unlockOld = await vault.unlockVault('Password1!');
      expect(unlockOld.ok).toBe(false);
      const unlockNew = await vault.unlockVault('NewPassword1!');
      expect(unlockNew.ok).toBe(true);
    });

    it('should reject wrong phrase', async () => {
      const created = await vault.createVault('Password1!');
      vault.lockVault();
      const ok = await vault.recoverVault(
        created.vaultId,
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon',
        'NewPassword1!'
      );
      expect(ok).toBe(false);
    });
  });

  describe('changePassword', () => {
    it('should re-wrap master key and keep items', async () => {
      await vault.createVault('Password1!');
      await vault.addItem(makeItem());
      const ok = await vault.changePassword({
        currentPassword: 'Password1!',
        newPassword: 'NewPassword1!',
        confirmPassword: 'NewPassword1!',
      });
      expect(ok).toBe(true);
      vault.lockVault();
      const unlockNew = await vault.unlockVault('NewPassword1!');
      expect(unlockNew.ok).toBe(true);
      const items = await vault.getAllItems();
      expect(items[0].value).toBe('sk_test_123');
    });
  });

  describe('CRUD', () => {
    beforeEach(async () => {
      await vault.createVault('Password1!');
    });

    it('should add, edit and remove item', async () => {
      await vault.addItem(makeItem());
      expect(await vault.getAllItems()).toHaveLength(1);
      await vault.editItem(makeItem({ name: 'Updated', value: 'sk_updated' }));
      const items = await vault.getAllItems();
      expect(items[0].name).toBe('Updated');
      expect(items[0].value).toBe('sk_updated');
      await vault.removeItem('test-id');
      expect(await vault.getAllItems()).toHaveLength(0);
    });
  });
});
