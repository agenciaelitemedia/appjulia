import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTaskTemplates } from '@/hooks/useTaskTemplates';
import { useTasks } from '@/hooks/useTasks';
import { useTeamByClient } from '@/hooks/useTeamByClient';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Star, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import type { TaskTemplate } from '@/hooks/useTaskTemplates';

interface AddRankedTasksDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId: string;
  clientId: string;
}

export function AddRankedTasksDialog({ open, onOpenChange, dealId, clientId }: AddRankedTasksDialogProps) {
  const { user } = useAuth();
  const { activeTemplates, isLoading: tplLoading } = useTaskTemplates(clientId);
  const { data: team = [] } = useTeamByClient();
  const { createFromTemplates, isCreating } = useTasks({ clientId, dealId });

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [assignedTo, setAssignedTo] = useState(String(user?.id ?? ''));
  const [dueDate, setDueDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const ALLOWED_FULL_LIST_ROLES = ['admin', 'colaborador', 'user'];
  const canSeeFullTeam = !!user?.role && ALLOWED_FULL_LIST_ROLES.includes(user.role);
  const visibleTeam = canSeeFullTeam
    ? team
    : team.filter((m) => String(m.id) === String(user?.id ?? ''));

  const toggleTemplate = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(filteredTemplates.map((t) => t.id)));
  const clearAll = () => setSelectedIds(new Set());

  const handleConfirm = async () => {
    if (selectedIds.size === 0) { toast.error('Selecione ao menos um template.'); return; }
    if (!assignedTo) { toast.error('Selecione um responsável.'); return; }
    const member = team.find((m) => String(m.id) === assignedTo);
    const assignedName = member?.name ?? (user?.name ?? '');
    try {
      await createFromTemplates({
        templateIds: [...selectedIds],
        targetDealId: dealId,
        assignedTo,
        assignedName,
        dueDate: dueDate || undefined,
      });
      toast.success(`${selectedIds.size} tarefa(s) adicionada(s) com sucesso!`);
      setSelectedIds(new Set());
      setDueDate('');
      onOpenChange(false);
    } catch {
      toast.error('Erro ao criar tarefas.');
    }
  };

  const filteredTemplates = activeTemplates.filter((t) => {
    const term = searchTerm.trim().toLowerCase();
    const matchesTerm = !term
      ? true
      : t.title.toLowerCase().includes(term) ||
        (t.category ?? '').toLowerCase().includes(term);
    const matchesCategory =
      categoryFilter === 'all' || (t.category ?? 'Sem categoria') === categoryFilter;
    return matchesTerm && matchesCategory;
  });

  const allCategories = Array.from(
    new Set(activeTemplates.map((t) => t.category ?? 'Sem categoria'))
  ).sort((a, b) => a.localeCompare(b));

  const byCategory = filteredTemplates.reduce<Record<string, TaskTemplate[]>>((acc, t) => {
    const key = t.category ?? 'Sem categoria';
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {});

  const totalPoints = filteredTemplates
    .filter((t) => selectedIds.has(t.id))
    .reduce((s, t) => s + t.points, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-500 fill-amber-400" />
            Adicionar Tarefas Rankeadas
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {tplLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : activeTemplates.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum template ativo. Cadastre templates em Tarefas → Configurações.
            </p>
          ) : (
            <>
              {/* Busca + Categoria */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar tarefa..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-8 pl-8 text-sm"
                  />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="h-8 w-[140px] text-sm">
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas categorias</SelectItem>
                    {allCategories.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Select all / clear */}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={selectAll}>Selecionar todos</Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={clearAll}>Limpar</Button>
                {selectedIds.size > 0 && (
                  <Badge variant="outline" className="gap-1 text-xs ml-auto text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-900/20">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    {totalPoints} pts selecionados
                  </Badge>
                )}
              </div>

              {/* Template list by category */}
              {Object.entries(byCategory).map(([cat, tpls]) => (
                <div key={cat}>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{cat}</p>
                  <div className="space-y-1.5">
                    {tpls.map((tpl) => (
                      <label key={tpl.id}
                        className="flex items-center gap-3 rounded-lg border bg-card p-2.5 cursor-pointer hover:bg-muted/40 transition-colors">
                        <Checkbox
                          checked={selectedIds.has(tpl.id)}
                          onCheckedChange={() => toggleTemplate(tpl.id)}
                        />
                        <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: tpl.color }} />
                        <span className="flex-1 text-sm">{tpl.title}</span>
                        <Badge variant="outline" className="gap-1 text-xs text-amber-600 border-amber-200 bg-amber-50/50 dark:bg-amber-900/10 flex-shrink-0">
                          <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                          {tpl.points}
                        </Badge>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}

        </div>

        {/* Footer fixo: Atribuir a + Data limite + Ações */}
        <div className="border-t bg-muted/30 px-5 py-3 space-y-3">
          {activeTemplates.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Atribuir a</Label>
                <Select value={assignedTo} onValueChange={setAssignedTo} disabled={!canSeeFullTeam && visibleTeam.length <= 1}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {visibleTeam.map((m) => (
                      <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Data limite (opcional)</Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="h-8 text-sm" />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isCreating}>Cancelar</Button>
            <Button onClick={handleConfirm} disabled={isCreating || selectedIds.size === 0} className="gap-2">
              {isCreating && <Loader2 className="h-4 w-4 animate-spin" />}
              Adicionar {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
