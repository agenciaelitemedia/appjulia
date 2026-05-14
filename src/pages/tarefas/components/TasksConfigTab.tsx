import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTaskTemplates, TaskTemplate } from '@/hooks/useTaskTemplates';
import { TaskTemplateForm } from './TaskTemplateForm';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Loader2, Plus, Pencil, Star, Trash2 } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

export function TasksConfigTab() {
  const { user } = useAuth();
  const clientId = user?.client_id ? String(user.client_id) : undefined;

  const { templates, isLoading, createTemplate, updateTemplate, toggleActive, deleteTemplate } = useTaskTemplates(clientId);

  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [editing, setEditing] = useState<TaskTemplate | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleSave = async (data: Parameters<typeof createTemplate>[0]) => {
    try {
      if (mode === 'edit' && editing) {
        await updateTemplate({ id: editing.id, ...data });
        toast.success('Template atualizado.');
      } else {
        await createTemplate(data);
        toast.success('Template criado.');
      }
      setMode('list');
      setEditing(null);
    } catch (e) {
      toast.error('Erro ao salvar template.');
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteTemplate(deletingId);
      toast.success('Template excluído.');
    } catch {
      toast.error('Erro ao excluir template.');
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  if (mode === 'create' || mode === 'edit') {
    return (
      <div className="max-w-lg">
        <h3 className="text-sm font-semibold mb-4">{mode === 'create' ? 'Novo template' : 'Editar template'}</h3>
        <TaskTemplateForm
          initial={editing ?? undefined}
          onSave={handleSave}
          onCancel={() => { setMode('list'); setEditing(null); }}
        />
      </div>
    );
  }

  // Group by category
  const byCategory = templates.reduce<Record<string, TaskTemplate[]>>((acc, t) => {
    const key = t.category ?? 'Sem categoria';
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Templates de tarefas</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Cadastre as tarefas pré-definidas que sua equipe pode assumir e pontuar.
          </p>
        </div>
        <Button size="sm" className="gap-2" onClick={() => { setEditing(null); setMode('create'); }}>
          <Plus className="h-4 w-4" /> Novo template
        </Button>
      </div>

      {templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2 border rounded-lg">
          <Star className="h-8 w-8 opacity-30" />
          <p className="text-sm">Nenhum template cadastrado.</p>
          <Button size="sm" variant="outline" onClick={() => setMode('create')} className="gap-2 mt-1">
            <Plus className="h-4 w-4" /> Criar primeiro template
          </Button>
        </div>
      ) : (
        Object.entries(byCategory).map(([cat, tpls]) => (
          <div key={cat}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{cat}</p>
            <div className="space-y-2">
              {tpls.map((tpl) => (
                <div key={tpl.id}
                  className="flex items-center gap-3 rounded-lg border bg-card p-3"
                >
                  {/* Color dot */}
                  <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: tpl.color }} />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${!tpl.is_active ? 'text-muted-foreground line-through' : ''}`}>
                      {tpl.title}
                    </p>
                    {tpl.description && (
                      <p className="text-xs text-muted-foreground truncate">{tpl.description}</p>
                    )}
                  </div>

                  {/* Points badge */}
                  <Badge variant="outline" className="gap-1 text-xs font-semibold text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-900/20 flex-shrink-0">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    {tpl.points}
                  </Badge>

                  {/* Active toggle */}
                  <Switch
                    checked={tpl.is_active}
                    onCheckedChange={(v) => toggleActive({ id: tpl.id, is_active: v })}
                  />

                  {/* Edit */}
                  <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0"
                    onClick={() => { setEditing(tpl); setMode('edit'); }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>

                  {/* Delete */}
                  <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => setDeletingId(tpl.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      <AlertDialog open={!!deletingId} onOpenChange={(o) => { if (!o) setDeletingId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir template?</AlertDialogTitle>
            <AlertDialogDescription>
              Tarefas já criadas a partir deste template não serão afetadas, mas o template deixará de aparecer para novas tarefas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
