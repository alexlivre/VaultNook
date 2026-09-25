# VaultNook v2 — Especificação Funcional

> **Propósito:** Aplicativo desktop para armazenar e gerenciar API keys, prompts, comandos e links de forma segura e local.
>
> **Status desta spec:** Versão consolidada de todos os recursos atuais e planejados, com melhorias de UX priorizadas para v0.1.0.

---

## 1. Visão Geral

VaultNook é um cofre digital pessoal que permite ao usuário:

- Armazenar valores sensíveis (chaves de API) com proteção criptográfica
- Organizar itens em categorias pré-definidas com identificação por cor
- Copiar valores rapidamente para a área de transferência
- Buscar e gerenciar todos os itens de forma centralizada
- Fazer backup e restaurar o cofre
- Proteger todo o conteúdo com senha mestra

**Princípios de design da aplicação:**

| Princípio | Descrição |
|-----------|-----------|
| Clareza acima de minimalismo | Ações de segurança (excluir, exportar) devem ser visualmente distintas, não ocultas em botões fantasmas |
| Fricção proposital | Excluir o cofre requer passos deliberados. Copiar um valor é um clique. A fricção corresponde à consequência |
| Metáfora física | O app deve parecer a abertura de um cofre, não o preenchimento de um formulário |
| Nativo de desktop | Janela sem bordas, menu de contexto, atalhos de teclado, arrastar e soltar |
| Tom profissional | Cada pixel intencional. Espaçamento consistente. Animações suaves a 60fps |

---

## 2. Funcionalidades — v0.1.0

### 2.1 Tela de Autenticação

| Funcionalidade | Descrição |
|---------------|-----------|
| Primeiro acesso | Detecta se é o primeiro uso e inicia assistente de criação |
| Criação de senha mestra | Formulário com senha + confirmação + indicador de força em tempo real |
| Frase de recuperação | Gera frase de 12 palavras na criação da senha; exibe uma vez e exige confirmação |
| Desbloqueio por senha | Solicita senha mestra para abrir o cofre |
| Desbloqueio biométrico | Oferece Windows Hello / Touch ID como alternativa (se configurado) |
| Opção de sessão | Após desbloquear, permite escolher "Manter destravado por 15 min / 1 hora / até travar" |
| Bloqueio automático | Bloqueia o cofre automaticamente — tempo configurável (30s / 60s / 5min / 15min / nunca) |
| Bloqueio manual | Botão ou atalho para travar o cofre imediatamente |
| Informação contextual | Exibe "Último desbloqueio: hoje, 14:34" e "23 itens em 4 categorias" na tela de desbloqueio |

**Fluxo de primeiro acesso:**

1. Usuário abre o app → detecta que não há senha
2. Assistente de criação é exibido:
   - Campo de senha mestra com medidor de força (fraca → forte)
   - Confirmação de senha
   - Checklist de requisitos (8+ caracteres, maiúscula, minúscula, número, símbolo)
3. Após criar senha, o app gera uma **frase de recuperação de 12 palavras**
4. Frase é exibida uma única vez; usuário deve confirmar digitando 3 palavras aleatórias
5. Cofre é criado e destravado automaticamente
6. Usuário vê tela principal vazia com mensagem "Seu cofre está vazio — adicione seu primeiro item"

### 2.2 Gerenciamento de Itens

| Funcionalidade | Descrição |
|---------------|-----------|
| Criar item | Diálogo com campos: nome (obrigatório), valor (obrigatório), descrição (opcional), categoria (dropdown) |
| Editar item | Mesmo diálogo pré-preenchido |
| Excluir item | Confirmação com AlertDialog; toast com opção "Desfazer" por 5 segundos |
| Copiar valor | Botão de cópia em cada card; duplo clique no card também copia |
| Visualizar valor | Prévia truncada (60px); valores de API aparecem mascarados por padrão com botão de revelar |
| Menu de contexto | Clique direito no item abre menu: Copiar valor, Copiar nome, Copiar como JSON, Editar, Excluir |
| Gerador de senhas | Ícone de dado ao lado do campo "Valor" na categoria APIs — gera senha forte aleatória |
| Favoritar item | Estrela no card permite marcar/desmarcar como favorito |
| Filtro de favoritos | Alternância "Favoritos primeiro" no topo da lista |
| Ações em lote | Seleção múltipla (Ctrl+Click, Shift+Click, Ctrl+A) permite copiar, exportar ou excluir vários itens |

**Comportamento do card de item:**

