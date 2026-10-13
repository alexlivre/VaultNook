import { randomUUID } from 'crypto';
import { decrypt, encrypt } from '../crypto';
import { saveVault } from './storage';
import { vaultState } from './state';
import type { Project } from '../../../shared/schemas';

export async function getAllProjects(): Promise<Project[]> {
  if (!vaultState.data || !vaultState.key) return [];
  const key = vaultState.key;
  return vaultState.data.projects.map((project) => ({
    id: project.id,
    name: decrypt(project.name, key),
    color: project.color,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  }));
}

export async function saveProject(input: { id?: string; name: string; color?: string }): Promise<Project> {
  if (!vaultState.data || !vaultState.key) throw new Error('Vault bloqueado');
  const key = vaultState.key;
  const now = Date.now();
  const encryptedName = encrypt(input.name, key);

  let stored = input.id
    ? vaultState.data.projects.find((project) => project.id === input.id)
    : undefined;

  if (stored) {
    stored.name = encryptedName;
    stored.color = input.color ?? stored.color;
    stored.updatedAt = now;
  } else {
    stored = {
      id: input.id || randomUUID(),
      name: encryptedName,
      color: input.color ?? '',
      createdAt: now,
      updatedAt: now,
    };
    vaultState.data.projects.push(stored);
  }

  await saveVault();
  return {
    id: stored.id,
    name: input.name,
    color: stored.color,
    createdAt: stored.createdAt,
    updatedAt: stored.updatedAt,
  };
}

export async function removeProject(id: string): Promise<void> {
  if (!vaultState.data) return;
  vaultState.data.projects = vaultState.data.projects.filter((project) => project.id !== id);
  const now = Date.now();
  vaultState.data.items = vaultState.data.items.map((item) =>
    item.projectId === id ? { ...item, projectId: '', updatedAt: now } : item
  );
  await saveVault();
}

export async function moveProjectItems(ids: string[], projectId: string): Promise<void> {
  if (!vaultState.data) return;
  const target = vaultState.data.projects.some((project) => project.id === projectId)
    ? projectId
    : '';
  const idSet = new Set(ids);
  const now = Date.now();
  vaultState.data.items = vaultState.data.items.map((item) =>
    idSet.has(item.id) ? { ...item, projectId: target, updatedAt: now } : item
  );
  await saveVault();
}
