import * as React from 'react';
import { MessageSquareText, Copy, Check, Hash, Type } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { Button } from './ui/button';
import { useToast } from './toast-provider';
import type { Item } from '../types';

interface PromptViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: Item | null;
}

export function PromptViewDialog({ open, onOpenChange, item }: PromptViewDialogProps) {
  const { toast } = useToast();
  const [copied, setCopied] = React.useState(false);

  const stats = React.useMemo(() => {
    if (!item) return { chars: 0, words: 0, tokens: 0 };
    const chars = item.value.length;
    const words = item.value.trim().split(/\s+/).filter(Boolean).length;
    const tokens = Math.ceil(chars / 4);
    return { chars, words, tokens };
  }, [item]);

  const handleCopy = async () => {
    if (!item) return;
    try {
      await navigator.clipboard.writeText(item.value);
      setCopied(true);
      toast({ title: 'Prompt copiado!', variant: 'success' });
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: 'Erro ao copiar', variant: 'destructive' });
    }
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-category-prompt/15 text-category-prompt">
              <MessageSquareText className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="truncate">{item.name}</DialogTitle>
              <DialogDescription className="truncate">
                {item.description || 'Visualização completa do prompt de IA'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Prompt Content View */}
        <div className="flex-1 overflow-y-auto min-h-0 my-2 rounded-lg border border-border-default bg-surface-base p-4">
          <pre className="font-mono text-xs text-text-primary whitespace-pre-wrap break-words leading-relaxed select-text font-normal">
            {item.value}
          </pre>
        </div>

        {/* Footer & Stats */}
        <div className="flex items-center justify-between pt-2 border-t border-border-default shrink-0 text-xs text-text-muted">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Type className="h-3.5 w-3.5" />
              {stats.chars} caracteres
            </span>
            <span className="flex items-center gap-1">
              <Hash className="h-3.5 w-3.5" />
              ~{stats.words} palavras
            </span>
            <span className="rounded-md bg-category-prompt/10 text-category-prompt px-2 py-0.5 font-mono text-[11px]">
              ~{stats.tokens} tokens
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
            <Button variant="primary" size="sm" onClick={handleCopy}>
              {copied ? <Check className="h-4 w-4 mr-1 text-white" /> : <Copy className="h-4 w-4 mr-1" />}
              Copiar prompt
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
