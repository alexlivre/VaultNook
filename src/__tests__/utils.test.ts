import { describe, it, expect } from 'vitest';
import {
  collectTagFrequency,
  dateInputValue,
  describeRotation,
  filterTagSuggestions,
  generateCustomPassword,
  generatePassphrase,
  calculateSecretAudit,
  isRotationDue,
  maskValue,
  resolveRotationDueAt,
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
          projectId: '',
          rotationDueAt: 0,
          rotationIntervalDays: 0,
          rotationUrl: '',
          rotationLastAt: 0,
          publicKeyHintDismissed: false,
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
          projectId: '',
          rotationDueAt: 0,
          rotationIntervalDays: 0,
          rotationUrl: '',
          rotationLastAt: 0,
          publicKeyHintDismissed: false,
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
          projectId: '',
          rotationDueAt: 0,
          rotationIntervalDays: 0,
          rotationUrl: '',
          rotationLastAt: 0,
          publicKeyHintDismissed: false,
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
          projectId: '',
          rotationDueAt: 0,
          rotationIntervalDays: 0,
          rotationUrl: '',
          rotationLastAt: 0,
          publicKeyHintDismissed: false,
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
          projectId: '',
          rotationDueAt: 0,
          rotationIntervalDays: 0,
          rotationUrl: '',
          rotationLastAt: 0,
          publicKeyHintDismissed: false,
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
          projectId: '',
          rotationDueAt: 0,
          rotationIntervalDays: 0,
          rotationUrl: '',
          rotationLastAt: 0,
          publicKeyHintDismissed: false,
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

  describe('tag helpers', () => {
    it('collects tag frequency sorted by count then name', () => {
      const frequency = collectTagFrequency([
        { tags: ['prod', 'dev'] },
        { tags: ['prod'] },
        { tags: ['cloud'] },
      ]);
      expect(frequency).toEqual([
        { tag: 'prod', count: 2 },
        { tag: 'cloud', count: 1 },
        { tag: 'dev', count: 1 },
      ]);
    });

    it('filters suggestions by query, excluding selected tags', () => {
      const all = [
        { tag: 'prod', count: 2 },
        { tag: 'produção', count: 1 },
        { tag: 'dev', count: 1 },
      ];
      expect(filterTagSuggestions(all, 'pro', ['prod'])).toEqual([{ tag: 'produção', count: 1 }]);
      expect(filterTagSuggestions(all, '#prod', [])).toEqual([
        { tag: 'prod', count: 2 },
        { tag: 'produção', count: 1 },
      ]);
      expect(filterTagSuggestions(all, '', [])).toEqual([]);
    });
  });

  describe('rotation helpers', () => {
    it('isRotationDue detects overdue items only', () => {
      expect(isRotationDue({ rotationDueAt: 0 })).toBe(false);
      expect(isRotationDue({ rotationDueAt: Date.now() - 1000 })).toBe(true);
      expect(isRotationDue({ rotationDueAt: Date.now() + 100000 })).toBe(false);
    });

    it('describeRotation formats the due status', () => {
      expect(describeRotation(0)).toBe('sem rotação');
      expect(describeRotation(Date.now() - 2 * 86400000 - 60000)).toBe('vencida há 2 dias');
      expect(describeRotation(Date.now() + 2.5 * 86400000)).toBe('vence em 3 dias');
    });
  });

  describe('resolveRotationDueAt', () => {
    it('computes for new items', () => {
      const now = 1000;
      expect(resolveRotationDueAt(null, 'days', '30', '', now)).toEqual({
        rotationDueAt: now + 30 * 86400000,
        rotationIntervalDays: 30,
      });
      expect(resolveRotationDueAt(null, 'date', '', '2030-01-02', now).rotationDueAt).toBe(
        new Date('2030-01-02T00:00:00').getTime()
      );
      expect(resolveRotationDueAt(null, 'none', '', '', now)).toEqual({
        rotationDueAt: 0,
        rotationIntervalDays: 0,
      });
    });

    it('keeps the existing date when the config is unchanged', () => {
      const intervalItem = { rotationDueAt: 555, rotationIntervalDays: 30 };
      expect(resolveRotationDueAt(intervalItem, 'days', '30', '', 1000)).toEqual({
        rotationDueAt: 555,
        rotationIntervalDays: 30,
      });

      const dateItem = { rotationDueAt: 777, rotationIntervalDays: 0 };
      expect(
        resolveRotationDueAt(dateItem, 'date', '', dateInputValue(777), 1000)
      ).toEqual({ rotationDueAt: 777, rotationIntervalDays: 0 });

      const noneItem = { rotationDueAt: 0, rotationIntervalDays: 0 };
      expect(resolveRotationDueAt(noneItem, 'none', '', '', 1000)).toEqual({
        rotationDueAt: 0,
        rotationIntervalDays: 0,
      });
    });

    it('recomputes when the config changes', () => {
      const intervalItem = { rotationDueAt: 555, rotationIntervalDays: 30 };
      expect(resolveRotationDueAt(intervalItem, 'none', '', '', 1000)).toEqual({
        rotationDueAt: 0,
        rotationIntervalDays: 0,
      });
      expect(resolveRotationDueAt(intervalItem, 'days', '60', '', 1000).rotationDueAt).toBe(
        1000 + 60 * 86400000
      );
    });
  });
});
