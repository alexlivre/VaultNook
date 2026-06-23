import * as React from 'react';
import { Minus, Square, X } from 'lucide-react';

export function WindowControls() {
  const [isMaximized, setIsMaximized] = React.useState(false);

  React.useEffect(() => {
    const cleanup = window.windowControls.onMaximizeChange(setIsMaximized);
    return () => { cleanup(); };
  }, []);

  return (
    <div className="flex items-stretch h-full">
      <button
        onClick={() => window.windowControls.minimize()}
        className="flex items-center justify-center w-11 h-full text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors cursor-pointer"
        title="Minimizar"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => window.windowControls.maximize()}
        className="flex items-center justify-center w-11 h-full text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors cursor-pointer"
        title={isMaximized ? 'Restaurar' : 'Maximizar'}
      >
        <Square className="h-3 w-3" />
      </button>
      <button
        onClick={() => window.windowControls.close()}
        className="flex items-center justify-center w-11 h-full text-text-muted hover:text-white hover:bg-destructive transition-colors cursor-pointer"
        title="Fechar"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
