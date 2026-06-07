import { ipcMain, dialog, app } from 'electron';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';
import * as vault from '../services/vault';
import * as registry from '../services/vault-registry';
import { CreateItemSchema, EditItemSchema, ChangePasswordSchema } from '../../renderer/types';

const IPC_CHANNELS = {
  INIT: 'vault:init',
  LIST_VAULTS: 'vault:list-vaults',
  CREATE_PASSWORD: 'vault:create-password',
  UNLOCK: 'vault:unlock',
  LOCK: 'vault:lock',
  CHANGE_PASSWORD: 'vault:change-password',
  DELETE_VAULT: 'vault:delete-vault',
  DELETE_VAULT_ENTRY: 'vault:delete-vault-entry',
  GET_INFO: 'vault:get-info',
  GET_ITEMS: 'vault:get-items',
  ADD_ITEM: 'vault:add-item',
  EDIT_ITEM: 'vault:edit-item',
  REMOVE_ITEM: 'vault:remove-item',
  EXPORT: 'vault:export',
  IMPORT: 'vault:import',
  EXPORT_FILE: 'vault:export-file',
  IMPORT_FILE: 'vault:import-file',
  TOGGLE_FAVORITE: 'vault:toggle-favorite',
  GET_SETTINGS: 'vault:get-settings',
  SAVE_SETTINGS: 'vault:save-settings',
  GET_VAULT_HINT: 'vault:get-vault-hint',
  TOGGLE_HIDDEN: 'vault:toggle-hidden',
} as const;

const DeleteVaultSchema = z.object({
  password: z.string().min(1),
});

const DeleteVaultEntrySchema = z.object({
  vaultId: z.string().min(1),
  password: z.string().min(1),
});

const ToggleFavoriteSchema = z.object({
  id: z.string(),
  favorite: z.boolean(),
});

const SaveSettingsSchema = z.object({
  autoLockTimer: z.number().min(0).max(900),
});

function validate<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new Error(result.error.issues.map((e: any) => e.message).join(', '));
  }
  return result.data;
}

