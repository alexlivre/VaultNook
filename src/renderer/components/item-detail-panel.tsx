import * as React from 'react';
import {
  Copy,
  Check,
  Eye,
  EyeOff,
  Star,
  Pencil,
  Trash2,
  CopyPlus,
  ExternalLink,
  SlidersHorizontal,
  Maximize2,
} from 'lucide-react';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { cn, maskValue, getPasswordStrength, formatRelativeTime, hasCommandParams, itemToJson } from '../lib/utils';
import type { Item } from '../types';
import { categoryMeta } from './category-icon';

interface ItemDetailPanelProps {
  item: Item | null;
  isRevealed: boolean;
  isCopied: boolean;
  onCopy: (value: string, itemId: string) => void;
  onEdit: (item: Item) => void;
  onDelete: (id: string, name: string) => void;
  onDuplicate: (item: Item) => void;
  onToggleFavorite: (id: string, current: boolean) => void;
  onToggleReveal: (id: string) => void;
  onOpenExternal: (url: string) => void;
  onOpenParamDialog: (item: Item) => void;
  onOpenPromptDialog: (item: Item) => void;
}

export function ItemDetailPanel({
  item,
  isRevealed,
  isCopied,
  onCopy,
  onEdit,
  onDelete,
  onDuplicate,
  onToggleFavorite,
  onToggleReveal,
  onOpenExternal,
  onOpenParamDialog,
  onOpenPromptDialog,
}: ItemDetailPanelProps) {
  if (!item) {
    return (
      <aside
        className="w-72 shrink-0 flex-col border-l border-border-default bg-surface-base/50 hidden lg:flex"
        aria-label="Detalhe do item"
      >
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-raised mb-3">
            <Copy className="h-5 w-5 text-text-muted" />
          </div>
          <p className="text-sm font-medium text-text-secondary">Nenhum item selecionado</p>
          <p className="mt-1 text-xs text-text-muted">Clique em um item para ver os detalhes</p>
        </div>
      </aside>
    );
  }

  const meta = categoryMeta[item.category];
  const showParams = item.category === 'command' && hasCommandParams(item.value);
  const isSecret = item.category === 'api' || item.category === 'keypair';
  const displayedValue = isSecret && !isRevealed ? maskValue(item.value) : item.value;
  const strength = item.category === 'api' ? getPasswordStrength(item.value) : null;
  const updatedTs = item.updatedAt || item.createdAt;
  const isStale = Date.now() - updatedTs > 4320 * 60 * 60 * 1000;

  const handleCopyJson = () => {
    onCopy(itemToJson(item), item.id);
  };

  return (
    <aside
      className="w-72 shrink-0 flex-col border-l border-border-default bg-surface-base/50 hidden lg:flex"
      aria-label="Detalhe do item"
    >
      {/* Header */}
      <div className="border-b border-border-default px-4 pb-3 pt-4">
        <span
          className="mb-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
          style={{
            color: meta.cssVar,
            backgroundColor: `color-mix(in srgb, ${meta.cssVar} 12%, transparent)`,
            borderColor: `color-mix(in srgb, ${meta.cssVar} 35%, transparent)`,
          }}
        >
          <meta.icon className="h-3 w-3" />
          {meta.label}
        </span>
        <h3 className="break-words text-base font-semibold tracking-tight text-text-primary">
          {item.name}
        </h3>
        <p className="mt-1 text-[11px] text-text-muted">
          atualizado {formatRelativeTime(updatedTs)}
          {(item.tags?.length ?? 0) > 0 && ` · ${item.tags.map((t) => `#${t}`).join(' ')}`}
        </p>
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-text-muted">
          {item.category === 'keypair' ? 'Chave privada' : 'Valor'}
        </p>
        <div className="rounded-lg border border-border-default bg-black/40 p-3 font-secret text-xs leading-relaxed break-all text-text-primary select-text">
          {displayedValue}
        </div>

        <div className="mt-2 flex gap-1.5">
          <Button
            variant="primary"
            size="sm"
            className="h-9 flex-1 text-xs"
            onClick={() => onCopy(item.value, item.id)}
          >
            {isCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {isCopied ? 'Copiado!' : 'Copiar'}
          </Button>
          {isSecret && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => onToggleReveal(item.id)}
                >
                  {isRevealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
                className="h-9 w-9 shrink-0"
                onClick={() => onToggleFavorite(item.id, item.favorite)}
              >
                <Star className={cn('h-4 w-4', item.favorite && 'fill-brass text-brass')} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{item.favorite ? 'Desfavoritar' : 'Favoritar'}</TooltipContent>
          </Tooltip>
        </div>

        {item.category === 'link' && (
          <Button
            variant="outline"
            size="sm"
            className="mt-2 h-8 w-full text-xs text-category-link"
            onClick={() => onOpenExternal(item.value)}
          >
            <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
            Abrir no navegador
          </Button>
        )}
        {showParams && (
          <Button
            variant="outline"
            size="sm"
            className="mt-2 h-8 w-full text-xs text-category-command"
            onClick={() => onOpenParamDialog(item)}
          >
            <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" />
            Preencher parâmetros
          </Button>
        )}
        {item.category === 'prompt' && (
          <Button
            variant="outline"
            size="sm"
            className="mt-2 h-8 w-full text-xs text-category-prompt"
            onClick={() => onOpenPromptDialog(item)}
          >
            <Maximize2 className="h-3.5 w-3.5 mr-1.5" />
            Ver prompt expandido
          </Button>
        )}

        {item.category === 'keypair' && item.publicKey && (
          <>
            <p className="mb-1.5 mt-4 text-[10px] font-bold uppercase tracking-widest text-text-muted">
              Chave pública
            </p>
            <div className="rounded-lg border border-border-default bg-black/40 p-3 font-secret text-xs leading-relaxed break-all text-text-primary select-text">
              {item.publicKey}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-2 h-8 w-full text-xs"
              onClick={() => onCopy(item.publicKey, item.id)}
            >
              <Copy className="h-3.5 w-3.5 mr-1.5" />
              Copiar chave pública
            </Button>
          </>
        )}

        {item.description && (
          <>
            <p className="mb-1.5 mt-4 text-[10px] font-bold uppercase tracking-widest text-text-muted">
              Descrição
            </p>
            <p className="text-xs leading-relaxed text-text-secondary select-text">
              {item.description}
            </p>
          </>
        )}

        <p className="mb-1 mt-4 text-[10px] font-bold uppercase tracking-widest text-text-muted">
          Metadados
        </p>
        <div className="text-xs">
          <div className="flex justify-between border-b border-dashed border-border-default py-1.5">
            <span className="text-text-muted">Criado em</span>
            <span className="text-text-secondary">
              {new Date(item.createdAt).toLocaleDateString('pt-BR')}
            </span>
          </div>
          <div className="flex justify-between border-b border-dashed border-border-default py-1.5">
            <span className="text-text-muted">Última rotação</span>
            <span className={isStale ? 'text-warning' : 'text-text-secondary'}>
              {formatRelativeTime(updatedTs)}
            </span>
          </div>
          {strength && (
            <div className="flex justify-between py-1.5">
              <span className="text-text-muted">Força</span>
              <span className="font-medium" style={{ color: strength.color }}>
                {strength.label.toLowerCase()}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-1.5 border-t border-border-default p-3">
        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => onEdit(item)}>
          <Pencil className="h-3.5 w-3.5 mr-1.5" />
          Editar
        </Button>
        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => onDuplicate(item)}>
          <CopyPlus className="h-3.5 w-3.5 mr-1.5" />
          Duplicar
        </Button>
        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={handleCopyJson}>
          <Copy className="h-3.5 w-3.5 mr-1.5" />
          Copiar JSON
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs text-destructive hover:text-destructive"
          onClick={() => onDelete(item.id, item.name)}
        >
          <Trash2 className="h-3.5 w-3.5 mr-1.5" />
          Excluir
        </Button>
      </div>
    </aside>
  );
}
