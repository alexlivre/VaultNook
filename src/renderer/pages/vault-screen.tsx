import * as React from 'react';
import {
  KeyRound,
  KeySquare,
  MessageSquareText,
  Terminal,
  Link,
  LayoutGrid,
  Plus,
  Lock,
  Search,
  LogOut,
  Settings,
  Command,
  Copy,
  Trash2,
  FolderInput,
} from 'lucide-react';
import { useVaultStore } from '../stores/vault-store';
import { useToast } from '../components/toast-provider';
import { useAutoLock, useKeyboardShortcuts } from '../lib/hooks';
import { Button } from '../components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '../components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '../components/ui/alert-dialog';
import { cn } from '../lib/utils';
import type { Category, Item } from '../types';
import { CategoryLabel, Category as CategoryEnum } from '../types';
import { AddEditItemDialog } from '../components/add-edit-item-dialog';
import { VaultSettingsSheet } from '../components/vault-settings-sheet';
import { WindowControls } from '../components/window-controls';
import { ItemCard } from '../components/item-card';
import { CommandPalette } from '../components/command-palette';
import { VaultToolbar } from '../components/vault-toolbar';
import { CommandParamDialog } from '../components/command-param-dialog';
import { PromptViewDialog } from '../components/prompt-view-dialog';
import { VaultAuditDialog } from '../components/vault-audit-dialog';
import { List } from 'react-window';

const tabs: { id: Category | 'all'; label: string; icon: React.ElementType; color: string }[] = [
  { id: 'all', label: 'Tudo', icon: LayoutGrid, color: 'text-category-all' },
  { id: 'api', label: 'APIs', icon: KeyRound, color: 'text-category-api' },
  { id: 'prompt', label: 'Prompts', icon: MessageSquareText, color: 'text-category-prompt' },
  { id: 'command', label: 'Commands', icon: Terminal, color: 'text-category-command' },
  { id: 'link', label: 'Links', icon: Link, color: 'text-category-link' },
  { id: 'keypair', label: 'Chaves', icon: KeySquare, color: 'text-category-keypair' },
];

interface VaultRowProps {
  items: Item[];
  revealedItemIds: Set<string>;
  copiedId: string | null;
  selectedItemIds: Set<string>;
  focusedIndex: number;
  onCopy: (value: string, itemId: string) => void;
  onEdit: (item: Item) => void;
  onDelete: (id: string, name: string) => void;
  onDuplicate: (item: Item) => void;
  onMoveCategory: (id: string, category: Category) => void;
  onToggleFavorite: (id: string, current: boolean) => void;
  onToggleReveal: (id: string) => void;
  onSelect: (id: string) => void;
  onOpenExternal: (url: string) => void;
  onOpenParamDialog: (item: Item) => void;
  onOpenPromptDialog: (item: Item) => void;
  onTagClick: (tag: string) => void;
  onActivity: () => void;
}

function VaultRow({
  ariaAttributes,
  index,
  style,
  items,
  revealedItemIds,
  copiedId,
  selectedItemIds,
  focusedIndex,
  onCopy,
  onEdit,
  onDelete,
  onDuplicate,
  onMoveCategory,
  onToggleFavorite,
  onToggleReveal,
  onSelect,
  onOpenExternal,
  onOpenParamDialog,
  onOpenPromptDialog,
  onTagClick,
  onActivity,
}: {
  ariaAttributes: { 'aria-posinset': number; 'aria-setsize': number; role: 'listitem' };
  index: number;
  style: React.CSSProperties;
} & VaultRowProps) {
  const item = items[index];
  return (
    <div {...ariaAttributes} style={style} className="px-0">
      <ItemCard
        item={item}
        index={index}
        isRevealed={revealedItemIds.has(item.id)}
        isCopied={copiedId === item.id}
        isSelected={selectedItemIds.has(item.id)}
        isFocused={focusedIndex === index}
        onCopy={onCopy}
        onEdit={onEdit}
        onDelete={onDelete}
        onDuplicate={onDuplicate}
        onMoveCategory={onMoveCategory}
        onToggleFavorite={onToggleFavorite}
        onToggleReveal={onToggleReveal}
        onSelect={onSelect}
        onOpenExternal={onOpenExternal}
        onOpenParamDialog={onOpenParamDialog}
        onOpenPromptDialog={onOpenPromptDialog}
        onTagClick={onTagClick}
        onActivity={onActivity}
        disableAnimation
      />
    </div>
  );
}

