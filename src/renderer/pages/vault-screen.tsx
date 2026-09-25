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
  Star,
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
import { ItemDetailPanel } from '../components/item-detail-panel';
import { DeleteConfirmDialog } from '../components/delete-confirm-dialog';
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
  onActivate: (id: string) => void;
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
  onActivate,
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
        onActivate={onActivate}
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
  const [detailSelectedId, setDetailSelectedId] = React.useState<string | null>(null);
  const [autoLockTimer, setAutoLockTimer] = React.useState(60);
  const [deleteTarget, setDeleteTarget] = React.useState<Item | null>(null);

  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const deletedItemRef = React.useRef<Item | null>(null);
  const undoTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const clipboardTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [listHeight, setListHeight] = React.useState(600);
  const listContainerRef = React.useRef<HTMLDivElement>(null);

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

  React.useEffect(() => {
    const el = listContainerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setListHeight(el.clientHeight));
    observer.observe(el);
    setListHeight(el.clientHeight);
    return () => observer.disconnect();
  }, [displayItems.length]);

  const detailItem = React.useMemo(
    () => displayItems.find((i) => i.id === detailSelectedId) ?? displayItems[0] ?? null,
    [displayItems, detailSelectedId]
  );

  const favoritesCount = React.useMemo(() => items.filter((i) => i.favorite).length, [items]);

  const categoryCounts = React.useMemo(() => {
    const counts: Record<Category | 'all', number> = {
      all: items.length,
      api: 0,
      prompt: 0,
      command: 0,
      link: 0,
      keypair: 0,
    };
    for (const item of items) counts[item.category] += 1;
    return counts;
  }, [items]);

  const topTags = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      for (const tag of item.tags || []) {
        counts.set(tag, (counts.get(tag) || 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tag]) => tag);
  }, [items]);

  React.useEffect(() => {
    window.vaultNookApi
      .getSettings()
      .then((s) => setAutoLockTimer(s.autoLockTimer))
      .catch(() => {});
  }, []);

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
            const cleared = await window.vaultNookApi.clearClipboard(value);
            if (cleared) {
              toast({ title: 'Área de transferência limpa por segurança', variant: 'default' });
            }
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

  const requestDelete = React.useCallback(
    (id: string) => {
      const item = items.find((i) => i.id === id);
      if (item) setDeleteTarget(item);
    },
    [items]
  );

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
          <button
            onClick={handleLock}
            className="flex items-center gap-2 rounded-md px-1 py-0.5 cursor-pointer"
            title="Travar e trocar de cofre"
          >
            <Lock className="h-4 w-4 text-brass" />
            <span className="text-sm font-semibold tracking-tight text-text-primary">
              {activeVaultName || 'VaultNook'}
            </span>
            <span className="text-[11px] text-text-muted">
              {items.length} {items.length === 1 ? 'item' : 'itens'}
            </span>
          </button>
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

        <div className="flex min-h-0 flex-1">
          {/* Vault sidebar */}
          <aside
            className="w-56 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-border-default bg-surface-base/50 px-2.5 py-3 hidden md:flex"
            aria-label="Navegação do cofre"
          >
            <button
              onClick={handleLock}
              className="mb-3 flex items-center gap-2.5 rounded-lg border border-border-default bg-surface-raised px-2.5 py-2 text-left cursor-pointer hover:border-text-muted/40"
              title="Travar e trocar de cofre"
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-brass shadow-[0_0_10px_rgba(201,162,39,0.7)]" />
              <span className="min-w-0">
                <span className="block truncate text-xs font-semibold text-text-primary">
                  {activeVaultName || 'VaultNook'}
                </span>
                <span className="block text-[10px] text-text-muted">trocar de cofre</span>
              </span>
            </button>

            <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-text-muted">
              Categorias
            </p>
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeCategory === tab.id && !searchQuery.startsWith('tag:');
              const count = categoryCounts[tab.id];

              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveCategory(tab.id);
                    handleActivity();
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors cursor-pointer text-left',
                    isActive
                      ? 'bg-surface-raised text-text-primary shadow-[inset_2px_0_0_var(--color-brass)]'
                      : 'text-text-secondary hover:bg-surface-raised hover:text-text-primary'
                  )}
                >
                  <Icon className={cn('h-3.5 w-3.5 shrink-0', tab.color)} />
                  <span className="truncate">{tab.label}</span>
                  <span className="ml-auto rounded-full border border-border-default bg-surface-base px-1.5 py-px text-[10px] tabular-nums text-text-muted">
                    {count}
                  </span>
                </button>
              );
            })}

            <button
              onClick={() => {
                setSearchQuery(searchQuery === 'is:fav' ? '' : 'is:fav');
                handleActivity();
              }}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors cursor-pointer text-left',
                searchQuery === 'is:fav'
                  ? 'bg-surface-raised text-text-primary shadow-[inset_2px_0_0_var(--color-brass)]'
                  : 'text-text-secondary hover:bg-surface-raised hover:text-text-primary'
              )}
            >
              <Star className="h-3.5 w-3.5 shrink-0 text-brass" />
              <span className="truncate">Favoritos</span>
              <span className="ml-auto rounded-full border border-border-default bg-surface-base px-1.5 py-px text-[10px] tabular-nums text-text-muted">
                {favoritesCount}
              </span>
            </button>

            {topTags.length > 0 && (
              <>
                <p className="px-2 pb-1 pt-3 text-[10px] font-bold uppercase tracking-widest text-text-muted">
                  Tags
                </p>
                <div className="flex flex-wrap gap-1.5 px-1">
                  {topTags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => {
                        setSearchQuery(searchQuery === `tag:${tag}` ? '' : `tag:${tag}`);
                        handleActivity();
                      }}
                      className={cn(
                        'rounded-full border px-2 py-0.5 font-secret text-[11px] cursor-pointer',
                        searchQuery === `tag:${tag}`
                          ? 'border-brass/50 text-brass'
                          : 'border-border-default text-text-muted hover:border-brass/40 hover:text-brass'
                      )}
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              </>
            )}

            <div className="mt-auto border-t border-border-default px-2 pt-2 text-[11px] leading-relaxed text-text-muted">
              Trava em{' '}
              {autoLockTimer === 0
                ? 'manual'
                : autoLockTimer < 60
                  ? `${autoLockTimer} s`
                  : `${Math.round(autoLockTimer / 60)} min`}
              {' · área limpa em 30 s'}
            </div>
          </aside>

          {/* Main column */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
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
              </div>
              <div className="shrink-0 pr-4 pt-2">
                <Button
                  variant="primary"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => {
                    setAddDialogOpen(true);
                    handleActivity();
                  }}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Novo
                </Button>
              </div>
            </div>

        {/* Bulk Action Bar */}
        {selectedItemIds.size > 0 && (
          <div className="mx-4 mb-1 flex items-center gap-2 rounded-md bg-brass/10 border border-brass/30 px-3 py-1.5 text-xs shrink-0">
            <span className="font-semibold text-brass">{selectedItemIds.size} selecionado(s)</span>
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
                  onDelete: requestDelete,
                  onDuplicate: handleDuplicate,
                  onMoveCategory: handleMoveCategory,
                  onToggleFavorite: handleToggleFavorite,
                  onToggleReveal: toggleReveal,
                  onSelect: toggleItemSelection,
                  onActivate: setDetailSelectedId,
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

            {/* Status bar */}
            <div className="flex shrink-0 items-center gap-2 border-t border-border-default px-4 py-1.5 text-[11px] text-text-muted">
              <span className="tabular-nums">
                {displayItems.length} {displayItems.length === 1 ? 'item' : 'itens'}
              </span>
              <span className="opacity-40">|</span>
              <span className="hidden sm:inline">Ctrl+K comandos</span>
              <span className="hidden opacity-40 sm:inline">|</span>
              <span className="hidden sm:inline">↑↓ navegar</span>
              <span className="hidden opacity-40 sm:inline">|</span>
              <span className="hidden sm:inline">Enter copiar</span>
            </div>
          </div>

          {/* Item detail panel */}
          <ItemDetailPanel
            item={detailItem}
            isRevealed={detailItem ? revealedItemIds.has(detailItem.id) : false}
            isCopied={detailItem ? copiedId === detailItem.id : false}
            onCopy={handleCopy}
            onEdit={setEditItem}
            onDelete={requestDelete}
            onDuplicate={handleDuplicate}
            onToggleFavorite={handleToggleFavorite}
            onToggleReveal={toggleReveal}
            onOpenExternal={handleOpenExternal}
            onOpenParamDialog={(it: Item) => setParamItem(it)}
            onOpenPromptDialog={(it: Item) => setPromptItem(it)}
          />
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

        {/* Single Delete Confirm */}
        <DeleteConfirmDialog
          open={deleteTarget !== null}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null);
          }}
          itemName={deleteTarget?.name ?? ''}
          onConfirm={() => {
            if (deleteTarget) handleDelete(deleteTarget.id, deleteTarget.name);
            setDeleteTarget(null);
          }}
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
