import { app } from 'electron';
import { existsSync, mkdirSync } from 'fs';
import { readFile, writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { timingSafeEqual } from 'crypto';
import {
  generateSalt,
  hashPassword,
  deriveKey,
  encrypt,
  decrypt,
  generateRecoveryPhrase,
  type VaultKey,
  type EncryptedData,
} from './crypto';
import type { Item, Category, ChangePassword } from '../../renderer/types';

function shouldEncrypt(category: string, formatVersion?: number): boolean {
  if (formatVersion === 2) return true;
  return category === 'api';
}

interface VaultData {
  version: string;
  formatVersion?: number;
  createdAt: number;
  passwordHash: string;
  salt: string;
  recoveryHash: string;
  hint: string;
  items: StoredItem[];
  settings: {
    autoLockTimer: number;
  };
}

interface StoredItem {
  id: string;
  name: string;
  value: string | EncryptedData;
  description: string;
  category: Category;
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
}

let vaultKey: VaultKey | null = null;
let vaultPath: string;
let vaultData: VaultData | null = null;
let activeVaultId: string | null = null;

function getVaultPath(vaultId?: string): string {
  if (vaultId) {
    return join(app.getPath('userData'), 'vaults', `${vaultId}.json`);
  }
  if (activeVaultId) {
    return join(app.getPath('userData'), 'vaults', `${activeVaultId}.json`);
  }
  return join(app.getPath('userData'), 'vault.json');
}

export function getVaultExists(): boolean {
  vaultPath = getVaultPath();
  return existsSync(vaultPath);
}

export function vaultExists(vaultId: string): boolean {
  return existsSync(getVaultPath(vaultId));
}

export async function loadVault(vaultId: string): Promise<boolean> {
  const path = getVaultPath(vaultId);
  if (!existsSync(path)) return false;

  vaultPath = path;
  const raw = await readFile(path, 'utf-8');
  vaultData = JSON.parse(raw);
  activeVaultId = vaultId;
  vaultKey = null;
  return true;
}

export async function createVault(password: string, hint: string = ''): Promise<{ recoveryPhrase: string[]; vaultId: string }> {
  const vaultsDir = join(app.getPath('userData'), 'vaults');
  if (!existsSync(vaultsDir)) {
    mkdirSync(vaultsDir, { recursive: true });
  }

  const id = activeVaultId || crypto.randomUUID();
  activeVaultId = id;
  vaultPath = getVaultPath(id);

  const salt = generateSalt();
  const hash = hashPassword(password, salt);
  const recoveryPhrase = generateRecoveryPhrase();
  const recoveryHash = hashPassword(recoveryPhrase.join(' '), salt);

  vaultData = {
    version: '0.1.0',
    formatVersion: 2,
    createdAt: Date.now(),
    passwordHash: hash.toString('base64'),
    salt: salt.toString('base64'),
    recoveryHash: recoveryHash.toString('base64'),
    hint,
    items: [],
    settings: {
      autoLockTimer: 60,
    },
  };

  await saveVault();
  vaultKey = deriveKey(password, salt);

  return { recoveryPhrase, vaultId: id };
}

export async function unlockVault(password: string): Promise<boolean> {
  if (!existsSync(vaultPath)) return false;

  const raw = await readFile(vaultPath, 'utf-8');
  vaultData = JSON.parse(raw);
  const parsed = vaultData!;
  const salt = Buffer.from(parsed.salt, 'base64');
  const hash = hashPassword(password, salt);

  const expected = Buffer.from(parsed.passwordHash, 'base64');
  if (!timingSafeEqual(hash, expected)) {
    return false;
  }

  vaultKey = deriveKey(password, salt);
  return true;
}

export function lockVault(): void {
  if (vaultKey) {
    vaultKey.zeroize();
    vaultKey = null;
  }
  vaultData = null;
  activeVaultId = null;
}

export function getActiveVaultId(): string | null {
  return activeVaultId;
}

export async function changePassword(data: ChangePassword): Promise<boolean> {
  if (!vaultData || !vaultKey) return false;

  const salt = Buffer.from(vaultData.salt, 'base64');
  const currentHash = hashPassword(data.currentPassword, salt);

  const expected = Buffer.from(vaultData.passwordHash, 'base64');
  if (!timingSafeEqual(currentHash, expected)) {
    return false;
  }

  const decryptedItems = vaultData.items.map((item) => ({
    ...item,
    value:
      typeof item.value === 'object'
        ? decrypt(item.value, vaultKey!)
        : item.value,
  }));

  vaultKey.zeroize();
  vaultKey = deriveKey(data.newPassword, salt);

  const fv = vaultData.formatVersion || 1;
  vaultData.items = decryptedItems.map((item) => ({
    ...item,
    value: shouldEncrypt(item.category, fv) ? encrypt(item.value, vaultKey!) : item.value,
  }));

  const newHash = hashPassword(data.newPassword, salt);
  vaultData!.passwordHash = newHash.toString('base64');
  await saveVault();
  return true;
}

export async function deleteVault(vaultId: string): Promise<void> {
  lockVault();
  const path = getVaultPath(vaultId);
  if (existsSync(path)) {
    await unlink(path);
  }
}

export async function getVaultInfo() {
  if (!vaultData) return null;
  const itemsByCategory: Record<string, number> = {
    api: 0,
    prompt: 0,
    command: 0,
    link: 0,
  };
  vaultData.items.forEach((item) => {
    itemsByCategory[item.category] = (itemsByCategory[item.category] || 0) + 1;
  });
  return {
    createdAt: vaultData.createdAt,
    totalItems: vaultData.items.length,
    itemsByCategory,
    appVersion: '0.1.0',
  };
}

export async function getAllItems(): Promise<Item[]> {
  if (!vaultData || !vaultKey) return [];
  const vk = vaultKey;
  return vaultData.items.map((item) => ({
    ...item,
    value:
      typeof item.value === 'object'
        ? decrypt(item.value, vk)
        : item.value,
  }));
}

export async function addItem(item: Item): Promise<void> {
  if (!vaultData || !vaultKey) return;
  const fv = vaultData.formatVersion || 1;
  vaultData.items.push({
    ...item,
    value: shouldEncrypt(item.category, fv) ? encrypt(item.value, vaultKey) : item.value,
  });
  await saveVault();
}

export async function editItem(item: Item): Promise<void> {
  if (!vaultData || !vaultKey) return;
  const fv = vaultData.formatVersion || 1;
  const index = vaultData.items.findIndex((i) => i.id === item.id);
  if (index === -1) return;
  vaultData.items[index] = {
    ...item,
    value: shouldEncrypt(item.category, fv) ? encrypt(item.value, vaultKey) : item.value,
  };
  await saveVault();
}

export async function removeItem(id: string): Promise<void> {
  if (!vaultData) return;
  vaultData.items = vaultData.items.filter((i) => i.id !== id);
  await saveVault();
}

export async function exportVault(): Promise<string> {
  if (!vaultData) return '{}';
  return JSON.stringify(
    {
      formatVersion: vaultData.formatVersion || 1,
      version: vaultData.version,
      createdAt: vaultData.createdAt,
      exportedAt: Date.now(),
      passwordHash: vaultData.passwordHash,
      salt: vaultData.salt,
      recoveryHash: vaultData.recoveryHash,
      settings: vaultData.settings,
      items: vaultData.items,
    },
    null,
    2
  );
}

export async function exportVaultRaw(vaultId: string): Promise<string | null> {
  const path = getVaultPath(vaultId);
  if (!existsSync(path)) return null;
  return readFile(path, 'utf-8');
}

export async function importVault(jsonData: string): Promise<{ imported: number; ignored: number; total: number }> {
  if (!vaultData) return { imported: 0, ignored: 0, total: 0 };
  try {
    const data = JSON.parse(jsonData);
    const existingNames = new Set(vaultData.items.map((i) => i.name));
    let imported = 0;
    let ignored = 0;

    const fv = vaultData.formatVersion || 1;
    for (const item of data.items || []) {
      if (existingNames.has(item.name)) {
        ignored++;
      } else {
        const value = shouldEncrypt(item.category, fv) && typeof item.value === 'string'
          ? encrypt(item.value, vaultKey!)
          : item.value;
        vaultData.items.push({
          id: crypto.randomUUID(),
          name: item.name,
          value,
          description: item.description || '',
          category: item.category,
          favorite: item.favorite || false,
          createdAt: item.createdAt || Date.now(),
          updatedAt: Date.now(),
        });
        existingNames.add(item.name);
        imported++;
      }
    }
    await saveVault();
    return { imported, ignored, total: data.items?.length || 0 };
  } catch {
    return { imported: 0, ignored: 0, total: 0 };
  }
}

export async function saveAutoLockTimer(timer: number): Promise<void> {
  if (!vaultData) return;
  vaultData.settings.autoLockTimer = timer;
  await saveVault();
}

export async function getAutoLockTimer(): Promise<number> {
  return vaultData?.settings.autoLockTimer ?? 60;
}

export async function getVaultMetadata(vaultId: string): Promise<{ totalItems: number; itemsByCategory: Record<string, number> } | null> {
  const path = getVaultPath(vaultId);
  if (!existsSync(path)) return null;
  try {
    const raw = await readFile(path, 'utf-8');
    const data = JSON.parse(raw);
    const itemsByCategory: Record<string, number> = {
      api: 0,
      prompt: 0,
      command: 0,
      link: 0,
    };
    const items = (data.items || []) as { category: string }[];
    items.forEach((item) => {
      itemsByCategory[item.category] = (itemsByCategory[item.category] || 0) + 1;
    });
    return {
      totalItems: data.items?.length || 0,
      itemsByCategory,
    };
  } catch {
    return null;
  }
}

export async function migrateToFullEncryption(): Promise<boolean> {
  if (!vaultData || !vaultKey || vaultData.formatVersion === 2) return false;

  const decryptedItems = vaultData.items.map((item) => ({
    ...item,
    value: typeof item.value === 'object'
      ? decrypt(item.value, vaultKey!)
      : item.value,
  }));

  vaultData.items = decryptedItems.map((item) => ({
    ...item,
    value: encrypt(item.value, vaultKey!),
  }));

  vaultData.formatVersion = 2;
  await saveVault();
  return true;
}

async function saveVault(): Promise<void> {
  if (!vaultData || !vaultPath) return;
  await writeFile(vaultPath, JSON.stringify(vaultData, null, 2), 'utf-8');
}

