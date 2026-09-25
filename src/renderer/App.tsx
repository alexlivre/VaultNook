import * as React from 'react';
import { useVaultStore } from './stores/vault-store';
import { ToastContextProvider } from './components/toast-provider';
import { CreatePasswordScreen } from './pages/create-password-screen';
import { UnlockScreen } from './pages/unlock-screen';
import { RecoveryScreen } from './pages/recovery-screen';
import { VaultScreen } from './pages/vault-screen';
import { VaultManagerScreen } from './pages/vault-manager-screen';

export function App() {
  const {
    screen,
    setScreen,
    setVaults,
    setIsLocked,
  } = useVaultStore();

  const [unlockVaultId, setUnlockVaultId] = React.useState<string | null>(null);
  const [unlockVaultName, setUnlockVaultName] = React.useState('');
  const [unlockVaultHint, setUnlockVaultHint] = React.useState('');

  React.useEffect(() => {
    async function init() {
      try {
        const api = window.vaultNookApi;
        const result = await api.init();
        setVaults(result.vaults);
        setScreen('vault-manager');
      } catch {
        setScreen('vault-manager');
      }
    }
    init();
  }, [setVaults, setScreen]);

  const handleSelectVault = React.useCallback(async (vaultId: string) => {
    try {
      const api = window.vaultNookApi;
      const hint = await api.getVaultHint(vaultId);
      // Find vault name from store
      const store = useVaultStore.getState();
      const vault = store.vaults.find((v) => v.id === vaultId);
      setUnlockVaultId(vaultId);
      setUnlockVaultName(vault?.name || 'Vault');
      setUnlockVaultHint(hint);
      setScreen('unlock');
    } catch {
      setScreen('vault-manager');
    }
  }, [setScreen]);

  const handleCreateVault = React.useCallback(() => {
    setScreen('create-password');
  }, [setScreen]);

  const handleCreated = React.useCallback(() => {
    setScreen('vault');
    setIsLocked(false);
  }, [setScreen, setIsLocked]);

  const handleUnlocked = React.useCallback(() => {
    setScreen('vault');
    setIsLocked(false);
  }, [setScreen, setIsLocked]);

  const handleForgotPassword = React.useCallback(() => {
    setScreen('recovery');
  }, [setScreen]);

  const handleRecovered = React.useCallback(() => {
    setScreen('vault');
    setIsLocked(false);
  }, [setScreen, setIsLocked]);

  const handleBackToManager = React.useCallback(() => {
    setUnlockVaultId(null);
    setUnlockVaultName('');
    setUnlockVaultHint('');
    setScreen('vault-manager');
  }, [setScreen]);

  return (
    <ToastContextProvider>
      {screen === 'vault-manager' && (
        <VaultManagerScreen
          onSelectVault={handleSelectVault}
          onCreateVault={handleCreateVault}
        />
      )}
      {screen === 'create-password' && <CreatePasswordScreen onCreated={handleCreated} />}
      {screen === 'unlock' && unlockVaultId && (
        <UnlockScreen
          vaultId={unlockVaultId}
          vaultName={unlockVaultName}
          vaultHint={unlockVaultHint}
          onUnlocked={handleUnlocked}
          onBack={handleBackToManager}
          onForgot={handleForgotPassword}
        />
      )}
      {screen === 'recovery' && unlockVaultId && (
        <RecoveryScreen
          vaultId={unlockVaultId}
          vaultName={unlockVaultName}
          onRecovered={handleRecovered}
          onBack={handleBackToManager}
        />
      )}
      {screen === 'vault' && <VaultScreen />}
      {screen === 'loading' && (
        <div className="flex min-h-screen items-center justify-center bg-surface-base">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-border-default border-t-brass" />
        </div>
      )}
    </ToastContextProvider>
  );
}
