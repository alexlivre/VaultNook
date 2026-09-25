import { app } from 'electron';
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { restrictPathAcl } from './fs-utils';

const LEGACY_APP_NAME = 'DevVault';

export async function migrateLegacyUserData(): Promise<void> {
  const userData = app.getPath('userData');
  const legacyDir = join(app.getPath('appData'), LEGACY_APP_NAME);

  if (legacyDir === userData || !existsSync(legacyDir)) return;

  const registryPath = join(userData, 'vaults.json');
  if (existsSync(registryPath)) return;

  const legacyRegistry = join(legacyDir, 'vaults.json');
  const legacySingleVault = join(legacyDir, 'vault.json');
  const legacyVaultsDir = join(legacyDir, 'vaults');

  if (!existsSync(legacyRegistry) && !existsSync(legacySingleVault) && !existsSync(legacyVaultsDir)) {
    return;
  }

  mkdirSync(userData, { recursive: true });

  if (existsSync(legacyRegistry)) {
    cpSync(legacyRegistry, registryPath);
  }
  if (existsSync(legacySingleVault)) {
    cpSync(legacySingleVault, join(userData, 'vault.json'));
  }

  const vaultsDir = join(userData, 'vaults');
  if (existsSync(legacyVaultsDir)) {
    cpSync(legacyVaultsDir, vaultsDir, { recursive: true });
  }

  await restrictPathAcl(vaultsDir, registryPath);
}
