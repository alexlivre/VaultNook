# Design — Endurecimento de Segurança e Migração de Cofres (v2 → v3)

Data: 2026-08-02
Status: Aprovado

## Objetivo

Corrigir as lacunas de segurança identificadas no modelo de criptografia atual:
metadados dos itens em texto puro, recovery phrase não funcional (e de entropia fraca),
`unsafe-eval` no CSP, escrita não atômica sem ACL, `pbkdf2Sync` bloqueando o event loop
e importação sem validação. Tudo com **migração automática dos cofres já existentes**.

## Contexto atual (formatVersion 2)

- `StoredItem`: `{ id, name, value, description, category, favorite, createdAt, updatedAt }`.
  Apenas `value` é criptografado (AES-256-GCM com chave derivada da senha via PBKDF2).
  Nome/descrição/categoria/favorito/datas em claro.
- Chave = PBKDF2(senha, salt) — não existe chave-mestra; trocar senha re-criptografa tudo.
- Recovery phrase: wordlist própria ~110 palavras, 12 palavras → ~81 bits de entropia;
  `validateRecoveryPhrase` só confere 12 strings não vazias; a frase **não é exibida** na
  criação nem usada para recuperar (recoveryHash armazenado, porém inerte).
- Persistência: `writeFile` direto em `%APPDATA%`, sem ACL e sem escrita atômica.
- CSP: `script-src 'self' 'unsafe-eval'`.

## 1. Formato v3 — chave-mestra + metadados criptografados

### VaultData v3

```ts
interface VaultDataV3 {
  version: string;            // '0.2.0'
  formatVersion: 3;
  createdAt: number;
  salt: string;               // base64, 32 bytes
  passwordHash: string;       // PBKDF2(senha)
  recoveryHash: string;       // PBKDF2(phrase)
  masterKeyWrap: EncryptedData;    // AES-GCM(chaveMestra, passwordKey)
  recoveryKeyWrap: EncryptedData;  // AES-GCM(chaveMestra, recoveryKey)
  hint: string;
  items: StoredItemV3[];
  settings: { autoLockTimer: number };
}

interface StoredItemV3 {
  id: string;                       // claro — seleção/reveal
  name: EncryptedData;              // criptografado
  value: EncryptedData;             // criptografado
  description: EncryptedData | null; // criptografado (null se vazio)
  category: Category;               // claro — filtro/estatística/cor
  favorite: boolean;                // claro — filtro
  createdAt: number;                // claro
  updatedAt: number;                // claro
}
```

### Chaves

- `masterKey` (32B aleatório, gerado por cofre): criptografa todos os campos dos itens.
  Em memória como `Buffer` mutável (`VaultKey`), zeroizado ao travar.
- `passwordKey = PBKDF2(senha, salt)`; `recoveryKey = PBKDF2(phrase, salt)`.
- `masterKeyWrap = AES-GCM(masterKey, passwordKey)`; `recoveryKeyWrap = AES-GCM(masterKey, recoveryKey)`.
- Unlock: derivar `passwordKey` → desembrulhar `masterKey` → zeroizar `passwordKey`.
- Troca de senha: derivar nova `passwordKey` → re-embrulhar `masterKey` (sem re-criptografar itens).
- Recuperação: derivar `recoveryKey` da frase → desembrulhar `masterKey` → definir nova senha.

## 2. Migração v2 → v3

Executada no `unlockVault` (chave disponível), de forma transparente no primeiro desbloqueio:

1. `oldKey = PBKDF2(senha, salt)` (idêntica à v2).
2. Gerar `masterKey` (aleatório) e **nova recovery phrase BIP39**.
3. Para cada item: descriptografar `value` com `oldKey`; criptografar `value`, `name`,
   `description` com `masterKey`.
4. `passwordKey = oldKey` → `masterKeyWrap = AES-GCM(masterKey, passwordKey)`.
5. `recoveryKey = PBKDF2(novaPhrase, salt)` → `recoveryKeyWrap = AES-GCM(masterKey, recoveryKey)`.
6. Atualizar `recoveryHash`; `formatVersion = 3`; salvar (atômico + ACL).
7. Retornar a nova frase para a UI exibir **uma única vez** ("Seu cofre foi atualizado").
   A frase antiga deixa de valer (era inerte).

Cadeia completa no unlock: `formatVersion 1 → 2 → 3` (reusar `migrateToFullEncryption`
para v1→v2, generalizado).

