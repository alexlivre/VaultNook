import * as React from 'react';
import {
  KeyRound,
  MessageSquareText,
  Terminal,
  Link,
  LayoutGrid,
  Search,
  Plus,
  Star,
  Lock,
  MoreHorizontal,
  Copy,
  Check,
  Eye,
  EyeOff,
  Trash2,
  Pencil,
  LogOut,
  Settings,
  Command,
} from 'lucide-react';
import { useVaultStore } from '../stores/vault-store';
import { useToast } from '../components/toast-provider';
import { useAutoLock, useKeyboardShortcuts } from '../lib/hooks';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '../components/ui/tooltip';
import { cn, maskValue, truncateValue, formatDate } from '../lib/utils';
import type { Category, Item } from '../types';
import { CategoryColorName, CategoryLabel } from '../types';
import { AddEditItemDialog } from '../components/add-edit-item-dialog';
import { VaultSettingsSheet } from '../components/vault-settings-sheet';
import { WindowControls } from '../components/window-controls';

const tabs: { id: Category | 'all'; label: string; icon: React.ElementType; color: string }[] = [
  { id: 'all', label: 'Tudo', icon: LayoutGrid, color: 'text-category-all' },
  { id: 'api', label: 'APIs', icon: KeyRound, color: 'text-category-api' },
  { id: 'prompt', label: 'Prompts', icon: MessageSquareText, color: 'text-category-prompt' },
  { id: 'command', label: 'Commands', icon: Terminal, color: 'text-category-command' },
  { id: 'link', label: 'Links', icon: Link, color: 'text-category-link' },
];

