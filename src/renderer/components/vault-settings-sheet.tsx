import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X, Info, KeyRound, Download, Upload, Trash2, Clock } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useToast } from './toast-provider';
import { useVaultStore, type AutoLockOption } from '../stores/vault-store';
import { cn } from '../lib/utils';
import { CategoryLabel, type Category } from '../types';
import { RecoveryPhraseActions } from './recovery-phrase-actions';

interface VaultSettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLock: () => void;
}

export function VaultSettingsSheet({ open, onOpenChange, onLock }: VaultSettingsSheetProps) {
  const { toast } = useToast();
  const { autoLockTimer, setAutoLockTimer } = useVaultStore();

  const [info, setInfo] = React.useState<{
    createdAt: number;
    totalItems: number;
    itemsByCategory: Record<string, number>;
    appVersion: string;
  } | null>(null);

  const [changingPassword, setChangingPassword] = React.useState(false);
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [passwordError, setPasswordError] = React.useState('');

  const [newPhrase, setNewPhrase] = React.useState<string | null>(null);
  const [regenerateOpen, setRegenerateOpen] = React.useState(false);
  const [regeneratePassword, setRegeneratePassword] = React.useState('');
  const [regenerateError, setRegenerateError] = React.useState('');

  const [deleteConfirm, setDeleteConfirm] = React.useState(false);
  const [deletePassword, setDeletePassword] = React.useState('');
  const [deleteError, setDeleteError] = React.useState('');

  React.useEffect(() => {
    if (open) {
      const api = window.vaultNookApi;
      api.getInfo().then(setInfo);
    }
  }, [open]);

  const handleExport = async () => {
    const api = window.vaultNookApi;
    const result = await api.exportVault();
    if (result) {
      toast({ title: 'Vault exportado com sucesso', variant: 'success' });
    }
  };

  const handleImport = async () => {
    const api = window.vaultNookApi;
    const result = await api.importVault();
    if (result) {
      toast({
        title: `Importado: ${result.imported} itens, ${result.ignored} ignorados`,
        variant: 'success',
      });
      // Refresh items
      const items = await api.getItems();
      useVaultStore.getState().setItems(items);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');

    if (newPassword !== confirmPassword) {
      setPasswordError('Senhas não conferem');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError('Mínimo 8 caracteres');
      return;
    }

    try {
      const api = window.vaultNookApi;
      const result = await api.changePassword({ currentPassword, newPassword, confirmPassword });
      toast({ title: 'Senha alterada com sucesso', variant: 'success' });
      setChangingPassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      if (result.recoveryPhrase) {
        setNewPhrase(result.recoveryPhrase);
      }
    } catch (err: unknown) {
      setPasswordError(err instanceof Error ? err.message : 'Erro ao alterar senha');
    }
  };

  const handleRegenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegenerateError('');
    try {
      const api = window.vaultNookApi;
      const result = await api.regenerateRecoveryPhrase(regeneratePassword);
      setRegenerateOpen(false);
      setRegeneratePassword('');
      setNewPhrase(result.recoveryPhrase);
      toast({ title: 'Nova frase gerada', variant: 'success' });
    } catch (err: unknown) {
      setRegenerateError(err instanceof Error ? err.message : 'Senha incorreta');
    }
  };

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteError('');

    try {
      const api = window.vaultNookApi;
      await api.deleteVault(deletePassword);
      onLock();
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'Senha incorreta');
    }
  };

  const handleTimerChange = async (timer: number) => {
    setAutoLockTimer(timer as AutoLockOption);
    try {
      const api = window.vaultNookApi;
      await api.saveSettings(timer);
    } catch {
      // silent
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-50 bg-black/40"
          onClick={() => onOpenChange(false)}
        />
        <DialogPrimitive.Content className="fixed right-0 top-0 z-50 h-full w-full max-w-sm border-l border-border-default bg-surface-raised shadow-xl">
          <div className="flex h-full flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border-default px-4 h-12 shrink-0">
              <h2 className="text-sm font-semibold text-text-primary">Configurações</h2>
              <DialogPrimitive.Close className="text-text-muted hover:text-text-primary cursor-pointer">
                <X className="h-4 w-4" />
              </DialogPrimitive.Close>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* Vault Info */}
              {info && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
                    <Info className="h-4 w-4" />
                    Informações do cofre
                  </div>
                  <div className="rounded-lg border border-border-default bg-surface-base p-3 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-text-muted">Versão</span>
                      <span className="text-text-secondary">{info.appVersion}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-text-muted">Criado em</span>
                      <span className="text-text-secondary">
                        {new Date(info.createdAt).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-text-muted">Total de itens</span>
                      <span className="text-text-secondary">{info.totalItems}</span>
                    </div>
                    <div className="border-t border-border-default pt-2 space-y-1">
                      {Object.entries(info.itemsByCategory).map(([cat, count]) => (
                        <div key={cat} className="flex justify-between text-xs">
                          <span className="text-text-muted">{CategoryLabel[cat as Category]}</span>
                          <span className="text-text-secondary">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Auto-lock */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
                  <Clock className="h-4 w-4" />
                  Bloqueio automático
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 30, label: '30s' },
                    { value: 60, label: '1min' },
                    { value: 300, label: '5min' },
                    { value: 900, label: '15min' },
                    { value: 0, label: 'Nunca' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleTimerChange(option.value)}
                      className={cn(
                        'rounded-md border px-2 py-1.5 text-xs font-medium transition-all cursor-pointer',
                        autoLockTimer === option.value
                          ? 'border-category-all bg-category-all/10 text-category-all'
                          : 'border-border-default text-text-muted hover:border-text-muted'
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* New recovery phrase */}
              {newPhrase && (
                <div className="space-y-3 rounded-lg border border-border-default bg-surface-base p-3">
                  <p className="text-sm font-medium text-text-primary">Nova frase de recuperação</p>
                  <p className="text-xs text-text-muted">
                    A frase anterior deixou de valer. Guarde esta em local seguro.
                  </p>
                  <ol className="grid grid-cols-2 gap-1 text-xs text-text-primary">
                    {newPhrase.split(' ').map((word, i) => (
                      <li key={i} className="flex items-center gap-1.5">
                        <span className="text-text-muted">{i + 1}.</span>
                        {word}
                      </li>
                    ))}
                  </ol>
                  <RecoveryPhraseActions phrase={newPhrase} />
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-8 text-xs"
                    onClick={() => setNewPhrase(null)}
                  >
                    Entendi, guardei a frase
                  </Button>
                </div>
              )}

              {/* Change Password */}
              <div className="space-y-3">
                <button
                  onClick={() => setChangingPassword(!changingPassword)}
                  className="flex items-center gap-2 text-sm font-medium text-text-primary hover:text-text-secondary transition-colors cursor-pointer"
                >
                  <KeyRound className="h-4 w-4" />
                  Trocar senha
                </button>
                {changingPassword && (
                  <form onSubmit={handleChangePassword} className="space-y-3 pl-6">
                    <div className="space-y-1">
                      <Label className="text-xs">Senha atual</Label>
                      <Input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="h-8 text-xs"
                        autoFocus
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Nova senha</Label>
                      <Input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Confirmar nova senha</Label>
                      <Input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                    {passwordError && (
                      <p className="text-xs text-destructive">{passwordError}</p>
                    )}
                    <Button type="submit" size="sm" className="w-full h-8 text-xs">
                      Alterar senha
                    </Button>
                  </form>
                )}
              </div>

              {/* Regenerate recovery phrase */}
              <div className="space-y-3">
                <button
                  onClick={() => setRegenerateOpen(!regenerateOpen)}
                  className="flex items-center gap-2 text-sm font-medium text-text-primary hover:text-text-secondary transition-colors cursor-pointer"
                >
                  <KeyRound className="h-4 w-4" />
                  Gerar nova frase de recuperação
                </button>
                {regenerateOpen && (
                  <form onSubmit={handleRegenerate} className="space-y-3 pl-6">
                    <p className="text-xs text-text-muted">
                      A frase atual deixará de funcionar. Confirme sua senha mestra para gerar uma nova.
                    </p>
                    <div className="space-y-1">
                      <Label className="text-xs">Senha atual</Label>
                      <Input
                        type="password"
                        value={regeneratePassword}
                        onChange={(e) => setRegeneratePassword(e.target.value)}
                        className="h-8 text-xs"
                        autoFocus
                      />
                    </div>
                    {regenerateError && (
                      <p className="text-xs text-destructive">{regenerateError}</p>
                    )}
                    <Button type="submit" size="sm" className="w-full h-8 text-xs" disabled={!regeneratePassword}>
                      Gerar nova frase
                    </Button>
                  </form>
                )}
              </div>

              {/* Backup */}
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start h-9 text-sm"
                  onClick={handleExport}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Exportar vault
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start h-9 text-sm"
                  onClick={handleImport}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Importar vault
                </Button>
              </div>

              {/* Danger Zone */}
              <div className="pt-4 border-t border-destructive/20">
                <div className="flex items-center gap-2 text-sm font-medium text-destructive mb-3">
                  <Trash2 className="h-4 w-4" />
                  Zona de perigo
                </div>
                {!deleteConfirm ? (
                  <Button
                    variant="outline"
                    className="w-full justify-start h-9 text-sm border-destructive/30 text-destructive hover:bg-destructive/10"
                    onClick={() => setDeleteConfirm(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir vault
                  </Button>
                ) : (
                  <form onSubmit={handleDelete} className="space-y-3">
                    <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3">
                      <p className="text-xs text-destructive font-medium mb-2">
                        Esta ação é irreversível. Digite sua senha para confirmar.
                      </p>
                      <Input
                        type="password"
                        placeholder="Senha mestra"
                        value={deletePassword}
                        onChange={(e) => setDeletePassword(e.target.value)}
                        className="h-8 text-xs mb-2"
                        autoFocus
                      />
                      {deleteError && (
                        <p className="text-xs text-destructive mb-2">{deleteError}</p>
                      )}
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="flex-1 h-8 text-xs"
                          onClick={() => {
                            setDeleteConfirm(false);
                            setDeletePassword('');
                            setDeleteError('');
                          }}
                        >
                          Cancelar
                        </Button>
                        <Button
                          type="submit"
                          size="sm"
                          className="flex-1 h-8 text-xs"
                          disabled={!deletePassword}
                        >
                          Confirmar exclusão
                        </Button>
                      </div>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
