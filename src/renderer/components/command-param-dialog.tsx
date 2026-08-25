import * as React from 'react';
import { Terminal, Copy, Check } from 'lucide-react';
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
import type { Item } from '../types';

interface CommandParamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: Item | null;
}

export function CommandParamDialog({ open, onOpenChange, item }: CommandParamDialogProps) {
  const { toast } = useToast();
  const [params, setParams] = React.useState<Record<string, string>>({});
  const [copied, setCopied] = React.useState(false);

  // Extract variables like {{HOST}} or {{port}}
  const paramNames = React.useMemo(() => {
    if (!item || !item.value) return [];
    const matches = item.value.match(/\{\{([^}]+)\}\}/g);
    if (!matches) return [];
    const unique = new Set(matches.map((m) => m.slice(2, -2).trim()));
    return Array.from(unique);
  }, [item]);

  React.useEffect(() => {
    if (open && paramNames.length > 0) {
      const initial: Record<string, string> = {};
      paramNames.forEach((p) => {
        initial[p] = '';
      });
      setParams(initial);
      setCopied(false);
    }
  }, [open, paramNames]);

  const resolvedCommand = React.useMemo(() => {
    if (!item) return '';
    let result = item.value;
    for (const [key, val] of Object.entries(params)) {
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      result = result.replace(regex, val || `{{${key}}}`);
    }
    return result;
  }, [item, params]);

  const handleCopy = async () => {
    if (!resolvedCommand) return;
    try {
      await navigator.clipboard.writeText(resolvedCommand);
      setCopied(true);
      toast({ title: 'Comando copiado com parâmetros!', variant: 'success' });
      setTimeout(() => setCopied(false), 1500);
      onOpenChange(false);
    } catch {
      toast({ title: 'Erro ao copiar', variant: 'destructive' });
    }
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-category-command/15 text-category-command">
              <Terminal className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle>Preencher Parâmetros do Comando</DialogTitle>
              <DialogDescription>
                Substitua as variáveis antes de copiar ou executar o comando
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Parameter Inputs */}
          <div className="space-y-3 max-h-48 overflow-y-auto px-1">
            {paramNames.map((paramName) => (
              <div key={paramName} className="space-y-1">
                <Label className="text-xs font-mono text-category-command">{`{{${paramName}}}`}</Label>
                <Input
                  placeholder={`Valor para ${paramName}`}
                  value={params[paramName] || ''}
                  onChange={(e) =>
                    setParams((prev) => ({ ...prev, [paramName]: e.target.value }))
                  }
                  className="h-8 text-xs font-mono"
                  autoFocus={paramNames[0] === paramName}
                />
              </div>
            ))}
          </div>

          {/* Live Preview */}
          <div className="space-y-1.5">
            <Label className="text-xs text-text-muted">Prévia do Comando Final</Label>
            <div className="rounded-lg border border-border-default bg-surface-base p-3">
              <pre className="font-mono text-xs text-text-primary whitespace-pre-wrap break-all select-all">
                {resolvedCommand}
              </pre>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border-default">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button variant="primary" size="sm" onClick={handleCopy}>
              {copied ? <Check className="h-4 w-4 mr-1 text-white" /> : <Copy className="h-4 w-4 mr-1" />}
              Copiar comando
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
