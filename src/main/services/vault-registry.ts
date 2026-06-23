import { app } from 'electron';
import { existsSync, mkdirSync } from 'fs';
import { readFile, writeFile, unlink } from 'fs/promises';
import { join } from 'path';

export interface VaultRegistryEntry {
  id: string;
  name: string;
  filename: string;
  createdAt: number;
  lastOpened: number;
  hidden: boolean;
  hint: string;
}

interface VaultRegistryData {
  version: string;
  vaults: VaultRegistryEntry[];
}

let registry: VaultRegistryData | null = null;

function getRegistryPath(): string {
  return join(app.getPath('userData'), 'vaults.json');
}

export async function loadRegistry(): Promise<VaultRegistryEntry[]> {
  const path = getRegistryPath();
  if (!existsSync(path)) {
    registry = { version: '1.0.0', vaults: [] };
    await saveRegistry();
    return [];
  }
  const raw = await readFile(path, 'utf-8');
  registry = JSON.parse(raw);
  return registry.vaults;
}

async function saveRegistry(): Promise<void> {
  if (!registry) return;
  await writeFile(getRegistryPath(), JSON.stringify(registry, null, 2), 'utf-8');
}

export async function listVaults(): Promise<VaultRegistryEntry[]> {
  if (!registry) await loadRegistry();
  return (registry?.vaults || []).filter((v) => !v.hidden);
}

export async function listAllVaults(): Promise<VaultRegistryEntry[]> {
  if (!registry) await loadRegistry();
  return registry?.vaults || [];
}

export async function getVault(id: string): Promise<VaultRegistryEntry | undefined> {
  if (!registry) await loadRegistry();
  return registry?.vaults.find((v) => v.id === id);
}

export async function addVault(name: string, hint: string, vaultId?: string): Promise<VaultRegistryEntry> {
  if (!registry) await loadRegistry();
  const id = vaultId || crypto.randomUUID();
  const entry: VaultRegistryEntry = {
    id,
    name,
    filename: `${id}.json`,
    createdAt: Date.now(),
    lastOpened: Date.now(),
    hidden: false,
    hint,
  };
  registry!.vaults.push(entry);
  await saveRegistry();
  return entry;
}

export async function updateVault(id: string, partial: Partial<VaultRegistryEntry>): Promise<void> {
  if (!registry) await loadRegistry();
  const entry = registry!.vaults.find((v) => v.id === id);
  if (!entry) return;
  Object.assign(entry, partial);
  await saveRegistry();
}

export async function removeVault(id: string): Promise<void> {
  if (!registry) await loadRegistry();
  registry!.vaults = registry!.vaults.filter((v) => v.id !== id);
  await saveRegistry();
}

export async function getVaultHint(id: string): Promise<string> {
  const entry = await getVault(id);
  return entry?.hint || '';
}

export async function migrateOldVault(): Promise<string | null> {
  const oldPath = join(app.getPath('userData'), 'vault.json');
  if (!existsSync(oldPath)) return null;

  const oldRaw = await readFile(oldPath, 'utf-8');
  let createdAt = Date.now();
  try {
    const oldData = JSON.parse(oldRaw);
    createdAt = oldData.createdAt || Date.now();
  } catch {
    // use current time
  }

  const id = crypto.randomUUID();
  const entry: VaultRegistryEntry = {
    id,
    name: 'Meu Cofre',
    filename: `${id}.json`,
    createdAt,
    lastOpened: Date.now(),
    hidden: false,
    hint: '',
  };

  const vaultsDir = join(app.getPath('userData'), 'vaults');
  if (!existsSync(vaultsDir)) {
    mkdirSync(vaultsDir, { recursive: true });
  }

  const newPath = join(vaultsDir, entry.filename);
  await writeFile(newPath, oldRaw, 'utf-8');

  await unlink(oldPath);

  registry = { version: '1.0.0', vaults: [entry] };
  await saveRegistry();

  return id;
}

export function getVaultsDir(): string {
  return join(app.getPath('userData'), 'vaults');
}