## 3. BIP39 + recuperação completa

### crypto.ts
- `generateRecoveryPhrase()`: 16 bytes aleatórios → 128 bits de entropia → SHA-256 →
  primeiros 4 bits de checksum → 132 bits → grupos de 11 → 12 palavras da wordlist
  inglesa oficial (2048). Wordlist em `src/main/services/bip39-wordlist.ts`.
- `validateRecoveryPhrase(words)`: 12 palavras, todas na wordlist, checksum válido.

### Fluxo de recuperação
- `UnlockScreen`: link "Esqueceu a senha?" → `RecoveryScreen`.
- `RecoveryScreen`: entrada das 12 palavras + nova senha (confirmar) → IPC
  `vault:recover` `{ vaultId, phrase, newPassword }`.
- Handler: derivar `recoveryKey` da frase → tentar desembrulhar `recoveryKeyWrap`.
  Falha = frase inválida. Sucesso → derivar nova `passwordKey` → re-embrulhar
  `masterKey` → atualizar `passwordHash` → salvar → retornar itens (entra no cofre).
- Frase exibida na **criação** do cofre (hoje não é exibida): passo após criar.

## 4. CSP

- Produção: `script-src 'self'` (remover `unsafe-eval`); manter `connect-src 'none'`
  e `style-src 'self' 'unsafe-inline'`.
- Dev: estender o plugin `relax-csp-for-hmr` para também adicionar `'unsafe-eval'`
  no modo serve (necessário para vite/react HMR).
- Verificação no build: se algum bundle de produção exigir eval, investigar a lib
  causadora antes de reintroduzir.

## 5. Persistência (atômica + ACL)

- Gravação atômica: `writeFile(<arquivo>.tmp)` → `rename` para o destino (atômico em NTFS).
- Windows: `icacls <dir de cofres> /inheritance:r /grant:r "%USERNAME%:(OI)(CI)F" /Q`
  aplicado à pasta `vaults/` e ao `vaults.json` (criados com permissão padrão e depois
  restringidos; executado sem admin em diretórios do usuário).
- Não-Windows: `chmod 0o600` nos arquivos.

## 6. pbkdf2 async

- Substituir `pbkdf2Sync` por `pbkdf2` (promisified) em `deriveKey`/`hashPassword`.
- Call sites (createVault, unlockVault, changePassword, migração, recuperação) já são async.

## 7. Validação de import

- Zod para estrutura do JSON importado.
- Aceitar `formatVersion` 1/2/3.
  - v1/v2: normalizar (re-criptografar com a chave-mestra atual).
  - v3 do **mesmo cofre**: valores já descriptografáveis com a chave-mestra → manter.
  - v3 de **outro cofre**: rejeitar com erro claro (valores criptografados com outra
    chave-mestra). Importação de cofre inteiro (`importVaultFile`) continua suportada
    (arquivo autocontido).
- Dedup por `id` (não mais por `name`, que passou a ser criptografado).

## 8. UI

- `CreatePasswordScreen`: passo pós-criação exibindo a recovery phrase (com aviso).
- `RecoveryScreen` (nova): frase + nova senha.
- `UnlockScreen`: link para recuperação.
- Diálogo "cofre atualizado — nova recovery phrase" após migração v2→v3.
- `VaultSettingsSheet`: troca de senha continua funcionando (agora re-embrulha).

## 9. Testes (Vitest)

- BIP39: gerar → validar; checksum inválido rejeitado; 12 palavras; todas na wordlist.
- Key-wrap: criar → desbloquear com senha; recuperar com frase; frase errada rejeitada.
- Metadados: `name`/`description` são `EncryptedData` em disco (não string).
- Migração v2→v3: fixture v2 → unlock → `formatVersion 3`, nomes criptografados,
  itens descriptografam corretamente, frase nova retornada.
- Troca de senha: unlock com nova senha OK; antiga falha; recuperação continua OK.
- Recuperação: frase + nova senha → unlock com nova senha; itens intactos.
- Atualizar testes existentes (APIs `deriveKey`/`hashPassword` viram async; formato muda).

## Riscos / decisões

- Migração one-way (sem downgrade); ocorre no primeiro desbloqueio pós-update.
- Nova recovery phrase na migração (a antiga era inerte; hash não guarda o texto).
- Merge de backup v3 de outro cofre não suportado.
- `icacls` depende do Windows; em outros SO usa `chmod`.
