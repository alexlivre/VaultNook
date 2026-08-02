# Instalador NSIS (electron-builder) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar o pipeline de build/empacotamento do Electron Forge para o electron-builder e produzir um instalador NSIS para Windows 11.

**Architecture:** Substituir o plugin Vite do Forge por configs Vite explícitas que produzem a mesma saída (`.vite/build/main.js`, `.vite/build/preload.js`, `.vite/renderer/main_window/`). O `main.ts` passa a ler `process.env.VITE_DEV_SERVER_URL` em vez dos globals do Forge. O electron-builder empacota a saída do Vite em um instalador NSIS por usuário, com fuses de segurança aplicados via hook `afterPack`.

**Tech Stack:** Vite 7 (build explícito main/preload/renderer), electron-builder (NSIS), `@electron/fuses`, `concurrently`/`wait-on`/`cross-env`/`electronmon` (dev), Node 24.

## Global Constraints

- Windows 11 target; instalação **por usuário** (`perMachine: false`), sem elevação de admin.
- Sem assinatura de código (instalador unsigned → SmartScreen avisará; aceitável).
- CSP de produção permanece `connect-src 'none'`; apenas dev relaxa para `ws:` (HMR).
- Ícone em `build/icon.png` (PNG quadrado ≥256px, gerado via MiniMax).
- Manter as mesmas proteções de fuses atuais: RunAsNode off, EnableCookieEncryption, EnableNodeOptionsEnvironmentVariable off, EnableNodeCliInspectArguments off, EnableEmbeddedAsarIntegrityValidation, OnlyLoadAppFromAsar.
- `main` em `package.json` continua `.vite/build/main.js`.
- Vaults persistem em `app.getPath('userData')` — runtime, não afetado pela migração.
- Código/comentários/commits em inglês.

---
## File Structure

| File | Ação | Responsabilidade |
|------|------|------------------|
| `package.json` | Modify | Remover deps do Forge, adicionar electron-builder/dev-tools, scripts novos |
| `forge.config.ts` | Delete | Não usado mais |
| `forge.env.d.ts` | Delete | Não usado mais |
| `src/main.ts` | Modify | Trocar globals do Forge por `process.env.VITE_DEV_SERVER_URL` + literal; remover squirrel |
| `src/global.d.ts` | Modify | Remover declarações `MAIN_WINDOW_VITE_*` |
| `vite.main.config.ts` | Modify | Build lib CJS → `.vite/build/main.js` |
| `vite.preload.config.ts` | Modify | Build lib CJS → `.vite/build/preload.js` |
| `vite.renderer.config.ts` | Modify | Build → `.vite/renderer/main_window/`, dev server 5173, CSP relax dev-only |
| `.gitignore` | Modify | Adicionar `dist/` |
| `build/icon.png` | Create | Ícone do app (gerado via MiniMax) |
| `electron-builder.yml` | Create | Config do electron-builder (NSIS por usuário) |
| `scripts/apply-fuses.mjs` | Create | Hook afterPack que aplica fuses ao exe |
| `README.md` | Modify | Remover refs ao Forge, documentar novos comandos |

---

### Task 1: package.json — dependências e scripts

**Files:**
- Modify: `package.json`

**Interfaces:**
- Consumes: nada.
- Produces: scripts `start`, `build`, `package`, `make`, `test`, `test:run`, `lint`; deps `electron-builder`, `vite`, `concurrently`, `wait-on`, `cross-env`, `electronmon`.

- [ ] **Step 1: Editar `package.json`**

Substitua o bloco `scripts` por:

```json
  "scripts": {
    "start": "concurrently -k \"npm:dev:renderer\" \"npm:dev:main\" \"npm:dev:preload\" \"npm:dev:electron\"",
    "dev:renderer": "vite --config vite.renderer.config.ts",
    "dev:main": "vite build -w --config vite.main.config.ts",
    "dev:preload": "vite build -w --config vite.preload.config.ts",
    "dev:electron": "wait-on http://localhost:5173 .vite/build/main.js .vite/build/preload.js && cross-env VITE_DEV_SERVER_URL=http://localhost:5173 electronmon .",
    "build": "vite build --config vite.main.config.ts && vite build --config vite.preload.config.ts && vite build --config vite.renderer.config.ts",
    "package": "npm run build && electron-builder --dir",
    "make": "npm run build && electron-builder --win nsis",
    "lint": "eslint --ext .ts,.tsx .",
    "test": "vitest",
    "test:run": "vitest run"
  },
```