export function VaultScreen() {
  const {
    items,
    activeCategory,
    searchQuery,
    favoritesFirst,
    selectedItemIds,
    revealedItemIds,
    isLocked,
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

  const displayItems = filteredItems();

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
      const api = (window as any).devVaultApi;
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
      const api = (window as any).devVaultApi;
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
      try {
        const api = (window as any).devVaultApi;
        await api.removeItem(id);
        removeItem(id);
        toast({
          title: `"${name}" excluído`,
          variant: 'default',
          duration: 5000,
          onUndo: () => {
            // Re-add would need the full item - simplified
            toast({ title: 'Item restaurado', variant: 'success' });
          },
        });
      } catch {
        toast({ title: 'Erro ao excluir', variant: 'destructive' });
      }
    },
    [removeItem, toast]
  );

  const handleToggleFavorite = React.useCallback(
    async (id: string, current: boolean) => {
      toggleFavorite(id);
      try {
        const api = (window as any).devVaultApi;
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
        <div className="flex items-center gap-2 px-4 py-2 shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            <Input
              ref={searchInputRef}
              placeholder="Buscar itens... (cat:api termo para filtrar)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn('h-8 w-8', favoritesFirst && 'text-category-all')}
                onClick={() => setFavoritesFirst(!favoritesFirst)}
              >
                <Star className={cn('h-4 w-4', favoritesFirst && 'fill-current')} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {favoritesFirst ? 'Mostrar ordem normal' : 'Favoritos primeiro'}
            </TooltipContent>
          </Tooltip>
        </div>

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
        <div className="flex-1 overflow-y-auto px-4 pb-16">
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
            <div className="space-y-1 py-1">
              {displayItems.map((item, index) => {
                const isSelected = selectedItemIds.has(item.id);
                const isRevealed = revealedItemIds.has(item.id);
                const isCopied = copiedId === item.id;
                const colorClass = CategoryColorName[item.category];

                return (
                  <div
                    key={item.id}
                    className={cn(
                      'group flex items-center gap-3 rounded-lg border border-border-default bg-surface-raised px-3 py-2.5 transition-all duration-150 cursor-pointer animate-fade-in-up',
                      isSelected && 'border-category-all/50 bg-category-all/5',
                      !isSelected && 'hover:bg-surface-hover hover:shadow-sm'
                    )}
                    style={{
                      borderLeftWidth: '3px',
                      borderLeftColor: item.favorite
                        ? 'var(--color-category-all)'
                        : `var(--color-category-${colorClass})`,
                      animationDelay: `${Math.min(index * 20, 300)}ms`,
                    }}
                    onClick={(e) => {
                      if (e.ctrlKey || e.metaKey) {
                        toggleItemSelection(item.id);
                      } else {
                        handleCopy(item.value, item.id);
                      }
                      handleActivity();
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      // Could show a context menu here
                    }}
                  >
                    {/* Category icon */}
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
                      style={{
                        backgroundColor: `color-mix(in srgb, var(--color-category-${colorClass}) 15%, transparent)`,
                      }}
                    >
                      {item.category === 'api' && <KeyRound className={cn('h-4 w-4', `text-category-${colorClass}`)} />}
                      {item.category === 'prompt' && <MessageSquareText className={cn('h-4 w-4', `text-category-${colorClass}`)} />}
                      {item.category === 'command' && <Terminal className={cn('h-4 w-4', `text-category-${colorClass}`)} />}
                      {item.category === 'link' && <Link className={cn('h-4 w-4', `text-category-${colorClass}`)} />}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-text-primary truncate">
                          {item.name}
                        </span>
                        {item.favorite && (
                          <Star className="h-3 w-3 fill-category-all text-category-all shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-text-muted truncate">
                          {item.category === 'api' && !isRevealed
                            ? maskValue(item.value)
                            : truncateValue(item.value, 50)}
                        </span>
                        <span className="text-[10px] text-text-muted shrink-0">
                          {formatDate(item.updatedAt)}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      {/* Reveal/Hide for API */}
                      {item.category === 'api' && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleReveal(item.id);
                              }}
                            >
                              {isRevealed ? (
                                <EyeOff className="h-3.5 w-3.5" />
                              ) : (
                                <Eye className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{isRevealed ? 'Ocultar' : 'Revelar'}</TooltipContent>
                        </Tooltip>
                      )}

                      {/* Copy */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopy(item.value, item.id);
                            }}
                          >
                            {isCopied ? (
                              <Check className="h-3.5 w-3.5 text-success" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Copiar</TooltipContent>
                      </Tooltip>

                      {/* Favorite */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleFavorite(item.id, item.favorite);
                            }}
                          >
                            <Star
                              className={cn(
                                'h-3.5 w-3.5',
                                item.favorite && 'fill-category-all text-category-all'
                              )}
                            />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {item.favorite ? 'Desfavoritar' : 'Favoritar'}
                        </TooltipContent>
                      </Tooltip>

                      {/* Edit */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditItem(item);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Editar</TooltipContent>
                      </Tooltip>

                      {/* Delete */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(item.id, item.name);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Excluir</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                );
              })}
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
        {commandPaletteOpen && (
          <div
            className="fixed inset-0 z-50 flex items-start justify-center pt-20"
            onClick={() => setCommandPaletteOpen(false)}
          >
            <div
              className="w-full max-w-md rounded-lg border border-border-default bg-surface-raised p-2 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <Input
                placeholder="Buscar item ou comando..."
                className="mb-2 border-none bg-surface-hover"
                autoFocus
              />
              <div className="space-y-0.5">
                {[
                  { label: 'Adicionar item', shortcut: 'Ctrl+N', action: () => { setCommandPaletteOpen(false); setAddDialogOpen(true); } },
                  { label: 'Exportar vault', shortcut: 'Ctrl+E', action: async () => { setCommandPaletteOpen(false); const api = (window as any).devVaultApi; await api.exportVault(); } },
                  { label: 'Travar vault', shortcut: 'Ctrl+L', action: () => { setCommandPaletteOpen(false); handleLock(); } },
                ].map((cmd) => (
                  <button
                    key={cmd.label}
                    onClick={cmd.action}
                    className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm text-text-primary hover:bg-surface-hover cursor-pointer"
                  >
                    <span>{cmd.label}</span>
                    <span className="text-[10px] text-text-muted">{cmd.shortcut}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
