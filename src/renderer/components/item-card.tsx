import * as React from 'react';
import {
  KeyRound,
  KeySquare,
  MessageSquareText,
  Terminal,
  Link,
  Star,
  Copy,
  Check,
  Eye,
  EyeOff,
  Trash2,
  Pencil,
  ExternalLink,
  SlidersHorizontal,
  Maximize2,
  CopyPlus,
  FolderInput,
} from 'lucide-react';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { cn, maskValue, truncateValue, formatDate } from '../lib/utils';
import type { Item, Category } from '../types';
import { CategoryColorName, CategoryLabel, Category as CategoryEnum } from '../types';

interface ItemCardProps {
  item: Item;
  index: number;
  isRevealed: boolean;
  isCopied: boolean;
  isSelected: boolean;
  isFocused?: boolean;
  onCopy: (value: string, itemId: string) => void;
  onEdit: (item: Item) => void;
  onDelete: (id: string, name: string) => void;
  onDuplicate?: (item: Item) => void;
  onMoveCategory?: (id: string, category: Category) => void;
  onToggleFavorite: (id: string, current: boolean) => void;
  onToggleReveal: (id: string) => void;
  onSelect: (id: string) => void;
  onOpenExternal?: (url: string) => void;
  onOpenParamDialog?: (item: Item) => void;
  onOpenPromptDialog?: (item: Item) => void;
  onTagClick?: (tag: string) => void;
  onActivity: () => void;
  disableAnimation?: boolean;
}

const categoryIcons: Record<string, React.ElementType> = {
  api: KeyRound,
  prompt: MessageSquareText,
  command: Terminal,
  link: Link,
  keypair: KeySquare,
};

