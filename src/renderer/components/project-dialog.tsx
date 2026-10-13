import * as React from 'react';
import { FolderPlus } from 'lucide-react';
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
import { useToast } from './toast-provider';
import { useVaultStore } from '../stores/vault-store';
import { VAULT_COLORS } from './rename-vault-dialog';
import type { Project } from '../types';

interface ProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: Project | null;
}

export function ProjectDialog({ open, onOpenChange, project }: ProjectDialogProps) {
  const { toast } = useToast();
  const [name, setName] = React.useState('');
  const [color, setColor] = React.useState<string>(VAULT_COLORS[0].value);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (project) {
      setName(project.name);
      setColor(project.color || VAULT_COLORS[0].value);
    } else {
      setName('');
      setColor(VAULT_COLORS[0].value);
    }
    setError('');
  }, [project, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Nome é obrigatório');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const api = window.vaultNookApi;
      const saved = await api.saveProject({ id: project?.id, name: name.trim(), color });
      const store = useVaultStore.getState();
      const projects = project
        ? store.projects.map((p) => (p.id === saved.id ? saved : p))
        : [...store.projects, saved];
      store.setProjects(projects);
      toast({ title: project ? 'Projeto atualizado' : 'Projeto criado', variant: 'success' });
      onOpenChange(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar projeto');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brass/15 text-brass">
              <FolderPlus className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle>{project ? 'Editar projeto' : 'Novo projeto'}</DialogTitle>
              <DialogDescription>
                {project
                  ? 'Altere o nome e a cor deste projeto'
                  : 'Agrupe credenciais por projeto — ex.: um cliente, um site, uma aplicação'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="space-y-2">
            <Label htmlFor="project-name">Nome do projeto</Label>
            <Input
              id="project-name"
              placeholder="Ex: Cloudflare - Site X"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>Cor de Identificação</Label>
            <div className="flex items-center gap-2 pt-1">
              {VAULT_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className="h-7 w-7 rounded-full transition-transform cursor-pointer relative flex items-center justify-center"
                  style={{
                    backgroundColor: c.value,
                    transform: color === c.value ? 'scale(1.15)' : 'scale(1)',
                    boxShadow:
                      color === c.value ? `0 0 0 2px var(--color-surface-base), 0 0 0 4px ${c.value}` : 'none',
                  }}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-2 border-t border-border-default">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={loading}>
              {loading ? 'Salvando...' : project ? 'Salvar alterações' : 'Criar projeto'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