No bloco `devDependencies`, **remova**:
- `@electron-forge/cli`
- `@electron-forge/maker-deb`
- `@electron-forge/maker-rpm`
- `@electron-forge/maker-squirrel`
- `@electron-forge/maker-zip`
- `@electron-forge/plugin-fuses`
- `@electron-forge/plugin-vite`
- `@types/electron-squirrel-startup`
- `electron-squirrel-startup`

No bloco `devDependencies`, **adicione**:
- `concurrently`
- `cross-env`
- `electron-builder`
- `electronmon`
- `vite`
- `wait-on`

Mantenha `electron`, `@electron/fuses`, `@tailwindcss/vite`, `@types/node`, `@types/react`, `@types/react-dom`, `autoprefixer`, `jsdom`, `postcss`, `tailwindcss`, `vitest`. O campo `main` continua `".vite/build/main.js"`.

- [ ] **Step 2: Deletar arquivos do Forge**

Delete `forge.config.ts` e `forge.env.d.ts`.

- [ ] **Step 3: Instalar dependências**

Run: `npm install`
Expected: conclui sem erro; `npm ls vite electron-builder concurrently wait-on cross-env electronmon` mostra os pacotes; nenhum pacote `@electron-forge/*` presente.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git rm forge.config.ts forge.env.d.ts
git commit -m "chore: replace electron-forge with electron-builder + vite build"
```

---

### Task 2: main.ts e global.d.ts — remover globals do Forge

**Files:**
- Modify: `src/main.ts`
- Modify: `src/global.d.ts`

**Interfaces:**
- Consumes: nada (Task 1 já removeu as deps do Forge).
- Produces: `main.ts` lê `process.env.VITE_DEV_SERVER_URL`; preload/renderer inalterados.

- [ ] **Step 1: Editar `src/main.ts`**

Remova o import e o bloco do squirrel:

```ts
import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { registerIpcHandlers } from './main/handlers/ipc-handlers';
```

(O import `import started from 'electron-squirrel-startup';` e o bloco `if (started) { app.quit(); }` devem ser removidos.)

Substitua o bloco de carregamento:

```ts
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/main_window/index.html'));
  }
```

- [ ] **Step 2: Editar `src/global.d.ts`**

Remova as duas declarações `MAIN_WINDOW_VITE_*`, mantendo:

```ts
import type { DevVaultApi, WindowControls } from './preload';

declare global {
  interface Window {
    devVaultApi: DevVaultApi;
    windowControls: WindowControls;
  }
}

declare module '*.css';
```

- [ ] **Step 3: Verificar lint**

Run: `npm run lint`
Expected: sem erros.

- [ ] **Step 4: Verificar testes**

Run: `npm run test:run`
Expected: 19 testes passam.

- [ ] **Step 5: Commit**

```bash
git add src/main.ts src/global.d.ts
git commit -m "refactor: replace forge globals with runtime env var"
```

---

### Task 3: Configs Vite (main, preload, renderer)

**Files:**
- Modify: `vite.main.config.ts`
- Modify: `vite.preload.config.ts`
- Modify: `vite.renderer.config.ts`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: entradas `src/main.ts`, `src/preload.ts`, `index.html`+`src/renderer.tsx`.
- Produces: `.vite/build/main.js`, `.vite/build/preload.js`, `.vite/renderer/main_window/index.html` (consumidos pelo electron-builder na Task 5).

- [ ] **Step 1: Reescrever `vite.main.config.ts`**

```ts
import { defineConfig } from 'vite';
import { builtinModules } from 'node:module';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('.', import.meta.url));

const external = ['electron', ...builtinModules, ...builtinModules.map((m) => `node:${m}`)];

