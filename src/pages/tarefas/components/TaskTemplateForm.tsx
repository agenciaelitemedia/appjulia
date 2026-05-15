import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Plus, Trash2, GripVertical, ArrowUp, ArrowDown } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/contexts/AuthContext';
import { useTaskCategories } from '@/hooks/useTaskCategories';
import { useTaskTemplateItems, type TaskTemplate, type TaskTemplateInput, type TaskTemplateItemInput } from '@/hooks/useTaskTemplates';

const PRESET_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6'];

interface TaskTemplateFormProps {
  initial?: Partial<TaskTemplate>;
  onSave: (data: TaskTemplateInput) => Promise<void>;
  onCancel: () => void;
}

export function TaskTemplateForm({ initial, onSave, onCancel }: TaskTemplateFormProps) {
  const { user } = useAuth();
  const clientId = user?.client_id ? String(user.client_id) : undefined;
  const { activeCategories, createCategory } = useTaskCategories(clientId);

  const { data: existingItems = [], isLoading: loadingItems } = useTaskTemplateItems(initial?.id);

  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [points, setPoints] = useState(String(initial?.points ?? 10));
  const [categoryId, setCategoryId] = useState<string>(initial?.category_id ?? '');
  const [color, setColor] = useState(initial?.color ?? '#6366f1');
  const [estimatedHours, setEstimatedHours] = useState(String(initial?.estimated_hours ?? ''));
  const [items, setItems] = useState<TaskTemplateItemInput[]>([]);
  const [newCatName, setNewCatName] = useState('');
  const [creatingCat, setCreatingCat] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Carrega itens existentes quando termina o fetch
  useEffect(() => {
    if (initial?.id && !loadingItems) {
      setItems(existingItems.map((it) => ({ id: it.id, title: it.title, description: it.description ?? '', position: it.position, is_required: it.is_required })));
    }
  }, [initial?.id, loadingItems, existingItems]);

  const addItem = () => setItems((prev) => [...prev, { title: '', description: '', position: prev.length, is_required: false }]);
  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));
  const updateItem = (idx: number, patch: Partial<TaskTemplateItemInput>) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const moveItem = (idx: number, dir: -1 | 1) => {
    setItems((prev) => {
      const next = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next.map((it, i) => ({ ...it, position: i }));
    });
  };

  const handleCreateCategory = async () => {
    if (!newCatName.trim()) return;
    setCreatingCat(true);
    try {
      const cat = await createCategory({ name: newCatName.trim(), color });
      setCategoryId(cat.id);
      setNewCatName('');
    } finally { setCreatingCat(false); }
  };

  const handleSave = async () => {
    if (!title.trim()) { setError('Título obrigatório.'); return; }
    const pts = parseInt(points, 10);
    if (isNaN(pts) || pts < 1) { setError('Pontos deve ser um número maior que zero.'); return; }
    const cleanItems = items.map((it, i) => ({ ...it, position: i })).filter((it) => it.title.trim().length > 0);
    if (cleanItems.length === 0) { setError('Adicione pelo menos um item da tarefa.'); return; }
    setError('');
    setSaving(true);
    try {
      const cat = activeCategories.find((c) => c.id === categoryId);
      await onSave({
        title: title.trim(),
        description: description.trim() || undefined,
        points: pts,
        category: cat?.name ?? null,
        category_id: categoryId || null,
        color,
        estimated_hours: estimatedHours ? parseInt(estimatedHours, 10) : undefined,
        items: cleanItems,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Título <span className="text-destructive">*</span></Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Enviar proposta comercial" />
      </div>

      <div className="space-y-1.5">
        <Label>Descrição</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)}
          placeholder="Detalhe o que deve ser feito..." className="resize-none h-20" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Pontos <span className="text-destructive">*</span></Label>
          <Input type="number" min={1} value={points} onChange={(e) => setPoints(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Horas estimadas</Label>
          <Input type="number" min={0} value={estimatedHours} onChange={(e) => setEstimatedHours(e.target.value)} placeholder="Opcional" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Categoria</Label>
        <Select value={categoryId || 'none'} onValueChange={(v) => setCategoryId(v === 'none' ? '' : v)}>
          <SelectTrigger><SelectValue placeholder="Selecione uma categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">— Sem categoria —</SelectItem>
            {activeCategories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                  {c.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-2 mt-1">
          <Input value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="Nova categoria..." className="h-8 text-xs" />
          <Button type="button" size="sm" variant="outline" onClick={handleCreateCategory} disabled={creatingCat || !newCatName.trim()} className="h-8 gap-1">
            {creatingCat ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Criar
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Cor</Label>
        <div className="flex gap-2">
          {PRESET_COLORS.map((c) => (
            <button key={c} type="button"
              className={`h-7 w-7 rounded-full border-2 transition-all ${color === c ? 'border-foreground scale-110' : 'border-transparent'}`}
              style={{ backgroundColor: c }}
              onClick={() => setColor(c)}
            />
          ))}
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)}
            className="h-7 w-7 rounded-full border cursor-pointer" />
        </div>
      </div>

      <div className="space-y-2 border-t pt-3">
        <div className="flex items-center justify-between">
          <Label>Itens da tarefa <span className="text-destructive">*</span></Label>
          <Button type="button" size="sm" variant="outline" onClick={addItem} className="h-7 gap-1">
            <Plus className="h-3 w-3" /> Adicionar item
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground -mt-1">Adicione ao menos um item — eles serão criados automaticamente em cada tarefa gerada por este template.</p>

        {items.length === 0 ? (
          <div className="text-xs text-muted-foreground border border-dashed rounded p-3 text-center">
            Nenhum item ainda. Clique em "Adicionar item".
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((it, idx) => (
              <div key={idx} className="flex gap-2 items-start border rounded p-2 bg-muted/30">
                <div className="flex flex-col gap-0.5 pt-1">
                  <button type="button" onClick={() => moveItem(idx, -1)} className="text-muted-foreground hover:text-foreground disabled:opacity-30" disabled={idx === 0}>
                    <ArrowUp className="h-3 w-3" />
                  </button>
                  <GripVertical className="h-3 w-3 text-muted-foreground" />
                  <button type="button" onClick={() => moveItem(idx, 1)} className="text-muted-foreground hover:text-foreground disabled:opacity-30" disabled={idx === items.length - 1}>
                    <ArrowDown className="h-3 w-3" />
                  </button>
                </div>
                <div className="flex-1 space-y-1">
                  <Input value={it.title} onChange={(e) => updateItem(idx, { title: e.target.value })}
                    placeholder={`Item ${idx + 1} — descreva a demanda`} className="h-8 text-sm" />
                  <Textarea value={it.description ?? ''} onChange={(e) => updateItem(idx, { description: e.target.value })}
                    placeholder="Observações (opcional)" className="resize-none h-14 text-xs" />
                  <label className="flex items-center gap-2 text-[11px] text-muted-foreground cursor-pointer select-none pt-0.5">
                    <Checkbox
                      checked={!!it.is_required}
                      onCheckedChange={(v) => updateItem(idx, { is_required: v === true })}
                      className="h-3.5 w-3.5"
                    />
                    Item obrigatório (não pode ser excluído nem cancelado)
                  </label>
                </div>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => removeItem(idx)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex gap-2 pt-1">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {initial?.id ? 'Salvar alterações' : 'Criar template'}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={saving}>Cancelar</Button>
      </div>
    </div>
  );
}