import { app } from 'electron';
import { existsSync } from 'fs';
import { readFile, unlink } from 'fs/promises';
import { join } from 'path';
import { atomicWriteFile } from '../fs-utils';
import { lockVault, vaultState } from './state';

export function getVaultPath(vaultId?: string): string {
  if (vaultId) {
    return join(app.getPath('userData'), 'vaults', `${vaultId}.json`);
  }
  if (vaultState.activeVaultId) {
    return join(app.getPath('userData'), 'vaults', `${vaultState.activeVaultId}.json`);
  }
  return join(app.getPath('userData'), 'vault.json');
}

export function getVaultsDir(): string {
  return join(app.getPath('userData'), 'vaults');
}

export async function loadVault(vaultId: string): Promise<boolean> {
  const path = getVaultPath(vaultId);
  if (!existsSync(path)) return false;
  vaultState.path = path;
  const raw = await readFile(path, 'utf-8');
  vaultState.data = JSON.parse(raw);
  vaultState.activeVaultId = vaultId;
  vaultState.key?.zeroize();
  vaultState.key = null;
  return true;
}

export async function saveVault(): Promise<void> {
  if (!vaultState.data || !vaultState.path) return;
  await atomicWriteFile(vaultState.path, JSON.stringify(vaultState.data, null, 2));
}

export async function deleteVault(vaultId: string): Promise<void> {
  lockVault();
  const path = getVaultPath(vaultId);
  if (existsSync(path)) {
    await unlink(path);
  }
}

export async function exportVaultRaw(vaultId: string): Promise<string | null> {
  const path = getVaultPath(vaultId);
  if (!existsSync(path)) return null;
  return readFile(path, 'utf-8');
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