export default defineConfig({
  build: {
    outDir: '.vite/build',
    emptyOutDir: false,
    lib: {
      entry: `${dir}src/main.ts`,
      formats: ['cjs'],
      fileName: () => 'main.js',
    },
    rollupOptions: { external },
  },
});
```

- [ ] **Step 2: Reescrever `vite.preload.config.ts`**

```ts
import { defineConfig } from 'vite';
import { builtinModules } from 'node:module';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('.', import.meta.url));

const external = ['electron', ...builtinModules, ...builtinModules.map((m) => `node:${m}`)];

export default defineConfig({
  build: {
    outDir: '.vite/build',
    emptyOutDir: false,
    lib: {
      entry: `${dir}src/preload.ts`,
      formats: ['cjs'],
      fileName: () => 'preload.js',
    },
    rollupOptions: { external },
  },
});
```

- [ ] **Step 3: Reescrever `vite.renderer.config.ts`**

```ts
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [
    tailwindcss(),
    {
      name: 'relax-csp-for-hmr',
      apply: 'serve',
      transformIndexHtml: (html) =>
        html.replace("connect-src 'none'", "connect-src 'self' ws:"),
    },
  ],
  resolve: {
    conditions: ['development', 'browser'],
    alias: { '@': `${dir}src` },
  },
  esbuild: {
    loader: 'tsx',
    include: /\.tsx?$/,
  },
  base: './',
  build: {
    outDir: '.vite/renderer/main_window',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
```

- [ ] **Step 4: Adicionar `dist/` ao `.gitignore`**

Adicione ao final de `.gitignore`:

```
# electron-builder output
dist/
```

- [ ] **Step 5: Verificar build de produção**

Run: `npm run build`
Expected: cria `.vite/build/main.js`, `.vite/build/preload.js` e `.vite/renderer/main_window/index.html`. Confirme com `Test-Path`.

- [ ] **Step 6: Commit**

```bash
git add vite.main.config.ts vite.preload.config.ts vite.renderer.config.ts .gitignore
git commit -m "build: explicit vite configs for main/preload/renderer"
```

---

### Task 4: Ícone da aplicação

**Files:**
- Create: `build/icon.png`

**Interfaces:**
- Consumes: nada.
- Produces: `build/icon.png` (1024×1024) — referenciado em `electron-builder.yml`.

- [ ] **Step 1: Criar pasta `build/`**

```bash
New-Item -ItemType Directory -Path build -Force
```

- [ ] **Step 2: Gerar o ícone**

Use a ferramenta `minimax_image_generate` com:
- `prompt`: "Flat minimal app icon, square 1:1, a stylized digital vault / padlock made of dark glass panels on a near-black background (#0a0a0f), subtle purple-blue glow accent, no text, no letters, crisp vector-style edges, modern dark UI theme icon"
- `aspect_ratio`: `1:1`
- `n`: 1
- `response_format`: `base64`
- `output_dir`: `C:\code\DevVault-Electron\build`
- `seed`: fixar um valor (ex.: `42`) para reprodutibilidade.

- [ ] **Step 3: Conferir dimensões**

Run: `Add-Type -AssemblyName System.Drawing; $img=[System.Drawing.Image]::FromFile("C:\code\DevVault-Electron\build\icon.png"); $img.Width; $img.Height`
Expected: `1024` e `1024` (ou ao menos ≥256×256, quadrado).

- [ ] **Step 4: Commit**

```bash
git add build/icon.png
git commit -m "feat: add app icon"
```

---

### Task 5: electron-builder config + fuses

**Files:**
- Create: `electron-builder.yml`
- Create: `scripts/apply-fuses.mjs`

**Interfaces:**
- Consumes: `.vite/**` (Task 3), `build/icon.png` (Task 4).
- Produces: `dist/win-unpacked/DevVault.exe` (via `npm run package`) e `dist/DevVault-0.1.0-setup.exe` (via `npm run make`, Task 7).

- [ ] **Step 1: Criar `electron-builder.yml`**

```yaml
appId: com.alexlivre.devvault
productName: DevVault
directories:
  buildResources: build
  output: dist
files:
  - .vite/build/**
  - .vite/renderer/**
  - package.json
asar: true
npmRebuild: false
afterPack: scripts/apply-fuses.mjs
win:
  target:
    - nsis
  icon: build/icon.png
nsis:
  oneClick: false
  perMachine: false
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true
  shortcutName: DevVault
  installerLanguages:
    - en_US
    - pt_BR
```

- [ ] **Step 2: Criar `scripts/apply-fuses.mjs`**

```js
const { flipFuses, FuseVersion, FuseV1Options } = require('@electron/fuses');
const path = require('node:path');

module.exports = async (context) => {
  if (context.electronPlatformName !== 'win32') return;
  const { appOutDir, packager } = context;
  const exePath = path.join(appOutDir, `${packager.appInfo.productFilename}.exe`);
  await flipFuses(exePath, {
    version: FuseVersion.V1,
    [FuseV1Options.RunAsNode]: false,
    [FuseV1Options.EnableCookieEncryption]: true,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
  });
};
```

- [ ] **Step 3: Gerar pacote portátil (valida a config)**

Run: `npm run package`
Expected: sucesso; `dist/win-unpacked/DevVault.exe` existe. (Primeira execução baixa o Electron 42 + ferramentas — requer rede.)

- [ ] **Step 4: Commit**

```bash
git add electron-builder.yml scripts/apply-fuses.mjs
git commit -m "build: electron-builder nsis config with security fuses"
```

---

### Task 6: README

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: scripts finais (Task 1).
- Produces: documentação atualizada.

- [ ] **Step 1: Atualizar `README.md`**

No bloco "Scripts disponíveis", substituir por:

| Comando | Descrição |
|---------|-----------|
| `npm start` | Inicia o app em modo desenvolvimento (HMR) |
| `npm test` | Roda testes em watch mode |
| `npm run test:run` | Roda testes uma vez |
| `npm run build` | Compila main/preload/renderer para `.vite/` |
| `npm run package` | Gera build portátil (sem instalação) → `dist/win-unpacked/` |
| `npm run make` | Gera instalador NSIS para Windows → `dist/` |
| `npm run lint` | Verifica qualidade do código |

No bloco "Executável", substituir por:

```bash
# Gera uma pasta portátil com o app (sem instalação)
# Saída: dist/win-unpacked/
npm run package

# Gera um instalador para Windows (NSIS)
# Saída: dist/DevVault-0.1.0-setup.exe
npm run make
```

Remover referências ao Electron Forge / Squirrel no restante do documento.

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: update build and packaging instructions"
```

---

### Task 7: Gerar o instalador final

**Files:**
- Produce: `dist/DevVault-0.1.0-setup.exe`

**Interfaces:**
- Consumes: config completa (Tasks 1–6).

- [ ] **Step 1: Gerar o instalador**

Run: `npm run make`
Expected: sucesso; `dist/DevVault-0.1.0-setup.exe` existe. Confirme com `Test-Path`.

- [ ] **Step 2: Smoke test do executável portátil**

Run: `Start-Process "dist\win-unpacked\DevVault.exe"; Start-Sleep -Seconds 5; Get-Process DevVault -ErrorAction SilentlyContinue`
Expected: processo `DevVault` em execução (app abriu sem crash). Em seguida: `Stop-Process -Name DevVault -Force`.

- [ ] **Step 3: Commit**

```bash
git add dist/.gitkeep
git commit -m "chore: mark dist output directory"
```

> Nota: `dist/` está no `.gitignore` (Task 3); o commit do Step 3 apenas registra a pasta com `.gitkeep`. Se preferir não versionar, pule o Step 3.

---

## Self-Review

- **Spec coverage:** Pipeline Vite (T3), dev mode (T1 scripts), electron-builder.yml+nsis por usuário (T5), limpeza deps Forge (T1), ícone (T4), fuses (T5), verificação/make (T7), README (T6). Coberto.
- **Placeholder scan:** nenhum "TBD/TODO"; todo passo tem conteúdo concreto.
- **Type consistency:** `main` continua `.vite/build/main.js`; `main.ts` usa `process.env.VITE_DEV_SERVER_URL` e literal `main_window`; nomes de arquivos de saída consistentes entre configs Vite e electron-builder.
