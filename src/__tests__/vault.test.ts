import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const testDir = join(tmpdir(), 'devvault-test-' + Date.now());
vi.mock('electron', () => ({
  app: {
    getPath: () => testDir,
  },
}));

import * as vault from '../main/services/vault';

describe('vault', () => {
  beforeEach(() => {
    mkdirSync(join(testDir, 'vaults'), { recursive: true });
  });

  afterEach(() => {
    vault.lockVault();
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('createVault', () => {
    it('should create vault with correct structure', async () => {
      const result = await vault.createVault('Password1!', 'hint');
      expect(result.recoveryPhrase).toHaveLength(12);
      expect(result.vaultId).toBeDefined();
    });
  });

  describe('unlockVault', () => {
    it('should unlock with correct password', async () => {
      await vault.createVault('Password1!');
      vault.lockVault();
      const success = await vault.unlockVault('Password1!');
      expect(success).toBe(true);
    });

    it('should fail with wrong password', async () => {
      await vault.createVault('Password1!');
      vault.lockVault();
      const success = await vault.unlockVault('WrongPassword!');
      expect(success).toBe(false);
    });
  });

  describe('CRUD operations', () => {
    beforeEach(async () => {
      await vault.createVault('Password1!');
    });

    it('should add and retrieve item', async () => {
      const item = {
        id: 'test-id',
        name: 'Test API',
        value: 'sk_test_123',
        description: 'Test description',
        category: 'api' as const,
        favorite: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await vault.addItem(item);
      const items = await vault.getAllItems();
      expect(items).toHaveLength(1);
      expect(items[0].name).toBe('Test API');
      expect(items[0].value).toBe('sk_test_123');
    });

    it('should edit item', async () => {
      const item = {
        id: 'test-id',
        name: 'Test API',
        value: 'sk_test_123',
        description: '',
        category: 'api' as const,
        favorite: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await vault.addItem(item);
      await vault.editItem({ ...item, name: 'Updated API', value: 'sk_updated' });
      const items = await vault.getAllItems();
      expect(items[0].name).toBe('Updated API');
      expect(items[0].value).toBe('sk_updated');
    });

    it('should remove item', async () => {
      const item = {
        id: 'test-id',
        name: 'Test API',
        value: 'sk_test_123',
        description: '',
        category: 'api' as const,
        favorite: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await vault.addItem(item);
      await vault.removeItem('test-id');
      const items = await vault.getAllItems();
      expect(items).toHaveLength(0);
    });
  });

  describe('export/import', () => {
    beforeEach(async () => {
      await vault.createVault('Password1!');
    });

    it('should export and import vault', async () => {
      const item = {
        id: 'test-id',
        name: 'Test API',
        value: 'sk_test_123',
        description: '',
        category: 'api' as const,
        favorite: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await vault.addItem(item);
      const exported = await vault.exportVault();
      expect(exported).toContain('Test API');

      const result = await vault.importVault(exported);
      expect(result.imported).toBe(0);
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      await vault.createVault('Password1!');
      const item = {
        id: 'test-id',
        name: 'Test API',
        value: 'sk_test_123',
        description: '',
        category: 'api' as const,
        favorite: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await vault.addItem(item);

      const success = await vault.changePassword({
        currentPassword: 'Password1!',
        newPassword: 'NewPassword1!',
        confirmPassword: 'NewPassword1!',
      });
      expect(success).toBe(true);

      vault.lockVault();
      const unlocked = await vault.unlockVault('NewPassword1!');
      expect(unlocked).toBe(true);

      const items = await vault.getAllItems();
      expect(items[0].value).toBe('sk_test_123');
    });
  });
});
