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
    unlockTarget,
    setUnlockTarget,
  } = useVaultStore();

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

  const handleSelectVault = React.useCallback(
    async (vaultId: string) => {
      try {
        const hint = await window.vaultNookApi.getVaultHint(vaultId);
        const vault = useVaultStore.getState().vaults.find((v) => v.id === vaultId);
        setUnlockTarget({ id: vaultId, name: vault?.name || 'Vault', hint });
        setScreen('unlock');
      } catch {
        setScreen('vault-manager');
      }
    },
    [setScreen, setUnlockTarget]
  );

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
    setUnlockTarget(null);
    setScreen('vault-manager');
  }, [setScreen, setUnlockTarget]);

  return (
    <ToastContextProvider>
      {screen === 'vault-manager' && (
        <VaultManagerScreen
          onSelectVault={handleSelectVault}
          onCreateVault={handleCreateVault}
        />
      )}
      {screen === 'create-password' && <CreatePasswordScreen onCreated={handleCreated} />}
      {screen === 'unlock' && unlockTarget && (
        <UnlockScreen
          vaultId={unlockTarget.id}
          vaultName={unlockTarget.name}
          vaultHint={unlockTarget.hint}
          onUnlocked={handleUnlocked}
          onBack={handleBackToManager}
          onForgot={handleForgotPassword}
        />
      )}
      {screen === 'recovery' && unlockTarget && (
        <RecoveryScreen
          vaultId={unlockTarget.id}
          vaultName={unlockTarget.name}
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
