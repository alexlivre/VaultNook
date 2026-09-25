import { randomUUID } from 'crypto';
import { decrypt, encrypt } from '../crypto';
import { saveVault } from './storage';
import { vaultState, type StoredItem } from './state';
import type { Category } from '../../../shared/schemas';

export async function exportVault(): Promise<string> {
  if (!vaultState.data) return '{}';
  return JSON.stringify(
    {
      formatVersion: 3,
      version: vaultState.data.version,
      createdAt: vaultState.data.createdAt,
      exportedAt: Date.now(),
      passwordHash: vaultState.data.passwordHash,
      salt: vaultState.data.salt,
      recoveryHash: vaultState.data.recoveryHash,
      masterKeyWrap: vaultState.data.masterKeyWrap,
      recoveryKeyWrap: vaultState.data.recoveryKeyWrap,
      settings: vaultState.data.settings,
      items: vaultState.data.items,
    },
    null,
    2
  );
}

export async function importVault(jsonData: string): Promise<{ imported: number; ignored: number; total: number }> {
  if (!vaultState.data || !vaultState.key) throw new Error('Vault bloqueado');
  const key = vaultState.key;
  const data = JSON.parse(jsonData);
  if (!data || typeof data !== 'object' || !Array.isArray(data.items)) {
    throw new Error('Backup inválido');
  }

  const existingIds = new Set(vaultState.data.items.map((i) => i.id));
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
        decrypt(item.value, key);
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
        ? encrypt(JSON.stringify(item.tags), key)
        : null;
      const rawPublicKey = typeof item.publicKey === 'string' ? item.publicKey : '';
      stored = {
        id: item.id || randomUUID(),
        name: encrypt(item.name || '', key),
        value: encrypt(rawValue, key),
        publicKey: rawPublicKey ? encrypt(rawPublicKey, key) : null,
        description: item.description ? encrypt(item.description, key) : null,
        tags: tagsEnc,
        category: item.category as Category,
        favorite: !!item.favorite,
        createdAt: item.createdAt ?? Date.now(),
        updatedAt: item.updatedAt ?? Date.now(),
      };
    }
    vaultState.data.items.push(stored);
    imported++;
  }

  await saveVault();
  return { imported, ignored, total: data.items.length };
}
