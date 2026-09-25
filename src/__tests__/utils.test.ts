import { describe, it, expect } from 'vitest';
import {
  generateCustomPassword,
  generatePassphrase,
  calculateSecretAudit,
  maskValue,
  truncateValue,
} from '../renderer/lib/utils';
import type { Item } from '../renderer/types';

describe('utils', () => {
  describe('generateCustomPassword', () => {
    it('should generate password of specified length with requested character sets', () => {
      const pwd = generateCustomPassword({
        length: 20,
        uppercase: true,
        lowercase: true,
        numbers: true,
        symbols: true,
      });
      expect(pwd).toHaveLength(20);
      expect(/[A-Z]/.test(pwd)).toBe(true);
      expect(/[a-z]/.test(pwd)).toBe(true);
      expect(/[0-9]/.test(pwd)).toBe(true);
      expect(/[^A-Za-z0-9]/.test(pwd)).toBe(true);
    });

    it('should generate numeric only password when selected', () => {
      const pin = generateCustomPassword({
        length: 8,
        uppercase: false,
        lowercase: false,
        numbers: true,
        symbols: false,
      });
      expect(pin).toHaveLength(8);
      expect(/^\d+$/.test(pin)).toBe(true);
    });
  });

  describe('generatePassphrase', () => {
    it('should generate memorable passphrase with custom word count and separator', () => {
      const pass = generatePassphrase(4, '-', true, true);
      const parts = pass.split('-');
      // 4 words + 1 number
      expect(parts).toHaveLength(5);
      expect(parts[0][0]).toBe(parts[0][0].toUpperCase());
      expect(/^\d+$/.test(parts[4])).toBe(true);
    });
  });

  describe('calculateSecretAudit', () => {
    it('should identify weak, duplicate and stale API keys', () => {
      const now = Date.now();
      const twoHundredDaysAgo = now - 200 * 24 * 60 * 60 * 1000;

      const items: Item[] = [
        {
          id: '1',
          name: 'Weak Key',
          value: '12345',
          publicKey: '',
          description: '',
          category: 'api',
          tags: [],
          favorite: false,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: '2',
          name: 'Stripe 1',
          value: 'mock_live_verylongandsecurekey9999!',
          publicKey: '',
          description: '',
          category: 'api',
          tags: [],
          favorite: false,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: '3',
          name: 'Stripe Duplicate',
          value: 'mock_live_verylongandsecurekey9999!',
          publicKey: '',
          description: '',
          category: 'api',
          tags: [],
          favorite: false,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: '4',
          name: 'Old Key',
          value: 'mock_test_someoldlongkey123456789!',
          publicKey: '',
          description: '',
          category: 'api',
          tags: [],
          favorite: false,
          createdAt: twoHundredDaysAgo,
          updatedAt: twoHundredDaysAgo,
        },
      ];

      const audit = calculateSecretAudit(items);
      expect(audit.totalSecrets).toBe(4);
      expect(audit.weakCount).toBe(1);
      expect(audit.weakItems[0].id).toBe('1');
      expect(audit.duplicateCount).toBe(2);
      expect(audit.staleCount).toBe(1);
      expect(audit.staleItems[0].id).toBe('4');
      expect(audit.healthScore).toBeLessThan(80);
    });

    it('should give 100% health score when all secrets are strong, unique and recent', () => {
      const now = Date.now();
      const items: Item[] = [
        {
          id: '1',
          name: 'Key A',
          value: 'mock_live_secure_alpha_123456789!@#',
          publicKey: '',
          description: '',
          category: 'api',
          tags: [],
          favorite: false,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: '2',
          name: 'Key B',
          value: 'mock_live_secure_beta_987654321!@#',
          publicKey: '',
          description: '',
          category: 'api',
          tags: [],
          favorite: false,
          createdAt: now,
          updatedAt: now,
        },
      ];

      const audit = calculateSecretAudit(items);
      expect(audit.healthScore).toBe(100);
      expect(audit.weakCount).toBe(0);
      expect(audit.duplicateCount).toBe(0);
      expect(audit.staleCount).toBe(0);
    });
  });

  describe('format helpers', () => {
    it('maskValue masks sensitive string preserving first/last 4 chars', () => {
      expect(maskValue('mock_live_1234567890abcdef')).toBe('mock••••••••cdef');
      expect(maskValue('short')).toBe('••••••••');
    });

    it('truncateValue shortens long string with ellipsis', () => {
      expect(truncateValue('Hello world', 5)).toBe('Hello...');
      expect(truncateValue('Hello', 10)).toBe('Hello');
    });
  });
});
