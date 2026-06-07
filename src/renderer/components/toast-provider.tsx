import * as React from 'react';
import { ToastProvider, ToastViewport, Toast, ToastTitle, ToastDescription } from './ui/toast';

interface ToastItem {
  id: string;
  title?: string;
  description?: string;
  variant?: 'default' | 'success' | 'destructive' | 'info';
  onUndo?: () => void;
}

interface ToastContextType {
  toasts: ToastItem[];
  toast: (props: Omit<ToastItem, 'id'> & { duration?: number }) => string;
  dismiss: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextType | null>(null);

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastContextProvider');
  return ctx;
}

export function ToastContextProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  const toast = React.useCallback((props: Omit<ToastItem, 'id'> & { duration?: number }) => {
    const id = crypto.randomUUID();
    const duration = props.variant === 'destructive' ? 5000 : props.duration || 3000;

    setToasts((prev) => [...prev, { ...props, id }]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }

    return id;
  }, []);

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      <ToastProvider>
        {children}
        {toasts.map((t) => (
          <Toast
            key={t.id}
            variant={t.variant}
            onUndo={t.onUndo}
            onOpenChange={(open) => {
              if (!open) dismiss(t.id);
            }}
            duration={3000}
          >
            {t.title && <ToastTitle>{t.title}</ToastTitle>}
            {t.description && <ToastDescription>{t.description}</ToastDescription>}
          </Toast>
        ))}
        <ToastViewport />
      </ToastProvider>
    </ToastContext.Provider>
  );
}
