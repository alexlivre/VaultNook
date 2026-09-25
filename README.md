<div align="center">
  <img src="https://img.shields.io/badge/status-alpha-yellow?style=flat-square" alt="Status: Alpha"/>
  <img src="https://img.shields.io/badge/version-0.1.0--alpha-blue?style=flat-square" alt="Version"/>
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License"/>
  <img src="https://img.shields.io/badge/electron-42+-purple?style=flat-square" alt="Electron"/>
  <img src="https://img.shields.io/badge/React-19-61dafb?style=flat-square" alt="React"/>

  <br/>

  # 🔒 VaultNook

  **Cofre digital pessoal para API keys, prompts, comandos e links.**

  *Armazene. Organize. Copie. Nunca mais esqueça onde está aquela chave.*

</div>

---

## ✨ Funcionalidades

### Autenticação e Segurança

| Funcionalidade | Descrição |
|---------------|-----------|
| **Senha mestra** | Protege todo o cofre com criptografia |
| **Indicador de força** | Feedback visual em tempo real durante a criação |
| **Bloqueio automático** | Trava após período de inatividade configurável |
| **Bloqueio manual** | Trave instantaneamente com um clique ou atalho |
| **Criptografia AES-256-GCM** | Todas as categorias criptografadas individualmente |
| **Comparação segura** | Verificação de senha com `timingSafeEqual` (ataques de tempo) |
| **Zeroização de chave** | Chave criptográfica sobrescrita na memória ao travar |
| **Troca de senha segura** | Re-criptografa todos os valores com a nova chave |
| **Sandbox habilitado** | BrowserWindow com `sandbox: true` para isolamento |
| **Aleatoriedade criptográfica** | Geração de phrase de recuperação com `crypto.randomInt()` |

### Gerenciamento de Itens

| Funcionalidade | Descrição |
|---------------|-----------|
| **CRUD completo** | Criar, editar e excluir itens |
| **5 categorias** | APIs, Prompts, Commands, Links + visão "Todos" |
| **Cópia com um clique** | Duplo clique ou botão de cópia |
| **Favoritos** | Marque itens importantes e filtre por estes |
| **Busca global** | Pesquise em todas as categorias de uma vez |
| **Busca por sintaxe** | `cat:api stripe` para filtrar por categoria |
| **Gerador de senhas** | Crie senhas fortes diretamente no app |
| **Multi-select** | Selecione vários itens para ações em lote |
| **Valores mascarados** | APIs aparecem ocultas por padrão — revele quando precisar |
| **Menu de contexto** | Clique direito para ações rápidas |
| **Desfazer exclusão** | Restaure item excluído em até 5 segundos |

### Gestão do Cofre

| Funcionalidade | Descrição |
|---------------|-----------|
| **Múltiplos cofres** | Crie, gerencie e alterne entre vários cofres |
| **Tela de seleção** | Interface inicial com cards para escolher o cofre |
| **Ocultar cofre** | Esconda cofres da lista com um clique |
| **Importar cofre** | Importe um vault de arquivo JSON como novo cofre |
| **Exportar cofre** | Exporte qualquer cofre sem precisar desbloquear |
| **Excluir cofre** | Remove permanentemente o cofre (requer senha) |
| **Dica de senha** | Cadastre e visualize dicas na tela de desbloqueio |
| **Exportar backup** | Salva cofre completo em JSON (metadados + itens criptografados) |
| **Importar backup** | Restaura a partir de JSON, mesclando com existentes |
| **Informações do cofre** | Estatísticas: total de itens, por categoria, versão |
| **Exclusão segura** | Remove permanentemente todos os dados (requer senha) |

### Interface

