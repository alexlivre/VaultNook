<div align="center">
  <img src="https://img.shields.io/badge/status-alpha-yellow?style=flat-square" alt="Status: Alpha"/>
  <img src="https://img.shields.io/badge/version-0.1.0--alpha-blue?style=flat-square" alt="Version"/>
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License"/>
  <img src="https://img.shields.io/badge/electron-42+-purple?style=flat-square" alt="Electron"/>
  <img src="https://img.shields.io/badge/React-19-61dafb?style=flat-square" alt="React"/>

  <br/>

  # 🔒 DevVault

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
| **Criptografia AES-256-GCM** | Valores de API criptografados individualmente |
| **Zeroização de chave** | Chave criptográfica sobrescrita na memória ao travar |
| **Troca de senha segura** | Re-criptografa todos os valores com a nova chave |

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

### Gestão do Cofre

| Funcionalidade | Descrição |
|---------------|-----------|
| **Exportar backup** | Salva todo o cofre em JSON (APIs criptografados) |
| **Importar backup** | Restaura a partir de JSON, mesclando com existentes |
| **Informações do cofre** | Estatísticas: total de itens, por categoria, versão |
| **Exclusão segura** | Remove permanentemente todos os dados (requer senha) |

### Interface

| Funcionalidade | Descrição |
|---------------|-----------|
| **Tema escuro profissional** | Design system completo com cores, elevação e espaçamento |
| **Abas coloridas** | Cada categoria com sua cor de identificação |
| **Paleta de comandos** | Ctrl+K para ações rápidas |
| **Notificações toast** | Feedback visual com opção de "Desfazer" |
| **Estados vazios** | Mensagens contextuais para cada situação |
| **Animações suaves** | Micro-interações a 60fps |

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
git clone https://github.com/alexlivre/DevVault-Electron.git
cd DevVault-Electron

# Instale as dependências
npm install

# Inicie em modo desenvolvimento
npm start
```

### Scripts disponíveis

| Comando | Descrição |
|---------|-----------|
| `npm start` | Inicia o app em modo desenvolvimento |
| `npm run package` | Empacota o app para o sistema atual (portátil) |
| `npm run make` | Gera instaladores (Windows/macOS/Linux) |
| `npm run publish` | Publica uma release |
| `npm run lint` | Verifica qualidade do código |

### Executável

```bash
# Gera uma pasta portátil com o app (sem instalação)
# Saída: out/DevVault-win32-x64/
npm run package

# Gera um instalador (Windows: .exe Squirrel, macOS: .dmg, Linux: .deb/.rpm)
# Saída: out/make/
npm run make
```

Depois de rodar `npm run make` no Windows, o instalador estará em `out/make/squirrel.windows/x64/`. Você pode executar o `.exe` diretamente ou instalar o app pelo instalador gerado.

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
| **Build** | Electron Forge + Vite |
| **Ícones** | Lucide |

---

## 📁 Estrutura do Projeto

```
src/
├── main.ts                          # Processo principal Electron
├── preload.ts                       # Ponte segura IPC com Zod
├── renderer.tsx                     # Entry point React
├── main/
│   ├── handlers/ipc-handlers.ts     # 16 handlers IPC validados
│   └── services/
│       ├── crypto.ts                # PBKDF2, AES-256-GCM, zeroização
│       └── vault.ts                 # CRUD, backup, troca de senha
└── renderer/
    ├── App.tsx                      # Roteamento de telas
    ├── types/index.ts               # Schemas Zod + tipos
    ├── stores/vault-store.ts        # Estado global (Zustand)
    ├── lib/
    │   ├── utils.ts                 # Helpers (máscara, senha, data)
    │   └── hooks.ts                 # Auto-lock, atalhos de teclado
    ├── components/
    │   ├── ui/                      # 10+ componentes base
    │   ├── add-edit-item-dialog.tsx  # CRUD com gerador de senha
    │   ├── vault-settings-sheet.tsx  # Painel de configurações
    │   └── toast-provider.tsx       # Sistema de notificações
    └── pages/
        ├── create-password-screen.tsx  # Primeiro acesso
        ├── unlock-screen.tsx           # Desbloqueio
        └── vault-screen.tsx            # Tela principal
```

---

## 🛡️ Segurança

### Como seus dados são protegidos

```
Senha mestra
    │
    ▼
PBKDF2 (600.000 iterações, SHA-256)
    │
    ├──► Hash da senha (armazenado no vault.json)
    │
    └──► Chave AES-256 (mantida em Buffer mutável na memória)
              │
              ▼
         AES-256-GCM (por item da categoria APIs)
              │
              ▼
         Ciphertext + IV + Tag (armazenados no vault.json)
```

- **Senha mestra** → PBKDF2 com salt aleatório de 32 bytes
- **Chave criptográfica** → armazenada em `Buffer` mutável, não em string
- **Zeroização** → ao travar, `buffer.fill(0)` sobrescreve a chave na RAM
- **Backup** → valores de API permanecem criptografados no JSON exportado
- **Troca de senha** → descriptografa tudo com a chave antiga e re-criptografa com a nova

---

## 🗺️ Roadmap

### v0.1.0-alpha ✅ (atual)
- ✅ Autenticação com senha mestra
- ✅ CRUD de itens com 4 categorias
- ✅ Criptografia AES-256-GCM
- ✅ Busca global com sintaxe `cat:`
- ✅ Favoritos e multi-select
- ✅ Export/Import JSON
- ✅ Auto-lock configurável
- ✅ Paleta de comandos (Ctrl+K)
- ✅ Tema escuro profissional

### v0.2.0 🔜
- Múltiplos cofres
- Tela de seleção de cofre

### v0.3.0
- Tags e labels personalizáveis
- Categorias customizáveis
- Arrastar e soltar itens

### v0.4.0
- Sincronização via Dropbox/OneDrive

### v1.0.0
- Testes de integração
- Documentação completa

---

## 📄 Licença

Distribuído sob licença MIT. Veja `LICENSE` para mais informações.

---

<div align="center">
  <sub>Feito com 💜 por <a href="https://github.com/alexlivre">alexlivre</a></sub>
</div>