| Estado | Aparência |
|--------|-----------|
| Normal | Nome, valor truncado, metadados (data, categoria), botões de ação |
| Favorito | Estrela preenchida; pode aparecer antes dos não-favoritos |
| API (sensível) | Valor mascarado (`sk_live_••••••`), fonte monoespaçada, botão de revelar (olho) |
| API revelado | Valor visível por 5 segundos, depois retorna ao estado mascarado |
| Hover | Leve escala (1.01), fundo mais claro, sombra elevada |
| Selecionado | Borda lateral esquerda na cor da categoria |
| Copiando | Ícone muda para check verde → toast "Copiado!" → volta ao normal |

### 2.3 Categorias

O sistema possui **5 categorias fixas** com identificação por cor:

| Categoria | Cor | Ícone | Comportamento do valor |
|-----------|-----|-------|------------------------|
| Todos (All) | Roxo (violeta) | LayoutGrid | Exibe itens de todas as categorias |
| APIs | Âmbar | KeyRound | Valor é criptografado (dados sensíveis); mascarado por padrão |
| Prompts | Azul | MessageSquareText | Valor armazenado em texto puro |
| Commands | Verde (esmeralda) | Terminal | Valor armazenado em texto puro |
| Links | Rosa | Link | Valor armazenado em texto puro |

As categorias são apresentadas como abas clicáveis no topo da tela principal. Cada aba exibe um **contador de itens**. A aba ativa possui indicador visual (linha inferior animada na cor da categoria). Ao trocar de aba, o conteúdo faz transição suave (crossfade).

### 2.4 Busca

| Funcionalidade | Descrição |
|---------------|-----------|
| Busca global | Filtra itens em **todas as categorias** por padrão (não apenas na categoria ativa) |
| Filtro por categoria | Ao buscar, resultados mostram badge com a cor da categoria de cada item |
| Busca por sintaxe | `cat:api stripe` busca "stripe" apenas na categoria APIs |
| Filtros ativos | Abaixo da barra de busca, pills clicáveis mostram filtros ativos — [ "stripe" ] [ ✕ APIs ] |
| Atalho de teclado | Ctrl+F ou Cmd+K foca a busca |
| Paleta de comandos | Cmd+K abre paleta que busca itens + oferece ações rápidas: "Adicionar item", "Exportar", "Travar" |
| Estado vazio de busca | Mensagem "Nenhum resultado para 'xyz' — tente outro termo" com botão "Limpar busca" |

### 2.5 Aba "Todos" (All)

- Aba padrão ao abrir o cofre
- Exibe itens de **todas as categorias** em ordem mista
- Cada item exibe badge colorido indicando sua categoria
- Quando bloqueado, itens da categoria APIs aparecem com valor oculto
- Ordenação padrão: favoritos primeiro, depois por data de criação (mais recentes primeiro)

### 2.6 Gestão do Cofre

Acessada através de um painel deslizante (slide-over) à direita, não de um menu dropdown.

| Funcionalidade | Descrição |
|---------------|-----------|
| Informações do cofre | Exibe data de criação, total de itens, quantidade por categoria, versão do app |
| Trocar senha | Formulário: senha atual + nova senha + confirmação; re-criptografa todos os valores |
| Configurar bloqueio | Seletor de tempo de bloqueio automático: 30s / 60s / 5min / 15min / nunca |
| Exportar cofre | Salva backup completo em JSON com diálogo de arquivo; valores de API permanecem criptografados |
| Importar cofre | Restaura a partir de JSON; mescla com itens existentes (ignora duplicatas por nome) |
| Excluir cofre | Requer digitar a senha mestra para confirmar; remove permanentemente todos os dados |

**Zona de perigo:** As ações destrutivas (excluir cofre) são visualmente separadas das demais, com cor vermelha e espaçamento extra.

### 2.7 Backup e Restauração

| Funcionalidade | Descrição |
|---------------|-----------|
| Exportar cofre | Salva backup completo em formato JSON (valores de API permanecem criptografados) |
| Importar cofre | Restaura a partir de arquivo JSON — mescla com itens existentes (ignora duplicatas por nome) |
| Contagem | Exibe quantos itens foram exportados, importados e ignorados (duplicatas) |
| Atalho | Ctrl+E para exportar |

### 2.8 Interface Visual

**Sistema de cores (tema escuro):**

| Token | Cor | Uso |
|-------|-----|-----|
| Superfície base | `#0a0a0f` | Fundo principal |
| Superfície elevada | `#12121a` | Cards, diálogos |
| Superfície overlay | `#1a1a24` | Dropdowns, sheets |
| Superfície hover | `#22222e` | Estados de hover |
| Texto primário | `#f1f1f6` | Títulos, nomes de itens |
| Texto secundário | `#a1a1b5` | Corpo, descrições |
| Texto muted | `#6b6b80` | Metadados, timestamps |
| Borda padrão | `#2a2a3a` | Contornos de card |
| Borda foco | `#5b5bff` | Anel de foco |

