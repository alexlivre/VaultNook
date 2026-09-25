import * as React from 'react';
import { Shield, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { WindowControls } from '../components/window-controls';
import { useVaultStore } from '../stores/vault-store';

interface RecoveryScreenProps {
  vaultId: string;
  vaultName: string;
  onRecovered: () => void;
  onBack: () => void;
}

export function RecoveryScreen({ vaultId, vaultName, onRecovered, onBack }: RecoveryScreenProps) {
  const [phrase, setPhrase] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('As senhas não conferem');
      return;
    }
    setLoading(true);
    try {
      const api = window.vaultNookApi;
      const result = await api.recover(vaultId, phrase, newPassword);
      const store = useVaultStore.getState();
      store.setItems(result.items);
      store.setActiveVaultId(result.vaultId);
      store.setActiveVaultName(vaultName);
      store.setIsLocked(false);
      onRecovered();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Frase de recuperação inválida');
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
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-secondary cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Voltar aos cofres
          </button>

          <div className="flex flex-col items-center gap-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border-default bg-surface-raised">
              <Shield className="h-8 w-8 text-brass" />
            </div>
            <h1 className="text-2xl font-semibold text-text-primary">Recuperar {vaultName}</h1>
            <p className="text-sm text-text-muted">Digite sua frase de recuperação e defina uma nova senha</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phrase">Frase de recuperação (12 palavras)</Label>
              <textarea
                id="phrase"
                value={phrase}
                onChange={(e) => setPhrase(e.target.value)}
                placeholder="palavra1 palavra2 ... palavra12"
                className="flex h-20 w-full rounded-md border border-border-default bg-surface-raised px-3 py-2 font-secret text-[13px] text-text-primary placeholder:text-text-muted placeholder:font-sans focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus resize-none"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">Nova senha mestra</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="Nova senha"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar nova senha</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="Repita a senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <Button type="submit" className="w-full h-10" disabled={loading || !phrase || !newPassword}>
              {loading ? 'Recuperando...' : 'Recuperar cofre'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
