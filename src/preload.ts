import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from './shared/ipc-channels';
import {
  CreatePasswordPayloadSchema,
  UnlockPayloadSchema,
  DeleteVaultEntryPayloadSchema,
  ToggleFavoritePayloadSchema,
  SaveSettingsPayloadSchema,
} from './shared/schemas';
import type { Category, CreateItem, EditItem, ChangePassword, Item, VaultInfo, ImportResult, VaultEntry } from './shared/schemas';

export class IpcError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'IpcError';
    this.code = code;
  }
}

interface IpcEnvelope {
  ok: boolean;
  data?: unknown;
  error?: { code: string; message: string };
}

async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  const response = (await ipcRenderer.invoke(channel, ...args)) as IpcEnvelope;
  if (response && typeof response === 'object' && 'ok' in response) {
    if (response.ok) return response.data as T;
    throw new IpcError(response.error?.code ?? 'ERROR', response.error?.message ?? 'Erro inesperado');
  }
  return response as unknown as T;
}

const api = {
  init: (): Promise<{ vaults: VaultEntry[] }> => invoke(IPC_CHANNELS.INIT),

  listVaults: (): Promise<VaultEntry[]> => invoke(IPC_CHANNELS.LIST_VAULTS),

  createVault: (password: string, name: string, hint?: string, color?: string): Promise<{ recoveryPhrase: string; vaultId: string }> => {
    const data = CreatePasswordPayloadSchema.parse({ password, name, hint: hint || '', color });
    return invoke(IPC_CHANNELS.CREATE_PASSWORD, data);
  },

  unlock: (password: string, vaultId: string): Promise<{ items: Item[]; info: VaultInfo; vaultId: string; recoveryPhrase?: string }> => {
    const data = UnlockPayloadSchema.parse({ password, vaultId });
    return invoke(IPC_CHANNELS.UNLOCK, data);
  },

  lock: (): Promise<boolean> => invoke(IPC_CHANNELS.LOCK),

  changePassword: (data: ChangePassword): Promise<{ recoveryPhrase?: string }> =>
    invoke(IPC_CHANNELS.CHANGE_PASSWORD, data),

  regenerateRecoveryPhrase: (password: string): Promise<{ recoveryPhrase: string }> =>
    invoke(IPC_CHANNELS.REGENERATE_RECOVERY_PHRASE, { password }),

  deleteVault: (password: string): Promise<boolean> =>
    invoke(IPC_CHANNELS.DELETE_VAULT, { password }),

  deleteVaultEntry: (vaultId: string, password: string): Promise<boolean> => {
    const data = DeleteVaultEntryPayloadSchema.parse({ vaultId, password });
    return invoke(IPC_CHANNELS.DELETE_VAULT_ENTRY, data);
  },

  getInfo: (): Promise<VaultInfo> => invoke(IPC_CHANNELS.GET_INFO),

  getItems: (): Promise<Item[]> => invoke(IPC_CHANNELS.GET_ITEMS),

  addItem: (data: CreateItem): Promise<Item> =>
    invoke(IPC_CHANNELS.ADD_ITEM, data),

  editItem: (data: EditItem): Promise<Item> =>
    invoke(IPC_CHANNELS.EDIT_ITEM, data),

  removeItem: (id: string): Promise<boolean> =>
    invoke(IPC_CHANNELS.REMOVE_ITEM, id),

  removeItems: (ids: string[]): Promise<boolean> =>
    invoke(IPC_CHANNELS.REMOVE_ITEMS, ids),

  moveCategoryItems: (ids: string[], category: Category): Promise<boolean> =>
    invoke(IPC_CHANNELS.MOVE_CATEGORY_ITEMS, { ids, category }),

  exportVault: (): Promise<boolean> =>
    invoke(IPC_CHANNELS.EXPORT),

  importVault: (): Promise<ImportResult | null> =>
    invoke(IPC_CHANNELS.IMPORT),

  exportVaultFile: (vaultId: string): Promise<boolean> =>
    invoke(IPC_CHANNELS.EXPORT_FILE, vaultId),

  importVaultFile: (): Promise<{ id: string; name: string } | null> =>
    invoke(IPC_CHANNELS.IMPORT_FILE),

  toggleFavorite: (id: string, favorite: boolean): Promise<boolean> => {
    const data = ToggleFavoritePayloadSchema.parse({ id, favorite });
    return invoke(IPC_CHANNELS.TOGGLE_FAVORITE, data);
  },

  getSettings: (): Promise<{ autoLockTimer: number }> =>
    invoke(IPC_CHANNELS.GET_SETTINGS),

  saveSettings: (autoLockTimer: number): Promise<boolean> => {
    const data = SaveSettingsPayloadSchema.parse({ autoLockTimer });
    return invoke(IPC_CHANNELS.SAVE_SETTINGS, data);
  },

  getVaultHint: (vaultId: string): Promise<string> =>
    invoke(IPC_CHANNELS.GET_VAULT_HINT, vaultId),

  toggleHidden: (vaultId: string): Promise<boolean> =>
    invoke(IPC_CHANNELS.TOGGLE_HIDDEN, vaultId),

  renameVault: (vaultId: string, name: string, color?: string): Promise<boolean> =>
    invoke(IPC_CHANNELS.RENAME_VAULT, { vaultId, name, color }),

  openExternal: (url: string): Promise<boolean> =>
    invoke(IPC_CHANNELS.OPEN_EXTERNAL, url),

  clearClipboard: (expected?: string): Promise<boolean> =>
    invoke(IPC_CHANNELS.CLEAR_CLIPBOARD, { expected }),

  recover: (vaultId: string, phrase: string, newPassword: string): Promise<{ items: Item[]; info: VaultInfo; vaultId: string }> =>
    invoke(IPC_CHANNELS.RECOVER, { vaultId, phrase, newPassword }),

  saveRecoveryPhrase: (phrase: string): Promise<boolean> =>
    invoke(IPC_CHANNELS.SAVE_RECOVERY_PHRASE, phrase),

  onVaultLockedBySystem: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on(IPC_CHANNELS.VAULT_LOCKED_BY_SYSTEM, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.VAULT_LOCKED_BY_SYSTEM, handler);
    };
  },
};

const windowControls = {
  minimize: () => ipcRenderer.send(IPC_CHANNELS.WINDOW_MINIMIZE),
  maximize: () => ipcRenderer.send(IPC_CHANNELS.WINDOW_MAXIMIZE),
  close: () => ipcRenderer.send(IPC_CHANNELS.WINDOW_CLOSE),
  onMaximizeChange: (callback: (maximized: boolean) => void) => {
    const handler = (_event: unknown, maximized: boolean) => callback(maximized);
    ipcRenderer.on(IPC_CHANNELS.WINDOW_MAXIMIZE_CHANGED, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.WINDOW_MAXIMIZE_CHANGED, handler);
    };
  },
};

export type VaultNookApi = typeof api;
export type WindowControls = typeof windowControls;

contextBridge.exposeInMainWorld('vaultNookApi', api);
contextBridge.exposeInMainWorld('windowControls', windowControls);
