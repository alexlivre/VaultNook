import { useCallback, useEffect, useRef } from 'react';
import { useVaultStore } from '../stores/vault-store';

type ShortcutHandlers = Record<string, () => void>;

// Keyboard shortcuts hook — registers a single global listener and keeps the
// latest handlers in a ref so the listener never has to be re-registered.
export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        if (e.key === 'Escape') {
          target.blur();
          return;
        }
        // Only Escape and Ctrl+F are handled while typing in a field
        if (!(e.key === 'f' && (e.ctrlKey || e.metaKey))) {
          return;
        }
      }

      const key = e.key.toLowerCase();
      const ctrl = e.ctrlKey || e.metaKey;

      if (key === 'escape') {
        e.preventDefault();
        handlersRef.current['escape']?.();
        return;
      }

      if (!ctrl) return;

      if (key === 'n') {
        e.preventDefault();
        handlersRef.current['new-item']?.();
      } else if (key === 'f') {
        e.preventDefault();
        handlersRef.current['search']?.();
      } else if (key === 'e') {
        e.preventDefault();
        handlersRef.current['export']?.();
      } else if (key === 'l') {
        e.preventDefault();
        handlersRef.current['lock']?.();
      } else if (key === 'a') {
        handlersRef.current['select-all']?.();
      } else if (key === 'k') {
        e.preventDefault();
        handlersRef.current['command-palette']?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}

// Auto-lock inactivity hook. Locks the vault in the main process and routes
// back to the unlock screen for the currently active vault.
export function useAutoLock() {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleActivity = useCallback(() => {
    const state = useVaultStore.getState();
    if (state.isLocked) return;

    if (timerRef.current) clearTimeout(timerRef.current);

    if (state.autoLockTimer > 0) {
      timerRef.current = setTimeout(async () => {
        const current = useVaultStore.getState();
        try {
          await window.vaultNookApi.lock();
        } catch {
          // silent
        }
        if (current.activeVaultId) {
          const target =
            current.unlockTarget?.id === current.activeVaultId
              ? current.unlockTarget
              : { id: current.activeVaultId, name: current.activeVaultName, hint: '' };
          current.setUnlockTarget(target);
          current.setScreen('unlock');
        } else {
          current.setScreen('vault-manager');
        }
        current.setIsLocked(true);
      }, state.autoLockTimer * 1000);
    }
  }, []);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  return { handleActivity };
}
