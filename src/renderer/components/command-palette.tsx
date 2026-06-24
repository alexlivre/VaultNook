import * as React from 'react';
import { Input } from './ui/input';
import type { Item } from '../types';

interface Command {
  label: string;
  shortcut: string;
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands: Command[];
  items: Item[];
  onSelectItem: (item: Item) => void;
}

export function CommandPalette({ isOpen, onClose, commands, items, onSelectItem }: CommandPaletteProps) {
  const [query, setQuery] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (isOpen) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const filteredCommands = React.useMemo(() => {
    if (!query) return commands;
    return commands.filter(cmd =>
      cmd.label.toLowerCase().includes(query.toLowerCase())
    );
  }, [commands, query]);

  const filteredItems = React.useMemo(() => {
    if (!query) return [];
    return items.filter(item =>
      item.name.toLowerCase().includes(query.toLowerCase()) ||
      item.value.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 5);
  }, [items, query]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg border border-border-default bg-surface-raised p-2 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <Input
          ref={inputRef}
          placeholder="Buscar item ou comando..."
          className="mb-2 border-none bg-surface-hover"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="space-y-0.5 max-h-64 overflow-y-auto">
          {filteredCommands.map((cmd) => (
            <button
              key={cmd.label}
              onClick={() => { cmd.action(); onClose(); }}
              className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm text-text-primary hover:bg-surface-hover cursor-pointer"
            >
              <span>{cmd.label}</span>
              <span className="text-[10px] text-text-muted">{cmd.shortcut}</span>
            </button>
          ))}
          {filteredItems.length > 0 && (
            <>
              <div className="px-3 py-1 text-[10px] text-text-muted uppercase font-medium">Itens</div>
              {filteredItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => { onSelectItem(item); onClose(); }}
                  className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm text-text-primary hover:bg-surface-hover cursor-pointer"
                >
                  <span className="truncate">{item.name}</span>
                  <span className="text-[10px] text-text-muted truncate ml-2">{item.category}</span>
                </button>
              ))}
            </>
          )}
          {filteredCommands.length === 0 && filteredItems.length === 0 && query && (
            <div className="px-3 py-4 text-center text-sm text-text-muted">
              Nenhum resultado para "{query}"
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
