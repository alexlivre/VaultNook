# Memory

## Project Overview
See @README.md for project overview and @package.json for available npm/pnpm commands for this project.

## Code Style Guidelines
- Use descriptive variable names
- Follow existing patterns in the codebase
- Extract complex conditions into meaningful boolean variables
- Source code, comments and commit messages in English; UI strings and chat in pt-BR
- Zod schemas live in `src/shared/schemas.ts` — the renderer re-exports them via `src/renderer/types/index.ts`; types are inferred from them, never declared twice
- IPC channel names live in `src/shared/ipc-channels.ts`; never inline a channel string. Handler-side validation schemas live in `src/main/handlers/schemas.ts`

## Architecture Notes

### Process split
Vite builds three bundles into `.vite/` (`vite.main.config.ts`, `vite.preload.config.ts`, `vite.renderer.config.ts`):
- `src/main.ts` — main process: frameless `BrowserWindow` (`sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`), IPC handlers, window controls and power events.
- `src/preload.ts` — the only bridge. Exposes `window.vaultNookApi` and `window.windowControls` through `contextBridge`; types derive from the objects (`typeof api`) and are consumed via `src/global.d.ts`. Event subscribers return a `void` unsubscribe function so effects can return it directly.
- `src/renderer/` — React 19 with a single Zustand store (`stores/vault-store.ts`).

All IPC passes through `src/main/handlers/ipc-handlers.ts` (34 handlers), and every payload is validated with Zod at that boundary.

### Crypto model (formatVersion 3)
- One random 256-bit **master key** per vault encrypts each item field (name, value, description) with AES-256-GCM, unique IV per field.
- The master key is stored twice, wrapped with AES-GCM: `masterKeyWrap` (from the master password) and `recoveryKeyWrap` (from the 12-word BIP39 phrase).
- PBKDF2-SHA256, 600 000 iterations, 32-byte key (`src/main/services/crypto.ts`).
- **Changing the password only re-wraps the master key** — no item is re-encrypted. The recovery phrase is regenerated at the same time.
- The key lives in a mutable `Buffer`, zeroed on lock; password comparison uses `timingSafeEqual`.
- v1/v2 vaults migrate to v3 on first unlock and return a new recovery phrase exactly once.

### Data model
- `VaultData.items: StoredItem[]` plus `VaultData.projects: StoredProject[]`; each item carries an optional `projectId` ('' = unassigned), plaintext `rotationDueAt` / `rotationIntervalDays` / `rotationLastAt` (0 = off) / `publicKeyHintDismissed`, and an encrypted `rotationUrl`. Project names and rotation links are encrypted with the master key; ids, colors and dates are plaintext.
- Editing runs `applyRotationOnEdit` (`vault/rotation.ts`) inside `EDIT_ITEM`: changing the **value** stamps `rotationLastAt` and — unless the due date was also edited in the same save — reschedules from `rotationIntervalDays` (or clears the alert). The public key never triggers detection.
- New fields are additive and keep `formatVersion: 3`: `normalizeVaultData` (`vault/state.ts`) fills `projects: []` / `projectId: ''` / rotation defaults in `loadVault`, `unlockVault` and `recoverVault`, so vaults written before a field existed still open without migration.
- `seedRotationAlerts` (`vault/state.ts`) marks every api/keypair item once when a vault from an older build is first loaded — `loadVault` saves the change; `recoverVault` and `migrateToV3` apply it too. The persisted `rotationSeeded` flag prevents any future version from repeating the mass alert; fresh vaults are created with `rotationSeeded: true`.
- File-level compatibility with older builds: they ignore unknown fields and preserve the `projects` array, but re-saving an item in an older build drops that item's `projectId` and rotation fields.

### Storage
- Vaults are registered in `vaults.json` and stored as `vaults/<id>.json` under `app.getPath('userData')` (`src/main/services/vault-registry.ts`; vault file logic lives in `src/main/services/vault/` — `state`, `storage`, `key`, `items`, `projects`, `backup`, `migration` — with `vault.ts` as the facade).
- Writes are atomic: `${file}.tmp` followed by rename (`fs-utils.ts`).
- Suggested backup file names embed the vault name and a `Date.now()` stamp (`vaultnook-backup-<name>-<timestamp>.json`; `vaultnook-export-…` from the vault manager), sanitized by `sanitizeFileName` (`fs-utils.ts`).
- `restrictPathAcl` narrows the vault directory and registry to the current user (`icacls` on Windows, `chmod 600` elsewhere). ACLs are **not** carried over by `cpSync` — reapply them after any copy.
- `src/main/services/legacy-user-data.ts` copies a pre-rename `%APPDATA%\DevVault` profile into `%APPDATA%\VaultNook` on first boot, leaving the old directory untouched as a backup. It runs before any read in `app.whenReady()`. **It can be deleted one release after the rename ships.**
- `docs/superpowers/` holds historical plans and specs — they reference the old DevVault naming on purpose. Do not rewrite them.

### Security invariants
- `appId: com.alexlivre.devvault` in `electron-builder.yml` is deliberately kept from the DevVault era: changing it makes Windows treat the build as a different app, so the NSIS installer would install alongside instead of upgrading in place.
- `scripts/apply-fuses.js` runs on `afterPack` to harden the packaged binary.
- The master password and the recovery phrase are never logged or persisted — only PBKDF2 hashes are stored.

## Common Workflows
- `npm start` — development with HMR (Vite + electronmon).
- `npm run test:run` — the suite once (7 suites / 97 tests in `src/__tests__/`). **Mandatory before any push or deploy; must finish with 0 failures.**
- `npm run lint` and `npx tsc --noEmit` — lint and typecheck. Run `tsc` explicitly: neither the lint nor the tests check types.
- `npm run build` — the three bundles; `npm run package` — portable directory; `npm run make` — NSIS installer. This project has no hosting, so **`npm run make` is the equivalent of a production deploy**.
- **"Compilar a aplicação" (user wording) means `npm run package` + `npm run make`** — generate both executables; `npm run build` alone does not count.
- If `npm install` pulls only production dependencies, the environment sets `NODE_ENV=production` with `omit=dev` — use `npm install --include=dev`.
