import * as React from 'react';
import { Dice5, Copy, Check, Sparkles, RefreshCw, KeyRound } from 'lucide-react';
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { generateCustomPassword, generatePassphrase, getPasswordStrength } from '../lib/utils';
import { useToast } from './toast-provider';

interface PasswordGeneratorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectPassword?: (password: string) => void;
}

export function PasswordGeneratorDialog({
  open,
  onOpenChange,
  onSelectPassword,
}: PasswordGeneratorDialogProps) {
  const { toast } = useToast();
  const [tab, setTab] = React.useState<'password' | 'passphrase'>('password');

  // Password options
  const [length, setLength] = React.useState(24);
  const [uppercase, setUppercase] = React.useState(true);
  const [lowercase, setLowercase] = React.useState(true);
  const [numbers, setNumbers] = React.useState(true);
  const [symbols, setSymbols] = React.useState(true);

  // Passphrase options
  const [wordCount, setWordCount] = React.useState(4);
  const [separator, setSeparator] = React.useState('-');
  const [capitalize, setCapitalize] = React.useState(true);
  const [includeNumber, setIncludeNumber] = React.useState(true);

  const [generatedValue, setGeneratedValue] = React.useState('');
  const [copied, setCopied] = React.useState(false);

  const regenerate = React.useCallback(() => {
    if (tab === 'password') {
      const pwd = generateCustomPassword({ length, uppercase, lowercase, numbers, symbols });
      setGeneratedValue(pwd);
    } else {
      const pass = generatePassphrase(wordCount, separator, capitalize, includeNumber);
      setGeneratedValue(pass);
    }
  }, [tab, length, uppercase, lowercase, numbers, symbols, wordCount, separator, capitalize, includeNumber]);

  React.useEffect(() => {
    if (open) {
      regenerate();
    }
  }, [open, regenerate]);

  const strength = React.useMemo(() => {
    return getPasswordStrength(generatedValue);
  }, [generatedValue]);

  const handleCopy = async () => {
    if (!generatedValue) return;
    await navigator.clipboard.writeText(generatedValue);
    setCopied(true);
    toast({ title: 'Copiado para área de transferência', variant: 'success' });
    setTimeout(() => setCopied(false), 1500);
  };

  const handleApply = () => {
    if (onSelectPassword && generatedValue) {
      onSelectPassword(generatedValue);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-category-api/15 text-category-api">
              <Dice5 className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle>Gerador Avançado de Senhas</DialogTitle>
              <DialogDescription>
                Crie credenciais criptograficamente seguras ou frases memoráveis
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Generated Result Preview */}
          <div className="rounded-lg border border-border-default bg-surface-base p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={generatedValue}
                className="font-mono text-sm tracking-wide bg-surface-raised border-border-default select-all"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={regenerate}
                title="Gerar nova"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="primary"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={handleCopy}
                title="Copiar"
              >
                {copied ? <Check className="h-4 w-4 text-white" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>

            {/* Strength Meter */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-1.5 flex-1 max-w-[200px]">
                {[1, 2, 3, 4, 5].map((lvl) => (
                  <div
                    key={lvl}
                    className="h-1.5 flex-1 rounded-full transition-all duration-300"
                    style={{
                      backgroundColor:
                        lvl <= strength.score
                          ? strength.color
                          : 'var(--color-border-default)',
                    }}
                  />
                ))}
              </div>
              <span className="text-xs font-medium" style={{ color: strength.color }}>
                {strength.label}
              </span>
            </div>
          </div>

          <Tabs value={tab} onValueChange={(v) => setTab(v as 'password' | 'passphrase')}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="password" className="text-xs">
                <KeyRound className="h-3.5 w-3.5 mr-1.5" />
                Senha Aleatória
              </TabsTrigger>
              <TabsTrigger value="passphrase" className="text-xs">
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                Frase Memorável
              </TabsTrigger>
            </TabsList>

            {/* Tab: Random Password */}
            <TabsContent value="password" className="space-y-3 pt-2">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <Label>Comprimento</Label>
                  <span className="font-mono text-text-secondary">{length} caracteres</span>
                </div>
                <input
                  type="range"
                  min="8"
                  max="64"
                  value={length}
                  onChange={(e) => setLength(Number(e.target.value))}
                  className="w-full accent-category-all h-1.5 bg-surface-raised rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                <label className="flex items-center gap-2 rounded-md border border-border-default p-2 cursor-pointer hover:bg-surface-hover">
                  <input
                    type="checkbox"
                    checked={uppercase}
                    onChange={(e) => setUppercase(e.target.checked)}
                    className="rounded accent-category-all"
                  />
                  <span>Maiúsculas (A-Z)</span>
                </label>
                <label className="flex items-center gap-2 rounded-md border border-border-default p-2 cursor-pointer hover:bg-surface-hover">
                  <input
                    type="checkbox"
                    checked={lowercase}
                    onChange={(e) => setLowercase(e.target.checked)}
                    className="rounded accent-category-all"
                  />
                  <span>Minúsculas (a-z)</span>
                </label>
                <label className="flex items-center gap-2 rounded-md border border-border-default p-2 cursor-pointer hover:bg-surface-hover">
                  <input
                    type="checkbox"
                    checked={numbers}
                    onChange={(e) => setNumbers(e.target.checked)}
                    className="rounded accent-category-all"
                  />
                  <span>Números (0-9)</span>
                </label>
                <label className="flex items-center gap-2 rounded-md border border-border-default p-2 cursor-pointer hover:bg-surface-hover">
                  <input
                    type="checkbox"
                    checked={symbols}
                    onChange={(e) => setSymbols(e.target.checked)}
                    className="rounded accent-category-all"
                  />
                  <span>Símbolos (!@#$)</span>
                </label>
              </div>
            </TabsContent>

            {/* Tab: Memorable Passphrase */}
            <TabsContent value="passphrase" className="space-y-3 pt-2">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <Label>Quantidade de palavras</Label>
                  <span className="font-mono text-text-secondary">{wordCount} palavras</span>
                </div>
                <input
                  type="range"
                  min="3"
                  max="6"
                  value={wordCount}
                  onChange={(e) => setWordCount(Number(e.target.value))}
                  className="w-full accent-category-all h-1.5 bg-surface-raised rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="space-y-1">
                  <Label className="text-xs">Separador</Label>
                  <select
                    value={separator}
                    onChange={(e) => setSeparator(e.target.value)}
                    className="w-full h-8 rounded-md border border-border-default bg-surface-raised px-2 text-xs text-text-primary focus:outline-none"
                  >
                    <option value="-">Hífen (-)</option>
                    <option value=".">Ponto (.)</option>
                    <option value="_">Underline (_)</option>
                    <option value=" ">Espaço ( )</option>
                  </select>
                </div>
                <div className="flex flex-col justify-end space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={capitalize}
                      onChange={(e) => setCapitalize(e.target.checked)}
                      className="rounded accent-category-all"
                    />
                    <span>Capitalizar</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeNumber}
                      onChange={(e) => setIncludeNumber(e.target.checked)}
                      className="rounded accent-category-all"
                    />
                    <span>Adicionar número</span>
                  </label>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Footer Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t border-border-default">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
            {onSelectPassword && (
              <Button variant="primary" size="sm" onClick={handleApply}>
                Usar esta senha
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