export function VaultScreen() {
  const {
    items,
    activeCategory,
    searchQuery,
    favoritesFirst,
    sortOption,
    selectedItemIds,
    revealedItemIds,
    activeVaultName,
    setActiveCategory,
    setSearchQuery,
    setFavoritesFirst,
    setSortOption,
    toggleFavorite,
    toggleReveal,
    toggleItemSelection,
    clearSelection,
    removeItem,
    removeItems,
    moveCategoryItems,
    filteredItems,
    setScreen,
    setIsLocked,
  } = useVaultStore();

  const { toast } = useToast();
  const { handleActivity } = useAutoLock();
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = React.useState(false);
  const [editItem, setEditItem] = React.useState<Item | null>(null);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = React.useState(false);
  const [auditOpen, setAuditOpen] = React.useState(false);
  const [paramItem, setParamItem] = React.useState<Item | null>(null);
  const [promptItem, setPromptItem] = React.useState<Item | null>(null);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = React.useState(false);
  const [focusedIndex, setFocusedIndex] = React.useState<number>(-1);

  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const deletedItemRef = React.useRef<Item | null>(null);
  const undoTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const clipboardTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [listHeight, setListHeight] = React.useState(600);
  const listContainerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const updateHeight = () => {
      if (listContainerRef.current) {
        setListHeight(listContainerRef.current.clientHeight);
      }
    };
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  // Listen for system lock/suspend events
  React.useEffect(() => {
    const api = window.vaultNookApi;
    if (api?.onVaultLockedBySystem) {
      return api.onVaultLockedBySystem(() => {
        setIsLocked(true);
        setScreen('vault-manager');
        toast({ title: 'Cofre bloqueado pelo sistema', variant: 'default' });
      });
    }
  }, [setIsLocked, setScreen, toast]);

  const displayItems = React.useMemo(
    () => filteredItems(),
    [items, activeCategory, searchQuery, favoritesFirst, sortOption]
  );

  const handleCopy = React.useCallback(
    async (value: string, itemId: string) => {
      try {
        await navigator.clipboard.writeText(value);
        setCopiedId(itemId);
        toast({ title: 'Copiado para área de transferência!', variant: 'success' });
        setTimeout(() => setCopiedId(null), 1500);

        // Auto-clear clipboard for sensitive items after 30 seconds
        if (clipboardTimeoutRef.current) {
          clearTimeout(clipboardTimeoutRef.current);
        }
        clipboardTimeoutRef.current = setTimeout(async () => {
          try {
            await window.vaultNookApi.clearClipboard();
            toast({ title: 'Área de transferência limpa por segurança', variant: 'default' });
          } catch {
            // silent
          }
        }, 30000);
      } catch {
        toast({ title: 'Erro ao copiar', variant: 'destructive' });
      }
    },
    [toast]
  );

  const handleLock = React.useCallback(async () => {
    try {
      const api = window.vaultNookApi;
      await api.lock();
      setIsLocked(true);
      setScreen('vault-manager');
    } catch {
      // silent
    }
  }, [setIsLocked, setScreen]);

  const handleOpenExternal = React.useCallback(async (url: string) => {
    try {
      let finalUrl = url.trim();
      if (!/^https?:\/\//i.test(finalUrl)) {
        finalUrl = 'https://' + finalUrl;
      }
      await window.vaultNookApi.openExternal(finalUrl);
    } catch {
      toast({ title: 'URL inválida', variant: 'destructive' });
    }
  }, [toast]);

  const handleDuplicate = React.useCallback(
    async (item: Item) => {
      try {
        const api = window.vaultNookApi;
        await api.addItem({
          name: `${item.name} (cópia)`,
          value: item.value,
          publicKey: item.publicKey || '',
          description: item.description,
          category: item.category,
          tags: item.tags || [],
        });
        const updated = await api.getItems();
        useVaultStore.getState().setItems(updated);
        toast({ title: 'Item duplicado com sucesso', variant: 'success' });
      } catch {
        toast({ title: 'Erro ao duplicar item', variant: 'destructive' });
      }
    },
    [toast]
  );

  const handleMoveCategory = React.useCallback(
    async (id: string, category: Category) => {
      try {
        const api = window.vaultNookApi;
        await api.moveCategoryItems([id], category);
        moveCategoryItems([id], category);
        toast({ title: `Movido para ${CategoryLabel[category]}`, variant: 'success' });
      } catch {
        toast({ title: 'Erro ao mover item', variant: 'destructive' });
      }
    },
    [moveCategoryItems, toast]
  );

  const handleBulkMove = React.useCallback(
    async (category: Category) => {
      const ids = Array.from(selectedItemIds);
      if (ids.length === 0) return;
      try {
        const api = window.vaultNookApi;
        await api.moveCategoryItems(ids, category);
        moveCategoryItems(ids, category);
        toast({ title: `${ids.length} itens movidos para ${CategoryLabel[category]}`, variant: 'success' });
      } catch {
        toast({ title: 'Erro ao mover itens em lote', variant: 'destructive' });
      }
    },
    [selectedItemIds, moveCategoryItems, toast]
  );

  const handleBulkDelete = React.useCallback(async () => {
    const ids = Array.from(selectedItemIds);
    if (ids.length === 0) return;
    try {
      const api = window.vaultNookApi;
      await api.removeItems(ids);
      removeItems(ids);
      setBulkDeleteConfirmOpen(false);
      toast({ title: `${ids.length} itens excluídos`, variant: 'default' });
    } catch {
      toast({ title: 'Erro ao excluir itens em lote', variant: 'destructive' });
    }
  }, [selectedItemIds, removeItems, toast]);

  // Keyboard navigation & Shortcuts
  useKeyboardShortcuts({
    'new-item': () => setAddDialogOpen(true),
    search: () => searchInputRef.current?.focus(),
    export: async () => {
      const api = window.vaultNookApi;
      const result = await api.exportVault();
      if (result) toast({ title: 'Vault exportado com sucesso', variant: 'success' });
    },
    lock: handleLock,
    'select-all': () => {
      if (selectedItemIds.size > 0) clearSelection();
      else useVaultStore.getState().selectAllItems();
    },
    'command-palette': () => setCommandPaletteOpen(true),
    escape: () => {
      if (selectedItemIds.size > 0) clearSelection();
      else if (searchQuery) setSearchQuery('');
      setFocusedIndex(-1);
    },
  });

  // Global key listener for list navigation (ArrowUp, ArrowDown, Enter, Space)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex((prev) => Math.min(prev + 1, displayItems.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        if (focusedIndex >= 0 && focusedIndex < displayItems.length) {
          e.preventDefault();
          const item = displayItems[focusedIndex];
          handleCopy(item.value, item.id);
        }
      } else if (e.key === ' ') {
        if (focusedIndex >= 0 && focusedIndex < displayItems.length) {
          e.preventDefault();
          const item = displayItems[focusedIndex];
          if (item.category === 'api' || item.category === 'keypair') {
            toggleReveal(item.id);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [displayItems, focusedIndex, handleCopy, toggleReveal]);

  // Activity tracking for auto-lock
  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'click'] as const;
    events.forEach((event) => container.addEventListener(event, handleActivity));
    return () => {
      events.forEach((event) => container.removeEventListener(event, handleActivity));
    };
  }, [handleActivity]);

  const handleDelete = React.useCallback(
    async (id: string, name: string) => {
      const item = items.find((i) => i.id === id);
      if (!item) return;

      deletedItemRef.current = item;

      try {
        const api = window.vaultNookApi;
        await api.removeItem(id);
        removeItem(id);

        if (undoTimeoutRef.current) {
          clearTimeout(undoTimeoutRef.current);
        }

        toast({
          title: `"${name}" excluído`,
          variant: 'default',
          duration: 5000,
          onUndo: async () => {
            if (!deletedItemRef.current) return;
            const api = window.vaultNookApi;
            await api.addItem(deletedItemRef.current);
            const updatedItems = await api.getItems();
            useVaultStore.getState().setItems(updatedItems);
            deletedItemRef.current = null;
            toast({ title: 'Item restaurado', variant: 'success' });
          },
        });

        undoTimeoutRef.current = setTimeout(() => {
          deletedItemRef.current = null;
        }, 5000);
      } catch {
        toast({ title: 'Erro ao excluir', variant: 'destructive' });
      }
    },
    [items, removeItem, toast]
  );

  const handleToggleFavorite = React.useCallback(
    async (id: string, current: boolean) => {
      toggleFavorite(id);
      try {
        const api = window.vaultNookApi;
        await api.toggleFavorite(id, !current);
      } catch {
        toggleFavorite(id);
      }
    },
    [toggleFavorite]
  );

  return (
    <TooltipProvider>
      <div
        ref={containerRef}
        className="flex h-screen flex-col bg-surface-base overflow-hidden"
      >
        {/* Titlebar */}
        <header className="titlebar flex items-center justify-between border-b border-border-default pl-4 pr-0 h-11 shrink-0">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-category-all" />
            <span className="text-sm font-medium text-text-primary">
              {activeVaultName || 'VaultNook'}
            </span>
          </div>
          <div className="flex items-stretch h-full gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setCommandPaletteOpen(true)}
                >
                  <Command className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Paleta de comandos (Ctrl+K)</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setSettingsOpen(true)}
                >
                  <Settings className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Configurações</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleLock}
                >
                  <LogOut className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Travar (Ctrl+L)</TooltipContent>
            </Tooltip>
          </div>
          <WindowControls />
        </header>

        {/* Category Tabs */}
        <div className="flex items-center gap-0.5 px-4 pt-3 pb-1 shrink-0 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeCategory === tab.id;
            const count =
              tab.id === 'all'
                ? items.length
                : items.filter((i) => i.category === tab.id).length;

            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveCategory(tab.id);
                  handleActivity();
                }}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200 cursor-pointer',
                  isActive
                    ? 'text-text-primary bg-surface-raised shadow-sm'
                    : 'text-text-muted hover:text-text-primary hover:bg-surface-hover'
                )}
              >
                <Icon className={cn('h-3.5 w-3.5', tab.color)} />
                {tab.label}
                {count > 0 && (
                  <span
                    className={cn(
                      'ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                      isActive ? 'bg-surface-overlay' : 'bg-transparent'
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Active tab indicator */}
        <div
          className="h-0.5 mx-4 transition-all duration-200 rounded-full"
          style={{
            backgroundColor: `var(--color-category-${activeCategory === 'all' ? 'all' : activeCategory})`,
            width: `${100 / tabs.length}%`,
            transform: `translateX(${tabs.findIndex((t) => t.id === activeCategory) * 100}%)`,
          }}
        />

        {/* Search + Sort + Filters + Audit */}
        <VaultToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          favoritesFirst={favoritesFirst}
          onToggleFavoritesFirst={() => setFavoritesFirst(!favoritesFirst)}
          sortOption={sortOption}
          onSortChange={setSortOption}
          onOpenAudit={() => setAuditOpen(true)}
          searchInputRef={searchInputRef}
        />

        {/* Bulk Action Bar */}
        {selectedItemIds.size > 0 && (
          <div className="mx-4 mb-1 flex items-center gap-2 rounded-md bg-category-all/10 border border-category-all/20 px-3 py-1.5 text-xs shrink-0">
            <span className="text-text-secondary font-medium">{selectedItemIds.size} selecionado(s)</span>
            <div className="flex-1" />

            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs"
              onClick={() => {
                const selectedItems = displayItems.filter((i) => selectedItemIds.has(i.id));
                const values = selectedItems.map((i) => i.value).join('\n');
                handleCopy(values, 'bulk');
              }}
            >
              <Copy className="h-3 w-3 mr-1" />
              Copiar valores
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-6 text-xs">
                  <FolderInput className="h-3 w-3 mr-1" />
                  Mover para...
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {CategoryEnum.options.map((cat) => (
                  <DropdownMenuItem key={cat} onClick={() => handleBulkMove(cat)}>
                    {CategoryLabel[cat]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs text-destructive hover:text-destructive"
              onClick={() => setBulkDeleteConfirmOpen(true)}
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Excluir selecionados
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs text-text-muted hover:text-text-primary"
              onClick={clearSelection}
            >
              Desmarcar
            </Button>
          </div>
        )}

        {/* Item List */}
        <div className="flex-1 px-4 pb-16 flex flex-col">
          {displayItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-raised mb-3">
                {searchQuery ? (
                  <Search className="h-5 w-5 text-text-muted" />
                ) : (
                  <Lock className="h-5 w-5 text-text-muted" />
                )}
              </div>
              <p className="text-sm text-text-secondary font-medium">
                {searchQuery
                  ? `Nenhum resultado para "${searchQuery}"`
                  : items.length === 0
                  ? 'Seu cofre está vazio'
                  : 'Nenhum item nesta categoria'}
              </p>
              <p className="text-xs text-text-muted mt-1">
                {searchQuery
                  ? 'Tente outro termo ou limpe a busca'
                  : items.length === 0
                  ? 'Adicione seu primeiro item'
                  : 'Tente outra categoria'}
              </p>
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-3"
                  onClick={() => setSearchQuery('')}
                >
                  Limpar busca
                </Button>
              )}
              {!searchQuery && items.length === 0 && (
                <Button
                  variant="primary"
                  size="sm"
                  className="mt-3"
                  onClick={() => setAddDialogOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Adicionar item
                </Button>
              )}
            </div>
          ) : (
            <div ref={listContainerRef} className="flex-1 overflow-hidden">
              <List
                defaultHeight={listHeight}
                rowCount={displayItems.length}
                rowHeight={72}
                rowComponent={VaultRow}
                rowProps={{
                  items: displayItems,
                  revealedItemIds,
                  copiedId,
                  selectedItemIds,
                  focusedIndex,
                  onCopy: handleCopy,
                  onEdit: setEditItem,
                  onDelete: handleDelete,
                  onDuplicate: handleDuplicate,
                  onMoveCategory: handleMoveCategory,
                  onToggleFavorite: handleToggleFavorite,
                  onToggleReveal: toggleReveal,
                  onSelect: toggleItemSelection,
                  onOpenExternal: handleOpenExternal,
                  onOpenParamDialog: (it: Item) => setParamItem(it),
                  onOpenPromptDialog: (it: Item) => setPromptItem(it),
                  onTagClick: (tag: string) => setSearchQuery(`tag:${tag}`),
                  onActivity: handleActivity,
                }}
                overscanCount={5}
              />
            </div>
          )}
        </div>

        {/* Floating Add Button */}
        <div className="fixed bottom-4 right-4 z-40">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="primary"
                className="h-12 w-12 rounded-full shadow-lg hover:shadow-xl transition-shadow"
                onClick={() => {
                  setAddDialogOpen(true);
                  handleActivity();
                }}
              >
                <Plus className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Adicionar item (Ctrl+N)</TooltipContent>
          </Tooltip>
        </div>

        {/* Keyboard shortcut hint */}
        <div className="fixed bottom-4 left-4 z-40">
          <div className="flex items-center gap-2 rounded-md bg-surface-overlay/80 backdrop-blur-sm border border-border-default px-2.5 py-1.5 text-[10px] text-text-muted">
            <span>Ctrl+N</span>
            <span className="text-text-muted/50">|</span>
            <span>Ctrl+F</span>
            <span className="text-text-muted/50">|</span>
            <span>↑ / ↓ navegar</span>
            <span className="text-text-muted/50">|</span>
            <span>Enter copiar</span>
          </div>
        </div>

        {/* Dialogs */}
        <AddEditItemDialog
          open={addDialogOpen}
          onOpenChange={(open) => {
            setAddDialogOpen(open);
            if (!open) handleActivity();
          }}
          onSaved={() => {
            setAddDialogOpen(false);
            toast({ title: 'Item adicionado com sucesso', variant: 'success' });
          }}
        />

        <AddEditItemDialog
          open={editItem !== null}
          onOpenChange={(open) => {
            if (!open) setEditItem(null);
          }}
          editItem={editItem}
          onSaved={() => {
            setEditItem(null);
            toast({ title: 'Item atualizado com sucesso', variant: 'success' });
          }}
        />

        <VaultSettingsSheet
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          onLock={handleLock}
        />

        <VaultAuditDialog
          open={auditOpen}
          onOpenChange={setAuditOpen}
          onEditItem={(item) => setEditItem(item)}
        />

        <CommandParamDialog
          open={paramItem !== null}
          onOpenChange={(open) => {
            if (!open) setParamItem(null);
          }}
          item={paramItem}
        />

        <PromptViewDialog
          open={promptItem !== null}
          onOpenChange={(open) => {
            if (!open) setPromptItem(null);
          }}
          item={promptItem}
        />

        {/* Bulk Delete Confirm Alert */}
        <AlertDialog open={bulkDeleteConfirmOpen} onOpenChange={setBulkDeleteConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir {selectedItemIds.size} itens selecionados?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação removerá todos os itens selecionados do cofre. Tem certeza?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleBulkDelete}>
                Excluir itens
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Command Palette */}
        <CommandPalette
          isOpen={commandPaletteOpen}
          onClose={() => setCommandPaletteOpen(false)}
          commands={[
            { label: 'Adicionar item', shortcut: 'Ctrl+N', action: () => { setAddDialogOpen(true); } },
            { label: 'Auditoria de segurança', shortcut: '', action: () => { setAuditOpen(true); } },
            { label: 'Exportar vault', shortcut: 'Ctrl+E', action: async () => { const api = window.vaultNookApi; await api.exportVault(); } },
            { label: 'Travar vault', shortcut: 'Ctrl+L', action: () => { handleLock(); } },
          ]}
          items={items}
          onSelectItem={(item) => {
            handleCopy(item.value, item.id);
          }}
        />
      </div>
    </TooltipProvider>
  );
}