| Funcionalidade | Descrição |
|---------------|-----------|
| **Tema escuro profissional** | Design system completo com cores, elevação e espaçamento |
| **Abas coloridas** | Cada categoria com sua cor de identificação |
| **Paleta de comandos** | Ctrl+K para ações rápidas e busca de itens |
| **Notificações toast** | Feedback visual com opção de "Desfazer" |
| **Estados vazios** | Mensagens contextuais para cada situação |
| **Animações suaves** | Micro-interações a 60fps |
| **Lista virtualizada** | Performance otimizada para cofres com 50+ itens |
| **Botões de janela** | Minimizar, maximizar e fechar customizados |
| **Janela arrastável** | Titlebar customizada, arraste em qualquer lugar |

### Atalhos de Teclado

| Atalho | Ação |
|--------|------|
| `Ctrl+N` | Novo item |
| `Ctrl+F` | Buscar |
| `Ctrl+K` | Paleta de comandos |
| `Ctrl+E` | Exportar |
| `Ctrl+L` | Travar |
| `Ctrl+A` | Selecionar todos |
| `Esc` | Fechar diálogos |

---

## 🚀 Começando

### Pré-requisitos

- Node.js 18+ (recomendado 20+)
- npm 9+

### Instalação

```bash
# Clone o repositório
git clone https://github.com/alexlivre/VaultNook.git
cd VaultNook

# Instale as dependências
npm install

# Inicie em modo desenvolvimento
npm start
```

### Scripts disponíveis

| Comando | Descrição |
|---------|-----------|
| `npm start` | Inicia o app em modo desenvolvimento (HMR) |
| `npm test` | Roda testes em watch mode |
| `npm run test:run` | Roda testes uma vez |
| `npm run build` | Compila main/preload/renderer para `.vite/` |
| `npm run package` | Gera build portátil (sem instalação) → `dist/win-unpacked/` |
| `npm run make` | Gera instalador NSIS para Windows → `dist/` |
| `npm run lint` | Verifica qualidade do código |

### Executável

```bash
# Gera uma pasta portátil com o app (sem instalação)
# Saída: dist/win-unpacked/
npm run package

# Gera um instalador para Windows (NSIS)
# Saída: dist/VaultNook-0.1.0-setup.exe
npm run make
```

Depois de rodar `npm run make` no Windows, o instalador estará em `dist/`. Execute o `.exe` do instalador para instalar o app (por usuário, sem admin). O app também pode ser executado diretamente em `dist/win-unpacked/VaultNook.exe`.

---

## 🧱 Stack Tecnológica

| Camada | Tecnologia |
|--------|-----------|
| **Desktop** | Electron 42+ |
| **UI** | React 19 + TypeScript |
| **Estilização** | Tailwind CSS v4 |
| **Componentes** | shadcn/ui (Radix primitives) |
| **Estado** | Zustand 5 |
| **Validação IPC** | Zod 4 |
| **Criptografia** | Node.js crypto (PBKDF2 + AES-256-GCM) |
| **Build** | Vite + electron-builder |
| **Testes** | Vitest |
| **Virtualização** | react-window |
| **Ícones** | Lucide |

---

## 📁 Estrutura do Projeto

```
src/
├── main.ts                          # Processo principal Electron
├── preload.ts                       # Ponte segura IPC com Zod
├── renderer.tsx                     # Entry point React
├── ipc-channels.ts                  # Canais IPC compartilhados
├── main/
│   ├── handlers/ipc-handlers.ts     # 22 handlers IPC validados
│   └── services/
│       ├── crypto.ts                # PBKDF2, AES-256-GCM, zeroização
│       ├── vault.ts                 # CRUD, backup, troca de senha, criptografia total
│       └── vault-registry.ts        # Registro de múltiplos cofres
├── renderer/
│   ├── App.tsx                      # Roteamento de telas
│   ├── types/index.ts               # Schemas Zod + tipos
│   ├── stores/vault-store.ts        # Estado global (Zustand)
│   ├── lib/
│   │   ├── utils.ts                 # Helpers (máscara, senha, data)
│   │   └── hooks.ts                 # Auto-lock, atalhos de teclado
│   ├── components/
│   │   ├── ui/                      # 10+ componentes base
│   │   ├── add-edit-item-dialog.tsx  # CRUD com gerador de senha
│   │   ├── command-palette.tsx      # Paleta de comandos funcional
│   │   ├── error-boundary.tsx       # Error Boundary React
│   │   ├── item-card.tsx            # Card de item extraído
│   │   ├── vault-settings-sheet.tsx # Painel de configurações
│   │   ├── vault-toolbar.tsx        # Toolbar de busca extraída
│   │   ├── toast-provider.tsx       # Sistema de notificações
│   │   └── window-controls.tsx      # Botões de janela customizados
│   └── pages/
│       ├── vault-manager-screen.tsx     # Seleção de cofres
│       ├── create-password-screen.tsx   # Criação de senha + dica
│       ├── unlock-screen.tsx            # Desbloqueio com dica
│       └── vault-screen.tsx             # Tela principal
└── __tests__/
    ├── crypto.test.ts               # Testes de criptografia (11)
    └── vault.test.ts                # Testes de vault CRUD (8)
```

