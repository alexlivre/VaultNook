import { decrypt, encrypt } from '../crypto';
import { saveVault } from './storage';
import { vaultState, type StoredItem } from './state';
import type { Item, Category } from '../../../shared/schemas';

export function hasItem(id: string): boolean {
  return !!vaultState.data?.items.some((item) => item.id === id);
}

function toStoredItem(item: Item): StoredItem {
  const key = vaultState.key!;
  const tagsEnc = Array.isArray(item.tags) && item.tags.length > 0
    ? encrypt(JSON.stringify(item.tags), key)
    : null;
  return {
    id: item.id,
    name: encrypt(item.name, key),
    value: encrypt(item.value, key),
    publicKey: item.publicKey ? encrypt(item.publicKey, key) : null,
    description: item.description ? encrypt(item.description, key) : null,
    tags: tagsEnc,
    category: item.category,
    favorite: item.favorite,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export async function getAllItems(): Promise<Item[]> {
  if (!vaultState.data || !vaultState.key) return [];
  const key = vaultState.key;
  return vaultState.data.items.map((item) => {
    let tags: string[] = [];
    if (item.tags) {
      try {
        const rawTags = decrypt(item.tags, key);
        tags = JSON.parse(rawTags);
      } catch {
        tags = [];
      }
    }
    return {
      id: item.id,
      name: decrypt(item.name, key),
      value: decrypt(item.value, key),
      publicKey: item.publicKey ? decrypt(item.publicKey, key) : '',
      description: item.description ? decrypt(item.description, key) : '',
      tags: Array.isArray(tags) ? tags : [],
      category: item.category,
      favorite: item.favorite,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  });
}

export async function addItem(item: Item): Promise<void> {
  if (!vaultState.data || !vaultState.key) return;
  vaultState.data.items.push(toStoredItem(item));
  await saveVault();
}

export async function editItem(item: Item): Promise<void> {
  if (!vaultState.data || !vaultState.key) return;
  vaultState.data.items = vaultState.data.items.map((i) => (i.id === item.id ? toStoredItem(item) : i));
  await saveVault();
}

export async function removeItem(id: string): Promise<void> {
  if (!vaultState.data) return;
  vaultState.data.items = vaultState.data.items.filter((i) => i.id !== id);
  await saveVault();
}

export async function removeItems(ids: string[]): Promise<void> {
  if (!vaultState.data) return;
  const idSet = new Set(ids);
  vaultState.data.items = vaultState.data.items.filter((i) => !idSet.has(i.id));
  await saveVault();
}

export async function moveCategoryItems(ids: string[], newCategory: Category): Promise<void> {
  if (!vaultState.data) return;
  const idSet = new Set(ids);
  vaultState.data.items = vaultState.data.items.map((i) => {
    if (idSet.has(i.id)) {
      return { ...i, category: newCategory, updatedAt: Date.now() };
    }
    return i;
  });
  await saveVault();
}
