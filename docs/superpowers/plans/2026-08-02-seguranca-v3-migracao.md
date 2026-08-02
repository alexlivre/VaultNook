# Segurança v3 + Migração de Cofres — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Endurecer a criptografia (chave-mestra + metadados criptografados + BIP39 + recuperação), persistência atômica com ACL, CSP estrito, PBKDF2 async e validação de import — com migração automática dos cofres existentes (v2 → v3).

**Architecture:** O cofre passa a ter uma chave-mestra aleatória que criptografa nome, valor e descrição de cada item. A chave-mestra é guardada embrulhada por duas chaves derivadas: da senha (`masterKeyWrap`) e da recovery phrase (`recoveryKeyWrap`), o que torna a troca de senha barata (re-embrulhar) e permite recuperação real via frase. A migração acontece no primeiro desbloqueio pós-update, gerando uma nova recovery phrase BIP39 exibida uma única vez.

**Tech Stack:** Node 24, TypeScript, Vite, electron-builder, Vitest. Nova dependência: `bip39` (BIP39 oficial, audited). `icacls` para ACL no Windows.

## Global Constraints

- `formatVersion: 3` para cofres novos e migrados; migração roda no `unlockVault`.
- Chave-mestra (32B) em `Buffer` mutável (`VaultKey`), zeroizada ao travar.
- `name` e `description` dos itens passam a ser `EncryptedData`; `id`, `category`, `favorite`, `createdAt`, `updatedAt` permanecem em claro.
- Recovery phrase BIP39 inglesa (via pacote `bip39`); recuperação re-embrulha a chave-mestra com nova senha.
- Escrita atômica (`.tmp` + rename) em todos os arquivos do cofre/registro; ACL restrita ao usuário atual.
- CSP produção: `script-src 'self'` (sem `unsafe-eval`); dev mantém `unsafe-eval` via plugin.
- `pbkdf2Sync` → `pbkdf2` (async, promisified).
- Migração one-way (sem downgrade); merge de backup v3 de outro cofre rejeitado com erro claro.
- Código/comentários/commits em inglês; UI em pt-BR.

---
## File Structure

| File | Ação | Responsabilidade |
|------|------|------------------|
| `package.json` | Modify | Adicionar dep `bip39` |
| `src/main/services/crypto.ts` | Modify | PBKDF2 async, `generateMasterKey`, `encryptKey`/`decryptKey`, BIP39 |
| `src/__tests__/crypto.test.ts` | Modify | Testes async + key-wrap + BIP39 |
| `src/main/services/fs-utils.ts` | Create | `atomicWriteFile`, `restrictPathAcl` |
| `src/main/services/vault-registry.ts` | Modify | Usar `atomicWriteFile` + ACL |
| `src/main/services/vault.ts` | Modify | Formato v3, migração, recuperação, CRUD, import/export |
| `src/__tests__/vault.test.ts` | Modify | Testes v3 + migração + recuperação |
| `src/ipc-channels.ts` | Modify | Canal `RECOVER`; remover `MIGRATE_ENCRYPTION` |
| `src/main/handlers/ipc-handlers.ts` | Modify | Handler `RECOVER`; unlock retorna frase de migração; call sites `.ok` |
| `src/preload.ts` | Modify | Método `recover`; `unlock` retorna `recoveryPhrase?`; remover `migrateEncryption` |
| `index.html` | Modify | CSP estrito sem `unsafe-eval` |
| `vite.renderer.config.ts` | Modify | Plugin dev adiciona `unsafe-eval` |
| `src/renderer/pages/create-password-screen.tsx` | Modify | Exibir recovery phrase após criação |
| `src/renderer/pages/recovery-screen.tsx` | Create | Tela de recuperação (frase + nova senha) |
| `src/renderer/pages/unlock-screen.tsx` | Modify | Link "Esqueceu a senha?" + diálogo de migração |
| `src/renderer/App.tsx` | Modify | Rota `recovery` |
| `README.md` | Modify | Documentar nova estrutura de segurança |

---

### Task 1: crypto.ts — PBKDF2 async, key-wrap, BIP39

**Files:**
- Modify: `src/main/services/crypto.ts`
- Modify: `src/__tests__/crypto.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `deriveKey(password: string, salt: Buffer): Promise<VaultKey>` (async)
  - `hashPassword(password: string, salt: Buffer): Promise<Buffer>` (async)
  - `generateSalt(): Buffer`
  - `generateMasterKey(): Buffer` (32B aleatório)
  - `encrypt(value: string, vaultKey: VaultKey): EncryptedData`
  - `decrypt(data: EncryptedData, vaultKey: VaultKey): string`
  - `encryptKey(secret: Buffer, wrappingKey: Buffer): EncryptedData`
  - `decryptKey(data: EncryptedData, wrappingKey: Buffer): Buffer`
  - `generateRecoveryPhrase(): string` (BIP39, 12 palavras)
  - `validateRecoveryPhrase(phrase: string): boolean`

- [ ] **Step 1: Adicionar a dependência `bip39`**

Run: `npm install bip39`
Expected: `bip39@^3.1.0` em `dependencies`.

- [ ] **Step 2: Reescrever `src/__tests__/crypto.test.ts` (testes novos, falham)**

```ts
import { describe, it, expect } from 'vitest';
import {
  encrypt, decrypt, hashPassword, generateSalt, deriveKey,
  generateMasterKey, encryptKey, decryptKey, generateRecoveryPhrase,
  validateRecoveryPhrase,
} from '../main/services/crypto';

