# Relatório de Revisão de Código — VaultNook

Análise estática completa do código-fonte, focada em redundâncias, otimização e
qualidade — sem adicionar recursos.

**Baseline verificado em 2026-09-25**

| Verificação | Resultado |
|---|---|
| `npx tsc --noEmit` | limpo |
| `npm run lint` | limpo |
| `npm run test:run` | 41 testes, 5 arquivos, 0 falhas (~14,6 s) |

O código está em bom estado geral: separação de processos correta, criptografia
sólida, testes reais e CSP fechada. Os itens abaixo são, em sua maioria,
dívidas técnicas e alguns bugs reais — dois deles com potencial de perda de dados.

---

## 1. Bugs reais (corrigir primeiro)

### 1.1 🔴 CRÍTICO — Criação de cofre pode sobrescrever outro cofre

`src/main/services/vault.ts` (`createVault`):

```ts
const id = activeVaultId || randomUUID();
activeVaultId = id;
vaultPath = getVaultPath(id);
```

`activeVaultId` é definido ao desbloquear um cofre (`loadVault`, `unlockVault`,
`recoverVault`) e **nunca é limpo por `lockVault()`**. Como `handleLock` no
renderer chama apenas `api.lock()` e volta para a tela de cofres, o fluxo:

1. desbloquear cofre A
2. travar (volta ao gerenciador)
3. criar novo cofre B

faz `createVault` reutilizar o **id de A**. Resultado: `saveVault()` sobrescreve o
arquivo de A com um cofre vazio, e `registry.addVault` insere uma **segunda
entrada com o mesmo id** no `vaults.json`. É perda de dados silenciosa e um
cenário comum.

**Correção sugerida:** remover `activeVaultId ||` de `createVault` (gerar sempre
`randomUUID()`), e/ou limpar `activeVaultId = null` em `lockVault()`. Vale
adicionar teste cobrindo "criar cofre após desbloquear outro".

Mesmo padrão afeta `DELETE_VAULT_ENTRY` (deixa `activeVaultId` apontando para o
cofre excluído).

### 1.2 🔴 Atalhos de teclado estão mortos

`src/renderer/lib/hooks.ts` — `useKeyboardShortcuts` apenas **retorna**
`handleKeyDown`; não há `addEventListener` dentro do hook. Em
`vault-screen.tsx:368` o retorno é ignorado:

```ts
useKeyboardShortcuts({ 'new-item': ..., search: ..., export: ..., lock: ..., ... });
```

O `useEffect` global de `vault-screen` (linha 391) trata apenas
`ArrowUp/Down/Enter/Space`. Portanto **Ctrl+N, Ctrl+F, Ctrl+E, Ctrl+L, Ctrl+A e
Ctrl+K não funcionam**, apesar de anunciados na barra de status e nos tooltips.

**Correção:** registrar/remover o listener dentro do próprio hook (com deps
corretas) ou consumir `handleKeyDown` num `useEffect` no `vault-screen`.

### 1.3 🟠 Auto-lock pode levar a tela em branco / comportamento inconsistente

`hooks.ts` (`useAutoLock`) faz `setScreen('unlock')`. Mas `App.tsx` só renderiza
`UnlockScreen` quando `unlockVaultId` (estado local do `App`) está definido.
Depois de **criar** um cofre, `unlockVaultId` é `null` → o auto-lock cai numa tela
vazia. O lock manual (`handleLock`) vai para `'vault-manager'`, então os dois
caminhos divergem.

Além disso, o timer só é agendado após o primeiro evento de atividade, e
`resetActivity()` grava `lastActivity`, que **nunca é lido** por ninguém.

**Correção:** unificar o destino do lock (gerenciador ou unlock com o id do cofre
ativo) e alinhar `handleActivity` a um único modelo.

### 1.4 🟡 `loadVault` não zera a chave anterior

```ts
export async function loadVault(vaultId: string): Promise<boolean> {
  ...
  vaultKey = null;   // descarta sem zeroizar
  return true;
}
```

Trocar de cofre sem travar antes deixa o material da chave antiga na memória até
o GC — justamente o que `zeroize()` existe para evitar. Chamar
`vaultKey?.zeroize()` antes de anular.

