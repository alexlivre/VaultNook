import * as React from 'react';
import { KeyRound, KeySquare, MessageSquareText, Terminal, Link, Dice5, X, Tag } from 'lucide-react';
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
import { PasswordGeneratorDialog } from './password-generator-dialog';
import type { Item, Category } from '../types';
import { CategoryLabel, Category as CategoryEnum } from '../types';

interface AddEditItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editItem?: Item | null;
  onSaved: () => void;
}

export function AddEditItemDialog({ open, onOpenChange, editItem, onSaved }: AddEditItemDialogProps) {
  const [name, setName] = React.useState('');
  const [value, setValue] = React.useState('');
  const [publicKey, setPublicKey] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [category, setCategory] = React.useState<Category>('api');
  const [tags, setTags] = React.useState<string[]>([]);
  const [tagInput, setTagInput] = React.useState('');
  const [generatorOpen, setGeneratorOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (editItem) {
      setName(editItem.name);
      setValue(editItem.value);
      setPublicKey(editItem.publicKey || '');
      setDescription(editItem.description);
      setCategory(editItem.category);
      setTags(editItem.tags || []);
    } else {
      setName('');
      setValue('');
      setPublicKey('');
      setDescription('');
      setCategory('api');
      setTags([]);
    }
    setTagInput('');
    setError('');
  }, [editItem, open]);

  const handleAddTag = () => {
    const trimmed = tagInput.trim().toLowerCase().replace(/^#/, '');
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

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
      const api = window.vaultNookApi;
      if (editItem) {
        await api.editItem({
          id: editItem.id,
          name: name.trim(),
          value: value.trim(),
          publicKey: publicKey.trim(),
          description: description.trim(),
          category,
          tags,
        });
      } else {
        await api.addItem({
          name: name.trim(),
          value: value.trim(),
          publicKey: publicKey.trim(),
          description: description.trim(),
          category,
          tags,
        });
      }
      // Refresh items from main process
      const items = await api.getItems();
      useVaultStore.getState().setItems(items);
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
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
                      {category === 'keypair' && <KeySquare className="h-3.5 w-3.5 text-category-keypair" />}
                      {CategoryLabel[category]}
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {CategoryEnum.options.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      <span className="flex items-center gap-2">
                        {cat === 'api' && <KeyRound className="h-3.5 w-3.5 text-category-api" />}
                        {cat === 'prompt' && <MessageSquareText className="h-3.5 w-3.5 text-category-prompt" />}
                        {cat === 'command' && <Terminal className="h-3.5 w-3.5 text-category-command" />}
                        {cat === 'link' && <Link className="h-3.5 w-3.5 text-category-link" />}
                        {cat === 'keypair' && <KeySquare className="h-3.5 w-3.5 text-category-keypair" />}
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
              <Label htmlFor="item-value">
                {category === 'keypair' ? 'Chave privada' : 'Valor'}
              </Label>
              <div className="flex gap-2">
                <Input
                  id="item-value"
                  type={category === 'api' || category === 'keypair' ? 'password' : 'text'}
                  placeholder={
                    category === 'api'
                      ? 'sk_live_...'
                      : category === 'keypair'
                        ? 'Chave privada'
                        : 'Seu valor aqui'
                  }
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => setGeneratorOpen(true)}
                  title="Gerador de Senha / Passphrase"
                >
                  <Dice5 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Public key (keypair only) */}
            {category === 'keypair' && (
              <div className="space-y-2">
                <Label htmlFor="item-public-key">Chave pública (opcional)</Label>
                <Input
                  id="item-public-key"
                  type="text"
                  placeholder="Chave pública"
                  value={publicKey}
                  onChange={(e) => setPublicKey(e.target.value)}
                />
              </div>
            )}

            {/* Tags */}
            <div className="space-y-2">
              <Label htmlFor="item-tags" className="flex items-center gap-1">
                <Tag className="h-3.5 w-3.5 text-text-muted" />
                Tags (opcional)
              </Label>
              <div className="flex gap-2">
                <Input
                  id="item-tags"
                  placeholder="Ex: prod, client-a, dev (Enter para adicionar)"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  className="flex-1 h-8 text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddTag}
                  className="h-8 text-xs shrink-0"
                >
                  Adicionar
                </Button>
              </div>
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
                        onClick={() => handleRemoveTag(tag)}
                        className="text-text-muted hover:text-text-primary cursor-pointer"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="item-description">Descrição (opcional)</Label>
              <textarea
                id="item-description"
                placeholder="Breve descrição do item"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="flex h-16 w-full rounded-md border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus resize-none"
                maxLength={500}
              />
            </div>

            {/* Security hint */}
            {(category === 'api' || category === 'keypair') && (
              <p className={`text-xs flex items-center gap-1.5 ${category === 'api' ? 'text-category-api/80' : 'text-category-keypair/80'}`}>
                {category === 'api' ? (
                  <KeyRound className="h-3 w-3" />
                ) : (
                  <KeySquare className="h-3 w-3" />
                )}
                Este valor e suas tags serão criptografados ao salvar
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

      <PasswordGeneratorDialog
        open={generatorOpen}
        onOpenChange={setGeneratorOpen}
        onSelectPassword={(pwd) => setValue(pwd)}
      />
    </>
  );
}