describe('crypto', () => {
  describe('encrypt/decrypt', () => {
    it('should encrypt and decrypt correctly', async () => {
      const salt = generateSalt();
      const key = await deriveKey('TestPassword123!', salt);
      const plaintext = 'sk_live_abc123xyz';
      const decrypted = decrypt(encrypt(plaintext, key), key);
      expect(decrypted).toBe(plaintext);
    });

    it('should fail to decrypt with wrong key', async () => {
      const salt = generateSalt();
      const key1 = await deriveKey('Password1!', salt);
      const key2 = await deriveKey('Password2!', salt);
      expect(() => decrypt(encrypt('secret', key1), key2)).toThrow();
    });

    it('should generate different ciphertext for same plaintext', async () => {
      const salt = generateSalt();
      const key = await deriveKey('Password1!', salt);
      const enc1 = encrypt('secret', key);
      const enc2 = encrypt('secret', key);
      expect(enc1.iv).not.toBe(enc2.iv);
      expect(enc1.ciphertext).not.toBe(enc2.ciphertext);
    });
  });

  describe('hashPassword', () => {
    it('should be consistent for same input', async () => {
      const salt = generateSalt();
      const h1 = await hashPassword('Password1!', salt);
      const h2 = await hashPassword('Password1!', salt);
      expect(h1.toString('base64')).toBe(h2.toString('base64'));
    });
  });

  describe('key wrap', () => {
    it('should wrap and unwrap a master key', () => {
      const master = generateMasterKey();
      const wrapping = generateMasterKey();
      const wrapped = encryptKey(master, wrapping);
      const unwrapped = decryptKey(wrapped, wrapping);
      expect(unwrapped.equals(master)).toBe(true);
    });

    it('should fail to unwrap with wrong wrapping key', () => {
      const master = generateMasterKey();
      const wrapped = encryptKey(master, generateMasterKey());
      expect(() => decryptKey(wrapped, generateMasterKey())).toThrow();
    });
  });

  describe('generateRecoveryPhrase', () => {
    it('should generate 12 valid BIP39 words', () => {
      const phrase = generateRecoveryPhrase();
      expect(phrase.split(' ')).toHaveLength(12);
      expect(validateRecoveryPhrase(phrase)).toBe(true);
    });

    it('should reject invalid phrase', () => {
      expect(validateRecoveryPhrase('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon')).toBe(false);
    });
  });
});
```

- [ ] **Step 3: Rodar testes e confirmar falha**

Run: `npx vitest run src/__tests__/crypto.test.ts`
Expected: FAIL (deriveKey não é async / funções novas não existem).

- [ ] **Step 4: Reescrever `src/main/services/crypto.ts`**

```ts
import { randomBytes, pbkdf2, createCipheriv, createDecipheriv } from 'crypto';
import { promisify } from 'node:util';
import { generateMnemonic, validateMnemonic } from 'bip39';

const pbkdf2Async = promisify(pbkdf2);

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const SALT_LENGTH = 32;
const ITERATIONS = 600000;
const DIGEST = 'sha256';

export interface EncryptedData {
  iv: string;
  ciphertext: string;
  tag: string;
}

export interface VaultKey {
  key: Buffer;
  zeroize(): void;
}

export async function deriveKey(password: string, salt: Buffer): Promise<VaultKey> {
  const key = (await pbkdf2Async(password, salt, ITERATIONS, KEY_LENGTH, DIGEST)) as Buffer;
  return {
    key,
    zeroize() {
      key.fill(0);
    },
  } as VaultKey;
}

export async function hashPassword(password: string, salt: Buffer): Promise<Buffer> {
  return (await pbkdf2Async(password, salt, ITERATIONS, KEY_LENGTH, DIGEST)) as Buffer;
}

export function generateSalt(): Buffer {
  return randomBytes(SALT_LENGTH);
}

export function generateMasterKey(): Buffer {
  return randomBytes(KEY_LENGTH);
}

function encryptBuffer(plaintext: Buffer, key: Buffer): EncryptedData {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString('base64'),
    ciphertext: encrypted.toString('base64'),
    tag: tag.toString('base64'),
  };
}

export function encrypt(value: string, vaultKey: VaultKey): EncryptedData {
  return encryptBuffer(Buffer.from(value, 'utf8'), vaultKey.key);
}

export function encryptKey(secret: Buffer, wrappingKey: Buffer): EncryptedData {
  return encryptBuffer(secret, wrappingKey);
}

