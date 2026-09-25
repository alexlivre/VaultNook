import * as React from 'react';
import {
  Lock,
  Plus,
  Download,
  Upload,
  Eye,
  EyeOff,
  Trash2,
  MoreHorizontal,
  FolderLock,
  Pencil,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '../components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '../components/ui/alert-dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useToast } from '../components/toast-provider';
import { useVaultStore } from '../stores/vault-store';
import { formatAbsoluteDate } from '../lib/utils';
import type { VaultEntry } from '../types';
import { WindowControls } from '../components/window-controls';
import { RenameVaultDialog } from '../components/rename-vault-dialog';

interface VaultManagerScreenProps {
  onSelectVault: (vaultId: string) => void;
  onCreateVault: () => void;
}

export function VaultManagerScreen({ onSelectVault, onCreateVault }: VaultManagerScreenProps) {
  const { vaults, setVaults } = useVaultStore();
  const { toast } = useToast();
  const [showHidden, setShowHidden] = React.useState(false);
  const [deleteVaultId, setDeleteVaultId] = React.useState<string | null>(null);
  const [deletePassword, setDeletePassword] = React.useState('');
  const [deleteError, setDeleteError] = React.useState('');
  const [deleting, setDeleting] = React.useState(false);
  const [renameTargetVault, setRenameTargetVault] = React.useState<VaultEntry | null>(null);

  const displayVaults = showHidden ? vaults : vaults.filter((v) => !v.hidden);

  const loadVaults = React.useCallback(async () => {
    try {
      const api = window.vaultNookApi;
      const list = await api.listVaults();
      setVaults(list);
    } catch {
      // silent
    }
  }, [setVaults]);

  React.useEffect(() => {
    loadVaults();
  }, [loadVaults]);

  const handleExport = React.useCallback(async (vaultId: string) => {
    try {
      const api = window.vaultNookApi;
      await api.exportVaultFile(vaultId);
      toast({ title: 'Vault exportado', variant: 'success' });
    } catch (err: unknown) {
      toast({ title: err instanceof Error ? err.message : 'Erro ao exportar', variant: 'destructive' });
    }
  }, [toast]);

  const handleToggleHidden = React.useCallback(async (vaultId: string) => {
    try {
      const api = window.vaultNookApi;
      const nowHidden = await api.toggleHidden(vaultId);
      await loadVaults();
      toast({
        title: nowHidden ? 'Vault ocultado' : 'Vault revelado',
        variant: 'default',
      });
    } catch (err: unknown) {
      toast({ title: err instanceof Error ? err.message : 'Erro', variant: 'destructive' });
    }
  }, [loadVaults, toast]);

  const handleDeleteConfirm = async () => {
    if (!deleteVaultId || !deletePassword) return;
    setDeleting(true);
    setDeleteError('');
    try {
      const api = window.vaultNookApi;
      await api.deleteVaultEntry(deleteVaultId, deletePassword);
      setDeleteVaultId(null);
      setDeletePassword('');
      await loadVaults();
      toast({ title: 'Vault excluído', variant: 'success' });
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'Senha incorreta');
    } finally {
      setDeleting(false);
    }
  };

  const handleImport = async () => {
    try {
      const api = window.vaultNookApi;
      const result = await api.importVaultFile();
      if (result) {
        await loadVaults();
        toast({ title: 'Vault importado com sucesso', variant: 'success' });
      }
    } catch (err: unknown) {
      toast({ title: err instanceof Error ? err.message : 'Erro ao importar', variant: 'destructive' });
    }
  };

  const vaultCount = vaults.filter((v) => !v.hidden).length;
  const hiddenCount = vaults.filter((v) => v.hidden).length;

  return (
    <div className="flex min-h-screen flex-col bg-surface-base">
      {/* Header */}
      <header className="titlebar flex items-center justify-between border-b border-border-default pl-6 pr-0 h-14 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-brass/40 bg-brass/10">
            <Lock className="h-5 w-5 text-brass" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-text-primary">VaultNook</h1>
            <p className="text-[11px] text-text-muted">
              {vaultCount} cofre{vaultCount !== 1 ? 's' : ''}
              {hiddenCount > 0 && ` (${hiddenCount} oculto${hiddenCount !== 1 ? 's' : ''})`}
            </p>
          </div>
        </div>
        <WindowControls />
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {displayVaults.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-raised mb-4">
              <FolderLock className="h-8 w-8 text-text-muted" />
            </div>
            <p className="text-sm text-text-secondary font-medium">Nenhum cofre encontrado</p>
            <p className="text-xs text-text-muted mt-1 mb-6">
              {vaults.length === 0
                ? 'Crie seu primeiro cofre para começar'
                : 'Todos os cofres estão ocultos'}
            </p>
            {vaults.length === 0 && (
              <Button variant="primary" onClick={onCreateVault}>
                <Plus className="h-4 w-4 mr-1" />
                Criar primeiro cofre
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3 max-w-lg mx-auto">
            {displayVaults.map((vault) => (
              <VaultCard
                key={vault.id}
                vault={vault}
                onSelectVault={onSelectVault}
                onRenameVault={setRenameTargetVault}
                onExportVault={handleExport}
                onToggleHiddenVault={handleToggleHidden}
                onDeleteVault={setDeleteVaultId}
              />
            ))}
          </div>
        )}
      </div>

      {/* Bottom actions */}
      <div className="border-t border-border-default px-6 py-4 shrink-0">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <Button variant="primary" className="flex-1" onClick={onCreateVault}>
            <Plus className="h-4 w-4 mr-1" />
            Novo cofre
          </Button>
          <Button variant="outline" className="flex-1" onClick={handleImport}>
            <Upload className="h-4 w-4 mr-1" />
            Importar
          </Button>
        </div>
        {hiddenCount > 0 && (
          <button
            onClick={() => setShowHidden(!showHidden)}
            className="mt-3 flex items-center gap-1.5 mx-auto text-xs text-text-muted hover:text-text-secondary cursor-pointer"
          >
            {showHidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            {showHidden ? 'Ocultar ocultos' : `Mostrar ocultos (${hiddenCount})`}
          </button>
        )}
      </div>

      {/* Rename / Color Dialog */}
      <RenameVaultDialog
        open={renameTargetVault !== null}
        onOpenChange={(open) => {
          if (!open) setRenameTargetVault(null);
        }}
        vault={renameTargetVault}
        onRenamed={loadVaults}
      />

      {/* Delete dialog */}
      <AlertDialog
        open={deleteVaultId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteVaultId(null);
            setDeletePassword('');
            setDeleteError('');
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cofre</AlertDialogTitle>
            <AlertDialogDescription>
              Digite a senha mestra deste cofre para confirmar a exclusão permanente.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="delete-password">Senha mestra</Label>
            <Input
              id="delete-password"
              type="password"
              placeholder="Digite a senha do cofre"
              value={deletePassword}
              onChange={(e) => {
                setDeletePassword(e.target.value);
                setDeleteError('');
              }}
            />
            {deleteError && (
              <p className="text-xs text-destructive">{deleteError}</p>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={!deletePassword || deleting}
              onClick={handleDeleteConfirm}
            >
              {deleting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface VaultCardProps {
  vault: VaultEntry;
  onSelectVault: (vaultId: string) => void;
  onRenameVault: (vault: VaultEntry) => void;
  onExportVault: (vaultId: string) => void;
  onToggleHiddenVault: (vaultId: string) => void;
  onDeleteVault: (vaultId: string) => void;
}

const VaultCard = React.memo(function VaultCard({
  vault,
  onSelectVault,
  onRenameVault,
  onExportVault,
  onToggleHiddenVault,
  onDeleteVault,
}: VaultCardProps) {
  const accentColor = vault.color || 'var(--color-brass)';

  return (
    <div
      className="group flex items-center gap-4 rounded-lg border border-border-default bg-surface-raised px-4 py-3.5 transition-all duration-150 hover:bg-surface-hover hover:shadow-sm cursor-pointer"
      style={{
        borderLeftWidth: '3px',
        borderLeftColor: accentColor,
      }}
      onClick={() => onSelectVault(vault.id)}
    >
      {/* Icon */}
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
        style={{
          backgroundColor: `color-mix(in srgb, ${accentColor} 15%, transparent)`,
          color: accentColor,
        }}
      >
        <Lock className="h-5 w-5" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text-primary truncate">
            {vault.name}
          </span>
          {vault.hidden && (
            <EyeOff className="h-3 w-3 text-text-muted shrink-0" />
          )}
          {vault.hasHint && (
            <span className="rounded-full border border-brass/30 bg-brass/10 px-1.5 py-0.5 text-[10px] font-semibold text-brass">
              dica
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-text-muted">
            {vault.itemCount} {vault.itemCount === 1 ? 'item' : 'itens'}
          </span>
          <span className="text-xs text-text-muted/50">·</span>
          <span className="text-xs text-text-muted">
            {formatAbsoluteDate(vault.lastOpened)}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onRenameVault(vault)}>
              <Pencil className="h-3.5 w-3.5 mr-2" />
              Personalizar / Renomear
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onExportVault(vault.id)}>
              <Download className="h-3.5 w-3.5 mr-2" />
              Exportar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onToggleHiddenVault(vault.id)}>
              {vault.hidden ? (
                <><Eye className="h-3.5 w-3.5 mr-2" />Revelar</>
              ) : (
                <><EyeOff className="h-3.5 w-3.5 mr-2" />Ocultar</>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onDeleteVault(vault.id)} className="text-destructive focus:text-destructive">
              <Trash2 className="h-3.5 w-3.5 mr-2" />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
});