export function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.INIT, () => {
    // Try to migrate old vault first
    const migratedId = registry.migrateOldVault();
    const vaults = registry.loadRegistry();
    return { vaults };
  });

  ipcMain.handle(IPC_CHANNELS.LIST_VAULTS, () => {
    const entries = registry.listAllVaults();
    // Attach item count to each vault
    return entries.map((entry) => {
      const meta = vault.getVaultMetadata(entry.id);
      return {
        id: entry.id,
        name: entry.name,
        createdAt: entry.createdAt,
        lastOpened: entry.lastOpened,
        hidden: entry.hidden,
        hasHint: entry.hint.length > 0,
        itemCount: meta?.totalItems || 0,
      };
    });
  });

  ipcMain.handle(IPC_CHANNELS.CREATE_PASSWORD, (_event, data: unknown) => {
    const { password, name, hint } = validate(
      z.object({
        password: z.string().min(8),
        name: z.string().min(1, 'Nome é obrigatório'),
        hint: z.string().optional().default(''),
      }),
      data
    );
    const result = vault.createVault(password, hint);
    // Add to registry with the same vaultId from the file
    registry.addVault(name, hint, result.vaultId);
    return result;
  });

  ipcMain.handle(IPC_CHANNELS.UNLOCK, (_event, data: unknown) => {
    const { password, vaultId } = validate(
      z.object({
        password: z.string().min(1),
        vaultId: z.string().min(1),
      }),
      data
    );
    // Load the vault file
    const loaded = vault.loadVault(vaultId);
    if (!loaded) throw new Error('Vault não encontrado');
    const success = vault.unlockVault(password);
    if (!success) throw new Error('Senha incorreta');
    // Update last opened
    registry.updateVault(vaultId, { lastOpened: Date.now() });
    return { items: vault.getAllItems(), info: vault.getVaultInfo(), vaultId };
  });

  ipcMain.handle(IPC_CHANNELS.LOCK, () => {
    vault.lockVault();
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.CHANGE_PASSWORD, (_event, data: unknown) => {
    const validated = validate(ChangePasswordSchema, data);
    const success = vault.changePassword(validated);
    if (!success) throw new Error('Senha atual incorreta');
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.DELETE_VAULT, (_event, data: unknown) => {
    const { password } = validate(DeleteVaultSchema, data);
    const vaultId = vault.getActiveVaultId();
    if (!vaultId) throw new Error('Nenhum vault ativo');
    const canUnlock = vault.unlockVault(password);
    if (!canUnlock) throw new Error('Senha incorreta');
    vault.deleteVault(vaultId);
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.DELETE_VAULT_ENTRY, (_event, data: unknown) => {
    const { vaultId, password } = validate(DeleteVaultEntrySchema, data);
    // Verify password before deleting
    vault.loadVault(vaultId);
    const canUnlock = vault.unlockVault(password);
    if (!canUnlock) throw new Error('Senha incorreta');
    vault.deleteVault(vaultId);
    registry.removeVault(vaultId);
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.GET_INFO, () => {
    return vault.getVaultInfo();
  });

  ipcMain.handle(IPC_CHANNELS.GET_ITEMS, () => {
    return vault.getAllItems();
  });

  ipcMain.handle(IPC_CHANNELS.ADD_ITEM, (_event, data: unknown) => {
    const validated = validate(CreateItemSchema, data);
    const item = {
      ...validated,
      id: crypto.randomUUID(),
      favorite: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    vault.addItem(item);
    return item;
  });

  ipcMain.handle(IPC_CHANNELS.EDIT_ITEM, (_event, data: unknown) => {
    const validated = validate(EditItemSchema, data);
    const items = vault.getAllItems();
    const existing = items.find((i) => i.id === validated.id);
    const fullItem = existing
      ? { ...existing, ...validated, updatedAt: Date.now() }
      : { ...validated, favorite: false, createdAt: Date.now(), updatedAt: Date.now() };
    vault.editItem(fullItem);
    return fullItem;
  });

  ipcMain.handle(IPC_CHANNELS.REMOVE_ITEM, (_event, id: unknown) => {
    const validated = validate(z.string(), id);
    vault.removeItem(validated);
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.EXPORT, async () => {
    const data = vault.exportVault();
    const result = await dialog.showSaveDialog({
      title: 'Exportar Vault',
      defaultPath: `devvault-backup-${Date.now()}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (!result.canceled && result.filePath) {
      writeFileSync(result.filePath, data, 'utf-8');
      return true;
    }
    return false;
  });

  ipcMain.handle(IPC_CHANNELS.IMPORT, async () => {
    const result = await dialog.showOpenDialog({
      title: 'Importar Vault',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile'],
    });
    if (!result.canceled && result.filePaths[0]) {
      const data = readFileSync(result.filePaths[0], 'utf-8');
      return vault.importVault(data);
    }
    return null;
  });

  ipcMain.handle(IPC_CHANNELS.EXPORT_FILE, async (_event, vaultId: unknown) => {
    const id = validate(z.string().min(1), vaultId);
    const raw = vault.exportVaultRaw(id);
    if (!raw) throw new Error('Vault não encontrado');
    const result = await dialog.showSaveDialog({
      title: 'Exportar Vault',
      defaultPath: `devvault-export-${Date.now()}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (!result.canceled && result.filePath) {
      writeFileSync(result.filePath, raw, 'utf-8');
      return true;
    }
    return false;
  });

  ipcMain.handle(IPC_CHANNELS.IMPORT_FILE, async () => {
    const result = await dialog.showOpenDialog({
      title: 'Importar Vault',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile'],
    });
    if (!result.canceled && result.filePaths[0]) {
      const raw = readFileSync(result.filePaths[0], 'utf-8');
      const data = JSON.parse(raw);
      const name = `Importado ${new Date().toLocaleDateString()}`;
      const vaultId = crypto.randomUUID();
      const vaultsDir = join(app.getPath('userData'), 'vaults');
      if (!existsSync(vaultsDir)) {
        mkdirSync(vaultsDir, { recursive: true });
      }
      writeFileSync(join(vaultsDir, `${vaultId}.json`), raw, 'utf-8');
      registry.addVault(name, '');
      return { id: vaultId, name };
    }
    return null;
  });

  ipcMain.handle(IPC_CHANNELS.TOGGLE_FAVORITE, (_event, data: unknown) => {
    const { id, favorite } = validate(ToggleFavoriteSchema, data);
    const items = vault.getAllItems();
    const item = items.find((i) => i.id === id);
    if (item) {
      vault.editItem({ ...item, favorite });
    }
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.GET_SETTINGS, () => {
    const timer = vault.getAutoLockTimer();
    return { autoLockTimer: timer };
  });

  ipcMain.handle(IPC_CHANNELS.SAVE_SETTINGS, (_event, data: unknown) => {
    const { autoLockTimer } = validate(SaveSettingsSchema, data);
    vault.saveAutoLockTimer(autoLockTimer);
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.GET_VAULT_HINT, (_event, vaultId: unknown) => {
    const id = validate(z.string().min(1), vaultId);
    return registry.getVaultHint(id);
  });

  ipcMain.handle(IPC_CHANNELS.TOGGLE_HIDDEN, (_event, vaultId: unknown) => {
    const id = validate(z.string().min(1), vaultId);
    const entry = registry.getVault(id);
    if (!entry) throw new Error('Vault não encontrado');
    registry.updateVault(id, { hidden: !entry.hidden });
    return !entry.hidden;
  });
}

export { IPC_CHANNELS };
