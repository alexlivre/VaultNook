import { randomUUID } from 'crypto';
import {
  decrypt,
  deriveKey,
  encrypt,
  encryptKey,
  generateMasterKey,
  generateRecoveryPhrase,
  type VaultKey,
} from '../crypto';
import { saveVault } from './storage';
import { toVaultKey } from './key';
import { vaultState, type LegacyVaultData, type StoredItem } from './state';
import type { Category } from '../../../shared/schemas';

export async function migrateToV3(parsed: LegacyVaultData, passwordKey: VaultKey, salt: Buffer): Promise<string> {
  const masterKey = toVaultKey(generateMasterKey());
  const newPhrase = generateRecoveryPhrase();

  const items: StoredItem[] = (parsed.items || []).map((item) => {
    const rawValue = typeof item.value === 'object' ? decrypt(item.value, passwordKey) : (item.value as string);
    const tagsEnc = Array.isArray(item.tags) && item.tags.length > 0
      ? encrypt(JSON.stringify(item.tags), masterKey)
      : null;
    return {
      id: item.id || randomUUID(),
      name: encrypt(item.name || '', masterKey),
      value: encrypt(rawValue || '', masterKey),
      description: item.description ? encrypt(item.description, masterKey) : null,
      tags: tagsEnc,
      category: item.category as Category,
      favorite: !!item.favorite,
      createdAt: item.createdAt ?? Date.now(),
      updatedAt: item.updatedAt ?? Date.now(),
    };
  });

  const recoveryKey = await deriveKey(newPhrase, salt);
  vaultState.data = {
    version: '0.2.0',
    formatVersion: 3,
    createdAt: parsed.createdAt ?? Date.now(),
    passwordHash: parsed.passwordHash,
    salt: parsed.salt,
    recoveryHash: recoveryKey.key.toString('base64'),
    masterKeyWrap: encryptKey(masterKey.key, passwordKey.key),
    recoveryKeyWrap: encryptKey(masterKey.key, recoveryKey.key),
    hint: parsed.hint ?? '',
    items,
    settings: parsed.settings ?? { autoLockTimer: 60 },
  };
  recoveryKey.zeroize();
  vaultState.key = masterKey;
  await saveVault();
  return newPhrase;
}
