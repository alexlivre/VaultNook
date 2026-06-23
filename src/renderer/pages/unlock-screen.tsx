import * as React from 'react';
import { Lock, Shield, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { WindowControls } from '../components/window-controls';
import type { AutoLockOption } from '../stores/vault-store';

interface UnlockScreenProps {
  vaultId: string;
  vaultName: string;
  vaultHint: string;
  onUnlocked: () => void;
  onBack: () => void;
}

export function UnlockScreen({ vaultId, vaultName, vaultHint, onUnlocked, onBack }: UnlockScreenProps) {
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [attempts, setAttempts] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const api = window.devVaultApi;
      const result = await api.unlock(password, vaultId);
      const settings = await api.getSettings();
      const { useVaultStore } = await import('../stores/vault-store');
      useVaultStore.getState().setItems(result.items);
      useVaultStore.getState().setAutoLockTimer((settings.autoLockTimer ?? 60) as AutoLockOption);
      useVaultStore.getState().setActiveVaultId(result.vaultId);
      useVaultStore.getState().setActiveVaultName(vaultName);
      onUnlocked();
    } catch (err: any) {
      setAttempts((a) => a + 1);
      setError(err.message || 'Senha incorreta');
      inputRef.current?.focus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-surface-base">
      <header className="titlebar flex items-center justify-end h-11 shrink-0">
        <WindowControls />
      </header>
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
        {/* Back button */}
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-secondary cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar aos cofres
        </button>

        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-category-all/10">
            <Lock className="h-8 w-8 text-category-all" />
          </div>
          <h1 className="text-2xl font-semibold text-text-primary">{vaultName}</h1>
          <p className="text-sm text-text-muted">Digite sua senha mestra para desbloquear</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="password">Senha mestra</Label>
            <Input
              ref={inputRef}
              id="password"
              type="password"
              placeholder="Digite sua senha"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              className={error ? 'animate-shake border-destructive' : ''}
              autoFocus
            />
            {vaultHint && (
              <p className="text-xs text-text-muted mt-1">
                💡 Dica: {vaultHint}
              </p>
            )}
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3">
              <p className="text-sm text-destructive">
                {error}
                {attempts > 0 && ` (${attempts} tentativa${attempts > 1 ? 's' : ''})`}
              </p>
            </div>
          )}

          <Button
            type="submit"
            className="w-full h-10"
            disabled={!password || loading}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Shield className="h-4 w-4 animate-spin" />
                Desbloqueando...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Desbloquear
              </span>
            )}
          </Button>
        </form>
        </div>
      </div>
    </div>
  );
}
