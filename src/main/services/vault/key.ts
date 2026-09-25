import { decryptKey, type VaultKey } from '../crypto';
import type { VaultData } from './state';

export function toVaultKey(buffer: Buffer): VaultKey {
  return {
    key: buffer,
    zeroize() {
      buffer.fill(0);
    },
  } as VaultKey;
}

export function unwrapMasterKey(data: VaultData, wrappingKey: VaultKey): VaultKey {
  const master = decryptKey(data.masterKeyWrap, wrappingKey.key);
  return toVaultKey(master);
}
