# Design — Migração para electron-builder (instalador NSIS Win11)

Data: 2026-08-02
Status: Aprovado

## Objetivo

Substituir o pipeline de build/empacotamento do Electron Forge pelo electron-builder,
produzindo um instalador NSIS moderno para Windows 11 (instalação por usuário, sem admin),
com ícone customizado e mantendo as proteções de fuses atuais. O fluxo de dev (`npm start`)
deve continuar funcionando com HMR.

## Contexto atual

- `package.json`: `main: ".vite/build/main.js"`; scripts usam `electron-forge`.
- `forge.config.ts`: VitePlugin (entries main/preload + renderer `main_window`), FusesPlugin, makers (squirrel/zip/rpm/deb).
- `main.ts` usa globals `MAIN_WINDOW_VITE_DEV_SERVER_URL` e `MAIN_WINDOW_VITE_NAME` (injetados pelo plugin).
- Renderer: `index.html` na raiz, entry `src/renderer.tsx`. CSP estrito: `connect-src 'none'`.
- Vaults persistidos em `app.getPath('userData')` (runtime — não afetado pela migração).
- Sem ícone no projeto.

## 1. Pipeline de build (Vite)

Reproduzir a mesma saída do plugin do Forge usando configs Vite explícitas:

- `vite.main.config.ts`: build lib CJS → `.vite/build/main.js`.
- `vite.preload.config.ts`: build lib CJS → `.vite/build/preload.js`.
- `vite.renderer.config.ts`: build → `.vite/renderer/main_window/` com `base: './'` (assets relativos para `file://`); dev server porta 5173 com `strictPort`.

### Mudanças em código-fonte

- `src/main.ts`:
  - `MAIN_WINDOW_VITE_DEV_SERVER_URL` → `process.env.VITE_DEV_SERVER_URL` (lido em runtime; `undefined` em prod).
  - `MAIN_WINDOW_VITE_NAME` → literal `'main_window'`.
  - Remover `import started from 'electron-squirrel-startup'` e o bloco `if (started) app.quit()`.
- `forge.env.d.ts`: deletar.
- `src/global.d.ts`: remover as declarações `MAIN_WINDOW_VITE_*`.

### CSP

- Produção permanece `connect-src 'none'`.
- Dev: plugin Vite inline em `vite.renderer.config.ts` (`apply: 'serve'`, `transformIndexHtml`) que troca `connect-src 'none'` por `connect-src 'self' ws:` para o HMR funcionar.

## 2. Dev mode (`npm start`)

Novas devDependencies: `concurrently`, `wait-on`, `cross-env`, `electronmon`.

Scripts:
- `start`: `concurrently -k "npm:dev:renderer" "npm:dev:main" "npm:dev:preload" "npm:dev:electron"`
- `dev:renderer`: `vite --config vite.renderer.config.ts`
- `dev:main`: `vite build -w --config vite.main.config.ts`
- `dev:preload`: `vite build -w --config vite.preload.config.ts`
- `dev:electron`: `wait-on http://localhost:5173 .vite/build/main.js .vite/build/preload.js && cross-env VITE_DEV_SERVER_URL=http://localhost:5173 electronmon .`

`electronmon` reinicia o Electron quando main/preload são reconstruídos.

## 3. electron-builder (`electron-builder.yml`)

- `appId: com.alexlivre.devvault`
- `productName: DevVault`
- `directories`: `buildResources: build`, `output: dist`
- `files`: `.vite/build/**`, `.vite/renderer/**`, `package.json` (deps de produção inclusas automaticamente)
- `asar: true`
- `win`: target `nsis`, icon `build/icon.png`
- `nsis`:
  - `oneClick: false`
  - `perMachine: false` (por usuário, sem elevação)
  - `allowToChangeInstallationDirectory: true`
  - `createDesktopShortcut: true`
  - `shortcutName: DevVault`
  - `installerLanguages: [en_US, pt_BR]`
- `npmRebuild: false` (sem módulos nativos)
- Fuses de segurança preservados via script `afterPack` usando `@electron/fuses` (RunAsNode off, EnableCookieEncryption, EnableNodeOptionsEnvironmentVariable off, EnableNodeCliInspectArguments off, EnableEmbeddedAsarIntegrityValidation, OnlyLoadAppFromAsar).

## 4. Limpeza de dependências e scripts

- Remover: todos `@electron-forge/*`, `electron-squirrel-startup`, `@types/electron-squirrel-startup`.
- Adicionar: `electron-builder`, `concurrently`, `wait-on`, `cross-env`, `electronmon`.
- Manter: `electron`, `@electron/fuses`.
- Deletar: `forge.config.ts`, `forge.env.d.ts`.
- Scripts finais:
  - `start` (dev, HMR)
  - `build`: `vite build` (main + preload + renderer, prod)
  - `package`: `npm run build && electron-builder --dir` (portátil)
  - `make`: `npm run build && electron-builder --win nsis` (instalador)
  - `test`, `test:run`, `lint` inalterados.

## 5. Ícone

- Gerar PNG quadrado 1024×1024 (tema cofre/segurança, dark) via MiniMax → `build/icon.png`.
- electron-builder converte para `.ico` automaticamente (exe + instalador).

## 6. Verificação

1. `npm install`
2. `npm run lint`
3. `npm run test:run`
4. `npm run build`
5. `npm run make` → instalador em `dist/DevVault-0.1.0-setup.exe`
6. Abrir `dist/win-unpacked/DevVault.exe` e confirmar que inicia.

## 7. Documentação

- Atualizar `README.md`: remover referências ao Electron Forge; documentar novos comandos (`npm run build`, `npm run make` com saída em `dist/`, `npm start` com HMR).

## Avisos / riscos

- Sem certificado de assinatura → Windows SmartScreen avisa no primeiro run (aceitável para uso pessoal).
- Primeira execução do electron-builder baixa Electron 42 + ferramentas NSIS (requer rede).
- Node 24 instalado: compatível com electron-builder atual.
