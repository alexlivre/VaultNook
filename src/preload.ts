import { contextBridge, ipcRenderer } from 'electron';
import { z } from 'zod';
import type { CreateItem, EditItem, ChangePassword, Item, VaultInfo, ImportResult } from './renderer/types';

const CreatePasswordPayload = z.object({ password: z.string().min(8) });
const UnlockPayload = z.object({ password: z.string().min(1) });
const DeleteVaultPayload = z.object({ password: z.string().min(1) });
const ToggleFavoritePayload = z.object({ id: z.string(), favorite: z.boolean() });
const SaveSettingsPayload = z.object({ autoLockTimer: z.number() });

const api = {
  init: (): Promise<{ isFirstRun: boolean }> => ipcRenderer.invoke('vault:init'),

  createVault: (password: string): Promise<{ recoveryPhrase: string[] }> => {
    const data = CreatePasswordPayload.parse({ password });
    return ipcRenderer.invoke('vault:create-password', data);
  },

  unlock: (password: string): Promise<{ items: Item[]; info: VaultInfo }> => {
    const data = UnlockPayload.parse({ password });
    return ipcRenderer.invoke('vault:unlock', data);
  },

  lock: (): Promise<boolean> => ipcRenderer.invoke('vault:lock'),

  changePassword: (data: ChangePassword): Promise<boolean> =>
    ipcRenderer.invoke('vault:change-password', data),

  deleteVault: (password: string): Promise<boolean> => {
    const data = DeleteVaultPayload.parse({ password });
    return ipcRenderer.invoke('vault:delete-vault', data);
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
};

export type DevVaultApi = typeof api;

contextBridge.exposeInMainWorld('devVaultApi', api);