export function ItemCard({
  item,
  index,
  isRevealed,
  isCopied,
  isSelected,
  isFocused = false,
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
  disableAnimation = false,
}: ItemCardProps) {
  const colorClass = CategoryColorName[item.category];
  const Icon = categoryIcons[item.category];
  const hasCommandParams = item.category === 'command' && /\{\{([^}]+)\}\}/.test(item.value);
  const [contextOpen, setContextOpen] = React.useState(false);
  const [contextPos, setContextPos] = React.useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [copiedField, setCopiedField] = React.useState<'value' | 'publicKey' | null>(null);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextPos({ x: e.clientX, y: e.clientY });
    setContextOpen(true);
    onActivity();
  };

  const handleCopyJson = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const data = JSON.stringify(
      {
        name: item.name,
        value: item.value,
        publicKey: item.publicKey,
        category: item.category,
        description: item.description,
        tags: item.tags,
      },
      null,
      2
    );
    onCopy(data, item.id);
  };

  return (
    <>
      <div
        className={cn(
          'group flex items-center gap-3 rounded-lg border border-border-default bg-surface-raised px-3 py-2.5 transition-all duration-150 cursor-pointer select-none',
          isSelected && 'border-category-all/50 bg-category-all/5',
          isFocused && 'ring-2 ring-border-focus',
          !isSelected && 'hover:bg-surface-hover hover:shadow-sm',
          !disableAnimation && 'animate-fade-in-up'
        )}
        style={{
          borderLeftWidth: '3px',
          borderLeftColor: item.favorite
            ? 'var(--color-category-all)'
            : `var(--color-category-${colorClass})`,
          animationDelay: disableAnimation ? '0ms' : `${Math.min(index * 20, 300)}ms`,
        }}
        onClick={(e) => {
          if (e.ctrlKey || e.metaKey) {
            onSelect(item.id);
          }
          onActivity();
        }}
        onContextMenu={handleContextMenu}
      >
        {/* Category Icon */}
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
          style={{
            backgroundColor: `color-mix(in srgb, var(--color-category-${colorClass}) 15%, transparent)`,
          }}
        >
          {Icon && <Icon className={cn('h-4 w-4', `text-category-${colorClass}`)} />}
        </div>

        {/* Content Info */}
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
              {(item.category === 'api' || item.category === 'keypair') && !isRevealed
                ? maskValue(item.value)
                : truncateValue(item.value, 45)}
            </span>
            <span className="text-[10px] text-text-muted shrink-0">
              {formatDate(item.updatedAt || item.createdAt)}
            </span>
          </div>

          {/* Tags Pills */}
          {item.tags && item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {item.tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onTagClick?.(tag);
                  }}
                  className="inline-flex items-center text-[10px] text-text-muted bg-surface-overlay/80 hover:text-text-primary hover:bg-surface-hover rounded px-1.5 py-0.2 cursor-pointer border border-border-default/40"
                  title={`Filtrar por tag #${tag}`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {/* Link category: Open in browser */}
          {item.category === 'link' && onOpenExternal && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-category-link hover:text-category-link"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenExternal(item.value);
                  }}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Abrir no navegador</TooltipContent>
            </Tooltip>
          )}

          {/* Command category with template params */}
          {hasCommandParams && onOpenParamDialog && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-category-command hover:text-category-command"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenParamDialog(item);
                  }}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Preencher parâmetros</TooltipContent>
            </Tooltip>
          )}

          {/* Prompt category: Expanded view */}
          {item.category === 'prompt' && onOpenPromptDialog && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-category-prompt hover:text-category-prompt"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenPromptDialog(item);
                  }}
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Ver prompt expandido</TooltipContent>
            </Tooltip>
          )}

          {/* API / keypair: Reveal / Mask */}
          {(item.category === 'api' || item.category === 'keypair') && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleReveal(item.id);
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

          {/* Copy public key (keypair only) */}
          {item.category === 'keypair' && item.publicKey && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCopiedField('publicKey');
                    onCopy(item.publicKey, item.id);
                  }}
                >
                  {isCopied && copiedField === 'publicKey' ? (
                    <Check className="h-3.5 w-3.5 text-success" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copiar chave pública</TooltipContent>
            </Tooltip>
          )}

          {/* Copy private value: keypair requires reveal first */}
          {(item.category !== 'keypair' || isRevealed) && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCopiedField('value');
                    onCopy(item.value, item.id);
                  }}
                >
                  {isCopied && copiedField !== 'publicKey' ? (
                    <Check className="h-3.5 w-3.5 text-success" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {item.category === 'keypair' ? 'Copiar chave privada' : 'Copiar'}
              </TooltipContent>
            </Tooltip>
          )}

          {/* Favorite Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite(item.id, item.favorite);
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

          {/* Edit Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(item);
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Editar</TooltipContent>
          </Tooltip>

          {/* Delete Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(item.id, item.name);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Excluir</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Context Menu Dropdown */}
      <DropdownMenu open={contextOpen} onOpenChange={setContextOpen}>
        <DropdownMenuTrigger asChild>
          <div
            style={{
              position: 'fixed',
              left: `${contextPos.x}px`,
              top: `${contextPos.y}px`,
              width: 1,
              height: 1,
              pointerEvents: 'none',
            }}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          {(item.category !== 'keypair' || isRevealed) && (
            <DropdownMenuItem
              onClick={() => {
                setCopiedField('value');
                onCopy(item.value, item.id);
              }}
            >
              <Copy className="h-3.5 w-3.5 mr-2" />
              {item.category === 'keypair' ? 'Copiar chave privada' : 'Copiar valor'}
            </DropdownMenuItem>
          )}
          {item.category === 'keypair' && item.publicKey && (
            <DropdownMenuItem
              onClick={() => {
                setCopiedField('publicKey');
                onCopy(item.publicKey, item.id);
              }}
            >
              <Copy className="h-3.5 w-3.5 mr-2 text-text-muted" />
              Copiar chave pública
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => onCopy(item.name, item.id)}>
            <Copy className="h-3.5 w-3.5 mr-2 text-text-muted" />
            Copiar nome
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleCopyJson}>
            <CopyPlus className="h-3.5 w-3.5 mr-2" />
            Copiar como JSON
          </DropdownMenuItem>

          {item.category === 'link' && onOpenExternal && (
            <DropdownMenuItem onClick={() => onOpenExternal(item.value)}>
              <ExternalLink className="h-3.5 w-3.5 mr-2 text-category-link" />
              Abrir no navegador
            </DropdownMenuItem>
          )}

          {hasCommandParams && onOpenParamDialog && (
            <DropdownMenuItem onClick={() => onOpenParamDialog(item)}>
              <SlidersHorizontal className="h-3.5 w-3.5 mr-2 text-category-command" />
              Preencher parâmetros
            </DropdownMenuItem>
          )}

          {item.category === 'prompt' && onOpenPromptDialog && (
            <DropdownMenuItem onClick={() => onOpenPromptDialog(item)}>
              <Maximize2 className="h-3.5 w-3.5 mr-2 text-category-prompt" />
              Ver prompt expandido
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          {onDuplicate && (
            <DropdownMenuItem onClick={() => onDuplicate(item)}>
              <CopyPlus className="h-3.5 w-3.5 mr-2" />
              Duplicar item
            </DropdownMenuItem>
          )}

          {onMoveCategory && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <FolderInput className="h-3.5 w-3.5 mr-2" />
                Mover categoria
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {CategoryEnum.options.map((cat) => (
                  <DropdownMenuItem
                    key={cat}
                    disabled={cat === item.category}
                    onClick={() => onMoveCategory(item.id, cat)}
                  >
                    {CategoryLabel[cat]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}

          <DropdownMenuItem onClick={() => onEdit(item)}>
            <Pencil className="h-3.5 w-3.5 mr-2" />
            Editar item
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={() => onDelete(item.id, item.name)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5 mr-2" />
            Excluir item
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