**Cores de categoria (aplicadas como badge, borda de card, e fundo de ícone com 10% opacidade):**

- **Todos (All):** `#8b5cf6` (violeta)
- **APIs:** `#f59e0b` (âmbar)
- **Prompts:** `#3b82f6` (azul)
- **Commands:** `#10b981` (esmeralda)
- **Links:** `#f43f5e` (rosa)

**Elevação (sombras):**

| Nível | Uso | Sombra |
|-------|-----|--------|
| 1 | Cards, itens | `0 1px 2px rgba(0,0,0,0.3)` |
| 2 | Diálogos, sheets | `0 4px 24px rgba(0,0,0,0.4)` |
| 3 | Modais, dropdowns | `0 8px 32px rgba(0,0,0,0.5)` |
| 4 | Toasts, tooltips | `0 2px 16px rgba(0,0,0,0.6)` |

**Iconografia:**

- Conjunto de ícones consistente (Linhas finas, mesmo peso visual)
- Sem emojis como ícones de interface
- Categoria Todos: grade, APIs: chave, Prompts: balão de texto, Commands: terminal, Links: elo

**Estados vazios (4 variantes):**

| Contexto | Mensagem | Ação |
|----------|----------|------|
| Nenhum item no cofre | "Seu cofre está vazio — adicione seu primeiro segredo" | Botão "Adicionar Item" destacado |
| Nenhum item na categoria | "Nenhuma API salva ainda" | Botão "Adicionar API Key" |
| Busca sem resultados | "Nenhum resultado para 'xyz'" | Link "Limpar busca" |
| Busca em cofre vazio | "Nada para buscar — adicione itens primeiro" | Botão "Adicionar Item" |

**Notificações (Toast):**

- Aparecem no canto inferior direito
- Auto-dispensam em 3 segundos
- Ação de "Desfazer" disponível em toasts de exclusão por 5 segundos
- Animações suaves de entrada/saída (slide)

**Animações e micro-interações:**

| Elemento | Animação | Duração |
|----------|----------|---------|
| Troca de aba | Deslizamento de linha + crossfade de conteúdo | 200ms |
| Cópia de valor | Ícone escala → check verde → retorna | 150ms |
| Hover no card | Leve escala + brilho + sombra | 150ms |
| Abertura de diálogo | Fundo escurece + conteúdo escala (0.95→1) | 200ms |
| Aparecimento de toast | Desliza de baixo para cima | 300ms |
| Exclusão de item | Card desliza para direita → desaparece | 250ms |
| Revelar valor de API | Troca de ícone + crossfade de conteúdo | 100ms |
| Travamento do cofre | Conteúdo desaparece → ícone de cadeado aparece | 300ms |
| Desbloqueio do cofre | Animação "decrypting..." com itens aparecendo em cascata | 400ms |
| Limpar busca | Botão "X" aparece com fade quando há texto | 100ms |

### 2.9 Atalhos de Teclado

| Atalho | Ação |
|--------|------|
| Ctrl+N | Criar novo item |
| Ctrl+F | Focar na barra de busca |
| Cmd+K | Abrir paleta de comandos |
| Ctrl+E | Exportar cofre |
| Ctrl+L | Travar cofre |
| Ctrl+A | Selecionar todos os itens (na categoria atual) |
| Esc | Fechar diálogos / limpar seleção |
| Delete | Excluir item(s) selecionado(s) |

### 2.10 Segurança

| Funcionalidade | Descrição |
|---------------|-----------|
| Hash de senha | Senha mestra protegida com algoritmo de derivação de chave (PBKDF2) com alto número de iterações |
| Criptografia | Valores da categoria APIs são criptografados individualmente com AES-256-GCM |
| IV único | Cada item criptografado possui seu próprio vetor de inicialização |
| Chave em memória | Chave criptográfica armazenada em buffer mutável (permite zeroização ao travar) |
| Zeroização | Ao travar o cofre, a chave criptográfica é sobrescrita na memória |
| Backup seguro | Valores de API permanecem criptografados no JSON exportado — só descriptografáveis dentro do app |
| Frase de recuperação | Frase de 12 palavras (BIP39) gerada na criação; permite recuperar acesso se esquecer a senha |
| Troca de senha | Requer senha atual; re-criptografa todos os valores com nova chave |
| Exclusão segura | Excluir cofre remove permanentemente todos os dados do disco |

