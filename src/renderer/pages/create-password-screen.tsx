import * as React from 'react';
import { Lock, Shield } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Progress } from '../components/ui/progress';
import { getPasswordStrength } from '../lib/utils';

interface CreatePasswordScreenProps {
  onCreated: () => void;
}

export function CreatePasswordScreen({ onCreated }: CreatePasswordScreenProps) {
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const strength = getPasswordStrength(password);
  const requirements = [
    { label: 'Mínimo 8 caracteres', met: password.length >= 8 },
    { label: 'Letra maiúscula', met: /[A-Z]/.test(password) },
    { label: 'Letra minúscula', met: /[a-z]/.test(password) },
    { label: 'Número', met: /[0-9]/.test(password) },
    { label: 'Símbolo', met: /[^A-Za-z0-9]/.test(password) },
  ];

  const allMet = requirements.every((r) => r.met);
  const passwordsMatch = password === confirmPassword && password.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!allMet) {
      setError('A senha não atende todos os requisitos');
      return;
    }
    if (!passwordsMatch) {
      setError('As senhas não conferem');
      return;
    }

    setLoading(true);
    try {
      const api = (window as any).devVaultApi;
      await api.createVault(password);
      onCreated();
    } catch (err: any) {
      setError(err.message || 'Erro ao criar cofre');
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
          <p className="text-sm text-text-muted">Crie sua senha mestra</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password">Nova senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="Digite sua senha mestra"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                autoFocus
              />
              {password.length > 0 && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <Progress
                      value={(strength.score / 6) * 100}
                      className="flex-1 mr-2"
                    />
                    <span
                      className="text-xs font-medium whitespace-nowrap"
                      style={{ color: strength.color }}
                    >
                      {strength.label}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {requirements.map((req) => (
                      <div key={req.label} className="flex items-center gap-2">
                        <div
                          className={`h-1.5 w-1.5 rounded-full ${
                            req.met ? 'bg-success' : 'bg-text-muted'
                          }`}
                        />
                        <span
                          className={`text-xs ${
                            req.met ? 'text-text-secondary' : 'text-text-muted'
                          }`}
                        >
                          {req.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Digite novamente"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setError('');
                }}
              />
              {confirmPassword.length > 0 && !passwordsMatch && (
                <p className="text-xs text-destructive">As senhas não conferem</p>
              )}
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <Button
            type="submit"
            className="w-full h-10"
            disabled={!allMet || !passwordsMatch || loading}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Shield className="h-4 w-4 animate-spin" />
                Criando...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Lock className="h-4 w-4" />
                Criar Vault
              </span>
            )}
          </Button>

          <p className="text-center text-xs text-text-muted">
            Sua senha mestra é irrecuperável. Mantenha-a em local seguro.
          </p>
        </form>
      </div>
    </div>
  );
}
