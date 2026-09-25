import { app } from 'electron';
import { existsSync, mkdirSync } from 'fs';
import { readFile } from 'fs/promises';
import { randomUUID, timingSafeEqual } from 'crypto';
import {
  generateSalt,
  deriveKey,
  generateMasterKey,
  encryptKey,
  decryptKey,
  generateRecoveryPhrase,
} from './crypto';
import { restrictPathAclOnce } from './fs-utils';
import { getVaultPath, getVaultsDir, saveVault } from './vault/storage';
import { toVaultKey, unwrapMasterKey } from './vault/key';
import { migrateToV3 } from './vault/migration';
import { vaultState } from './vault/state';
import type { ChangePassword } from '../../shared/schemas';

export { hasItem, getAllItems, addItem, editItem, removeItem, removeItems, moveCategoryItems } from './vault/items';
export { loadVault, deleteVault, exportVaultRaw, getVaultMetadata } from './vault/storage';
export { exportVault, importVault } from './vault/backup';
export { lockVault, getActiveVaultId } from './vault/state';

export async function createVault(password: string, hint: string = ''): Promise<{ recoveryPhrase: string; vaultId: string }> {
  const vaultsDir = getVaultsDir();
  if (!existsSync(vaultsDir)) {
    mkdirSync(vaultsDir, { recursive: true });
  }
  await restrictPathAclOnce(vaultsDir);

  vaultState.key?.zeroize();

  const id = randomUUID();
  vaultState.activeVaultId = id;
  vaultState.path = getVaultPath(id);

  const salt = generateSalt();
  const phrase = generateRecoveryPhrase();
  const masterKey = toVaultKey(generateMasterKey());

  const passwordKey = await deriveKey(password, salt);
  const passwordHash = passwordKey.key.toString('base64');
  const masterKeyWrap = encryptKey(masterKey.key, passwordKey.key);
  passwordKey.zeroize();

  const recoveryKey = await deriveKey(phrase, salt);
  const recoveryHash = recoveryKey.key.toString('base64');
  const recoveryKeyWrap = encryptKey(masterKey.key, recoveryKey.key);
  recoveryKey.zeroize();

  vaultState.data = {
    version: '0.2.0',
    formatVersion: 3,
    createdAt: Date.now(),
    passwordHash,
    salt: salt.toString('base64'),
    recoveryHash,
    masterKeyWrap,
    recoveryKeyWrap,
    hint,
    items: [],
    settings: { autoLockTimer: 60 },
  };
  vaultState.key = masterKey;

  await saveVault();
  return { recoveryPhrase: phrase, vaultId: id };
}

export async function unlockVault(password: string): Promise<{ ok: boolean; recoveryPhrase?: string }> {
  if (!existsSync(vaultState.path)) return { ok: false };

  const raw = await readFile(vaultState.path, 'utf-8');
  const parsed = JSON.parse(raw);
  const salt = Buffer.from(parsed.salt, 'base64');

  const passwordKey = await deriveKey(password, salt);
  const expected = Buffer.from(parsed.passwordHash, 'base64');
  if (passwordKey.key.length !== expected.length || !timingSafeEqual(passwordKey.key, expected)) {
    passwordKey.zeroize();
    return { ok: false };
  }

  const fv = parsed.formatVersion || 1;
  let migratedPhrase: string | undefined;
  if (fv < 3) {
    migratedPhrase = await migrateToV3(parsed, passwordKey, salt);
  } else {
    vaultState.data = parsed;
    vaultState.key = unwrapMasterKey(parsed, passwordKey);
  }
  passwordKey.zeroize();

  return { ok: true, recoveryPhrase: migratedPhrase };
}

export async function changePassword(data: ChangePassword): Promise<{ ok: boolean; recoveryPhrase?: string }> {
  if (!vaultState.data || !vaultState.key) return { ok: false };
  const vault = vaultState.data;
  const masterKey = vaultState.key;
  const salt = Buffer.from(vault.salt, 'base64');
  const currentKey = await deriveKey(data.currentPassword, salt);
  const expected = Buffer.from(vault.passwordHash, 'base64');
  const matches = currentKey.key.length === expected.length && timingSafeEqual(currentKey.key, expected);
  currentKey.zeroize();
  if (!matches) {
    return { ok: false };
  }
  const newPasswordKey = await deriveKey(data.newPassword, salt);
  vault.masterKeyWrap = encryptKey(masterKey.key, newPasswordKey.key);
  vault.passwordHash = newPasswordKey.key.toString('base64');
  newPasswordKey.zeroize();

  const newPhrase = generateRecoveryPhrase();
  const newRecoveryKey = await deriveKey(newPhrase, salt);
  vault.recoveryKeyWrap = encryptKey(masterKey.key, newRecoveryKey.key);
  vault.recoveryHash = newRecoveryKey.key.toString('base64');
  newRecoveryKey.zeroize();

  await saveVault();
  return { ok: true, recoveryPhrase: newPhrase };
}

export async function regenerateRecoveryPhrase(currentPassword: string): Promise<{ ok: boolean; recoveryPhrase?: string }> {
  if (!vaultState.data || !vaultState.key) return { ok: false };
  const vault = vaultState.data;
  const masterKey = vaultState.key;
  const salt = Buffer.from(vault.salt, 'base64');
  const currentKey = await deriveKey(currentPassword, salt);
  const expected = Buffer.from(vault.passwordHash, 'base64');
  const matches = currentKey.key.length === expected.length && timingSafeEqual(currentKey.key, expected);
  currentKey.zeroize();
  if (!matches) {
    return { ok: false };
  }

  const newPhrase = generateRecoveryPhrase();
  const newRecoveryKey = await deriveKey(newPhrase, salt);
  vault.recoveryKeyWrap = encryptKey(masterKey.key, newRecoveryKey.key);
  vault.recoveryHash = newRecoveryKey.key.toString('base64');
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

  vaultState.key?.zeroize();
  const data = parsed;
  vaultState.data = data;
  vaultState.key = toVaultKey(master);
  vaultState.activeVaultId = vaultId;
  vaultState.path = path;

  const newPasswordKey = await deriveKey(newPassword, salt);
  data.masterKeyWrap = encryptKey(master, newPasswordKey.key);
  data.passwordHash = newPasswordKey.key.toString('base64');
  newPasswordKey.zeroize();
  await saveVault();
  return true;
}

export async function saveAutoLockTimer(timer: number): Promise<void> {
  if (!vaultState.data) return;
  vaultState.data.settings.autoLockTimer = timer;
  await saveVault();
}

export async function getAutoLockTimer(): Promise<number> {
  return vaultState.data?.settings.autoLockTimer ?? 60;
}

export async function getVaultInfo() {
  if (!vaultState.data) return null;
  const itemsByCategory: Record<string, number> = { api: 0, prompt: 0, command: 0, link: 0, keypair: 0 };
  for (const item of vaultState.data.items) {
    itemsByCategory[item.category] = (itemsByCategory[item.category] || 0) + 1;
  }
  return {
    createdAt: vaultState.data.createdAt,
    totalItems: vaultState.data.items.length,
    itemsByCategory,
    appVersion: app.getVersion(),
  };
}
