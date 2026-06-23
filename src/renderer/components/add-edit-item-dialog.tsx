import * as React from 'react';
import { KeyRound, MessageSquareText, Terminal, Link, Dice5 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { useVaultStore } from '../stores/vault-store';
import { generatePassword } from '../lib/utils';
import type { Item, Category, CreateItem } from '../types';
import { CategoryLabel, CategoryColorName } from '../types';

interface AddEditItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editItem?: Item | null;
  onSaved: () => void;
}

export function AddEditItemDialog({ open, onOpenChange, editItem, onSaved }: AddEditItemDialogProps) {
  const [name, setName] = React.useState('');
  const [value, setValue] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [category, setCategory] = React.useState<Category>('api');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (editItem) {
      setName(editItem.name);
      setValue(editItem.value);
      setDescription(editItem.description);
      setCategory(editItem.category);
    } else {
      setName('');
      setValue('');
      setDescription('');
      setCategory('api');
    }
    setError('');
  }, [editItem, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Nome é obrigatório');
      return;
    }
    if (!value.trim()) {
      setError('Valor é obrigatório');
      return;
    }

    setLoading(true);
    try {
      const api = window.devVaultApi;
      if (editItem) {
        await api.editItem({ id: editItem.id, name: name.trim(), value: value.trim(), description: description.trim(), category });
      } else {
        await api.addItem({ name: name.trim(), value: value.trim(), description: description.trim(), category });
      }
      // Refresh items from main process
      const items = await api.getItems();
      useVaultStore.getState().setItems(items);
      onSaved();
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar');
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePassword = () => {
    setValue(generatePassword());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editItem ? 'Editar item' : 'Novo item'}</DialogTitle>
          <DialogDescription>
            {editItem ? 'Modifique os campos abaixo' : 'Adicione um novo item ao cofre'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Category */}
          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select
              value={category}
              onValueChange={(v: Category) => setCategory(v)}
              disabled={!!editItem}
            >
              <SelectTrigger>
                <SelectValue>
                  <div className="flex items-center gap-2">
                    {category === 'api' && <KeyRound className="h-3.5 w-3.5 text-category-api" />}
                    {category === 'prompt' && <MessageSquareText className="h-3.5 w-3.5 text-category-prompt" />}
                    {category === 'command' && <Terminal className="h-3.5 w-3.5 text-category-command" />}
                    {category === 'link' && <Link className="h-3.5 w-3.5 text-category-link" />}
                    {CategoryLabel[category]}
                  </div>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(['api', 'prompt', 'command', 'link'] as Category[]).map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    <span className="flex items-center gap-2">
                      {cat === 'api' && <KeyRound className="h-3.5 w-3.5 text-category-api" />}
                      {cat === 'prompt' && <MessageSquareText className="h-3.5 w-3.5 text-category-prompt" />}
                      {cat === 'command' && <Terminal className="h-3.5 w-3.5 text-category-command" />}
                      {cat === 'link' && <Link className="h-3.5 w-3.5 text-category-link" />}
                      {CategoryLabel[cat]}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="item-name">Nome</Label>
            <Input
              id="item-name"
              placeholder="Ex: stripe-live-key"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus={!editItem}
            />
          </div>

          {/* Value */}
          <div className="space-y-2">
            <Label htmlFor="item-value">Valor</Label>
            <div className="flex gap-2">
              <Input
                id="item-value"
                type={category === 'api' ? 'password' : 'text'}
                placeholder={category === 'api' ? 'sk_live_...' : 'Seu valor aqui'}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="flex-1"
              />
              {category === 'api' && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={handleGeneratePassword}
                  title="Gerar senha"
                >
                  <Dice5 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="item-description">Descrição (opcional)</Label>
            <textarea
              id="item-description"
              placeholder="Breve descrição do item"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="flex h-20 w-full rounded-md border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus resize-none"
              maxLength={500}
            />
          </div>

          {/* Security hint */}
          {category === 'api' && (
            <p className="text-xs text-category-api/80 flex items-center gap-1.5">
              <KeyRound className="h-3 w-3" />
              Este valor será criptografado ao salvar
            </p>
          )}

          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/30 p-2">
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? 'Salvando...' : editItem ? 'Salvar' : 'Adicionar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
