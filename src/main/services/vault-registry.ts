import { app } from 'electron';
import { readFileSync, writeFileSync, existsSync } from 'fs';
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

export function loadRegistry(): VaultRegistryEntry[] {
  const path = getRegistryPath();
  if (!existsSync(path)) {
    registry = { version: '1.0.0', vaults: [] };
    saveRegistry();
    return [];
  }
  const raw = readFileSync(path, 'utf-8');
  registry = JSON.parse(raw);
  return registry.vaults;
}

function saveRegistry(): void {
  if (!registry) return;
  writeFileSync(getRegistryPath(), JSON.stringify(registry, null, 2), 'utf-8');
}

export function listVaults(): VaultRegistryEntry[] {
  if (!registry) loadRegistry();
  return (registry?.vaults || []).filter((v) => !v.hidden);
}

export function listAllVaults(): VaultRegistryEntry[] {
  if (!registry) loadRegistry();
  return registry?.vaults || [];
}

export function getVault(id: string): VaultRegistryEntry | undefined {
  if (!registry) loadRegistry();
  return registry?.vaults.find((v) => v.id === id);
}

export function addVault(name: string, hint: string, vaultId?: string): VaultRegistryEntry {
  if (!registry) loadRegistry();
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
  saveRegistry();
  return entry;
}

export function updateVault(id: string, partial: Partial<VaultRegistryEntry>): void {
  if (!registry) loadRegistry();
  const entry = registry!.vaults.find((v) => v.id === id);
  if (!entry) return;
  Object.assign(entry, partial);
  saveRegistry();
}

export function removeVault(id: string): void {
  if (!registry) loadRegistry();
  registry!.vaults = registry!.vaults.filter((v) => v.id !== id);
  saveRegistry();
}

export function getVaultHint(id: string): string {
  const entry = getVault(id);
  return entry?.hint || '';
}

export function migrateOldVault(): string | null {
  const oldPath = join(app.getPath('userData'), 'vault.json');
  if (!existsSync(oldPath)) return null;

  // Read old vault to extract createdAt
  const oldRaw = readFileSync(oldPath, 'utf-8');
  let createdAt = Date.now();
  try {
    const oldData = JSON.parse(oldRaw);
    createdAt = oldData.createdAt || Date.now();
  } catch {
    // use current time
  }

  // Create registry entry
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

  // Ensure vaults directory exists
  const vaultsDir = join(app.getPath('userData'), 'vaults');
  if (!existsSync(vaultsDir)) {
    const { mkdirSync } = require('fs');
    mkdirSync(vaultsDir, { recursive: true });
  }

  // Copy old vault to new location
  const newPath = join(vaultsDir, entry.filename);
  writeFileSync(newPath, oldRaw, 'utf-8');

  // Remove old vault
  const { unlinkSync } = require('fs');
  unlinkSync(oldPath);

  // Initialize registry
  registry = { version: '1.0.0', vaults: [entry] };
  saveRegistry();

  return id;
}

export function getVaultsDir(): string {
  return join(app.getPath('userData'), 'vaults');
}
