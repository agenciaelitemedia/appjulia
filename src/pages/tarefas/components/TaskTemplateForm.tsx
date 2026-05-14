import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import type { TaskTemplate, TaskTemplateInput } from '@/hooks/useTaskTemplates';

const PRESET_CATEGORIES = ['Comercial', 'Suporte', 'Financeiro', 'Jurídico', 'Operacional', 'Marketing'];
const PRESET_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6'];

interface TaskTemplateFormProps {
  initial?: Partial<TaskTemplate>;
  onSave: (data: TaskTemplateInput) => Promise<void>;
  onCancel: () => void;
}

export function TaskTemplateForm({ initial, onSave, onCancel }: TaskTemplateFormProps) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [points, setPoints] = useState(String(initial?.points ?? 10));
  const [category, setCategory] = useState(initial?.category ?? '');
  const [color, setColor] = useState(initial?.color ?? '#6366f1');
  const [estimatedHours, setEstimatedHours] = useState(String(initial?.estimated_hours ?? ''));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!title.trim()) { setError('Título obrigatório.'); return; }
    const pts = parseInt(points, 10);
    if (isNaN(pts) || pts < 1) { setError('Pontos deve ser um número maior que zero.'); return; }
    setError('');
    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim() || undefined,
        points: pts,
        category: category.trim() || undefined,
        color,
        estimated_hours: estimatedHours ? parseInt(estimatedHours, 10) : undefined,
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
        <div className="flex flex-wrap gap-1.5">
          {PRESET_CATEGORIES.map((c) => (
            <button key={c}
              className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${category === c ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted border-border'}`}
              onClick={() => setCategory(category === c ? '' : c)}
            >
              {c}
            </button>
          ))}
        </div>
        <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ou digite uma categoria personalizada" className="mt-1.5" />
      </div>

      <div className="space-y-1.5">
        <Label>Cor</Label>
        <div className="flex gap-2">
          {PRESET_COLORS.map((c) => (
            <button key={c}
              className={`h-7 w-7 rounded-full border-2 transition-all ${color === c ? 'border-foreground scale-110' : 'border-transparent'}`}
              style={{ backgroundColor: c }}
              onClick={() => setColor(c)}
            />
          ))}
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)}
            className="h-7 w-7 rounded-full border cursor-pointer" />
        </div>
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