### 1.5 🟡 Desfazer exclusão gera novo id

`onUndo` de `handleDelete` (vault-screen) chama `api.addItem(item)`; o handler
`ADD_ITEM` ignora qualquer id recebido e cria `crypto.randomUUID()`. O item
restaurado volta com id diferente (quebra referências de favoritos/detalhe
aberto). Restaurar preservando o id original é o comportamento esperado.

### 1.6 🟡 `clipboard.clear()` limpa a área de transferência inteira

O timer de 30 s em `handleCopy` chama `clearClipboard`, que faz
`clipboard.clear()` — apagando o que o usuário copiou **depois**, de qualquer
outro app. Preferível comparar o conteúdo antes de limpar, ou marcar um timeout
por item.

### 1.7 🟡 `useAutoLock`: listeners re-registrados a cada atividade

`handleActivity` muda de identidade quando deps do store mudam, e o `useEffect`
de listeners depende dele → remove/adiciona 5 eventos a cada mudança. Estável,
mas desperdício; pode usar `useRef` para o handler.

---

## 2. Redundâncias

### 2.1 PBKDF2 calculado duas vezes por operação

`hashPassword` e `deriveKey` em `crypto.ts` são **exatamente a mesma operação**
(mesmo salt, iterações, comprimento, digest) — logo, produzem os mesmos bytes.
Mas o código chama os dois em sequência:

| Operação | Hoje | Poderia ser |
|---|---|---|
| `unlockVault` | `deriveKey(pw)` + `hashPassword(pw)` | 1 derivação |
| `createVault` | `hashPassword(pw)` + `deriveKey(pw)` + `hashPassword(phrase)` + `deriveKey(phrase)` | 2 derivações |
| `changePassword` | 4 derivações (senha e frase, cada uma 2×) | 2 derivações |
| `recoverVault` | 3 derivações | 2 derivações |

Com 600 000 iterações (~300 ms cada), isso **dobra o tempo de unlock/criação/
troca de senha** sem ganho de segurança (o valor derivado já é usado como chave
de embrulho *e* como verificador). Derive uma vez e reutilize o `Buffer` para as
duas finalidades.

### 2.2 Validação Zod duplicada (preload + main)

`preload.ts` valida payloads com schemas próprios (`CreatePasswordPayload`,
`UnlockPayload`, `DeleteVaultEntryPayload`, `ToggleFavoritePayload`,
`SaveSettingsPayload`) e `ipc-handlers.ts` valida **de novo** com schemas
inline equivalentes. As definições divergem entre si. A fronteira de confiança é
o processo main — a validação do main é a que importa.

**Sugestão:** centralizar schemas num único módulo compartilhado e validar só no
main (ou manter no preload apenas para erro antecipado, importando os mesmos
schemas em vez de redefini-los).

### 2.3 `main` importa de `renderer/types`

`ipc-handlers.ts` e `vault.ts` importam `../../renderer/types` (`Category`,
`CreateItemSchema`, `ChangePasswordSchema`, `Item`…). Funciona, mas cruza a
fronteira de processos e arrasta rótulos/cores de UI para dentro do bundle do
main. Um diretório `src/shared/` para schemas, tipos e canais resolveria.

### 2.4 Canais IPC inline (viola a convenção do próprio projeto)

`IPC_CHANNELS` existe em `src/ipc-channels.ts`, mas `main.ts` e `preload.ts`
hardcodam `'window:minimize'`, `'window:maximize'`, `'window:close'`,
`'window:maximize-changed'` e `'vault-locked-by-system'`. O AGENTS.md pede
explicitamente para nunca inline-ar channel strings.

### 2.5 Formatação de tempo duplicada

- `formatDate` (`lib/utils.ts`) — tempo relativo
- `relativeTime` (`item-detail-panel.tsx`) — tempo relativo, **outra** implementação
- `formatDate` local (`vault-manager-screen.tsx`) — data absoluta

Três helpers para a mesma preocupação, com saídas diferentes. Unificar em `utils`.

### 2.6 Outras duplicações

