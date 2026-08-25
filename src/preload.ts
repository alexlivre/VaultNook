import { contextBridge, ipcRenderer } from 'electron';
import { z } from 'zod';
import { IPC_CHANNELS } from './ipc-channels';
import type { CreateItem, EditItem, ChangePassword, Item, VaultInfo, ImportResult, VaultEntry } from './renderer/types';

const CreatePasswordPayload = z.object({
  password: z.string().min(8),
  name: z.string().min(1),
  hint: z.string().optional().default(''),
  color: z.string().optional(),
});
const UnlockPayload = z.object({ password: z.string().min(1), vaultId: z.string().min(1) });
const DeleteVaultEntryPayload = z.object({ vaultId: z.string().min(1), password: z.string().min(1) });
const ToggleFavoritePayload = z.object({ id: z.string(), favorite: z.boolean() });
const SaveSettingsPayload = z.object({ autoLockTimer: z.number() });

const api = {
  init: (): Promise<{ vaults: VaultEntry[] }> => ipcRenderer.invoke(IPC_CHANNELS.INIT),

  listVaults: (): Promise<VaultEntry[]> => ipcRenderer.invoke(IPC_CHANNELS.LIST_VAULTS),

  createVault: (password: string, name: string, hint?: string, color?: string): Promise<{ recoveryPhrase: string; vaultId: string }> => {
    const data = CreatePasswordPayload.parse({ password, name, hint: hint || '', color });
    return ipcRenderer.invoke(IPC_CHANNELS.CREATE_PASSWORD, data);
  },

  unlock: (password: string, vaultId: string): Promise<{ items: Item[]; info: VaultInfo; vaultId: string; recoveryPhrase?: string }> => {
    const data = UnlockPayload.parse({ password, vaultId });
    return ipcRenderer.invoke(IPC_CHANNELS.UNLOCK, data);
  },

  lock: (): Promise<boolean> => ipcRenderer.invoke(IPC_CHANNELS.LOCK),

  changePassword: (data: ChangePassword): Promise<{ recoveryPhrase?: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.CHANGE_PASSWORD, data),

  regenerateRecoveryPhrase: (password: string): Promise<{ recoveryPhrase: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.REGENERATE_RECOVERY_PHRASE, { password }),

  deleteVault: (password: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.DELETE_VAULT, { password }),

  deleteVaultEntry: (vaultId: string, password: string): Promise<boolean> => {
    const data = DeleteVaultEntryPayload.parse({ vaultId, password });
    return ipcRenderer.invoke(IPC_CHANNELS.DELETE_VAULT_ENTRY, data);
  },

  getInfo: (): Promise<VaultInfo> => ipcRenderer.invoke(IPC_CHANNELS.GET_INFO),

  getItems: (): Promise<Item[]> => ipcRenderer.invoke(IPC_CHANNELS.GET_ITEMS),

  addItem: (data: CreateItem): Promise<Item> =>
    ipcRenderer.invoke(IPC_CHANNELS.ADD_ITEM, data),

  editItem: (data: EditItem): Promise<Item> =>
    ipcRenderer.invoke(IPC_CHANNELS.EDIT_ITEM, data),

  removeItem: (id: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.REMOVE_ITEM, id),

  removeItems: (ids: string[]): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.REMOVE_ITEMS, ids),

  moveCategoryItems: (ids: string[], category: Category): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.MOVE_CATEGORY_ITEMS, { ids, category }),

  exportVault: (): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.EXPORT),

  importVault: (): Promise<ImportResult | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.IMPORT),

  exportVaultFile: (vaultId: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.EXPORT_FILE, vaultId),

  importVaultFile: (): Promise<{ id: string; name: string } | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.IMPORT_FILE),

  toggleFavorite: (id: string, favorite: boolean): Promise<boolean> => {
    const data = ToggleFavoritePayload.parse({ id, favorite });
    return ipcRenderer.invoke(IPC_CHANNELS.TOGGLE_FAVORITE, data);
  },

  getSettings: (): Promise<{ autoLockTimer: number }> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_SETTINGS),

  saveSettings: (autoLockTimer: number): Promise<boolean> => {
    const data = SaveSettingsPayload.parse({ autoLockTimer });
    return ipcRenderer.invoke(IPC_CHANNELS.SAVE_SETTINGS, data);
  },

  getVaultHint: (vaultId: string): Promise<string> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_VAULT_HINT, vaultId),

  toggleHidden: (vaultId: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.TOGGLE_HIDDEN, vaultId),

  renameVault: (vaultId: string, name: string, color?: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.RENAME_VAULT, { vaultId, name, color }),

  openExternal: (url: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.OPEN_EXTERNAL, url),

  clearClipboard: (): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.CLEAR_CLIPBOARD),

  recover: (vaultId: string, phrase: string, newPassword: string): Promise<{ items: Item[]; info: VaultInfo; vaultId: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.RECOVER, { vaultId, phrase, newPassword }),

  saveRecoveryPhrase: (phrase: string): Promise<boolean> =>
    ipcRenderer.invoke(IPC_CHANNELS.SAVE_RECOVERY_PHRASE, phrase),

  onVaultLockedBySystem: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('vault-locked-by-system', handler);
    return () => ipcRenderer.removeListener('vault-locked-by-system', handler);
  },
};

const windowControls = {
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
  onMaximizeChange: (callback: (maximized: boolean) => void) => {
    const handler = (_event: unknown, maximized: boolean) => callback(maximized);
    ipcRenderer.on('window:maximize-changed', handler);
    return () => ipcRenderer.removeListener('window:maximize-changed', handler);
  },
};

export type DevVaultApi = typeof api;
export type WindowControls = typeof windowControls;

contextBridge.exposeInMainWorld('devVaultApi', api);
contextBridge.exposeInMainWorld('windowControls', windowControls);

