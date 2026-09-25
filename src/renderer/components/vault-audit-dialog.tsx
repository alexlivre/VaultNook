import * as React from 'react';
import { ShieldCheck, ShieldAlert, AlertTriangle, Clock, Pencil, KeyRound } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { Button } from './ui/button';
import { useVaultStore } from '../stores/vault-store';
import { calculateSecretAudit, formatRelativeTime, maskValue } from '../lib/utils';
import type { Item } from '../types';

interface VaultAuditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditItem: (item: Item) => void;
}

export function VaultAuditDialog({ open, onOpenChange, onEditItem }: VaultAuditDialogProps) {
  const { items } = useVaultStore();
  const [filterType, setFilterType] = React.useState<'all' | 'weak' | 'duplicate' | 'stale'>('all');

  const audit = React.useMemo(() => {
    return calculateSecretAudit(items);
  }, [items]);

  const displayedItems = React.useMemo(() => {
    switch (filterType) {
      case 'weak':
        return audit.weakItems;
      case 'duplicate':
        return audit.duplicateItems;
      case 'stale':
        return audit.staleItems;
      case 'all':
      default: {
        const set = new Set<string>();
        const combined: Item[] = [];
        [...audit.weakItems, ...audit.duplicateItems, ...audit.staleItems].forEach((it) => {
          if (!set.has(it.id)) {
            set.add(it.id);
            combined.push(it);
          }
        });
        return combined;
      }
    }
  }, [audit, filterType]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-success';
    if (score >= 50) return 'text-warning';
    return 'text-destructive';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brass/15 text-brass">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle>Auditoria de Segurança dos Segredos</DialogTitle>
              <DialogDescription>
                Análise de integridade, força e idade das suas credenciais (100% offline)
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Health Score Banner */}
          <div className="flex items-center justify-between rounded-lg border border-border-default bg-surface-base p-4">
            <div className="space-y-1">
              <span className="text-xs text-text-muted">Pontuação Geral do Cofre</span>
              <p className="text-sm font-medium text-text-primary">
                {audit.totalSecrets === 0
                  ? 'Nenhuma API key cadastrada'
                  : audit.healthScore >= 80
                  ? 'Excelente nível de proteção'
                  : audit.healthScore >= 50
                  ? 'Atenção necessária em algumas chaves'
                  : 'Risco alto: senhas fracas ou reutilizadas'}
              </p>
            </div>
            <div className="text-right">
              <span className={`text-2xl font-bold font-mono ${getScoreColor(audit.healthScore)}`}>
                {audit.healthScore}%
              </span>
            </div>
          </div>

          {/* Metric Cards */}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setFilterType(filterType === 'weak' ? 'all' : 'weak')}
              className={`rounded-lg border p-3 text-left transition-colors cursor-pointer ${
                filterType === 'weak'
                  ? 'border-destructive bg-destructive/10'
                  : 'border-border-default bg-surface-raised hover:bg-surface-hover'
              }`}
            >
              <div className="flex items-center gap-1.5 text-destructive mb-1">
                <ShieldAlert className="h-3.5 w-3.5" />
                <span className="text-xs font-semibold">Fracos</span>
              </div>
              <p className="text-lg font-bold text-text-primary">{audit.weakCount}</p>
            </button>

            <button
              onClick={() => setFilterType(filterType === 'duplicate' ? 'all' : 'duplicate')}
              className={`rounded-lg border p-3 text-left transition-colors cursor-pointer ${
                filterType === 'duplicate'
                  ? 'border-warning bg-warning/10'
                  : 'border-border-default bg-surface-raised hover:bg-surface-hover'
              }`}
            >
              <div className="flex items-center gap-1.5 text-warning mb-1">
                <AlertTriangle className="h-3.5 w-3.5" />
                <span className="text-xs font-semibold">Duplicados</span>
              </div>
              <p className="text-lg font-bold text-text-primary">{audit.duplicateCount}</p>
            </button>

            <button
              onClick={() => setFilterType(filterType === 'stale' ? 'all' : 'stale')}
              className={`rounded-lg border p-3 text-left transition-colors cursor-pointer ${
                filterType === 'stale'
                  ? 'border-brass bg-brass/10'
                  : 'border-border-default bg-surface-raised hover:bg-surface-hover'
              }`}
            >
              <div className="flex items-center gap-1.5 text-brass mb-1">
                <Clock className="h-3.5 w-3.5" />
                <span className="text-xs font-semibold">&gt; 180 dias</span>
              </div>
              <p className="text-lg font-bold text-text-primary">{audit.staleCount}</p>
            </button>
          </div>

          {/* List of Flagged Items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-text-muted">
              <span>
                {filterType === 'all'
                  ? `Todos os itens com alertas (${displayedItems.length})`
                  : filterType === 'weak'
                  ? `Segredos com baixa complexidade (${displayedItems.length})`
                  : filterType === 'duplicate'
                  ? `Segredos reutilizados (${displayedItems.length})`
                  : `Segredos sem rotação há mais de 180 dias (${displayedItems.length})`}
              </span>
              {filterType !== 'all' && (
                <button
                  onClick={() => setFilterType('all')}
                  className="text-brass hover:underline cursor-pointer"
                >
                  Ver todos
                </button>
              )}
            </div>

            <div className="max-h-56 overflow-y-auto space-y-1.5 rounded-lg border border-border-default bg-surface-base p-2">
              {displayedItems.length === 0 ? (
                <div className="p-4 text-center text-xs text-text-muted">
                  Nenhum segredo vulnerável encontrado nesta categoria! 🎉
                </div>
              ) : (
                displayedItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-border-default bg-surface-raised px-3 py-2 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <KeyRound className="h-3.5 w-3.5 text-category-api shrink-0" />
                      <div className="min-w-0 flex-1">
                        <span className="font-medium text-text-primary truncate block">
                          {item.name}
                        </span>
                        <span className="text-[11px] text-text-muted font-mono truncate block">
                          {maskValue(item.value)} · Atualizado {formatRelativeTime(item.updatedAt || item.createdAt)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => {
                          onOpenChange(false);
                          onEditItem(item);
                        }}
                        title="Editar item"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-border-default">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
