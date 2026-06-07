import { useCallback, useRef, useState } from 'react';
import { useVaultStore } from '../stores/vault-store';
import type { AutoLockOption } from '../stores/vault-store';
import type { ToastProps } from '../components/ui/toast';

// Simple toast management hook
export function useToast() {
  const [toasts, setToasts] = useState<
    (ToastProps & { id: string; title?: string; description?: string })[]
  >([]);

  const toast = useCallback(
    (props: { title?: string; description?: string; variant?: ToastProps['variant']; duration?: number; onUndo?: () => void }) => {
      const id = crypto.randomUUID();
      const duration = props.variant === 'destructive' ? 5000 : props.duration || 3000;

      setToasts((prev) => [
        ...prev,
        { id, ...props, duration },
      ]);

      if (duration > 0) {
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, duration);
      }

      return id;
    },
    []
  );

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, toast, dismiss };
}

// Auto-lock inactivity hook
export function useAutoLock() {
  const { isLocked, autoLockTimer, resetActivity, setScreen, setIsLocked } = useVaultStore();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleActivity = useCallback(() => {
    if (isLocked) return;
    resetActivity();
    if (timerRef.current) clearTimeout(timerRef.current);
    if (autoLockTimer > 0) {
      timerRef.current = setTimeout(() => {
        setScreen('unlock');
        setIsLocked(true);
      }, autoLockTimer * 1000);
    }
  }, [isLocked, autoLockTimer, resetActivity, setScreen, setIsLocked]);

  return { handleActivity };
}

// Keyboard shortcuts hook
export function useKeyboardShortcuts(handlers: Record<string, () => void>) {
  const [lastKey, setLastKey] = useState<string>('');

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        if (e.key === 'Escape') {
          (e.target as HTMLElement).blur();
          return;
        }
        // Only handle shortcuts when not in input, except Escape and Ctrl+F
        if (e.key !== 'Escape' && !(e.key === 'f' && (e.ctrlKey || e.metaKey))) {
          return;
        }
      }

      const key = e.key.toLowerCase();
      const ctrl = e.ctrlKey || e.metaKey;

      if (key === 'escape') {
        e.preventDefault();
        handlers['escape']?.();
        return;
      }

      if (ctrl && key === 'n') {
        e.preventDefault();
        handlers['new-item']?.();
        return;
      }
      if (ctrl && key === 'f') {
        e.preventDefault();
        handlers['search']?.();
        return;
      }
      if (ctrl && key === 'e') {
        e.preventDefault();
        handlers['export']?.();
        return;
      }
      if (ctrl && key === 'l') {
        e.preventDefault();
        handlers['lock']?.();
        return;
      }
      if (ctrl && key === 'a') {
        handlers['select-all']?.();
        return;
      }
      if (ctrl && key === 'k') {
        e.preventDefault();
        handlers['command-palette']?.();
        return;
      }
    },
    [handlers]
  );

  return { handleKeyDown };
}
