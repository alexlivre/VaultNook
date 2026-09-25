import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Item } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(timestamp: number): string {
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

export function maskValue(value: string): string {
  if (value.length <= 8) return '••••••••';
  return value.substring(0, 4) + '••••••••' + value.substring(value.length - 4);
}

export function truncateValue(value: string, maxLength: number = 60): string {
  if (value.length <= maxLength) return value;
  return value.substring(0, maxLength) + '...';
}

export function generatePassword(length: number = 32): string {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  const all = upper + lower + digits + symbols;

  // Guarantee at least one of each type
  const required = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    digits[Math.floor(Math.random() * digits.length)],
    symbols[Math.floor(Math.random() * symbols.length)],
  ];

  const remaining = Array.from({ length: length - 4 }, () =>
    all[Math.floor(Math.random() * all.length)]
  );

  const combined = [...required, ...remaining];
  // Shuffle using Fisher-Yates
  for (let i = combined.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [combined[i], combined[j]] = [combined[j], combined[i]];
  }

  return combined.join('');
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