---

## 3. Funcionalidades Planejadas

### 3.1 Versão 0.2.x — Múltiplos Cofres

| Funcionalidade | Descrição |
|---------------|-----------|
| Múltiplos cofres | Permitir criar mais de um cofre, cada um com sua própria senha |
| Tela de seleção | Tela inicial para escolher ou criar um cofre |
| Cofre padrão | Cofre existente migrado como "Principal" |
| Renomear | Permitir renomear cofres |
| Excluir cofre | Deletar cofre selecionado (com confirmação da senha) |
| Isolamento | Dados de cada cofre isolados entre si |

### 3.2 Versão 0.3.x — Organização Avançada

| Funcionalidade | Descrição |
|---------------|-----------|
| Tags/Labels | Adicionar tags personalizáveis aos itens para filtragem |
| Categorias personalizáveis | Criar, renomear e excluir categorias |
| Arrastar e soltar | Mover itens entre categorias por drag-and-drop |

### 3.3 Versão 0.4.x — Sincronização e Portabilidade

| Funcionalidade | Descrição |
|---------------|-----------|
| Sincronização via arquivo | Sincronizar cofres através de arquivos em serviços de nuvem (Dropbox, OneDrive, etc.) |
| Exportar cofre específico | Exportar apenas um cofre como arquivo portátil |

### 3.4 Versão 1.0.x — Produção

| Funcionalidade | Descrição |
|---------------|-----------|
| Documentação completa | Documentar todas as funcionalidades e arquitetura |
| Testes de integração | Testes cobrindo fluxos completos de uso |

---

## 4. Ideias Futuras (Sem Prioridade Definida)

- Histórico de itens copiados (clipboard history)
- Atalho de teclado global para abrir o app rapidamente
- Auto-completar para valores já salvos
- Ícone na bandeja do sistema
- Minimizar para bandeja ao fechar
- Tema claro (light mode)
- Modo sem senha para itens não sensíveis
- Busca avançada com filtros por data e tipo
- Sistema de plugins/extensões
- Exportar em outros formatos (CSV, TXT)
- Atalhos customizáveis pelo usuário

---

## 5. Comportamento do Sistema (Requisitos Não-Funcionais)

| Requisito | Descrição |
|-----------|-----------|
| Armazenamento local | Todos os dados armazenados localmente no dispositivo do usuário |
| Portabilidade | Deve funcionar em Windows, Linux e macOS |
| Isolamento | Dados de cada cofre isolados entre si |
| Persistência | Dados salvos em disco e carregados ao abrir o app |
| Performance | Respostas rápidas para busca, inserção e cópia; listas virtualizadas para +50 itens |
| Segurança por padrão | Valores sensíveis criptografados mesmo em backups |
| Autenticação | Acesso ao cofre protegido por senha |
| Privacidade | Nenhum dado enviado para servidores externos |
| Offline-first | Funciona 100% offline; sem dependência de rede |
| Resiliência | Backup exportado contém dados criptografados — descriptografia só ocorre dentro do app |

---

## 6. Fluxos de Usuário Principais

### 6.1 Primeiro Uso

1. Usuário abre o app → detecta que não há senha
2. Assistente guiado exibido:
   a. Criação de senha mestra com medidor de força e validação em tempo real
   b. Geração de frase de recuperação de 12 palavras
   c. Confirmação da frase (digitar 3 palavras aleatórias)
3. Cofre é criado e destravado automaticamente
4. Transição animada: cadeado abre, itens aparecem em cascata
5. Usuário vê tela principal vazia com estado "Seu cofre está vazio"

### 6.2 Uso Diário

1. Usuário abre o app → tenta desbloqueio biométrico (se configurado)
2. Se indisponível, solicita senha mestra com opção "Manter destravado por..."
3. Usuário digita senha → animação de desbloqueio → cofre destrava
4. Usuário visualiza itens, busca globalmente (Cmd+K), copia com duplo clique, adiciona ou edita
5. App trava automaticamente após tempo configurado de inatividade
6. Usuário pode travar manualmente (Ctrl+L ou botão) a qualquer momento

### 6.3 Gerenciamento

1. Usuário abre painel de configurações (botão ⚙️ no título)
2. Painel deslizante à direita exibe opções:
   - **Info:** estatísticas do cofre
   - **Trocar Senha:** formulário com re-criptografia automática
   - **Configurar Bloqueio:** seletor de tempo
   - **Exportar:** diálogo de salvar arquivo
   - **Importar:** diálogo de abrir arquivo + mesclagem
   - **Excluir Cofre:** requer digitar senha mestra + confirmação

