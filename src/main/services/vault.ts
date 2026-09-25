import { app } from 'electron';
import { existsSync, mkdirSync } from 'fs';
import { readFile, unlink } from 'fs/promises';
import { join } from 'path';
import { randomUUID, timingSafeEqual } from 'crypto';
import {
  generateSalt,
  hashPassword,
  deriveKey,
  generateMasterKey,
  encrypt,
  decrypt,
  encryptKey,
  decryptKey,
  generateRecoveryPhrase,
  type VaultKey,
  type EncryptedData,
} from './crypto';
import { atomicWriteFile, restrictPathAcl } from './fs-utils';
import type { Item, Category, ChangePassword } from '../../renderer/types';

interface StoredItem {
  id: string;
  name: EncryptedData;
  value: EncryptedData;
  publicKey?: EncryptedData | null;
  description: EncryptedData | null;
  tags?: EncryptedData | null;
  category: Category;
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
}

interface LegacyItem {
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

interface LegacyVaultData {
  version?: string;
  formatVersion?: number;
  createdAt?: number;
  passwordHash: string;
  salt: string;
  hint?: string;
  items?: LegacyItem[];
  settings?: { autoLockTimer: number };
}

interface VaultData {
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
  settings: {
    autoLockTimer: number;
  };
}

let vaultKey: VaultKey | null = null;
let vaultPath: string;
let vaultData: VaultData | null = null;
let activeVaultId: string | null = null;

function toVaultKey(buffer: Buffer): VaultKey {
  return {
    key: buffer,
    zeroize() {
      buffer.fill(0);
    },
  } as VaultKey;
}

function getVaultPath(vaultId?: string): string {
  if (vaultId) {
    return join(app.getPath('userData'), 'vaults', `${vaultId}.json`);
  }
  if (activeVaultId) {
    return join(app.getPath('userData'), 'vaults', `${activeVaultId}.json`);
  }
  return join(app.getPath('userData'), 'vault.json');
}

function getVaultsDir(): string {
  return join(app.getPath('userData'), 'vaults');
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

export async function createVault(password: string, hint: string = ''): Promise<{ recoveryPhrase: string; vaultId: string }> {
  const vaultsDir = getVaultsDir();
  if (!existsSync(vaultsDir)) {
    mkdirSync(vaultsDir, { recursive: true });
  }
  await restrictPathAcl(vaultsDir);

  const id = activeVaultId || randomUUID();
  activeVaultId = id;
  vaultPath = getVaultPath(id);

  const salt = generateSalt();
  const passwordHash = await hashPassword(password, salt);
  const phrase = generateRecoveryPhrase();
  const recoveryHash = await hashPassword(phrase, salt);
  const masterKey = toVaultKey(generateMasterKey());

  const passwordKey = await deriveKey(password, salt);
  const masterKeyWrap = encryptKey(masterKey.key, passwordKey.key);
  passwordKey.zeroize();

  const recoveryKey = await deriveKey(phrase, salt);
  const recoveryKeyWrap = encryptKey(masterKey.key, recoveryKey.key);
  recoveryKey.zeroize();

  vaultData = {
    version: '0.2.0',
    formatVersion: 3,
    createdAt: Date.now(),
    passwordHash: passwordHash.toString('base64'),
    salt: salt.toString('base64'),
    recoveryHash: recoveryHash.toString('base64'),
    masterKeyWrap,
    recoveryKeyWrap,
    hint,
    items: [],
    settings: { autoLockTimer: 60 },
  };
  vaultKey = masterKey;

  await saveVault();
  return { recoveryPhrase: phrase, vaultId: id };
}

async function migrateToV3(parsed: LegacyVaultData, passwordKey: VaultKey, salt: Buffer): Promise<string> {
  const masterKey = toVaultKey(generateMasterKey());
  const newPhrase = generateRecoveryPhrase();

  const items: StoredItem[] = (parsed.items || []).map((item) => {
    const rawValue = typeof item.value === 'object' ? decrypt(item.value, passwordKey) : (item.value as string);
    const tagsEnc = Array.isArray(item.tags) && item.tags.length > 0
      ? encrypt(JSON.stringify(item.tags), masterKey)
      : null;
    return {
      id: item.id || randomUUID(),
      name: encrypt(item.name || '', masterKey),
      value: encrypt(rawValue || '', masterKey),
      description: item.description ? encrypt(item.description, masterKey) : null,
      tags: tagsEnc,
      category: item.category as Category,
      favorite: !!item.favorite,
      createdAt: item.createdAt ?? Date.now(),
      updatedAt: item.updatedAt ?? Date.now(),
    };
  });

  const recoveryKey = await deriveKey(newPhrase, salt);
  vaultData = {
    version: '0.2.0',
    formatVersion: 3,
    createdAt: parsed.createdAt ?? Date.now(),
    passwordHash: parsed.passwordHash,
    salt: parsed.salt,
    recoveryHash: (await hashPassword(newPhrase, salt)).toString('base64'),
    masterKeyWrap: encryptKey(masterKey.key, passwordKey.key),
    recoveryKeyWrap: encryptKey(masterKey.key, recoveryKey.key),
    hint: parsed.hint ?? '',
    items,
    settings: parsed.settings ?? { autoLockTimer: 60 },
  };
  recoveryKey.zeroize();
  vaultKey = masterKey;
  await saveVault();
  return newPhrase;
}

function unwrapMasterKey(data: VaultData, wrappingKey: VaultKey): VaultKey {
  const master = decryptKey(data.masterKeyWrap, wrappingKey.key);
  return toVaultKey(master);
}

export async function unlockVault(password: string): Promise<{ ok: boolean; recoveryPhrase?: string }> {
  if (!existsSync(vaultPath)) return { ok: false };

  const raw = await readFile(vaultPath, 'utf-8');
  const parsed = JSON.parse(raw);
  const salt = Buffer.from(parsed.salt, 'base64');

  const passwordKey = await deriveKey(password, salt);
  const hash = await hashPassword(password, salt);
  const expected = Buffer.from(parsed.passwordHash, 'base64');
  if (hash.length !== expected.length || !timingSafeEqual(hash, expected)) {
    passwordKey.zeroize();
    return { ok: false };
  }

  const fv = parsed.formatVersion || 1;
  let migratedPhrase: string | undefined;
  if (fv < 3) {
    migratedPhrase = await migrateToV3(parsed, passwordKey, salt);
  } else {
    vaultData = parsed;
    vaultKey = unwrapMasterKey(parsed, passwordKey);
  }
  passwordKey.zeroize();

  return { ok: true, recoveryPhrase: migratedPhrase };
}

export function lockVault(): void {
  if (vaultKey) {
    vaultKey.zeroize();
    vaultKey = null;
  }
  vaultData = null;
}

export function getActiveVaultId(): string | null {
  return activeVaultId;
}

export async function changePassword(data: ChangePassword): Promise<{ ok: boolean; recoveryPhrase?: string }> {
  if (!vaultData || !vaultKey) return { ok: false };
  const salt = Buffer.from(vaultData.salt, 'base64');
  const currentHash = await hashPassword(data.currentPassword, salt);
  const expected = Buffer.from(vaultData.passwordHash, 'base64');
  if (currentHash.length !== expected.length || !timingSafeEqual(currentHash, expected)) {
    return { ok: false };
  }
  const newPasswordKey = await deriveKey(data.newPassword, salt);
  vaultData.masterKeyWrap = encryptKey(vaultKey.key, newPasswordKey.key);
  vaultData.passwordHash = (await hashPassword(data.newPassword, salt)).toString('base64');
  newPasswordKey.zeroize();

  const newPhrase = generateRecoveryPhrase();
  const newRecoveryKey = await deriveKey(newPhrase, salt);
  vaultData.recoveryKeyWrap = encryptKey(vaultKey.key, newRecoveryKey.key);
  vaultData.recoveryHash = (await hashPassword(newPhrase, salt)).toString('base64');
  newRecoveryKey.zeroize();

  await saveVault();
  return { ok: true, recoveryPhrase: newPhrase };
}

export async function regenerateRecoveryPhrase(currentPassword: string): Promise<{ ok: boolean; recoveryPhrase?: string }> {
  if (!vaultData || !vaultKey) return { ok: false };
  const salt = Buffer.from(vaultData.salt, 'base64');
  const currentHash = await hashPassword(currentPassword, salt);
  const expected = Buffer.from(vaultData.passwordHash, 'base64');
  if (currentHash.length !== expected.length || !timingSafeEqual(currentHash, expected)) {
    return { ok: false };
  }

  const newPhrase = generateRecoveryPhrase();
  const newRecoveryKey = await deriveKey(newPhrase, salt);
  vaultData.recoveryKeyWrap = encryptKey(vaultKey.key, newRecoveryKey.key);
  vaultData.recoveryHash = (await hashPassword(newPhrase, salt)).toString('base64');
  newRecoveryKey.zeroize();

  await saveVault();
  return { ok: true, recoveryPhrase: newPhrase };
}

export async function recoverVault(vaultId: string, phrase: string, newPassword: string): Promise<boolean> {
  const path = getVaultPath(vaultId);
  if (!existsSync(path)) return false;
  const raw = await readFile(path, 'utf-8');
  const parsed = JSON.parse(raw);
  if ((parsed.formatVersion || 1) < 3) return false;

  const salt = Buffer.from(parsed.salt, 'base64');
  const normalizedPhrase = phrase.trim().toLowerCase().split(/\s+/).join(' ');
  const recoveryKey = await deriveKey(normalizedPhrase, salt);

  let master: Buffer;
  try {
    master = decryptKey(parsed.recoveryKeyWrap, recoveryKey.key);
  } catch {
    recoveryKey.zeroize();
    return false;
  }
  recoveryKey.zeroize();

  vaultData = parsed;
  vaultKey = toVaultKey(master);
  activeVaultId = vaultId;
  vaultPath = path;

  const newPasswordKey = await deriveKey(newPassword, salt);
  vaultData.masterKeyWrap = encryptKey(master, newPasswordKey.key);
  vaultData.passwordHash = (await hashPassword(newPassword, salt)).toString('base64');
  newPasswordKey.zeroize();
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

export async function saveAutoLockTimer(timer: number): Promise<void> {
  if (!vaultData) return;
  vaultData.settings.autoLockTimer = timer;
  await saveVault();
}

export async function getAutoLockTimer(): Promise<number> {
  return vaultData?.settings.autoLockTimer ?? 60;
}

export async function getVaultInfo() {  if (!vaultData) return null;
  const itemsByCategory: Record<string, number> = { api: 0, prompt: 0, command: 0, link: 0, keypair: 0 };
  for (const item of vaultData.items) {
    itemsByCategory[item.category] = (itemsByCategory[item.category] || 0) + 1;
  }
  return {
    createdAt: vaultData.createdAt,
    totalItems: vaultData.items.length,
    itemsByCategory,
    appVersion: app.getVersion(),
  };
}

export async function getVaultMetadata(vaultId: string) {
  const path = getVaultPath(vaultId);
  if (!existsSync(path)) return null;
  try {
    const raw = await readFile(path, 'utf-8');
    const data = JSON.parse(raw);
    const items = (data.items || []) as { category: string }[];
    const itemsByCategory: Record<string, number> = { api: 0, prompt: 0, command: 0, link: 0, keypair: 0 };
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

export async function getAllItems(): Promise<Item[]> {
  if (!vaultData || !vaultKey) return [];
  return vaultData.items.map((item) => {
    let tags: string[] = [];
    if (item.tags) {
      try {
        const rawTags = decrypt(item.tags, vaultKey!);
        tags = JSON.parse(rawTags);
      } catch {
        tags = [];
      }
    }
    return {
      id: item.id,
      name: decrypt(item.name, vaultKey!),
      value: decrypt(item.value, vaultKey!),
      publicKey: item.publicKey ? decrypt(item.publicKey, vaultKey!) : '',
      description: item.description ? decrypt(item.description, vaultKey!) : '',
      tags: Array.isArray(tags) ? tags : [],
      category: item.category,
      favorite: item.favorite,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  });
}

function toStoredItem(item: Item): StoredItem {
  const tagsEnc = Array.isArray(item.tags) && item.tags.length > 0
    ? encrypt(JSON.stringify(item.tags), vaultKey!)
    : null;
  return {
    id: item.id,
    name: encrypt(item.name, vaultKey!),
    value: encrypt(item.value, vaultKey!),
    publicKey: item.publicKey ? encrypt(item.publicKey, vaultKey!) : null,
    description: item.description ? encrypt(item.description, vaultKey!) : null,
    tags: tagsEnc,
    category: item.category,
    favorite: item.favorite,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export async function addItem(item: Item): Promise<void> {
  if (!vaultData || !vaultKey) return;
  vaultData.items.push(toStoredItem(item));
  await saveVault();
}

export async function editItem(item: Item): Promise<void> {
  if (!vaultData || !vaultKey) return;
  vaultData.items = vaultData.items.map((i) => (i.id === item.id ? toStoredItem(item) : i));
  await saveVault();
}

export async function removeItem(id: string): Promise<void> {
  if (!vaultData) return;
  vaultData.items = vaultData.items.filter((i) => i.id !== id);
  await saveVault();
}

export async function removeItems(ids: string[]): Promise<void> {
  if (!vaultData) return;
  const idSet = new Set(ids);
  vaultData.items = vaultData.items.filter((i) => !idSet.has(i.id));
  await saveVault();
}

export async function moveCategoryItems(ids: string[], newCategory: Category): Promise<void> {
  if (!vaultData) return;
  const idSet = new Set(ids);
  vaultData.items = vaultData.items.map((i) => {
    if (idSet.has(i.id)) {
      return { ...i, category: newCategory, updatedAt: Date.now() };
    }
    return i;
  });
  await saveVault();
}

export async function exportVault(): Promise<string> {
  if (!vaultData) return '{}';
  return JSON.stringify(
    {
      formatVersion: 3,
      version: vaultData.version,
      createdAt: vaultData.createdAt,
      exportedAt: Date.now(),
      passwordHash: vaultData.passwordHash,
      salt: vaultData.salt,
      recoveryHash: vaultData.recoveryHash,
      masterKeyWrap: vaultData.masterKeyWrap,
      recoveryKeyWrap: vaultData.recoveryKeyWrap,
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
  if (!vaultData || !vaultKey) throw new Error('Vault bloqueado');
  const data = JSON.parse(jsonData);
  if (!data || typeof data !== 'object' || !Array.isArray(data.items)) {
    throw new Error('Backup inválido');
  }

  const existingIds = new Set(vaultData.items.map((i) => i.id));
  let imported = 0;
  let ignored = 0;
  const sourceFv = data.formatVersion || 1;

  for (const item of data.items) {
    if (existingIds.has(item.id)) {
      ignored++;
      continue;
    }
    let stored: StoredItem;
    if (sourceFv === 3) {
      try {
        decrypt(item.value, vaultKey!);
      } catch {
        throw new Error('Backup de outro cofre: importe como novo cofre');
      }
      stored = {
        id: item.id,
        name: item.name,
        value: item.value,
        publicKey: item.publicKey ?? null,
        description: item.description ?? null,
        tags: item.tags ?? null,
        category: item.category,
        favorite: !!item.favorite,
        createdAt: item.createdAt ?? Date.now(),
        updatedAt: item.updatedAt ?? Date.now(),
      };
    } else {
      const rawValue = typeof item.value === 'string' ? item.value : '';
      const tagsEnc = Array.isArray(item.tags) && item.tags.length > 0
        ? encrypt(JSON.stringify(item.tags), vaultKey!)
        : null;
      const rawPublicKey = typeof item.publicKey === 'string' ? item.publicKey : '';
      stored = {
        id: item.id || randomUUID(),
        name: encrypt(item.name || '', vaultKey!),
        value: encrypt(rawValue, vaultKey!),
        publicKey: rawPublicKey ? encrypt(rawPublicKey, vaultKey!) : null,
        description: item.description ? encrypt(item.description, vaultKey!) : null,
        tags: tagsEnc,
        category: item.category as Category,
        favorite: !!item.favorite,
        createdAt: item.createdAt ?? Date.now(),
        updatedAt: item.updatedAt ?? Date.now(),
      };
    }
    vaultData.items.push(stored);
    imported++;
  }

  await saveVault();
  return { imported, ignored, total: data.items.length };
}

async function saveVault(): Promise<void> {
  if (!vaultData || !vaultPath) return;
  await atomicWriteFile(vaultPath, JSON.stringify(vaultData, null, 2));
}
