import * as React from 'react';
import { Copy, Download } from 'lucide-react';
import { Button } from './ui/button';
import { useToast } from './toast-provider';

interface RecoveryPhraseActionsProps {
  phrase: string;
}

export function RecoveryPhraseActions({ phrase }: RecoveryPhraseActionsProps) {
  const { toast } = useToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(phrase);
      toast({ title: 'Frase copiada!', variant: 'success' });
    } catch {
      toast({ title: 'Erro ao copiar', variant: 'destructive' });
    }
  };

  const handleSave = async () => {
    try {
      const saved = await window.vaultNookApi.saveRecoveryPhrase(phrase);
      if (saved) toast({ title: 'Frase salva em arquivo', variant: 'success' });
    } catch {
      toast({ title: 'Erro ao salvar', variant: 'destructive' });
    }
  };

  return (
    <div className="flex gap-2">
      <Button variant="outline" className="flex-1 h-10" onClick={handleCopy}>
        <Copy className="h-4 w-4 mr-2" />
        Copiar
      </Button>
      <Button variant="outline" className="flex-1 h-10" onClick={handleSave}>
        <Download className="h-4 w-4 mr-2" />
        Salvar em .txt
      </Button>
    </div>
  );
}