### 6.4 Gerenciamento de Itens

1. **Adicionar:** Ctrl+N ou botão "+" → diálogo → seleciona categoria → preenche → salva
2. **Editar:** clique no ícone de lápis no card → diálogo pré-preenchido → altera → salva
3. **Excluir:** clique no ícone de lixo → confirmação → toast com "Desfazer" por 5s
4. **Copiar:** duplo clique no card ou botão de cópia → feedback visual → toast "Copiado!"
5. **Multi-select:** Ctrl+Click nos cards → barra de ações em lote aparece → copiar/exportar/excluir selecionados
6. **Favoritar:** clique na estrela → item move-se para o topo (se ordenação "Favoritos primeiro" ativa)

---

## 7. Mudanças em Relação à Versão Anterior (v1 da spec)

### 7.1 Funcionalidades Adicionadas à v0.1.0

| Funcionalidade | Origem | Motivo |
|---------------|--------|--------|
| Frase de recuperação (12 palavras) | Nova | Responsabilidade com o usuário — senha perdida = dados perdidos |
| Favoritos | v0.3.x original | Necessidade diária — usuários com muitos itens precisam pinar os importantes |
| Gerador de senhas | Ideias futuras | Completeza de fluxo — criar API key sem sair do app |
| Busca global (entre categorias) | Melhoria de UX | "Sei que o item existe" é mais comum que "Sei em qual categoria está" |
| Paleta de comandos (Cmd+K) | Nova | Padrão de apps profissionais (VS Code, Linear, Raycast) |
| Multi-select e ações em lote | Nova | Evita ações repetitivas |
| Menu de contexto (clique direito) | Nova | Comportamento nativo de desktop |
| Undo em exclusão | Ideias futuras | Segurança contra erro do usuário |
| Autolock configurável | Ideias futuras | 60s fixo é agressivo para alguns, insuficiente para outros |
| Opção de sessão ("manter destravado") | Nova | Reduz fricção do desbloqueio frequente |
| Biometria (Windows Hello/Touch ID) | Ideias futuras | Caminho preferencial de desbloqueio — reduz atrito |
| Paginação | v0.3.x original | Performance e orientação em listas grandes |
| Painel deslizante (sheet) para config | Nova | Mais profissional que menu dropdown |
| Contadores nas abas de categoria | Nova | Contexto imediato sem trocar de aba |
| Animações de transição e micro-interações | Nova | Sensação premium e metáfora física de "abrir cofre" |

### 7.2 Funcionalidades que Permanecerão para Versões Futuras

| Funcionalidade | Versão Alvo | Motivo |
|---------------|-------------|--------|
| Múltiplos cofres | v0.2.x | Mudança arquitetural (roteamento, storage, estado) |
| Tags/Labels | v0.3.x | Nova dimensão no modelo de dados |
| Categorias personalizáveis | v0.3.x | Mudança no modelo de dados |
| Arrastar e soltar | v0.3.x | Complexidade de implementação |
| Sincronização via nuvem | v0.4.x | Requer file watchers, resolução de conflitos |
| Light mode | Futuro | Baixo impacto para ferramenta de desenvolvedor |
| Plugins/extensões | Futuro | Requer arquitetura de plugin |

---

## 8. Glossário

| Termo | Definição |
|-------|-----------|
| Cofre (Vault) | Conjunto de dados protegido por senha (itens + configurações) |
| Item | Entrada individual com nome, valor, descrição, categoria e estado de favorito |
| Valor criptografado | Dado armazenado de forma ilegível sem a chave correta |
| Senha mestra | Senha única que protege o cofre inteiro |
| Frase de recuperação | 12 palavras geradas na criação que permitem recuperar o cofre |
| Backup | Cópia exportada do cofre para fins de restauração |
| Toast | Notificação temporária que aparece na tela, com opção de ação |
| Categoria | Classificação fixa dos itens (APIs, Prompts, Commands, Links) |
| Paleta de comandos | Menu quick-action acessado por atalho de teclado (Cmd+K) |
| Zeroização | Sobrescrita intencional de dados sensíveis na memória |
| Sheet | Painel deslizante lateral (não um diálogo modal) |

---

## 9. Histórico do Documento

| Data | Versão | Descrição |
|------|--------|-----------|
| 2026-06-07 | v3 | Especificação revisada com melhorias de UX: favoritos, busca global, paleta de comandos, multi-select, biometria, frase de recuperação, autolock configurável, painel deslizante, animações, e reorganização de prioridades |
| 2026-06-07 | v2 | Especificação consolidada de todos os recursos atuais e planejados |
