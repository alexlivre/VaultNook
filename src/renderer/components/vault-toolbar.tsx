import * as React from 'react';
import { Search, Star } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { cn } from '../lib/utils';

interface VaultToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  favoritesFirst: boolean;
  onToggleFavoritesFirst: () => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
}

export function VaultToolbar({
  searchQuery,
  onSearchChange,
  favoritesFirst,
  onToggleFavoritesFirst,
  searchInputRef,
}: VaultToolbarProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 shrink-0">
      <div className="relative flex-1">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        <Input
          ref={searchInputRef}
          placeholder="Buscar itens... (cat:api termo para filtrar)"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-8 h-8 text-sm"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
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
            onClick={onToggleFavoritesFirst}
          >
            <Star className={cn('h-4 w-4', favoritesFirst && 'fill-current')} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {favoritesFirst ? 'Mostrar ordem normal' : 'Favoritos primeiro'}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
