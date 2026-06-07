import { ipcMain, dialog } from 'electron';
import { writeFileSync, readFileSync } from 'fs';
import { z } from 'zod';
import * as vault from '../services/vault';
import { CreateItemSchema, EditItemSchema, ChangePasswordSchema } from '../../renderer/types';

const IPC_CHANNELS = {
  INIT: 'vault:init',
  CREATE_PASSWORD: 'vault:create-password',
  UNLOCK: 'vault:unlock',
  LOCK: 'vault:lock',
  CHANGE_PASSWORD: 'vault:change-password',
  DELETE_VAULT: 'vault:delete-vault',
  GET_INFO: 'vault:get-info',
  GET_ITEMS: 'vault:get-items',
  ADD_ITEM: 'vault:add-item',
  EDIT_ITEM: 'vault:edit-item',
  REMOVE_ITEM: 'vault:remove-item',
  EXPORT: 'vault:export',
  IMPORT: 'vault:import',
  TOGGLE_FAVORITE: 'vault:toggle-favorite',
  GET_SETTINGS: 'vault:get-settings',
  SAVE_SETTINGS: 'vault:save-settings',
} as const;

const DeleteVaultSchema = z.object({
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
    const exists = vault.getVaultExists();
    return { isFirstRun: !exists };
  });

  ipcMain.handle(IPC_CHANNELS.CREATE_PASSWORD, (_event, data: unknown) => {
    const { password } = validate(
      z.object({ password: z.string().min(8) }),
      data
    );
    const result = vault.createVault(password);
    return result;
  });

  ipcMain.handle(IPC_CHANNELS.UNLOCK, (_event, data: unknown) => {
    const { password } = validate(
      z.object({ password: z.string().min(1) }),
      data
    );
    const success = vault.unlockVault(password);
    if (!success) throw new Error('Senha incorreta');
    return { items: vault.getAllItems(), info: vault.getVaultInfo() };
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
    // Verify password before deleting
    const canUnlock = vault.unlockVault(password);
    if (!canUnlock) throw new Error('Senha incorreta');
    vault.deleteVault();
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
    // Get existing item to preserve favorite and timestamps
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

  ipcMain.handle(IPC_CHANNELS.TOGGLE_FAVORITE, (_event, data: unknown) => {
    const { id, favorite } = validate(ToggleFavoriteSchema, data);
    // We need to update the item in vault
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
}

export { IPC_CHANNELS };
