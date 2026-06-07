import { contextBridge, ipcRenderer } from 'electron';
import { z } from 'zod';
import type { CreateItem, EditItem, ChangePassword, Item, VaultInfo, ImportResult, VaultEntry } from './renderer/types';

const CreatePasswordPayload = z.object({
  password: z.string().min(8),
  name: z.string().min(1),
  hint: z.string().optional().default(''),
});
const UnlockPayload = z.object({ password: z.string().min(1), vaultId: z.string().min(1) });
const DeleteVaultEntryPayload = z.object({ vaultId: z.string().min(1), password: z.string().min(1) });
const ToggleFavoritePayload = z.object({ id: z.string(), favorite: z.boolean() });
const SaveSettingsPayload = z.object({ autoLockTimer: z.number() });

const api = {
  init: (): Promise<{ vaults: VaultEntry[] }> => ipcRenderer.invoke('vault:init'),

  listVaults: (): Promise<VaultEntry[]> => ipcRenderer.invoke('vault:list-vaults'),

  createVault: (password: string, name: string, hint?: string): Promise<{ recoveryPhrase: string[]; vaultId: string }> => {
    const data = CreatePasswordPayload.parse({ password, name, hint: hint || '' });
    return ipcRenderer.invoke('vault:create-password', data);
  },

  unlock: (password: string, vaultId: string): Promise<{ items: Item[]; info: VaultInfo; vaultId: string }> => {
    const data = UnlockPayload.parse({ password, vaultId });
    return ipcRenderer.invoke('vault:unlock', data);
  },

  lock: (): Promise<boolean> => ipcRenderer.invoke('vault:lock'),

  changePassword: (data: ChangePassword): Promise<boolean> =>
    ipcRenderer.invoke('vault:change-password', data),

  deleteVault: (password: string): Promise<boolean> =>
    ipcRenderer.invoke('vault:delete-vault', { password }),

  deleteVaultEntry: (vaultId: string, password: string): Promise<boolean> => {
    const data = DeleteVaultEntryPayload.parse({ vaultId, password });
    return ipcRenderer.invoke('vault:delete-vault-entry', data);
  },

  getInfo: (): Promise<VaultInfo> => ipcRenderer.invoke('vault:get-info'),

  getItems: (): Promise<Item[]> => ipcRenderer.invoke('vault:get-items'),

  addItem: (data: CreateItem): Promise<Item> =>
    ipcRenderer.invoke('vault:add-item', data),

  editItem: (data: EditItem): Promise<Item> =>
    ipcRenderer.invoke('vault:edit-item', data),

  removeItem: (id: string): Promise<boolean> =>
    ipcRenderer.invoke('vault:remove-item', id),

  exportVault: (): Promise<boolean> =>
    ipcRenderer.invoke('vault:export'),

  importVault: (): Promise<ImportResult | null> =>
    ipcRenderer.invoke('vault:import'),

  exportVaultFile: (vaultId: string): Promise<boolean> =>
    ipcRenderer.invoke('vault:export-file', vaultId),

  importVaultFile: (): Promise<{ id: string; name: string } | null> =>
    ipcRenderer.invoke('vault:import-file'),

  toggleFavorite: (id: string, favorite: boolean): Promise<boolean> => {
    const data = ToggleFavoritePayload.parse({ id, favorite });
    return ipcRenderer.invoke('vault:toggle-favorite', data);
  },

  getSettings: (): Promise<{ autoLockTimer: number }> =>
    ipcRenderer.invoke('vault:get-settings'),

  saveSettings: (autoLockTimer: number): Promise<boolean> => {
    const data = SaveSettingsPayload.parse({ autoLockTimer });
    return ipcRenderer.invoke('vault:save-settings', data);
  },

  getVaultHint: (vaultId: string): Promise<string> =>
    ipcRenderer.invoke('vault:get-vault-hint', vaultId),

  toggleHidden: (vaultId: string): Promise<boolean> =>
    ipcRenderer.invoke('vault:toggle-hidden', vaultId),
};

const windowControls = {
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
  onMaximizeChange: (callback: (maximized: boolean) => void) => {
    const handler = (_event: any, maximized: boolean) => callback(maximized);
    ipcRenderer.on('window:maximize-changed', handler);
    return () => ipcRenderer.removeListener('window:maximize-changed', handler);
  },
};

export type DevVaultApi = typeof api;
export type WindowControls = typeof windowControls;

contextBridge.exposeInMainWorld('devVaultApi', api);
contextBridge.exposeInMainWorld('windowControls', windowControls);