- `handleCopyJson` existe igual em `item-card.tsx` e `item-detail-panel.tsx`.
- Regex `/\{\{([^}]+)\}\}/` de parâmetros de comando repetida em 3 arquivos
  (`item-card`, `item-detail-panel`, `command-param-dialog`) — extrair helper.
- Mapa de ícones/cor de categoria recriado em 4 lugares (`item-card`,
  `item-detail-panel`, `add-edit-item-dialog`, `tabs` de `vault-screen`); o
  `CategoryIcon` de `types` (string) não é usado para isso.
- O bloco JSX de ícone por categoria em `add-edit-item-dialog` é repetido
  literalmente (trigger + itens) — extrair `<CategoryIcon category>`.
- Duas instâncias de `<AddEditItemDialog>` montadas ao mesmo tempo em
  `vault-screen` (uma para adicionar, outra para editar), cada uma com seu
  `<PasswordGeneratorDialog>` — dá para ter uma só alternando modo.
- `vite.main.config.ts` e `vite.preload.config.ts` são quase idênticos — extrair
  uma base comum.
- Re-export `export { IPC_CHANNELS }` no fim de `ipc-handlers.ts` é inútil.

---

## 3. Código morto (remover)

Confirmado por busca — definido e nunca referenciado:

| Símbolo | Arquivo |
|---|---|
| `useToast` (2ª implementação, não usada) | `renderer/lib/hooks.ts` |
| `generatePassword` | `renderer/lib/utils.ts` |
| `CategoryIcon`, `CategoryColor`, `ExportData` | `renderer/types/index.ts` |
| `getVaultExists`, `vaultExists` | `main/services/vault.ts` |
| `listVaults`, `getVaultsDir` | `main/services/vault-registry.ts` |
| `isFirstRun` / `setIsFirstRun` | `renderer/stores/vault-store.ts` |
| `lastActivity` / `resetActivity` (nunca lidos) | `renderer/stores/vault-store.ts` |

Observação: o fluxo de `INIT` sempre termina em `'vault-manager'`, então a tela
`'loading'` de `App.tsx` praticamente nunca aparece (só no primeiro paint antes
do efeito). Pode ser simplificada.

---

## 4. Otimizações de desempenho

1. **Criptografia (maior ganho de UX):** unificar derivação (item 2.1) —
   unlock ~2× mais rápido, criação ~2× mais rápida.
2. **Testes ~10× mais rápidos:** `ITERATIONS` é constante fixa de 600 000, então
   a suíte gasta ~14 s só em PBKDF2. Torná-la injetável/configurável para testes
   (ex.: `process.env.NODE_ENV === 'test'`) reduziria drasticamente o tempo de CI.
3. **ACL repetida:** `ensureRestricted()` roda `icacls` (spawn de processo) em
   **toda** `loadRegistry`/`addVault`. Em Windows isso custa dezenas de ms por
   chamada. Cachear com um flag de módulo ("já restrinja nesta execução").
4. **`LIST_VAULTS` lê e faz `JSON.parse` de cada arquivo de cofre** só para contar
   itens (`getVaultMetadata`), em paralelo. Com muitos cofres é N leituras de
   disco; considerar cache de metadados (invalidado em save) ou persistir o
   contador no registry.
5. **Contadores da sidebar:** para cada uma das 6 abas há um `items.filter(...)`
   completo (O(6n)). Uma única passada com `reduce` gera todos.
6. **`react-window`:** a altura é medida por listener de `window.resize`; um
   `ResizeObserver` no container é mais correto (acompanha mudanças de layout que
   não redimensionam a janela).
7. **`VaultCard`** recebe `formatDate` inline (nova identidade a cada render) e
   não é memoizado — `React.memo` + handler estável evita re-render da lista.

---

## 5. Arquitetura e manutenibilidade

- **`vault.ts` tem ~520 linhas** acumulando: orquestração de cripto, persistência,
  migração v1/v2→v3, export/import e CRUD. Dividir em `vault-store` (arquivo),
  `vault-crypto` (embrulho de chave) e `vault-migration` melhora testabilidade e
  reduz o risco das mudanças (ver bug 1.1 nasce dessa mistura de responsabilidades).
