import * as React from 'react';
import { KeyRound, KeySquare, Dice5, Folder, RotateCw, Tag } from 'lucide-react';
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
import { CategoryIcon } from './category-icon';
import { TagInput } from './tag-input';
import { useToast } from './toast-provider';
import {
  cn,
  collectTagFrequency,
  dateInputValue,
  resolveRotationDueAt,
  type RotationUiMode,
} from '../lib/utils';

interface AddEditItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editItem?: Item | null;
  onSaved: () => void;
}

export function AddEditItemDialog({ open, onOpenChange, editItem, onSaved }: AddEditItemDialogProps) {
  const projects = useVaultStore((state) => state.projects);
  const items = useVaultStore((state) => state.items);
  const tagFrequency = React.useMemo(() => collectTagFrequency(items), [items]);
  const { toast } = useToast();
  const [name, setName] = React.useState('');
  const [value, setValue] = React.useState('');
  const [publicKey, setPublicKey] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [category, setCategory] = React.useState<Category>('api');
  const [tags, setTags] = React.useState<string[]>([]);
  const [projectId, setProjectId] = React.useState('');
  const [rotationMode, setRotationMode] = React.useState<RotationUiMode>('none');
  const [rotationDays, setRotationDays] = React.useState('');
  const [rotationDate, setRotationDate] = React.useState('');
  const [rotationUrl, setRotationUrl] = React.useState('');
  const [publicKeyHintDismissed, setPublicKeyHintDismissed] = React.useState(false);
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
      setProjectId(editItem.projectId || '');
      setRotationUrl(editItem.rotationUrl || '');
      setPublicKeyHintDismissed(!!editItem.publicKeyHintDismissed);
      if (editItem.rotationDueAt > 0 && editItem.rotationIntervalDays > 0) {
        setRotationMode('days');
        setRotationDays(String(editItem.rotationIntervalDays));
        setRotationDate('');
      } else if (editItem.rotationDueAt > 0) {
        setRotationMode('date');
        setRotationDays('');
        setRotationDate(dateInputValue(editItem.rotationDueAt));
      } else {
        setRotationMode('none');
        setRotationDays('');
        setRotationDate('');
      }
    } else {
      setName('');
      setValue('');
      setPublicKey('');
      setDescription('');
      setCategory('api');
      setTags([]);
      const store = useVaultStore.getState();
      const activeProject = store.activeProjectId;
      setProjectId(
        activeProject !== 'all' &&
          activeProject !== 'none' &&
          store.projects.some((project) => project.id === activeProject)
          ? activeProject
          : ''
      );
      setRotationMode('none');
      setRotationDays('');
      setRotationDate('');
      setRotationUrl('');
      setPublicKeyHintDismissed(false);
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

    const { rotationDueAt, rotationIntervalDays } = resolveRotationDueAt(
      editItem ?? null,
      rotationMode,
      rotationDays,
      rotationDate
    );

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
          projectId,
          rotationDueAt,
          rotationIntervalDays,
          rotationUrl: rotationUrl.trim(),
          rotationLastAt: editItem.rotationLastAt || 0,
          publicKeyHintDismissed,
        });
      } else {
        await api.addItem({
          name: name.trim(),
          value: value.trim(),
          publicKey: publicKey.trim(),
          description: description.trim(),
          category,
          tags,
          projectId,
          rotationDueAt,
          rotationIntervalDays,
          rotationUrl: rotationUrl.trim(),
          rotationLastAt: 0,
          publicKeyHintDismissed,
        });
      }
      // Refresh items from main process
      const items = await api.getItems();
      useVaultStore.getState().setItems(items);

      // Aviso: a privada mudou e a pública continua a mesma (par real × ID fixo)
      if (
        editItem &&
        category === 'keypair' &&
        publicKey.trim() !== '' &&
        editItem.value !== value.trim() &&
        (editItem.publicKey || '') === publicKey.trim() &&
        !publicKeyHintDismissed
      ) {
        const updatedItem = items.find((i) => i.id === editItem.id);
        if (updatedItem) {
          toast({
            title: 'A chave pública continua a mesma',
            description:
              'Se este campo for uma chave pública de verdade, considere atualizá-la junto com a privada.',
            duration: 8000,
            actionLabel: 'A pública não muda',
            onAction: async () => {
              const silenced = await api.editItem({ ...updatedItem, publicKeyHintDismissed: true });
              useVaultStore.getState().updateItem(silenced);
            },
          });
        }
      }

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
                      <CategoryIcon category={category} className="h-3.5 w-3.5" />
                      {CategoryLabel[category]}
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {CategoryEnum.options.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      <span className="flex items-center gap-2">
                        <CategoryIcon category={cat} className="h-3.5 w-3.5" />
                        {CategoryLabel[cat]}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Project */}
            <div className="space-y-2">
              <Label>Projeto</Label>
              <Select
                value={projectId || 'none'}
                onValueChange={(v) => setProjectId(v === 'none' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue>
                    <span className="flex items-center gap-2">
                      <Folder className="h-3.5 w-3.5 text-text-muted" />
                      {projects.find((project) => project.id === projectId)?.name || 'Sem projeto'}
                    </span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <span className="flex items-center gap-2">
                      <Folder className="h-3.5 w-3.5 text-text-muted" />
                      Sem projeto
                    </span>
                  </SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: project.color || 'var(--color-brass)' }}
                        />
                        {project.name}
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
                <label className="flex items-center gap-2 pt-0.5 text-xs text-text-muted cursor-pointer">
                  <input
                    type="checkbox"
                    checked={publicKeyHintDismissed}
                    onChange={(e) => setPublicKeyHintDismissed(e.target.checked)}
                    className="h-3.5 w-3.5 accent-[var(--color-brass)]"
                  />
                  Não avisar quando a chave pública não mudar na rotação
                </label>
              </div>
            )}

            {/* Tags */}
            <div className="space-y-2">
              <Label htmlFor="item-tags" className="flex items-center gap-1">
                <Tag className="h-3.5 w-3.5 text-text-muted" />
                Tags (opcional)
              </Label>
              <TagInput tags={tags} onChange={setTags} frequency={tagFrequency} />
            </div>

            {/* Rotation (api/keypair only) */}
            {(category === 'api' || category === 'keypair') && (
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <RotateCw className="h-3.5 w-3.5 text-text-muted" />
                  Rotação (opcional)
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { value: 'none', label: 'Sem rotação' },
                      { value: 'days', label: 'A cada dias' },
                      { value: 'date', label: 'Em uma data' },
                    ] as { value: RotationUiMode; label: string }[]
                  ).map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setRotationMode(option.value)}
                      className={cn(
                        'rounded-md border px-2 py-1.5 text-xs font-medium transition-all cursor-pointer',
                        rotationMode === option.value
                          ? 'border-brass bg-brass/10 text-brass'
                          : 'border-border-default text-text-muted hover:border-text-muted'
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                {rotationMode === 'days' && (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      placeholder="30"
                      value={rotationDays}
                      onChange={(e) => setRotationDays(e.target.value)}
                      className="h-8 w-24 text-xs"
                    />
                    <span className="text-xs text-text-muted">dias até a próxima rotação</span>
                  </div>
                )}
                {rotationMode === 'date' && (
                  <Input
                    type="date"
                    value={rotationDate}
                    onChange={(e) => setRotationDate(e.target.value)}
                    className="h-8 text-xs"
                  />
                )}
                {rotationMode !== 'none' && (
                  <Input
                    type="text"
                    placeholder="Link para rotacionar (ex.: dashboard do provedor)"
                    value={rotationUrl}
                    onChange={(e) => setRotationUrl(e.target.value)}
                    className="h-8 text-xs"
                  />
                )}
              </div>
            )}

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