---

## 🛡️ Segurança

### Como seus dados são protegidos (v3)

```
Senha mestra / Frase BIP39
        │
        ▼
   PBKDF2 (600.000 iterações, SHA-256)
        │
        └──► chave de embrulho ──► AES-GCM ──► Chave-mestra (256 bits, em memória)
                                                     │
                                                     ▼
                        AES-256-GCM por campo (nome, valor, descrição)
```

- **Chave-mestra de 256 bits** gerada aleatoriamente por cofre; criptografa nome, valor e
  descrição de cada item com AES-256-GCM (IV único por campo).
- A chave-mestra é protegida por duas "cápsulas" (`masterKeyWrap` e `recoveryKeyWrap`):
  uma derivada da **senha mestra** e outra da **frase de recuperação BIP39** (12 palavras).
- **Trocar a senha** apenas re-embrulha a chave-mestra — nada é re-criptografado.
- **Recuperação**: se a senha for esquecida, a frase BIP39 desembrulha a chave-mestra e
  permite definir uma nova senha.
- Chave em `Buffer` mutável, zeroizada ao travar; comparação de senha via `timingSafeEqual`.
- **Migração automática**: cofres antigos (v1/v2) são convertidos para v3 no primeiro
  desbloqueio, gerando uma nova frase de recuperação exibida uma única vez.
- Arquivos gravados atomicamente (`.tmp` + rename) e com ACL restrita ao usuário atual.
- Senha e recovery phrase nunca são armazenadas em claro — apenas hashes PBKDF2.

---

## 🗺️ Roadmap

### v0.1.0 ✅ (atual)
- ✅ Autenticação com senha mestra
- ✅ CRUD de itens com 4 categorias
- ✅ Criptografia AES-256-GCM (todas categorias, formatVersion 3 com chave-mestra)
- ✅ Comparação segura com timingSafeEqual
- ✅ Busca global com sintaxe `cat:`
- ✅ Favoritos e multi-select
- ✅ Export/Import JSON (backup completo)
- ✅ Auto-lock configurável
- ✅ Paleta de comandos funcional com busca
- ✅ Desfazer exclusão (5 segundos)
- ✅ Tema escuro profissional
- ✅ Lista virtualizada para 50+ itens
- ✅ Múltiplos cofres
- ✅ Tela de seleção de cofre
- ✅ Dica de senha
- ✅ Botões de janela customizados
- ✅ Error Boundary React
- ✅ Testes automatizados (Vitest, 21 testes)

### v0.2.0 🔜
- Tags e labels personalizáveis
- Categorias customizáveis
- Arrastar e soltar itens
- Migração automática de cofres antigos

### v0.3.0
- Sincronização via Dropbox/OneDrive

### v1.0.0
- Documentação completa

---

## 📄 Licença

Distribuído sob licença MIT. Veja `LICENSE` para mais informações.

---

<div align="center">
  <sub>Feito com 💜 por <a href="https://github.com/alexlivre">alexlivre</a></sub>
</div>
