import * as React from 'react';
import { AlertTriangle, Check, Info, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { cn } from '../lib/utils';

const CONFIRM_WORD = 'Sim';

export function matchesConfirmWord(input: string, word: string): boolean {
  return input.trim().localeCompare(word.trim(), undefined, { sensitivity: 'accent' }) === 0;
}

interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemName: string;
  onConfirm: () => void;
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  itemName,
  onConfirm,
}: DeleteConfirmDialogProps) {
  const [confirmation, setConfirmation] = React.useState('');

  React.useEffect(() => {
    if (!open) setConfirmation('');
  }, [open]);

  const matches = matchesConfirmWord(confirmation, CONFIRM_WORD);
  const showError = !matches && confirmation.trim().length > 0;

  const handleConfirm = () => {
    if (!matches) return;
    onConfirm();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Excluir item</DialogTitle>
          <DialogDescription>Esta ação remove o item do cofre.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-text-secondary">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
            <span>
              "{itemName}" será removido do cofre e o valor será perdido.
            </span>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs text-text-muted">
              Digite a palavra de confirmação abaixo para continuar.
            </p>
            <div className="flex items-center gap-2">
              <Input
                autoFocus
                autoComplete="off"
                spellCheck={false}
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleConfirm();
                }}
                aria-invalid={showError}
                className={cn('flex-1', matches && 'border-success', showError && 'border-destructive')}
              />
              <span
                className="flex h-9 shrink-0 items-center rounded-md border border-brass/50 bg-brass/10 px-3 text-xs font-semibold text-brass"
                aria-hidden="true"
              >
                {CONFIRM_WORD}
              </span>
            </div>
            {showError && (
              <p className="flex items-center gap-1.5 text-xs text-destructive">
                <Info className="h-3.5 w-3.5 shrink-0" />
                A palavra de confirmação não confere.
              </p>
            )}
            {matches && (
              <p className="flex items-center gap-1.5 text-xs text-success">
                <Check className="h-3.5 w-3.5 shrink-0" />
                Confere
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" disabled={!matches} onClick={handleConfirm}>
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Excluir
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