- **`ipc-handlers.ts` (~370 linhas)** com schemas inline. Extrair `schemas.ts` e
  manter os handlers finos.
- **Erros IPC não tipados:** todos os handlers fazem `throw new Error(...)` e o
  renderer exibe `err.message` — que vem prefixado por
  `"Error invoking remote method '<canal>': "` do Electron. Usar um envelope
  `{ ok, code, message }` (ou códigos de erro) dá mensagens limpas e tratáveis.
- **`tsconfig` sem `strict`:** só `noImplicitAny` está ligado. Ex.: `vaultPath`
  (`let vaultPath: string;`) fica `undefined` em runtime. Ligar `strict` de forma
  incremental pega essa classe de bug.
- **`allowJs: true`** no tsconfig é desnecessário (não há JS em `src/`).

---

## 6. Segurança (postura já boa — pontos a refinar)

Positivo: `sandbox: true` + `contextIsolation` + `nodeIntegration: false`, CSP
fechada (`connect-src 'none'`), fuses aplicados no `afterPack`, PBKDF2 600k,
AES-256-GCM, `timingSafeEqual`, zeroização da chave, ACL restritiva, validação
Zod na fronteira.

Pontos de atenção:

- **`passwordHash` é o próprio material da chave de embrulho** (mesma derivação).
  Não cria risco novo relevante (o atacante já tem o `masterKeyWrap`), mas
  chamar de "hash" e exportá-lo num backup convém documentar com clareza.
- **`loadVault` sem zeroizar** (bug 1.4) — quebra a promessa de higiene de memória.
- **`maskValue` revela os 4 primeiros e 4 últimos caracteres** — para chaves
  longas é ok, mas é exposição residual deliberada; vale ponderar.
- **`ImportedVaultSchema` usa `items: z.array(z.any())`** — na prática não valida
  nada do conteúdo importado. Validar a forma do item (ou ao menos `id`/`category`).
- **`OPEN_EXTERNAL`** já restringe http/https — bom.
- **IPC de controles de janela** (`ipcMain.on('window:*')`) não valida o sender;
  cenário de renderer comprometido poderia manipular a janela (risco baixo).
- **Frase de recuperação** é salva em `.txt` puro por design — ok, mas é o ponto
  mais sensível do fluxo; um aviso explícito ao salvar seria prudente.
- CSP pode endurecer com `object-src 'none'; base-uri 'self'`.

---

## 7. Testes — lacunas

Cobertura atual (41 testes) é boa para cripto/vault/migração/fs/utils. Faltam:

- **Parser de busca do `filteredItems`** (`cat:`, `tag:`, `is:fav`, ordenação) —
  lógica não trivial, sem nenhum teste.
- **Ações do store Zustand** (seleção, move, remove em lote).
- **Handlers de validação do IPC** (payloads inválidos).
- **Regressão do bug 1.1** (criar cofre após desbloquear outro) — recomendo teste
  antes da correção.
- Desfazer exclusão preservando id (após correção 1.5).

---

## 8. Priorização sugerida

**P0 — corrigir agora**
1. Bug 1.1 (sobrescrita de cofre / perda de dados).
2. Bug 1.2 (atalhos mortos).
3. Bug 1.3 (auto-lock inconsistente).

**P1 — ganhos rápidos de qualidade/perf**
4. Unificar derivação PBKDF2 (2.1) + `ITERATIONS` injetável nos testes.
5. `loadVault` zeroizar chave (1.4) e `clipboard` seletivo (1.6).
6. Remover código morto da seção 3.
7. Cachear ACL (4.3).

**P2 — dívida técnica**
8. `src/shared/`, canais IPC centralizados (2.3, 2.4).
9. Deduplicar helpers de UI/tempo (2.5, 2.6) e extrair schemas do main (2.2).
10. Quebrar `vault.ts` e ligar `strict`.

**P3 — polimento**
11. Contadores/índices num só passe, `ResizeObserver`, `React.memo`.
12. Endurecer CSP, validar schema de import, envelope de erro IPC.

---

*Relatório gerado a partir de leitura integral da pasta `src/`, configurações de
build e suíte de testes. Nenhum arquivo de código foi alterado nesta análise.*
