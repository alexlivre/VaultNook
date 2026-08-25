import * as React from 'react';
import { Search, Star, ArrowUpDown, ShieldCheck } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { cn } from '../lib/utils';
import type { SortOption } from '../types';

interface VaultToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  favoritesFirst: boolean;
  onToggleFavoritesFirst: () => void;
  sortOption: SortOption;
  onSortChange: (sort: SortOption) => void;
  onOpenAudit: () => void;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
}

const sortLabels: Record<SortOption, string> = {
  recent: 'Mais recentes',
  updated: 'Modificados recentemente',
  'name-asc': 'Nome (A → Z)',
  'name-desc': 'Nome (Z → A)',
  favorites: 'Favoritos no topo',
};

export function VaultToolbar({
  searchQuery,
  onSearchChange,
  favoritesFirst,
  onToggleFavoritesFirst,
  sortOption,
  onSortChange,
  onOpenAudit,
  searchInputRef,
}: VaultToolbarProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 shrink-0">
      {/* Search Input */}
      <div className="relative flex-1">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        <Input
          ref={searchInputRef}
          placeholder="Buscar... (dica: cat:api, tag:prod, is:fav)"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-8 pr-7 h-8 text-sm"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary text-xs cursor-pointer"
          >
            ✕
          </button>
        )}
      </div>

      {/* Sort Menu */}
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowUpDown className="h-4 w-4 text-text-muted hover:text-text-primary" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>Ordenar: {sortLabels[sortOption]}</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" className="w-52">
          {(['recent', 'updated', 'name-asc', 'name-desc', 'favorites'] as SortOption[]).map((opt) => (
            <DropdownMenuItem
              key={opt}
              onClick={() => onSortChange(opt)}
              className={cn(sortOption === opt && 'font-semibold text-category-all')}
            >
              {sortLabels[opt]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Audit Vault Security Button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-text-muted hover:text-category-all"
            onClick={onOpenAudit}
          >
            <ShieldCheck className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Auditoria de segurança</TooltipContent>
      </Tooltip>

      {/* Favorites Toggle */}
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
          {favoritesFirst ? 'Favoritos priorizados' : 'Priorizar favoritos'}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
