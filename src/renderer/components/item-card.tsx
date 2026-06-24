import * as React from 'react';
import {
  KeyRound,
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
} from 'lucide-react';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { cn, maskValue, truncateValue, formatDate } from '../lib/utils';
import type { Item } from '../types';
import { CategoryColorName } from '../types';

interface ItemCardProps {
  item: Item;
  index: number;
  isRevealed: boolean;
  isCopied: boolean;
  isSelected: boolean;
  onCopy: (value: string, itemId: string) => void;
  onEdit: (item: Item) => void;
  onDelete: (id: string, name: string) => void;
  onToggleFavorite: (id: string, current: boolean) => void;
  onToggleReveal: (id: string) => void;
  onSelect: (id: string) => void;
  onActivity: () => void;
  disableAnimation?: boolean;
}

const categoryIcons: Record<string, React.ElementType> = {
  api: KeyRound,
  prompt: MessageSquareText,
  command: Terminal,
  link: Link,
};

export function ItemCard({
  item,
  index,
  isRevealed,
  isCopied,
  isSelected,
  onCopy,
  onEdit,
  onDelete,
  onToggleFavorite,
  onToggleReveal,
  onSelect,
  onActivity,
  disableAnimation = false,
}: ItemCardProps) {
  const colorClass = CategoryColorName[item.category];
  const Icon = categoryIcons[item.category];

  return (
    <div
      className={cn(
        'group flex items-center gap-3 rounded-lg border border-border-default bg-surface-raised px-3 py-2.5 transition-all duration-150 cursor-pointer',
        isSelected && 'border-category-all/50 bg-category-all/5',
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
        } else {
          onCopy(item.value, item.id);
        }
        onActivity();
      }}
      onContextMenu={(e) => {
        e.preventDefault();
      }}
    >
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
        style={{
          backgroundColor: `color-mix(in srgb, var(--color-category-${colorClass}) 15%, transparent)`,
        }}
      >
        {Icon && <Icon className={cn('h-4 w-4', `text-category-${colorClass}`)} />}
      </div>

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

      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {item.category === 'api' && (
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

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation();
                onCopy(item.value, item.id);
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
  );
}
