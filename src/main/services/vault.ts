import { app } from 'electron';
import { readFileSync, writeFileSync, existsSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';
import {
  generateSalt,
  hashPassword,
  deriveKey,
  encrypt,
  decrypt,
  generateRecoveryPhrase,
  validateRecoveryPhrase,
  type VaultKey,
  type EncryptedData,
} from './crypto';
import type { Item, Category, ChangePassword } from '../../renderer/types';

interface VaultData {
  version: string;
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

export function loadVault(vaultId: string): boolean {
  const path = getVaultPath(vaultId);
  if (!existsSync(path)) return false;

  vaultPath = path;
  const raw = readFileSync(path, 'utf-8');
  vaultData = JSON.parse(raw);
  activeVaultId = vaultId;
  vaultKey = null;
  return true;
}

export function createVault(password: string, hint: string = ''): { recoveryPhrase: string[]; vaultId: string } {
  saveVaultId();
  
  // Create vaults directory if needed
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

  saveVault();
  vaultKey = deriveKey(password, salt);

  return { recoveryPhrase, vaultId: id };
}

export function unlockVault(password: string): boolean {
  if (!existsSync(vaultPath)) return false;

  const raw = readFileSync(vaultPath, 'utf-8');
  vaultData = JSON.parse(raw);
  const parsed = vaultData!;
  const salt = Buffer.from(parsed.salt, 'base64');
  const hash = hashPassword(password, salt);

  if (hash.toString('base64') !== parsed.passwordHash) {
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

export function changePassword(data: ChangePassword): boolean {
  if (!vaultData || !vaultKey) return false;

  const salt = Buffer.from(vaultData.salt, 'base64');
  const currentHash = hashPassword(data.currentPassword, salt);

  if (currentHash.toString('base64') !== vaultData.passwordHash) {
    return false;
  }

  // Decrypt all items with old key
  const decryptedItems = vaultData.items.map((item) => ({
    ...item,
    value:
      typeof item.value === 'object'
        ? decrypt(item.value, vaultKey!)
        : item.value,
  }));

  // Derive new key
  vaultKey.zeroize();
  vaultKey = deriveKey(data.newPassword, salt);

  // Re-encrypt API items with new key
  vaultData.items = decryptedItems.map((item) => ({
    ...item,
    value:
      item.category === 'api'
        ? encrypt(item.value, vaultKey!)
        : item.value,
  }));

  // Update password hash
  const newHash = hashPassword(data.newPassword, salt);
  vaultData!.passwordHash = newHash.toString('base64');
  saveVault();
  return true;
}

export function deleteVault(vaultId: string): void {
  lockVault();
  const path = getVaultPath(vaultId);
  if (existsSync(path)) {
    unlinkSync(path);
  }
}

export function getVaultInfo() {
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

export function getAllItems(): Item[] {
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

export function addItem(item: Item): void {
  if (!vaultData || !vaultKey) return;
  vaultData.items.push({
    ...item,
    value:
      item.category === 'api' ? encrypt(item.value, vaultKey) : item.value,
  });
  saveVault();
}

export function editItem(item: Item): void {
  if (!vaultData || !vaultKey) return;
  const index = vaultData.items.findIndex((i) => i.id === item.id);
  if (index === -1) return;
  vaultData.items[index] = {
    ...item,
    value:
      item.category === 'api' ? encrypt(item.value, vaultKey) : item.value,
  };
  saveVault();
}

export function removeItem(id: string): void {
  if (!vaultData) return;
  vaultData.items = vaultData.items.filter((i) => i.id !== id);
  saveVault();
}

export function exportVault(): string {
  if (!vaultData) return '{}';
  return JSON.stringify(
    {
      version: vaultData.version,
      createdAt: vaultData.createdAt,
      exportedAt: Date.now(),
      items: vaultData.items,
    },
    null,
    2
  );
}

export function exportVaultRaw(vaultId: string): string | null {
  const path = getVaultPath(vaultId);
  if (!existsSync(path)) return null;
  return readFileSync(path, 'utf-8');
}

export function importVault(jsonData: string): { imported: number; ignored: number; total: number } {
  if (!vaultData) return { imported: 0, ignored: 0, total: 0 };
  try {
    const data = JSON.parse(jsonData);
    const existingNames = new Set(vaultData.items.map((i) => i.name));
    let imported = 0;
    let ignored = 0;

    for (const item of data.items || []) {
      if (existingNames.has(item.name)) {
        ignored++;
      } else {
        vaultData.items.push({
          id: item.id,
          name: item.name,
          value: item.value,
          description: item.description || '',
          category: item.category,
          favorite: item.favorite || false,
          createdAt: item.createdAt || Date.now(),
          updatedAt: item.updatedAt || Date.now(),
        });
        existingNames.add(item.name);
        imported++;
      }
    }
    saveVault();
    return { imported, ignored, total: data.items?.length || 0 };
  } catch {
    return { imported: 0, ignored: 0, total: 0 };
  }
}

export function saveAutoLockTimer(timer: number): void {
  if (!vaultData) return;
  vaultData.settings.autoLockTimer = timer;
  saveVault();
}

export function getAutoLockTimer(): number {
  return vaultData?.settings.autoLockTimer ?? 60;
}

export function getVaultMetadata(vaultId: string): { totalItems: number; itemsByCategory: Record<string, number> } | null {
  const path = getVaultPath(vaultId);
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, 'utf-8');
    const data = JSON.parse(raw);
    const itemsByCategory: Record<string, number> = {
      api: 0,
      prompt: 0,
      command: 0,
      link: 0,
    };
    (data.items || []).forEach((item: any) => {
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

function saveVault(): void {
  if (!vaultData || !vaultPath) return;
  writeFileSync(vaultPath, JSON.stringify(vaultData, null, 2), 'utf-8');
}

function saveVaultId(): void {
  // Used only to set up vaultId from context before createVault
}
