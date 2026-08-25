import { ipcMain, dialog, app, shell, clipboard } from 'electron';
import { writeFile, readFile } from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';
import * as vault from '../services/vault';
import * as registry from '../services/vault-registry';
import { IPC_CHANNELS } from '../../ipc-channels';
import { CreateItemSchema, EditItemSchema, ChangePasswordSchema } from '../../renderer/types';

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

const ImportedVaultSchema = z.object({
  version: z.string(),
  passwordHash: z.string(),
  salt: z.string(),
  items: z.array(z.any()),
});

function validate<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new Error(result.error.issues.map((e) => e.message).join(', '));
  }
  return result.data;
}

export function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.INIT, async () => {
    await registry.migrateOldVault();
    const vaults = await registry.loadRegistry();
    return { vaults };
  });

  ipcMain.handle(IPC_CHANNELS.LIST_VAULTS, async () => {
    const entries = await registry.listAllVaults();
    return Promise.all(entries.map(async (entry) => {
      const meta = await vault.getVaultMetadata(entry.id);
      return {
        id: entry.id,
        name: entry.name,
        createdAt: entry.createdAt,
        lastOpened: entry.lastOpened,
        hidden: entry.hidden,
        hasHint: entry.hint.length > 0,
        itemCount: meta?.totalItems || 0,
        color: entry.color,
      };
    }));
  });

  ipcMain.handle(IPC_CHANNELS.CREATE_PASSWORD, async (_event, data: unknown) => {
    const { password, name, hint, color } = validate(
      z.object({
        password: z.string().min(8),
        name: z.string().min(1, 'Nome é obrigatório'),
        hint: z.string().optional().default(''),
        color: z.string().optional(),
      }),
      data
    );
    const result = await vault.createVault(password, hint);
    await registry.addVault(name, hint, result.vaultId, color);
    return result;
  });

  ipcMain.handle(IPC_CHANNELS.UNLOCK, async (_event, data: unknown) => {
    const { password, vaultId } = validate(
      z.object({
        password: z.string().min(1),
        vaultId: z.string().min(1),
      }),
      data
    );
    const loaded = await vault.loadVault(vaultId);
    if (!loaded) throw new Error('Vault não encontrado');
    const result = await vault.unlockVault(password);
    if (!result.ok) throw new Error('Senha incorreta');
    await registry.updateVault(vaultId, { lastOpened: Date.now() });
    return {
      items: await vault.getAllItems(),
      info: await vault.getVaultInfo(),
      vaultId,
      recoveryPhrase: result.recoveryPhrase,
    };
  });

  ipcMain.handle(IPC_CHANNELS.RECOVER, async (_event, data: unknown) => {
    const { vaultId, phrase, newPassword } = validate(
      z.object({
        vaultId: z.string().min(1),
        phrase: z.string().min(1),
        newPassword: z.string().min(8),
      }),
      data
    );
    const ok = await vault.recoverVault(vaultId, phrase, newPassword);
    if (!ok) throw new Error('Frase de recuperação inválida');
    await registry.updateVault(vaultId, { lastOpened: Date.now() });
    return {
      items: await vault.getAllItems(),
      info: await vault.getVaultInfo(),
      vaultId,
    };
  });

  ipcMain.handle(IPC_CHANNELS.LOCK, async () => {
    vault.lockVault();
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.CHANGE_PASSWORD, async (_event, data: unknown) => {
    const validated = validate(ChangePasswordSchema, data);
    const result = await vault.changePassword(validated);
    if (!result.ok) throw new Error('Senha atual incorreta');
    return { recoveryPhrase: result.recoveryPhrase };
  });

  ipcMain.handle(IPC_CHANNELS.REGENERATE_RECOVERY_PHRASE, async (_event, data: unknown) => {
    const { password } = validate(
      z.object({ password: z.string().min(1) }),
      data
    );
    const result = await vault.regenerateRecoveryPhrase(password);
    if (!result.ok) throw new Error('Senha incorreta');
    return { recoveryPhrase: result.recoveryPhrase };
  });

  ipcMain.handle(IPC_CHANNELS.DELETE_VAULT, async (_event, data: unknown) => {
    const { password } = validate(DeleteVaultSchema, data);
    const vaultId = vault.getActiveVaultId();
    if (!vaultId) throw new Error('Nenhum vault ativo');
    const canUnlock = await vault.unlockVault(password);
    if (!canUnlock.ok) throw new Error('Senha incorreta');
    await vault.deleteVault(vaultId);
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.DELETE_VAULT_ENTRY, async (_event, data: unknown) => {
    const { vaultId, password } = validate(DeleteVaultEntrySchema, data);
    await vault.loadVault(vaultId);
    const canUnlock = await vault.unlockVault(password);
    if (!canUnlock.ok) throw new Error('Senha incorreta');
    await vault.deleteVault(vaultId);
    await registry.removeVault(vaultId);
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.GET_INFO, async () => {
    return vault.getVaultInfo();
  });

  ipcMain.handle(IPC_CHANNELS.GET_ITEMS, async () => {
    return vault.getAllItems();
  });

  ipcMain.handle(IPC_CHANNELS.ADD_ITEM, async (_event, data: unknown) => {
    const validated = validate(CreateItemSchema, data);
    const item = {
      ...validated,
      id: crypto.randomUUID(),
      favorite: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await vault.addItem(item);
    return item;
  });

  ipcMain.handle(IPC_CHANNELS.EDIT_ITEM, async (_event, data: unknown) => {
    const validated = validate(EditItemSchema, data);
    const items = await vault.getAllItems();
    const existing = items.find((i) => i.id === validated.id);
    const fullItem = existing
      ? { ...existing, ...validated, updatedAt: Date.now() }
      : { ...validated, favorite: false, createdAt: Date.now(), updatedAt: Date.now() };
    await vault.editItem(fullItem);
    return fullItem;
  });

  ipcMain.handle(IPC_CHANNELS.REMOVE_ITEM, async (_event, id: unknown) => {
    const validated = validate(z.string(), id);
    await vault.removeItem(validated);
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.SAVE_RECOVERY_PHRASE, async (_event, phrase: unknown) => {
    const { phrase: validated } = validate(
      z.object({ phrase: z.string().min(1) }),
      { phrase }
    );
    const result = await dialog.showSaveDialog({
      title: 'Salvar frase de recuperação',
      defaultPath: `devvault-recovery-phrase.txt`,
      filters: [{ name: 'Texto', extensions: ['txt'] }],
    });
    if (!result.canceled && result.filePath) {
      await writeFile(result.filePath, validated, 'utf-8');
      return true;
    }
    return false;
  });

  ipcMain.handle(IPC_CHANNELS.EXPORT, async () => {
    const data = await vault.exportVault();
    const result = await dialog.showSaveDialog({
      title: 'Exportar Vault',
      defaultPath: `devvault-backup-${Date.now()}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (!result.canceled && result.filePath) {
      await writeFile(result.filePath, data, 'utf-8');
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
      const data = await readFile(result.filePaths[0], 'utf-8');
      return vault.importVault(data);
    }
    return null;
  });

  ipcMain.handle(IPC_CHANNELS.EXPORT_FILE, async (_event, vaultId: unknown) => {
    const id = validate(z.string().min(1), vaultId);
    const raw = await vault.exportVaultRaw(id);
    if (!raw) throw new Error('Vault não encontrado');
    const result = await dialog.showSaveDialog({
      title: 'Exportar Vault',
      defaultPath: `devvault-export-${Date.now()}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (!result.canceled && result.filePath) {
      await writeFile(result.filePath, raw, 'utf-8');
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
      const raw = await readFile(result.filePaths[0], 'utf-8');
      const data = JSON.parse(raw);
      const validated = validate(ImportedVaultSchema, data);
      const name = `Importado ${new Date().toLocaleDateString()}`;
      const vaultId = crypto.randomUUID();
      const vaultsDir = join(app.getPath('userData'), 'vaults');
      if (!existsSync(vaultsDir)) {
        mkdirSync(vaultsDir, { recursive: true });
      }
      await writeFile(join(vaultsDir, `${vaultId}.json`), JSON.stringify(validated), 'utf-8');
      await registry.addVault(name, '', vaultId);
      return { id: vaultId, name };
    }
    return null;
  });

  ipcMain.handle(IPC_CHANNELS.TOGGLE_FAVORITE, async (_event, data: unknown) => {
    const { id, favorite } = validate(ToggleFavoriteSchema, data);
    const items = await vault.getAllItems();
    const item = items.find((i) => i.id === id);
    if (item) {
      await vault.editItem({ ...item, favorite });
    }
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.GET_SETTINGS, async () => {
    const timer = await vault.getAutoLockTimer();
    return { autoLockTimer: timer };
  });

  ipcMain.handle(IPC_CHANNELS.SAVE_SETTINGS, async (_event, data: unknown) => {
    const { autoLockTimer } = validate(SaveSettingsSchema, data);
    await vault.saveAutoLockTimer(autoLockTimer);
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.GET_VAULT_HINT, async (_event, vaultId: unknown) => {
    const id = validate(z.string().min(1), vaultId);
    return registry.getVaultHint(id);
  });

  ipcMain.handle(IPC_CHANNELS.TOGGLE_HIDDEN, async (_event, vaultId: unknown) => {
    const id = validate(z.string().min(1), vaultId);
    const entry = await registry.getVault(id);
    if (!entry) throw new Error('Vault não encontrado');
    await registry.updateVault(id, { hidden: !entry.hidden });
    return !entry.hidden;
  });

  ipcMain.handle(IPC_CHANNELS.RENAME_VAULT, async (_event, data: unknown) => {
    const { vaultId, name, color } = validate(
      z.object({
        vaultId: z.string().min(1),
        name: z.string().min(1, 'Nome é obrigatório'),
        color: z.string().optional(),
      }),
      data
    );
    await registry.renameVault(vaultId, name, color);
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.REMOVE_ITEMS, async (_event, ids: unknown) => {
    const validated = validate(z.array(z.string()), ids);
    await vault.removeItems(validated);
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.MOVE_CATEGORY_ITEMS, async (_event, data: unknown) => {
    const { ids, category } = validate(
      z.object({
        ids: z.array(z.string()),
        category: z.enum(['api', 'prompt', 'command', 'link']),
      }),
      data
    );
    await vault.moveCategoryItems(ids, category);
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.OPEN_EXTERNAL, async (_event, url: unknown) => {
    const validated = validate(z.string(), url);
    try {
      const parsed = new URL(validated);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        await shell.openExternal(validated);
        return true;
      }
    } catch {
      // invalid URL
    }
    return false;
  });

  ipcMain.handle(IPC_CHANNELS.CLEAR_CLIPBOARD, async () => {
    clipboard.clear();
    return true;
  });
}

export { IPC_CHANNELS };
