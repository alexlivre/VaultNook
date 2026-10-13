import * as React from 'react';
import { X } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { cn, filterTagSuggestions, type TagFrequency } from '../lib/utils';

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  frequency: TagFrequency[];
}

export function TagInput({ tags, onChange, frequency }: TagInputProps) {
  const [input, setInput] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [highlighted, setHighlighted] = React.useState(-1);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const suggestions = React.useMemo(
    () => filterTagSuggestions(frequency, input, tags),
    [frequency, input, tags]
  );

  const popular = React.useMemo(
    () => frequency.filter((entry) => !tags.includes(entry.tag)).slice(0, 6),
    [frequency, tags]
  );

  React.useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setHighlighted(-1);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  const addTag = (raw: string) => {
    const tag = raw.trim().toLowerCase().replace(/^#/, '');
    if (tag && !tags.includes(tag)) {
      onChange([...tags, tag]);
    }
    setInput('');
    setOpen(false);
    setHighlighted(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && suggestions.length > 0) {
      e.preventDefault();
      setOpen(true);
      setHighlighted((prev) => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp' && suggestions.length > 0) {
      e.preventDefault();
      setHighlighted((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (open && highlighted >= 0 && highlighted < suggestions.length) {
        addTag(suggestions[highlighted].tag);
      } else {
        addTag(input);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
      setHighlighted(-1);
    }
  };

  const showSuggestions = open && suggestions.length > 0;

  return (
    <div ref={containerRef} className="relative space-y-2">
      <div className="flex gap-2">
        <Input
          id="item-tags"
          placeholder="Ex: prod, client-a (Enter para adicionar)"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setOpen(true);
            setHighlighted(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          className="flex-1 h-8 text-xs"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => addTag(input)}
          className="h-8 text-xs shrink-0"
        >
          Adicionar
        </Button>
      </div>

      {showSuggestions && (
        <div className="absolute left-0 top-9 z-30 w-64 overflow-hidden rounded-md border border-border-default bg-surface-overlay shadow-lg">
          {suggestions.map((entry, index) => (
            <button
              key={entry.tag}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                addTag(entry.tag);
              }}
              onMouseEnter={() => setHighlighted(index)}
              className={cn(
                'flex w-full items-center justify-between px-2.5 py-1.5 text-left text-xs cursor-pointer',
                index === highlighted
                  ? 'bg-brass/10 text-brass'
                  : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
              )}
            >
              <span className="font-secret">#{entry.tag}</span>
              <span className="text-[10px] text-text-muted">
                {entry.count} uso{entry.count > 1 ? 's' : ''}
              </span>
            </button>
          ))}
        </div>
      )}

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-md bg-surface-overlay border border-border-default px-2 py-0.5 text-xs text-text-secondary"
            >
              #{tag}
              <button
                type="button"
                onClick={() => onChange(tags.filter((t) => t !== tag))}
                className="text-text-muted hover:text-text-primary cursor-pointer"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {popular.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[10px] text-text-muted">Mais usadas:</span>
          {popular.map((entry) => (
            <button
              key={entry.tag}
              type="button"
              onClick={() => addTag(entry.tag)}
              className="rounded-full border border-border-default px-2 py-0.5 font-secret text-[11px] text-text-muted hover:border-brass/40 hover:text-brass cursor-pointer"
            >
              #{entry.tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
