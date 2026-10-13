import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Item } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRelativeTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Agora mesmo';
  if (minutes < 60) return `Há ${minutes} minuto${minutes > 1 ? 's' : ''}`;
  if (hours < 24) return `Há ${hours} hora${hours > 1 ? 's' : ''}`;
  if (days < 7) return `Há ${days} dia${days > 1 ? 's' : ''}`;
  return date.toLocaleDateString('pt-BR');
}

export function formatAbsoluteDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('pt-BR');
}

export function hasCommandParams(value: string): boolean {
  return /\{\{([^}]+)\}\}/.test(value);
}

export function extractCommandParams(value: string): string[] {
  const matches = value.match(/\{\{([^}]+)\}\}/g);
  if (!matches) return [];
  return Array.from(new Set(matches.map((m) => m.slice(2, -2).trim())));
}

export function itemToJson(item: Item): string {
  return JSON.stringify(
    {
      name: item.name,
      value: item.value,
      publicKey: item.publicKey,
      category: item.category,
      description: item.description,
      tags: item.tags,
    },
    null,
    2
  );
}

export interface TagFrequency {
  tag: string;
  count: number;
}

export function collectTagFrequency(items: Pick<Item, 'tags'>[]): TagFrequency[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    for (const tag of item.tags || []) {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag, count]) => ({ tag, count }));
}

