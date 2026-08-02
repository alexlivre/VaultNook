import * as React from 'react';
import {
  KeyRound,
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
} from 'lucide-react';
import { useVaultStore } from '../stores/vault-store';
import { useToast } from '../components/toast-provider';
import { useAutoLock, useKeyboardShortcuts } from '../lib/hooks';
import { Button } from '../components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '../components/ui/tooltip';
import { cn } from '../lib/utils';
import type { Category, Item } from '../types';
import { AddEditItemDialog } from '../components/add-edit-item-dialog';
import { VaultSettingsSheet } from '../components/vault-settings-sheet';
import { WindowControls } from '../components/window-controls';
import { ItemCard } from '../components/item-card';
import { CommandPalette } from '../components/command-palette';
import { VaultToolbar } from '../components/vault-toolbar';
import { List } from 'react-window';

const tabs: { id: Category | 'all'; label: string; icon: React.ElementType; color: string }[] = [
  { id: 'all', label: 'Tudo', icon: LayoutGrid, color: 'text-category-all' },
  { id: 'api', label: 'APIs', icon: KeyRound, color: 'text-category-api' },
  { id: 'prompt', label: 'Prompts', icon: MessageSquareText, color: 'text-category-prompt' },
  { id: 'command', label: 'Commands', icon: Terminal, color: 'text-category-command' },
  { id: 'link', label: 'Links', icon: Link, color: 'text-category-link' },
];

interface VaultRowProps {
  items: Item[];
  revealedItemIds: Set<string>;
  copiedId: string | null;
  selectedItemIds: Set<string>;
  onCopy: (value: string, itemId: string) => void;
  onEdit: (item: Item) => void;
  onDelete: (id: string, name: string) => void;
  onToggleFavorite: (id: string, current: boolean) => void;
  onToggleReveal: (id: string) => void;
  onSelect: (id: string) => void;
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
  onCopy,
  onEdit,
  onDelete,
  onToggleFavorite,
  onToggleReveal,
  onSelect,
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
        onCopy={onCopy}
        onEdit={onEdit}
        onDelete={onDelete}
        onToggleFavorite={onToggleFavorite}
        onToggleReveal={onToggleReveal}
        onSelect={onSelect}
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
    selectedItemIds,
    revealedItemIds,
    activeVaultName,
    setActiveCategory,
    setSearchQuery,
    setFavoritesFirst,
    toggleFavorite,
    toggleReveal,
    toggleItemSelection,
    clearSelection,
    removeItem,
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
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const deletedItemRef = React.useRef<Item | null>(null);
  const undoTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const displayItems = React.useMemo(
    () => filteredItems(),
    [items, activeCategory, searchQuery, favoritesFirst]
  );

  const handleCopy = React.useCallback(
    async (value: string, itemId: string) => {
      try {
        await navigator.clipboard.writeText(value);
        setCopiedId(itemId);
        toast({ title: 'Copiado!', variant: 'success' });
        setTimeout(() => setCopiedId(null), 1500);
      } catch {
        toast({ title: 'Erro ao copiar', variant: 'destructive' });
      }
    },
    [toast]
  );

  const handleLock = React.useCallback(async () => {
    try {
      const api = window.devVaultApi;
      await api.lock();
      setIsLocked(true);
      setScreen('vault-manager');
    } catch {
      // silent
    }
  }, [setIsLocked, setScreen]);

  useKeyboardShortcuts({
    'new-item': () => setAddDialogOpen(true),
    search: () => searchInputRef.current?.focus(),
    export: async () => {
      const api = window.devVaultApi;
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
    },
  });

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
      const item = items.find(i => i.id === id);
      if (!item) return;

      deletedItemRef.current = item;

      try {
        const api = window.devVaultApi;
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
            const api = window.devVaultApi;
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
        const api = window.devVaultApi;
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
              {activeVaultName || 'DevVault'}
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

        {/* Search + Filters */}
        <VaultToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          favoritesFirst={favoritesFirst}
          onToggleFavoritesFirst={() => setFavoritesFirst(!favoritesFirst)}
          searchInputRef={searchInputRef}
        />

        {/* Bulk action bar */}
        {selectedItemIds.size > 0 && (
          <div className="mx-4 mb-1 flex items-center gap-2 rounded-md bg-category-all/10 border border-category-all/20 px-3 py-1.5 text-xs shrink-0">
            <span className="text-text-secondary">{selectedItemIds.size} selecionado(s)</span>
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
              Copiar todos
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs text-destructive hover:text-destructive"
              onClick={clearSelection}
            >
              Limpar
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
                height={listHeight}
                width="100%"
                itemCount={displayItems.length}
                itemSize={72}
                overscanCount={5}
              >
                {({ index, style }) => (
                  <VaultRow
                    index={index}
                    style={style}
                    ariaAttributes={{
                      'aria-posinset': index + 1,
                      'aria-setsize': displayItems.length,
                      role: 'listitem',
                    }}
                    items={displayItems}
                    revealedItemIds={revealedItemIds}
                    copiedId={copiedId}
                    selectedItemIds={selectedItemIds}
                    onCopy={handleCopy}
                    onEdit={setEditItem}
                    onDelete={handleDelete}
                    onToggleFavorite={handleToggleFavorite}
                    onToggleReveal={toggleReveal}
                    onSelect={toggleItemSelection}
                    onActivity={handleActivity}
                  />
                )}
              </List>
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
            <span>Ctrl+E</span>
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
            toast({ title: 'Item adicionado', variant: 'success' });
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
            toast({ title: 'Item atualizado', variant: 'success' });
          }}
        />

        <VaultSettingsSheet
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          onLock={handleLock}
        />

        {/* Command Palette */}
        <CommandPalette
          isOpen={commandPaletteOpen}
          onClose={() => setCommandPaletteOpen(false)}
          commands={[
            { label: 'Adicionar item', shortcut: 'Ctrl+N', action: () => { setAddDialogOpen(true); } },
            { label: 'Exportar vault', shortcut: 'Ctrl+E', action: async () => { const api = window.devVaultApi; await api.exportVault(); } },
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
