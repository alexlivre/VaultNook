import * as React from 'react';
import { Lock, Shield } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

interface UnlockScreenProps {
  onUnlocked: () => void;
}

export function UnlockScreen({ onUnlocked }: UnlockScreenProps) {
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
      const api = (window as any).devVaultApi;
      const result = await api.unlock(password);
      // Store items in the Zustand store
      const { useVaultStore } = await import('../stores/vault-store');
      useVaultStore.getState().setItems(result.items);
      useVaultStore.getState().setAutoLockTimer(result.info?.settings?.autoLockTimer ?? 60);
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
    <div className="flex min-h-screen items-center justify-center bg-surface-base p-8">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-category-all/10">
            <Lock className="h-8 w-8 text-category-all" />
          </div>
          <h1 className="text-2xl font-semibold text-text-primary">DevVault</h1>
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
  );
}
