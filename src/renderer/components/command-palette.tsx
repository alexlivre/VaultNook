import * as React from 'react';
import { Input } from './ui/input';

interface Command {
  label: string;
  shortcut: string;
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands: Command[];
}

export function CommandPalette({ isOpen, onClose, commands }: CommandPaletteProps) {
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
          placeholder="Buscar item ou comando..."
          className="mb-2 border-none bg-surface-hover"
          autoFocus
        />
        <div className="space-y-0.5">
          {commands.map((cmd) => (
            <button
              key={cmd.label}
              onClick={cmd.action}
              className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm text-text-primary hover:bg-surface-hover cursor-pointer"
            >
              <span>{cmd.label}</span>
              <span className="text-[10px] text-text-muted">{cmd.shortcut}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
