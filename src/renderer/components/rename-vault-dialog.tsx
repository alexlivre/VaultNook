import * as React from 'react';
import { Pencil } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useToast } from './toast-provider';
import type { VaultEntry } from '../types';

export const VAULT_COLORS = [
  { label: 'Violeta', value: '#8b5cf6' },
  { label: 'Azul', value: '#3b82f6' },
  { label: 'Esmeralda', value: '#10b981' },
  { label: 'Âmbar', value: '#f59e0b' },
  { label: 'Rosa', value: '#f43f5e' },
  { label: 'Ciano', value: '#06b6d4' },
  { label: 'Índigo', value: '#6366f1' },
];

interface RenameVaultDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vault: VaultEntry | null;
  onRenamed: () => void;
}

export function RenameVaultDialog({ open, onOpenChange, vault, onRenamed }: RenameVaultDialogProps) {
  const { toast } = useToast();
  const [name, setName] = React.useState('');
  const [color, setColor] = React.useState<string>('#8b5cf6');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (vault) {
      setName(vault.name);
      setColor(vault.color || '#8b5cf6');
      setError('');
    }
  }, [vault, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vault) return;
    if (!name.trim()) {
      setError('Nome é obrigatório');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const api = window.devVaultApi;
      await api.renameVault(vault.id, name.trim(), color);
      toast({ title: 'Cofre atualizado com sucesso', variant: 'success' });
      onRenamed();
      onOpenChange(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao renomear cofre');
    } finally {
      setLoading(false);
    }
  };

  if (!vault) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-category-all/15 text-category-all">
              <Pencil className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle>Personalizar Cofre</DialogTitle>
              <DialogDescription>
                Altere o nome e a cor de identificação deste cofre
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="space-y-2">
            <Label htmlFor="vault-name">Nome do cofre</Label>
            <Input
              id="vault-name"
              placeholder="Ex: Trabalho, Pessoal, Finanças"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>Cor de Identificação</Label>
            <div className="flex items-center gap-2 pt-1">
              {VAULT_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className="h-7 w-7 rounded-full transition-transform cursor-pointer relative flex items-center justify-center"
                  style={{
                    backgroundColor: c.value,
                    transform: color === c.value ? 'scale(1.15)' : 'scale(1)',
                    boxShadow: color === c.value ? `0 0 0 2px var(--color-surface-base), 0 0 0 4px ${c.value}` : 'none',
                  }}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-border-default">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar alterações'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
