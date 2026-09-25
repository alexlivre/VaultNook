import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const root = join(tmpdir(), 'vaultnook-user-data-test-' + Date.now());
const appData = join(root, 'appData');
const legacyDir = join(appData, 'DevVault');
const userData = join(appData, 'VaultNook');

vi.mock('electron', () => ({
  app: {
    getPath: (name: string) => (name === 'appData' ? appData : userData),
  },
}));

import { migrateLegacyUserData } from '../main/services/legacy-user-data';

const REGISTRY = JSON.stringify({ version: '1.0.0', vaults: [{ id: 'registered' }] });

function seedLegacy(): void {
  mkdirSync(join(legacyDir, 'vaults'), { recursive: true });
  writeFileSync(join(legacyDir, 'vaults.json'), REGISTRY);
  writeFileSync(join(legacyDir, 'vaults', 'registered.json'), '{"formatVersion":3}');
  writeFileSync(join(legacyDir, 'vaults', 'orphan.json'), '{"formatVersion":3}');
}

describe('migrateLegacyUserData', () => {
  beforeEach(() => {
    rmSync(root, { recursive: true, force: true });
    mkdirSync(legacyDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('should copy the registry and every vault file, including unregistered ones', async () => {
    seedLegacy();

    await migrateLegacyUserData();

    expect(readFileSync(join(userData, 'vaults.json'), 'utf-8')).toBe(REGISTRY);
    expect(existsSync(join(userData, 'vaults', 'registered.json'))).toBe(true);
    expect(existsSync(join(userData, 'vaults', 'orphan.json'))).toBe(true);
  });

  it('should keep the legacy directory untouched as a backup', async () => {
    seedLegacy();

    await migrateLegacyUserData();

    expect(existsSync(join(legacyDir, 'vaults.json'))).toBe(true);
    expect(existsSync(join(legacyDir, 'vaults', 'orphan.json'))).toBe(true);
  });

  it('should not overwrite data that already exists in the new location', async () => {
    seedLegacy();
    mkdirSync(userData, { recursive: true });
    writeFileSync(join(userData, 'vaults.json'), '{"version":"1.0.0","vaults":[]}');

    await migrateLegacyUserData();

    expect(readFileSync(join(userData, 'vaults.json'), 'utf-8')).toBe('{"version":"1.0.0","vaults":[]}');
  });

  it('should do nothing when there is no legacy directory', async () => {
    rmSync(legacyDir, { recursive: true, force: true });

    await migrateLegacyUserData();

    expect(existsSync(userData)).toBe(false);
  });
});