export function filterTagSuggestions(
  all: TagFrequency[],
  query: string,
  exclude: string[],
  limit: number = 5
): TagFrequency[] {
  const normalized = query.trim().toLowerCase().replace(/^#/, '');
  if (!normalized) return [];
  const excluded = new Set(exclude.map((tag) => tag.toLowerCase()));
  return all
    .filter((entry) => entry.tag.includes(normalized) && !excluded.has(entry.tag))
    .slice(0, limit);
}

const DAY_MS = 86400000;

export function isRotationDue(item: Pick<Item, 'rotationDueAt'>): boolean {
  return item.rotationDueAt > 0 && Date.now() >= item.rotationDueAt;
}

export function describeRotation(dueAt: number): string {
  if (!dueAt) return 'sem rotação';
  const now = Date.now();
  if (now >= dueAt) {
    const days = Math.floor((now - dueAt) / DAY_MS);
    return days <= 0 ? 'vence hoje' : `vencida há ${days} dia${days > 1 ? 's' : ''}`;
  }
  const days = Math.ceil((dueAt - now) / DAY_MS);
  return `vence em ${days} dia${days > 1 ? 's' : ''}`;
}

export type RotationUiMode = 'none' | 'days' | 'date';

export function dateInputValue(timestamp: number): string {
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function resolveRotationDueAt(
  editItem: Pick<Item, 'rotationDueAt' | 'rotationIntervalDays'> | null,
  mode: RotationUiMode,
  days: string,
  date: string,
  now: number = Date.now()
): { rotationDueAt: number; rotationIntervalDays: number } {
  const parsedDays = Number(days);
  const intervalDays = mode === 'days' && parsedDays > 0 ? Math.floor(parsedDays) : 0;
  const computed =
    mode === 'days'
      ? intervalDays > 0
        ? now + intervalDays * DAY_MS
        : 0
      : mode === 'date' && date
        ? new Date(`${date}T00:00:00`).getTime()
        : 0;

  if (editItem) {
    const initialMode: RotationUiMode =
      editItem.rotationDueAt > 0 && editItem.rotationIntervalDays > 0
        ? 'days'
        : editItem.rotationDueAt > 0
          ? 'date'
          : 'none';
    const initialDays =
      editItem.rotationIntervalDays > 0 ? String(editItem.rotationIntervalDays) : '';
    const initialDate =
      editItem.rotationDueAt > 0 && editItem.rotationIntervalDays <= 0
        ? dateInputValue(editItem.rotationDueAt)
        : '';

    if (mode === initialMode && days === initialDays && date === initialDate) {
      return {
        rotationDueAt: editItem.rotationDueAt,
        rotationIntervalDays: editItem.rotationIntervalDays,
      };
    }
  }

  return { rotationDueAt: computed, rotationIntervalDays: intervalDays };
}

export function maskValue(value: string): string {
  if (value.length <= 8) return '••••••••';
  return value.substring(0, 4) + '••••••••' + value.substring(value.length - 4);
}

export function truncateValue(value: string, maxLength: number = 60): string {
  if (value.length <= maxLength) return value;
  return value.substring(0, maxLength) + '...';
}

export function getPasswordStrength(password: string): {
  score: number;
  label: string;
  color: string;
} {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 2) return { score, label: 'Fraca', color: 'var(--color-destructive)' };
  if (score <= 3) return { score, label: 'Média', color: 'var(--color-warning)' };
  if (score <= 4) return { score, label: 'Boa', color: 'var(--color-info)' };
  return { score, label: 'Forte', color: 'var(--color-success)' };
}

export function generateCustomPassword(options: {
  length: number;
  uppercase: boolean;
  lowercase: boolean;
  numbers: boolean;
  symbols: boolean;
}): string {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';

  let pool = '';
  const required: string[] = [];

  if (options.uppercase) {
    pool += upper;
    required.push(upper[Math.floor(Math.random() * upper.length)]);
  }
  if (options.lowercase) {
    pool += lower;
    required.push(lower[Math.floor(Math.random() * lower.length)]);
  }
  if (options.numbers) {
    pool += digits;
    required.push(digits[Math.floor(Math.random() * digits.length)]);
  }
  if (options.symbols) {
    pool += symbols;
    required.push(symbols[Math.floor(Math.random() * symbols.length)]);
  }

  if (pool.length === 0) {
    pool = lower + digits;
    required.push(lower[0], digits[0]);
  }

  const length = Math.max(options.length, required.length);
  const remaining = Array.from({ length: length - required.length }, () =>
    pool[Math.floor(Math.random() * pool.length)]
  );

  const combined = [...required, ...remaining];
  for (let i = combined.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [combined[i], combined[j]] = [combined[j], combined[i]];
  }

  return combined.join('');
}

const PASSPHRASE_WORDS = [
  'apple', 'arrow', 'beacon', 'breeze', 'bridge', 'cabin', 'canyon', 'castle', 'cipher',
  'cliff', 'clover', 'comet', 'coral', 'crystal', 'delta', 'drift', 'eagle', 'echo',
  'ember', 'falcon', 'feather', 'flame', 'forest', 'frost', 'galaxy', 'garden', 'glacier',
  'grove', 'harbor', 'haven', 'horizon', 'island', 'jungle', 'lagoon', 'lantern', 'meadow',
  'meteor', 'nebula', 'oasis', 'ocean', 'orbit', 'pebble', 'phoenix', 'planet', 'portal',
  'prism', 'quantum', 'quartz', 'radar', 'radiant', 'rainbow', 'ranger', 'reef', 'river',
  'rocket', 'shadow', 'shield', 'signal', 'silver', 'solar', 'spark', 'sphere', 'spirit',
  'spring', 'star', 'stellar', 'stone', 'summit', 'sunset', 'swift', 'temple', 'thunder',
  'tide', 'timber', 'topaz', 'trail', 'valley', 'vector', 'velvet', 'vessel', 'vortex',
  'voyage', 'wave', 'whisper', 'willow', 'winter', 'zenith', 'zephyr', 'zero', 'zone'
];

export function generatePassphrase(
  wordCount: number = 4,
  separator: string = '-',
  capitalize: boolean = true,
  includeNumber: boolean = true
): string {
  const words: string[] = [];
  for (let i = 0; i < wordCount; i++) {
    let word = PASSPHRASE_WORDS[Math.floor(Math.random() * PASSPHRASE_WORDS.length)];
    if (capitalize) {
      word = word.charAt(0).toUpperCase() + word.slice(1);
    }
    words.push(word);
  }

  let result = words.join(separator);
  if (includeNumber) {
    const num = Math.floor(Math.random() * 90 + 10);
    result += `${separator}${num}`;
  }
  return result;
}

export interface SecretAuditResult {
  totalSecrets: number;
  weakCount: number;
  weakItems: Item[];
  duplicateCount: number;
  duplicateItems: Item[];
  staleCount: number;
  staleItems: Item[];
  healthScore: number;
}

export function calculateSecretAudit(items: Item[]): SecretAuditResult {
  const apiItems = items.filter((i) => i.category === 'api');
  const now = Date.now();
  const ONE_HUNDRED_EIGHTY_DAYS = 180 * 24 * 60 * 60 * 1000;

  const weakItems: Item[] = [];
  const valueMap = new Map<string, Item[]>();
  const staleItems: Item[] = [];

  for (const item of apiItems) {
    const strength = getPasswordStrength(item.value);
    if (strength.score <= 2 || item.value.length < 10) {
      weakItems.push(item);
    }

    const list = valueMap.get(item.value) || [];
    list.push(item);
    valueMap.set(item.value, list);

    if (now - (item.updatedAt || item.createdAt) > ONE_HUNDRED_EIGHTY_DAYS) {
      staleItems.push(item);
    }
  }

  const duplicateItems: Item[] = [];
  for (const list of valueMap.values()) {
    if (list.length > 1) {
      duplicateItems.push(...list);
    }
  }

  const total = apiItems.length;
  let penalty = 0;
  if (total > 0) {
    penalty += (weakItems.length / total) * 50;
    penalty += (duplicateItems.length / total) * 30;
    penalty += (staleItems.length / total) * 20;
  }
  const healthScore = total === 0 ? 100 : Math.max(0, Math.min(100, Math.round(100 - penalty)));

  return {
    totalSecrets: total,
    weakCount: weakItems.length,
    weakItems,
    duplicateCount: duplicateItems.length,
    duplicateItems,
    staleCount: staleItems.length,
    staleItems,
    healthScore,
  };
}

