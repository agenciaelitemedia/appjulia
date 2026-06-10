import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, Folder } from 'lucide-react';
import {
  useHelpCategories, useSaveHelpCategory, useDeleteHelpCategory, type HelpCategory,
} from '@/hooks/useHelpCenter';

const CATEGORY_COLORS = ['#6366f1', '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#0891b2', '#7c3aed', '#db2777'];

export function HelpCategoriesTab() {
  const { data: categories = [], isLoading } = useHelpCategories(true);
  const save = useSaveHelpCategory();
  const del = useDeleteHelpCategory();
  const [editing, setEditing] = useState<Partial<HelpCategory> | null>(null);
  const [deleting, setDeleting] = useState<HelpCategory | null>(null);

  const move = (cat: HelpCategory, dir: -1 | 1) => {
    const idx = categories.findIndex(c => c.id === cat.id);
    const target = categories[idx + dir];
    if (!target) return;
    save.mutate({ id: cat.id, name: cat.name, position: target.position });
    save.mutate({ id: target.id, name: target.name, position: cat.position });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setEditing({ name: '', color: CATEGORY_COLORS[0], is_active: true, position: categories.length })}>
          <Plus className="h-4 w-4 mr-1" /> Nova categoria
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-center py-8">Carregando…</p>
      ) : categories.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhuma categoria criada</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {categories.map((cat, idx) => (
            <Card key={cat.id}>
              <CardContent className="p-3 flex items-center gap-3">
                <span className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${cat.color}22` }}>
                  <Folder className="h-4 w-4" style={{ color: cat.color || undefined }} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{cat.name}</span>
                    {!cat.is_active && <Badge variant="secondary" className="text-[10px]">Inativa</Badge>}
                  </div>
                  {cat.description && <p className="text-xs text-muted-foreground truncate">{cat.description}</p>}
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" disabled={idx === 0} onClick={() => move(cat, -1)}>
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" disabled={idx === categories.length - 1} onClick={() => move(cat, 1)}>
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setEditing(cat)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setDeleting(cat)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={v => !v && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing?.id ? 'Editar categoria' : 'Nova categoria'}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label>Nome</Label>
                <Input value={editing.name || ''} onChange={e => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div>
                <Label>Descrição</Label>
                <Input value={editing.description || ''} onChange={e => setEditing({ ...editing, description: e.target.value })} />
              </div>
              <div>
                <Label>Cor</Label>
                <div className="flex gap-1.5 mt-1">
                  {CATEGORY_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      className="h-7 w-7 rounded-full border-2"
                      style={{ backgroundColor: c, borderColor: editing.color === c ? 'hsl(var(--foreground))' : 'transparent' }}
                      onClick={() => setEditing({ ...editing, color: c })}
                    />
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label>Ativa</Label>
                <Switch checked={editing.is_active !== false} onCheckedChange={v => setEditing({ ...editing, is_active: v })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button
              disabled={!editing?.name?.trim() || save.isPending}
              onClick={async () => {
                if (!editing?.name) return;
                await save.mutateAsync(editing as any);
                setEditing(null);
              }}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={v => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir categoria "{deleting?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Os posts desta categoria NÃO serão excluídos, apenas ficarão sem categoria. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deleting) del.mutate(deleting.id); setDeleting(null); }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}