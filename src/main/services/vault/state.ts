import type { VaultKey, EncryptedData } from '../crypto';
import type { Category } from '../../../shared/schemas';

export interface StoredItem {
  id: string;
  name: EncryptedData;
  value: EncryptedData;
  publicKey?: EncryptedData | null;
  description: EncryptedData | null;
  tags?: EncryptedData | null;
  projectId?: string;
  rotationDueAt?: number;
  rotationIntervalDays?: number;
  rotationUrl?: EncryptedData | null;
  category: Category;
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface StoredProject {
  id: string;
  name: EncryptedData;
  color: string;
  createdAt: number;
  updatedAt: number;
}

export interface LegacyItem {
  id?: string;
  name?: string;
  value: string | EncryptedData;
  publicKey?: string | EncryptedData;
  description?: string;
  tags?: string[];
  category: Category;
  favorite?: boolean;
  createdAt?: number;
  updatedAt?: number;
}

export interface LegacyVaultData {
  version?: string;
  formatVersion?: number;
  createdAt?: number;
  passwordHash: string;
  salt: string;
  hint?: string;
  items?: LegacyItem[];
  settings?: { autoLockTimer: number };
}

export interface VaultData {
  version: string;
  formatVersion: 3;
  createdAt: number;
  passwordHash: string;
  salt: string;
  recoveryHash: string;
  masterKeyWrap: EncryptedData;
  recoveryKeyWrap: EncryptedData;
  hint: string;
  items: StoredItem[];
  projects: StoredProject[];
  rotationSeeded: boolean;
  settings: {
    autoLockTimer: number;
  };
}

export function normalizeVaultData(data: VaultData): VaultData {
  if (!Array.isArray(data.projects)) {
    data.projects = [];
  }
  if (data.rotationSeeded !== true) {
    data.rotationSeeded = false;
  }
  if (Array.isArray(data.items)) {
    data.items = data.items.map((item) => ({
      ...item,
      projectId: item.projectId ?? '',
      rotationDueAt: item.rotationDueAt ?? 0,
      rotationIntervalDays: item.rotationIntervalDays ?? 0,
      rotationUrl: item.rotationUrl ?? null,
    }));
  }
  return data;
}

export function seedRotationAlerts(data: VaultData): boolean {
  if (data.rotationSeeded) return false;
  const now = Date.now();
  for (const item of data.items) {
    if ((item.category === 'api' || item.category === 'keypair') && !item.rotationDueAt) {
      item.rotationDueAt = now;
    }
  }
  data.rotationSeeded = true;
  return true;
}

export const vaultState = {
  key: null as VaultKey | null,
  path: '',
  data: null as VaultData | null,
  activeVaultId: null as string | null,
};

export function lockVault(): void {
  if (vaultState.key) {
    vaultState.key.zeroize();
    vaultState.key = null;
  }
  vaultState.data = null;
  vaultState.activeVaultId = null;
}

export function getActiveVaultId(): string | null {
  return vaultState.activeVaultId;
}
