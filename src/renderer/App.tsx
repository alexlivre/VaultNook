import * as React from 'react';
import { useVaultStore } from './stores/vault-store';
import { ToastContextProvider } from './components/toast-provider';
import { CreatePasswordScreen } from './pages/create-password-screen';
import { UnlockScreen } from './pages/unlock-screen';
import { VaultScreen } from './pages/vault-screen';

export function App() {
  const { screen, setScreen, isFirstRun, setIsFirstRun, setIsLocked, setItems } =
    useVaultStore();

  React.useEffect(() => {
    async function init() {
      try {
        const api = (window as any).devVaultApi;
        const result = await api.init();
        setIsFirstRun(result.isFirstRun);
        if (result.isFirstRun) {
          setScreen('create-password');
        } else {
          setScreen('unlock');
        }
      } catch {
        setScreen('unlock');
      }
    }
    init();
  }, [setIsFirstRun, setScreen]);

  const handleCreated = React.useCallback(() => {
    setScreen('vault');
    setIsLocked(false);
  }, [setScreen, setIsLocked]);

  const handleUnlocked = React.useCallback(() => {
    setScreen('vault');
    setIsLocked(false);
  }, [setScreen, setIsLocked]);

  return (
    <ToastContextProvider>
      {screen === 'create-password' && <CreatePasswordScreen onCreated={handleCreated} />}
      {screen === 'unlock' && <UnlockScreen onUnlocked={handleUnlocked} />}
      {screen === 'vault' && <VaultScreen />}
      {screen === 'loading' && (
        <div className="flex min-h-screen items-center justify-center bg-surface-base">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-border-default border-t-category-all" />
        </div>
      )}
    </ToastContextProvider>
  );
}