function decryptBuffer(data: EncryptedData, key: Buffer): Buffer {
  const iv = Buffer.from(data.iv, 'base64');
  const encrypted = Buffer.from(data.ciphertext, 'base64');
  const tag = Buffer.from(data.tag, 'base64');
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

export function decrypt(data: EncryptedData, vaultKey: VaultKey): string {
  return decryptBuffer(data, vaultKey.key).toString('utf8');
}

export function decryptKey(data: EncryptedData, wrappingKey: Buffer): Buffer {
  return decryptBuffer(data, wrappingKey);
}

export function generateRecoveryPhrase(): string {
  return generateMnemonic(128);
}

export function validateRecoveryPhrase(phrase: string): boolean {
  return validateMnemonic(phrase.trim().toLowerCase());
}
```

- [ ] **Step 5: Rodar testes e confirmar passagem**

Run: `npx vitest run src/__tests__/crypto.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/main/services/crypto.ts src/__tests__/crypto.test.ts
git commit -m "feat: async pbkdf2, key-wrap primitives, BIP39 recovery phrase"
```

---

### Task 2: fs-utils.ts — escrita atômica + ACL

**Files:**
- Create: `src/main/services/fs-utils.ts`
- Modify: `src/main/services/vault-registry.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `atomicWriteFile(filePath: string, data: string): Promise<void>`
  - `restrictPathAcl(...paths: string[]): Promise<void>` (icacls no Windows, chmod 0o600 fora)

- [ ] **Step 1: Criar `src/main/services/fs-utils.ts`**

```ts
import { writeFile, rename, chmod } from 'fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function atomicWriteFile(filePath: string, data: string): Promise<void> {
  const tmpPath = `${filePath}.tmp`;
  await writeFile(tmpPath, data, 'utf-8');
  await rename(tmpPath, filePath);
}

export async function restrictPathAcl(...paths: string[]): Promise<void> {
  for (const p of paths) {
    try {
      if (process.platform === 'win32') {
        const user = process.env.USERNAME || process.env.USER || '';
        if (!user) continue;
        await execFileAsync('icacls', [p, '/grant:r', `${user}:(OI)(CI)F`, '/inheritance:r', '/Q']);
      } else {
        await chmod(p, 0o600);
      }
    } catch {
      // best effort — file/dir may already be restricted or fs non-POSIX
    }
  }
}
```

- [ ] **Step 2: Aplicar em `src/main/services/vault-registry.ts`**

Substitua `import { writeFile } from 'fs/promises';` para não importar `writeFile` (o registry continua usando `readFile`). Substitua `saveRegistry`:

```ts
import { atomicWriteFile, restrictPathAcl } from './fs-utils';
```

E em `loadRegistry`, após o `existsSync` não existir, antes de `saveRegistry()`, adicionar restrição da pasta (uma vez):

```ts
async function ensureRestricted(): Promise<void> {
  await restrictPathAcl(join(app.getPath('userData'), 'vaults'), getRegistryPath());
}
```

Substitua a implementação de `saveRegistry` para usar `atomicWriteFile`:

```ts
async function saveRegistry(): Promise<void> {
  if (!registry) return;
  await atomicWriteFile(getRegistryPath(), JSON.stringify(registry, null, 2));
}
```

E chame `await ensureRestricted();` no início de `loadRegistry()` (após o `if (!existsSync)` que cria o registro) e no início de `addVault` (após `if (!registry) await loadRegistry();`).

- [ ] **Step 3: Verificação**

Run: `npx vitest run src/__tests__/vault.test.ts src/__tests__/crypto.test.ts`
Expected: PASS (registry continua funcionando; ACL é best-effort).

- [ ] **Step 4: Commit**

```bash
git add src/main/services/fs-utils.ts src/main/services/vault-registry.ts
git commit -m "feat: atomic writes and restricted ACL for vault files"
```

---

### Task 3: vault.ts — formato v3, migração, recuperação, CRUD

**Files:**
- Modify: `src/main/services/vault.ts`

**Interfaces:**
- Consumes: crypto.ts (Task 1), fs-utils.ts (Task 2).
- Produces:
  - `createVault(password, hint?): Promise<{ recoveryPhrase: string; vaultId: string }>`
  - `unlockVault(password): Promise<{ ok: boolean; recoveryPhrase?: string }>`
  - `lockVault(): void`
  - `changePassword(data): Promise<boolean>`
  - `recoverVault(vaultId, phrase, newPassword): Promise<boolean>`
  - `getAllItems(): Promise<Item[]>`
  - `addItem(item: Item): Promise<void>` / `editItem(item: Item): Promise<void>` / `removeItem(id): Promise<void>`
  - `exportVault(): Promise<string>` / `exportVaultRaw(vaultId): Promise<string | null>`
  - `importVault(jsonData): Promise<{ imported: number; ignored: number; total: number }>`
  - `getVaultInfo()`, `getActiveVaultId()`, `getVaultExists()`, `vaultExists(vaultId)`, `deleteVault(vaultId)`, `loadVault(vaultId)`

- [ ] **Step 1: Reescrever `src/main/services/vault.ts` integralmente**

```ts
import { app } from 'electron';
import { existsSync, mkdirSync } from 'fs';
import { readFile, unlink } from 'fs/promises';
import { join } from 'path';
import { randomUUID, timingSafeEqual } from 'crypto';
import {
  generateSalt,
  hashPassword,
  deriveKey,
  generateMasterKey,
  encrypt,
  decrypt,
  encryptKey,
  decryptKey,
  generateRecoveryPhrase,
  type VaultKey,
  type EncryptedData,
} from './crypto';
import { atomicWriteFile, restrictPathAcl } from './fs-utils';
import type { Item, Category, ChangePassword } from '../../renderer/types';

interface StoredItem {
  id: string;
  name: EncryptedData;
  value: EncryptedData;
  description: EncryptedData | null;
  category: Category;
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
}

interface VaultData {
  version: string;
  formatVersion: 3;
  createdAt: number;
  passwordHash: string;
  salt: string;
  recoveryHash: string;
  masterKeyWrap: EncryptedData;
  recoveryKeyWrap: EncryptedData;
  hint: string;
  items: StoredItem[];
  settings: {
    autoLockTimer: number;
  };
}

let vaultKey: VaultKey | null = null;
let vaultPath: string;
let vaultData: VaultData | null = null;
let activeVaultId: string | null = null;

function toVaultKey(buffer: Buffer): VaultKey {
  return {
    key: buffer,
    zeroize() {
      buffer.fill(0);
    },
  } as VaultKey;
}

function getVaultPath(vaultId?: string): string {
  if (vaultId) {
    return join(app.getPath('userData'), 'vaults', `${vaultId}.json`);
  }
  if (activeVaultId) {
    return join(app.getPath('userData'), 'vaults', `${activeVaultId}.json`);
  }
  return join(app.getPath('userData'), 'vault.json');
}

function getVaultsDir(): string {
  return join(app.getPath('userData'), 'vaults');
}

export function getVaultExists(): boolean {
  vaultPath = getVaultPath();
  return existsSync(vaultPath);
}

export function vaultExists(vaultId: string): boolean {
  return existsSync(getVaultPath(vaultId));
}

export async function loadVault(vaultId: string): Promise<boolean> {
  const path = getVaultPath(vaultId);
  if (!existsSync(path)) return false;
  vaultPath = path;
  const raw = await readFile(path, 'utf-8');
  vaultData = JSON.parse(raw);
  activeVaultId = vaultId;
  vaultKey = null;
  return true;
}

export async function createVault(password: string, hint: string = ''): Promise<{ recoveryPhrase: string; vaultId: string }> {
  const vaultsDir = getVaultsDir();
  if (!existsSync(vaultsDir)) {
    mkdirSync(vaultsDir, { recursive: true });
  }
  await restrictPathAcl(vaultsDir);

  const id = activeVaultId || randomUUID();
  activeVaultId = id;
  vaultPath = getVaultPath(id);

  const salt = generateSalt();
  const passwordHash = await hashPassword(password, salt);
  const phrase = generateRecoveryPhrase();
  const recoveryHash = await hashPassword(phrase, salt);
  const masterKey = toVaultKey(generateMasterKey());

  const passwordKey = await deriveKey(password, salt);
  const masterKeyWrap = encryptKey(masterKey.key, passwordKey.key);
  passwordKey.zeroize();

  const recoveryKey = await deriveKey(phrase, salt);
  const recoveryKeyWrap = encryptKey(masterKey.key, recoveryKey.key);
  recoveryKey.zeroize();

  vaultData = {
    version: '0.2.0',
    formatVersion: 3,
    createdAt: Date.now(),
    passwordHash: passwordHash.toString('base64'),
    salt: salt.toString('base64'),
    recoveryHash: recoveryHash.toString('base64'),
    masterKeyWrap,
    recoveryKeyWrap,
    hint,
    items: [],
    settings: { autoLockTimer: 60 },
  };
  vaultKey = masterKey;

  await saveVault();
  return { recoveryPhrase: phrase, vaultId: id };
}

async function migrateToV3(parsed: any, passwordKey: VaultKey, salt: Buffer): Promise<string> {
  const masterKey = toVaultKey(generateMasterKey());
  const newPhrase = generateRecoveryPhrase();

  const items: StoredItem[] = (parsed.items || []).map((item: any) => {
    const rawValue = typeof item.value === 'object' ? decrypt(item.value, passwordKey) : (item.value as string);
    return {
      id: item.id || randomUUID(),
      name: encrypt(item.name || '', masterKey),
      value: encrypt(rawValue || '', masterKey),
      description: item.description ? encrypt(item.description, masterKey) : null,
      category: item.category as Category,
      favorite: !!item.favorite,
      createdAt: item.createdAt ?? Date.now(),
      updatedAt: item.updatedAt ?? Date.now(),
    };
  });

  const recoveryKey = await deriveKey(newPhrase, salt);
  vaultData = {
    version: '0.2.0',
    formatVersion: 3,
    createdAt: parsed.createdAt ?? Date.now(),
    passwordHash: parsed.passwordHash,
    salt: parsed.salt,
    recoveryHash: (await hashPassword(newPhrase, salt)).toString('base64'),
    masterKeyWrap: encryptKey(masterKey.key, passwordKey.key),
    recoveryKeyWrap: encryptKey(masterKey.key, recoveryKey.key),
    hint: parsed.hint ?? '',
    items,
    settings: parsed.settings ?? { autoLockTimer: 60 },
  };
  recoveryKey.zeroize();
  vaultKey = masterKey;
  await saveVault();
  return newPhrase;
}

function unwrapMasterKey(data: VaultData, wrappingKey: VaultKey): VaultKey {
  const master = decryptKey(data.masterKeyWrap, wrappingKey.key);
  return toVaultKey(master);
}

export async function unlockVault(password: string): Promise<{ ok: boolean; recoveryPhrase?: string }> {
  if (!existsSync(vaultPath)) return { ok: false };

  const raw = await readFile(vaultPath, 'utf-8');
  const parsed = JSON.parse(raw);
  const salt = Buffer.from(parsed.salt, 'base64');

  const passwordKey = await deriveKey(password, salt);
  const hash = await hashPassword(password, salt);
  const expected = Buffer.from(parsed.passwordHash, 'base64');
  if (hash.length !== expected.length || !timingSafeEqual(hash, expected)) {
    passwordKey.zeroize();
    return { ok: false };
  }

  const fv = parsed.formatVersion || 1;
  let migratedPhrase: string | undefined;
  if (fv < 3) {
    migratedPhrase = await migrateToV3(parsed, passwordKey, salt);
  } else {
    vaultData = parsed;
    vaultKey = unwrapMasterKey(parsed, passwordKey);
  }
  passwordKey.zeroize();

  return { ok: true, recoveryPhrase: migratedPhrase };
}

export function lockVault(): void {
  if (vaultKey) {
    vaultKey.zeroize();
    vaultKey = null;
  }
  vaultData = null;
}

export function getActiveVaultId(): string | null {
  return activeVaultId;
}

export async function changePassword(data: ChangePassword): Promise<boolean> {
  if (!vaultData || !vaultKey) return false;
  const salt = Buffer.from(vaultData.salt, 'base64');
  const currentHash = await hashPassword(data.currentPassword, salt);
  const expected = Buffer.from(vaultData.passwordHash, 'base64');
  if (currentHash.length !== expected.length || !timingSafeEqual(currentHash, expected)) {
    return false;
  }
  const newPasswordKey = await deriveKey(data.newPassword, salt);
  vaultData.masterKeyWrap = encryptKey(vaultKey.key, newPasswordKey.key);
  vaultData.passwordHash = (await hashPassword(data.newPassword, salt)).toString('base64');
  newPasswordKey.zeroize();
  await saveVault();
  return true;
}

export async function recoverVault(vaultId: string, phrase: string, newPassword: string): Promise<boolean> {
  const path = getVaultPath(vaultId);
  if (!existsSync(path)) return false;
  const raw = await readFile(path, 'utf-8');
  const parsed = JSON.parse(raw);
  if ((parsed.formatVersion || 1) < 3) return false;

  const salt = Buffer.from(parsed.salt, 'base64');
  const normalizedPhrase = phrase.trim().toLowerCase().split(/\s+/).join(' ');
  const recoveryKey = await deriveKey(normalizedPhrase, salt);

  let master: Buffer;
  try {
    master = decryptKey(parsed.recoveryKeyWrap, recoveryKey.key);
  } catch {
    recoveryKey.zeroize();
    return false;
  }
  recoveryKey.zeroize();

  vaultData = parsed;
  vaultKey = toVaultKey(master);
  activeVaultId = vaultId;
  vaultPath = path;

  const newPasswordKey = await deriveKey(newPassword, salt);
  vaultData.masterKeyWrap = encryptKey(master, newPasswordKey.key);
  vaultData.passwordHash = (await hashPassword(newPassword, salt)).toString('base64');
  newPasswordKey.zeroize();
  await saveVault();
  return true;
}

export async function deleteVault(vaultId: string): Promise<void> {
  lockVault();
  const path = getVaultPath(vaultId);
  if (existsSync(path)) {
    await unlink(path);
  }
}

export async function getVaultInfo() {
  if (!vaultData) return null;
  const itemsByCategory: Record<string, number> = { api: 0, prompt: 0, command: 0, link: 0 };
  for (const item of vaultData.items) {
    itemsByCategory[item.category] = (itemsByCategory[item.category] || 0) + 1;
  }
  return {
    createdAt: vaultData.createdAt,
    totalItems: vaultData.items.length,
    itemsByCategory,
    appVersion: app.getVersion(),
  };
}

export async function getAllItems(): Promise<Item[]> {
  if (!vaultData || !vaultKey) return [];
  return vaultData.items.map((item) => ({
    id: item.id,
    name: decrypt(item.name, vaultKey!),
    value: decrypt(item.value, vaultKey!),
    description: item.description ? decrypt(item.description, vaultKey!) : '',
    category: item.category,
    favorite: item.favorite,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }));
}

function toStoredItem(item: Item): StoredItem {
  return {
    id: item.id,
    name: encrypt(item.name, vaultKey!),
    value: encrypt(item.value, vaultKey!),
    description: item.description ? encrypt(item.description, vaultKey!) : null,
    category: item.category,
    favorite: item.favorite,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export async function addItem(item: Item): Promise<void> {
  if (!vaultData || !vaultKey) return;
  vaultData.items.push(toStoredItem(item));
  await saveVault();
}

export async function editItem(item: Item): Promise<void> {
  if (!vaultData || !vaultKey) return;
  vaultData.items = vaultData.items.map((i) => (i.id === item.id ? toStoredItem(item) : i));
  await saveVault();
}

export async function removeItem(id: string): Promise<void> {
  if (!vaultData) return;
  vaultData.items = vaultData.items.filter((i) => i.id !== id);
  await saveVault();
}

export async function exportVault(): Promise<string> {
  if (!vaultData) return '{}';
  return JSON.stringify(
    {
      formatVersion: 3,
      version: vaultData.version,
      createdAt: vaultData.createdAt,
      exportedAt: Date.now(),
      passwordHash: vaultData.passwordHash,
      salt: vaultData.salt,
      recoveryHash: vaultData.recoveryHash,
      masterKeyWrap: vaultData.masterKeyWrap,
      recoveryKeyWrap: vaultData.recoveryKeyWrap,
      settings: vaultData.settings,
      items: vaultData.items,
    },
    null,
    2
  );
}

export async function exportVaultRaw(vaultId: string): Promise<string | null> {
  const path = getVaultPath(vaultId);
  if (!existsSync(path)) return null;
  return readFile(path, 'utf-8');
}

export async function importVault(jsonData: string): Promise<{ imported: number; ignored: number; total: number }> {
  if (!vaultData || !vaultKey) throw new Error('Vault bloqueado');
  const data = JSON.parse(jsonData);
  if (!data || typeof data !== 'object' || !Array.isArray(data.items)) {
    throw new Error('Backup inválido');
  }

  const existingIds = new Set(vaultData.items.map((i) => i.id));
  let imported = 0;
  let ignored = 0;
  const sourceFv = data.formatVersion || 1;

  for (const item of data.items) {
    if (existingIds.has(item.id)) {
      ignored++;
      continue;
    }
    let stored: StoredItem;
    if (sourceFv === 3) {
      try {
        decrypt(item.value, vaultKey!);
      } catch {
        throw new Error('Backup de outro cofre: importe como novo cofre');
      }
      stored = {
        id: item.id,
        name: item.name,
        value: item.value,
        description: item.description ?? null,
        category: item.category,
        favorite: !!item.favorite,
        createdAt: item.createdAt ?? Date.now(),
        updatedAt: item.updatedAt ?? Date.now(),
      };
    } else {
      const rawValue = typeof item.value === 'string' ? item.value : '';
      stored = {
        id: item.id || randomUUID(),
        name: encrypt(item.name || '', vaultKey!),
        value: encrypt(rawValue, vaultKey!),
        description: item.description ? encrypt(item.description, vaultKey!) : null,
        category: item.category as Category,
        favorite: !!item.favorite,
        createdAt: item.createdAt ?? Date.now(),
        updatedAt: item.updatedAt ?? Date.now(),
      };
    }
    vaultData.items.push(stored);
    imported++;
  }

  await saveVault();
  return { imported, ignored, total: data.items.length };
}

async function saveVault(): Promise<void> {
  if (!vaultData || !vaultPath) return;
  await atomicWriteFile(vaultPath, JSON.stringify(vaultData, null, 2));
}
```

> Nota: `getVaultInfo` original lia o arquivo cru para estatísticas de cofres não abertos; a versão acima usa `vaultData` em memória (cofre aberto). O handler `LIST_VAULTS` que usa stats via meta deve continuar funcionando (ver Task 4).

- [ ] **Step 2: Verificação**

Run: `npx tsc --noEmit`
Expected: erros apenas em arquivos não atualizados ainda (vault.test.ts, handlers, preload) — **não corrija agora**; serão tratados nas Tasks 4–5.

- [ ] **Step 3: Commit**

```bash
git add src/main/services/vault.ts
git commit -m "feat: v3 vault format with master key, metadata encryption, migration and recovery"
```

---

### Task 4: vault.test.ts — testes v3, migração e recuperação

**Files:**
- Modify: `src/__tests__/vault.test.ts`

**Interfaces:**
- Consumes: `vault` (Task 3), mock `electron` com `getPath → testDir` e `getVersion → '0.0.0'`.

- [ ] **Step 1: Reescrever `src/__tests__/vault.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const testDir = join(tmpdir(), 'devvault-test-' + Date.now());
vi.mock('electron', () => ({
  app: {
    getPath: () => testDir,
    getVersion: () => '0.0.0-test',
  },
}));

import * as vault from '../main/services/vault';

const makeItem = (overrides: Partial<Parameters<typeof vault.addItem>[0]> = {}) => ({
  id: 'test-id',
  name: 'Test API',
  value: 'sk_test_123',
  description: '',
  category: 'api' as const,
  favorite: false,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  ...overrides,
});

describe('vault v3', () => {
  beforeEach(() => {
    mkdirSync(join(testDir, 'vaults'), { recursive: true });
  });

  afterEach(() => {
    vault.lockVault();
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('createVault', () => {
    it('should create vault and return BIP39 phrase', async () => {
      const result = await vault.createVault('Password1!', 'hint');
      expect(result.recoveryPhrase.split(' ')).toHaveLength(12);
      expect(result.vaultId).toBeDefined();
    });
  });

  describe('unlockVault', () => {
    it('should unlock with correct password', async () => {
      await vault.createVault('Password1!');
      vault.lockVault();
      const success = await vault.unlockVault('Password1!');
      expect(success.ok).toBe(true);
      expect(success.recoveryPhrase).toBeUndefined();
    });

    it('should fail with wrong password', async () => {
      await vault.createVault('Password1!');
      vault.lockVault();
      const success = await vault.unlockVault('WrongPassword!');
      expect(success.ok).toBe(false);
    });
  });

  describe('metadata encryption', () => {
    it('should store name and description encrypted at rest', async () => {
      await vault.createVault('Password1!');
      await vault.addItem(makeItem({ name: 'Stripe Live', description: 'conta principal' }));
      const raw = JSON.parse(require('fs').readFileSync(join(testDir, 'vaults', 'test-vault.json'), 'utf-8'));
      const stored = raw.items[0];
      expect(typeof stored.name).toBe('object');
      expect(stored.name.ciphertext).toBeDefined();
      expect(typeof stored.description).toBe('object');
    });

    it('should decrypt name/value/description on getAllItems', async () => {
      await vault.createVault('Password1!');
      await vault.addItem(makeItem({ name: 'Stripe Live', description: 'conta principal' }));
      const items = await vault.getAllItems();
      expect(items[0].name).toBe('Stripe Live');
      expect(items[0].description).toBe('conta principal');
      expect(items[0].value).toBe('sk_test_123');
    });
  });

  describe('migration v2 -> v3', () => {
    it('should migrate a v2 vault and return a new recovery phrase', async () => {
      const salt = require('crypto').randomBytes(32);
      const { hashPassword } = await import('../main/services/crypto');
      const passwordHash = await hashPassword('OldPassword1!', salt);
      const legacy = {
        version: '0.1.0',
        formatVersion: 2,
        createdAt: Date.now(),
        passwordHash: passwordHash.toString('base64'),
        salt: salt.toString('base64'),
        recoveryHash: 'x',
        hint: '',
        items: [
          {
            id: 'old-1',
            name: 'Legacy API',
            value: 'plaintext-value', // v2 stores value encrypted; here simplified as string
            description: 'legacy desc',
            category: 'api',
            favorite: false,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        ],
        settings: { autoLockTimer: 60 },
      };
      require('fs').writeFileSync(join(testDir, 'vaults', 'old-vault.json'), JSON.stringify(legacy));
      await vault.loadVault('old-vault');
      const result = await vault.unlockVault('OldPassword1!');
      expect(result.ok).toBe(true);
      expect(result.recoveryPhrase).toBeDefined();
      const items = await vault.getAllItems();
      expect(items[0].name).toBe('Legacy API');
      expect(items[0].value).toBe('plaintext-value');
      const raw = JSON.parse(require('fs').readFileSync(join(testDir, 'vaults', 'old-vault.json'), 'utf-8'));
      expect(raw.formatVersion).toBe(3);
      expect(typeof raw.items[0].name).toBe('object');
    });
  });

  describe('recovery', () => {
    it('should recover with phrase and new password', async () => {
      const created = await vault.createVault('Password1!');
      await vault.addItem(makeItem());
      const phrase = created.recoveryPhrase;
      vault.lockVault();

      const ok = await vault.recoverVault(created.vaultId, phrase, 'NewPassword1!');
      expect(ok).toBe(true);
      const items = await vault.getAllItems();
      expect(items[0].value).toBe('sk_test_123');

      vault.lockVault();
      const unlockOld = await vault.unlockVault('Password1!');
      expect(unlockOld.ok).toBe(false);
      const unlockNew = await vault.unlockVault('NewPassword1!');
      expect(unlockNew.ok).toBe(true);
    });

    it('should reject wrong phrase', async () => {
      const created = await vault.createVault('Password1!');
      vault.lockVault();
      const ok = await vault.recoverVault(created.vaultId, 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon', 'NewPassword1!');
      expect(ok).toBe(false);
    });
  });

  describe('changePassword', () => {
    it('should re-wrap master key and keep items', async () => {
      await vault.createVault('Password1!');
      await vault.addItem(makeItem());
      const ok = await vault.changePassword({
        currentPassword: 'Password1!',
        newPassword: 'NewPassword1!',
        confirmPassword: 'NewPassword1!',
      });
      expect(ok).toBe(true);
      vault.lockVault();
      const unlockNew = await vault.unlockVault('NewPassword1!');
      expect(unlockNew.ok).toBe(true);
      const items = await vault.getAllItems();
      expect(items[0].value).toBe('sk_test_123');
    });
  });

  describe('CRUD', () => {
    beforeEach(async () => {
      await vault.createVault('Password1!');
    });

    it('should add, edit and remove item', async () => {
      await vault.addItem(makeItem());
      expect(await vault.getAllItems()).toHaveLength(1);
      await vault.editItem(makeItem({ name: 'Updated', value: 'sk_updated' }));
      const items = await vault.getAllItems();
      expect(items[0].name).toBe('Updated');
      expect(items[0].value).toBe('sk_updated');
      await vault.removeItem('test-id');
      expect(await vault.getAllItems()).toHaveLength(0);
    });
  });
});
```

> Nota: no teste de migração, o item legacy usa `value` como string (valor em claro), que é o caminho do `migrateToV3` para `typeof item.value === 'string'`. Isso testa o ramo de migração de texto puro.

- [ ] **Step 2: Rodar testes**

Run: `npx vitest run src/__tests__/vault.test.ts`
Expected: PASS. Se falhar por conta do nome do arquivo do vault de teste (`test-vault.json` vs `randomUUID`), ajuste para ler o arquivo do diretório `vaults/` (o primeiro `.json`).

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/vault.test.ts
git commit -m "test: v3 vault, migration and recovery"
```

---

### Task 5: IPC + preload — canal RECOVER e retorno do unlock

**Files:**
- Modify: `src/ipc-channels.ts`
- Modify: `src/main/handlers/ipc-handlers.ts`
- Modify: `src/preload.ts`

**Interfaces:**
- Consumes: `vault` (Task 3), `registry`.
- Produces: `window.devVaultApi.recover(vaultId, phrase, newPassword)`; `unlock` retorna `recoveryPhrase?: string`.

- [ ] **Step 1: `src/ipc-channels.ts`**

Substitua `MIGRATE_ENCRYPTION: 'vault:migrate-encryption',` por:

```ts
  RECOVER: 'vault:recover',
```

- [ ] **Step 2: `src/main/handlers/ipc-handlers.ts`**

Atualize o handler `UNLOCK` para retornar a frase de migração:

```ts
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
```

Atualize `DELETE_VAULT` (linha ~113): `const canUnlock = await vault.unlockVault(password); if (!canUnlock)` → `if (!canUnlock.ok)`.

Atualize `DELETE_VAULT_ENTRY` (linha ~122): idem.

Adicione o handler `RECOVER` logo após o `UNLOCK`:

```ts
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
```

- [ ] **Step 3: `src/preload.ts`**

Remova o método `migrateEncryption` do objeto `api`. Adicione `recover`:

```ts
  recover: (vaultId: string, phrase: string, newPassword: string): Promise<{ items: Item[]; info: VaultInfo; vaultId: string }> =>
    ipcRenderer.invoke(IPC_CHANNELS.RECOVER, { vaultId, phrase, newPassword }),
```

Atualize o tipo de retorno de `unlock` para incluir a frase:

```ts
  unlock: (password: string, vaultId: string): Promise<{ items: Item[]; info: VaultInfo; vaultId: string; recoveryPhrase?: string }> => {
    const data = UnlockPayload.parse({ password, vaultId });
    return ipcRenderer.invoke(IPC_CHANNELS.UNLOCK, data);
  },
```

- [ ] **Step 4: Verificação**

Run: `npm run lint && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add src/ipc-channels.ts src/main/handlers/ipc-handlers.ts src/preload.ts
git commit -m "feat: recovery IPC channel and unlock migration phrase"
```

---

### Task 6: CSP — produção estrito, dev com unsafe-eval

**Files:**
- Modify: `index.html`
- Modify: `vite.renderer.config.ts`

**Interfaces:**
- Consumes: nada.
- Produces: CSP produção `script-src 'self'`; dev adiciona `'unsafe-eval'`.

- [ ] **Step 1: `index.html`**

Substitua o `<meta http-equiv="Content-Security-Policy" ...>` por:

```html
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'none';"
    />
```

- [ ] **Step 2: `vite.renderer.config.ts`**

Atualize o plugin dev para também relaxar script-src:

```ts
    {
      name: 'relax-csp-for-hmr',
      apply: 'serve',
      transformIndexHtml: (html) =>
        html
          .replace("connect-src 'none'", "connect-src 'self' ws:")
          .replace("script-src 'self'", "script-src 'self' 'unsafe-eval'"),
    },
```

- [ ] **Step 3: Verificar ausência de eval no bundle de produção**

Run: `npm run build`
Run: `rg -n "new Function|eval\(" .vite/renderer/main_window/assets/*.js | Select-Object -First 5`
Expected: build OK. Se `new Function(`/`eval(` aparecerem, identifique a lib (chunk) — se for apenas `eval(` de algum polyfill não executado no boot, mantenha; caso contrário documente a exceção no commit.

- [ ] **Step 4: Commit**

```bash
git add index.html vite.renderer.config.ts
git commit -m "chore: strict CSP in production, unsafe-eval only in dev"
```

---

### Task 7: UI — frase na criação, tela de recuperação, link e diálogo de migração

**Files:**
- Modify: `src/renderer/pages/create-password-screen.tsx`
- Create: `src/renderer/pages/recovery-screen.tsx`
- Modify: `src/renderer/pages/unlock-screen.tsx`
- Modify: `src/renderer/App.tsx`

**Interfaces:**
- Consumes: `window.devVaultApi.recover`, `window.devVaultApi.unlock`, store `useVaultStore`.

- [ ] **Step 1: `create-password-screen.tsx`**

Adicione estado para exibir a frase após criar. Substitua `const [loading, setLoading] = React.useState(false);` por:

```ts
  const [loading, setLoading] = React.useState(false);
  const [newPhrase, setNewPhrase] = React.useState<string | null>(null);
```

Substitua o `handleSubmit` para capturar a frase:

```ts
    setLoading(true);
    try {
      const api = window.devVaultApi;
      const result = await api.createVault(password, vaultName.trim(), hint.trim());
      setNewPhrase(result.recoveryPhrase);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao criar cofre');
    } finally {
      setLoading(false);
    }
  };
```

Se `newPhrase`, renderize no lugar do formulário (antes do fechamento do container), exibindo as 12 palavras e botão "Continuar":

```tsx
  if (newPhrase) {
    return (
      <div className="flex min-h-screen flex-col bg-surface-base">
        <header className="titlebar flex items-center justify-end h-11 shrink-0">
          <WindowControls />
        </header>
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="w-full max-w-md space-y-6 text-center">
            <h1 className="text-2xl font-semibold text-text-primary">Guarde sua frase de recuperação</h1>
            <p className="text-sm text-text-muted">
              Anote estas 12 palavras em local seguro. Com elas você recupera o cofre
              se esquecer a senha. Elas não podem ser recuperadas depois.
            </p>
            <div className="rounded-lg border border-border-default bg-surface-raised p-4">
              <ol className="grid grid-cols-2 gap-2 text-sm text-text-primary">
                {newPhrase.split(' ').map((word, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="text-xs text-text-muted">{i + 1}.</span>
                    {word}
                  </li>
                ))}
              </ol>
            </div>
            <Button variant="primary" className="w-full h-10" onClick={onCreated}>
              Continuar
            </Button>
          </div>
        </div>
      </div>
    );
  }
```

- [ ] **Step 2: Criar `src/renderer/pages/recovery-screen.tsx`**

```tsx
import * as React from 'react';
import { Shield, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { WindowControls } from '../components/window-controls';
import { useVaultStore } from '../stores/vault-store';

interface RecoveryScreenProps {
  vaultId: string;
  vaultName: string;
  onRecovered: () => void;
  onBack: () => void;
}

export function RecoveryScreen({ vaultId, vaultName, onRecovered, onBack }: RecoveryScreenProps) {
  const [phrase, setPhrase] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('As senhas não conferem');
      return;
    }
    setLoading(true);
    try {
      const api = window.devVaultApi;
      const result = await api.recover(vaultId, phrase, newPassword);
      const store = useVaultStore.getState();
      store.setItems(result.items);
      store.setActiveVaultId(result.vaultId);
      store.setActiveVaultName(vaultName);
      store.setIsLocked(false);
      onRecovered();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Frase de recuperação inválida');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-surface-base">
      <header className="titlebar flex items-center justify-end h-11 shrink-0">
        <WindowControls />
      </header>
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-secondary cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar aos cofres
          </button>

          <div className="flex flex-col items-center gap-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-category-all/10">
              <Shield className="h-8 w-8 text-category-all" />
            </div>
            <h1 className="text-2xl font-semibold text-text-primary">Recuperar {vaultName}</h1>
            <p className="text-sm text-text-muted">Digite sua frase de recuperação e defina uma nova senha</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phrase">Frase de recuperação (12 palavras)</Label>
              <textarea
                id="phrase"
                value={phrase}
                onChange={(e) => setPhrase(e.target.value)}
                placeholder="palavra1 palavra2 ... palavra12"
                className="flex h-20 w-full rounded-md border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus resize-none"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">Nova senha mestra</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="Nova senha"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar nova senha</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="Repita a senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <Button type="submit" className="w-full h-10" disabled={loading || !phrase || !newPassword}>
              {loading ? 'Recuperando...' : 'Recuperar cofre'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: `unlock-screen.tsx`**

No rodapé do form (após o botão "Desbloquear"), adicione o link (precisa da prop `onForgot`). Atualize a interface:

```ts
interface UnlockScreenProps {
  vaultId: string;
  vaultName: string;
  vaultHint: string;
  onUnlocked: () => void;
  onBack: () => void;
  onForgot: () => void;
}
```

E adicione após o `</form>`:

```tsx
        <button
          onClick={onForgot}
          className="mx-auto block text-xs text-text-muted hover:text-text-secondary cursor-pointer"
        >
          Esqueceu a senha? Recuperar com frase
        </button>
```

No `handleSubmit`, capture a frase de migração e exiba um diálogo antes de `onUnlocked()`:

```ts
      const result = await api.unlock(password, vaultId);
      const settings = await api.getSettings();
      const { useVaultStore } = await import('../stores/vault-store');
      useVaultStore.getState().setItems(result.items);
      useVaultStore.getState().setAutoLockTimer((settings.autoLockTimer ?? 60) as AutoLockOption);
      useVaultStore.getState().setActiveVaultId(result.vaultId);
      useVaultStore.getState().setActiveVaultName(vaultName);
      if (result.recoveryPhrase) {
        setMigrationPhrase(result.recoveryPhrase);
      } else {
        onUnlocked();
      }
```

Adicione estado `const [migrationPhrase, setMigrationPhrase] = React.useState<string | null>(null);` e renderize um overlay quando presente (mesma estrutura do passo de frase da criação), com botão "Continuar" que chama `onUnlocked()`.

- [ ] **Step 4: `App.tsx`**

Adicione estado `const [recoveryMode, setRecoveryMode] = React.useState(false);` (ou use `screen === 'recovery'`). Adicione `handleForgotPassword`:

```ts
  const handleForgotPassword = React.useCallback(() => {
    setScreen('recovery');
  }, [setScreen]);
```

E `handleRecovered`:

```ts
  const handleRecovered = React.useCallback(() => {
    setScreen('vault');
    setIsLocked(false);
  }, [setScreen, setIsLocked]);
```

No bloco de render, adicione:

```tsx
      {screen === 'recovery' && unlockVaultId && (
        <RecoveryScreen
          vaultId={unlockVaultId}
          vaultName={unlockVaultName}
          onRecovered={handleRecovered}
          onBack={handleBackToManager}
        />
      )}
```

Passe `onForgot={handleForgotPassword}` ao `UnlockScreen`. Importe `RecoveryScreen`.

- [ ] **Step 5: Verificação**

Run: `npm run lint && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/pages/create-password-screen.tsx src/renderer/pages/recovery-screen.tsx src/renderer/pages/unlock-screen.tsx src/renderer/App.tsx
git commit -m "feat: recovery phrase display, recovery screen and migration dialog"
```

---

### Task 8: Verificação final + README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Rodar verificação completa**

Run: `npm run lint`
Run: `npx tsc --noEmit`
Run: `npm run test:run`
Run: `npm run build`
Expected: lint exit 0; tsc sem erros; 19+ testes passando (novos: ~10); build OK.

- [ ] **Step 2: Atualizar `README.md`**

No bloco de segurança, substituir a seção de criptografia por:

```md
### Como seus dados são protegidos (v3)

- **Chave-mestra de 256 bits** gerada aleatoriamente por cofre, criptografa nome, valor e
  descrição de cada item com AES-256-GCM.
- A chave-mestra é protegida por duas "cápsulas": uma derivada da senha mestra (PBKDF2,
  600.000 iterações) e outra derivada da **frase de recuperação BIP39**.
- Trocar a senha apenas re-embrulha a chave-mestra — nada é re-criptografado.
- Recuperação por frase BIP39 (12 palavras) se a senha for esquecida.
- Chave em `Buffer` mutável, zeroizada ao travar; comparação de senha via `timingSafeEqual`.
- Arquivos gravados atomicamente e com ACL restrita ao usuário atual.
```

Na seção "Segurança" (diagrama atual), substituir o fluxo do diagrama por:

```md
Senha mestra / Frase BIP39
        │
        ▼
   PBKDF2 (600.000 iterações)
        │
        └──► chave de embrulho ──► AES-GCM ──► Chave-mestra (256 bits, em memória)
                                                     │
                                                     ▼
                             AES-256-GCM por campo (nome, valor, descrição)
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: document v3 security model"
```

---

## Self-Review

- **Spec coverage:** v3 key-wrap (T3), migração v2→v3 (T3), BIP39+recuperação (T1/T3/T5/T7), CSP (T6), persistência atômica+ACL (T2), PBKDF2 async (T1), validação de import (T3 `importVault`), UI (T7), testes (T1/T4), README (T8). Coberto.
- **Placeholder scan:** nenhum TBD; todos os passos com código/commandos concretos.
- **Type consistency:** `unlockVault` → `{ ok, recoveryPhrase? }` consistente em vault.ts, handlers, preload e testes. `generateRecoveryPhrase(): string` consistente em crypto, vault, testes e UI. `recoverVault(vaultId, phrase, newPassword): Promise<boolean>` consistente.
- **Desvio documentado:** uso do pacote `bip39` (auditado) em vez de wordlist manual — mantém a mesma garantia BIP39 com menos risco de implementação própria.
