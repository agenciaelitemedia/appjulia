import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import type { DspTemplateButton } from '../types';

const MAX_QUICK_REPLY = 3;
const MAX_ACTION = 2;

interface Props {
  value: DspTemplateButton[];
  onChange: (next: DspTemplateButton[]) => void;
  disabled?: boolean;
}

export function TemplateButtonsEditor({ value, onChange, disabled }: Props) {
  const quickCount = value.filter((b) => b.type === 'quick_reply').length;
  const actionCount = value.filter((b) => b.type !== 'quick_reply').length;

  const update = (i: number, patch: Partial<DspTemplateButton>) =>
    onChange(value.map((b, j) => (j === i ? { ...b, ...patch } : b)));

  const add = () =>
    onChange([...value, { type: quickCount < MAX_QUICK_REPLY ? 'quick_reply' : 'url', text: '' }]);

  const canAdd = quickCount < MAX_QUICK_REPLY || actionCount < MAX_ACTION;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Botões (opcional)</Label>
        <Button
          type="button" size="sm" variant="outline" className="h-7 gap-1"
          onClick={add} disabled={disabled || !canAdd}
        >
          <Plus className="h-3.5 w-3.5" /> Adicionar
        </Button>
      </div>

      {value.map((b, i) => (
        <div key={i} className="space-y-2 rounded-md border p-2">
          <div className="flex items-center gap-2">
            <Select
              value={b.type}
              onValueChange={(t) => update(i, { type: t as DspTemplateButton['type'], url: null, phone: null })}
            >
              <SelectTrigger className="h-8 w-[170px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="quick_reply">Resposta rápida</SelectItem>
                <SelectItem value="url">Link (URL)</SelectItem>
                <SelectItem value="phone">Telefone</SelectItem>
              </SelectContent>
            </Select>
            <Input
              className="h-8"
              maxLength={25}
              placeholder="Texto do botão"
              value={b.text}
              disabled={disabled}
              onChange={(e) => update(i, { text: e.target.value })}
            />
            <Button
              type="button" size="icon" variant="ghost" className="h-8 w-8"
              disabled={disabled}
              onClick={() => onChange(value.filter((_, j) => j !== i))}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          {b.type === 'url' && (
            <Input
              className="h-8"
              placeholder="https://..."
              value={b.url ?? ''}
              disabled={disabled}
              onChange={(e) => update(i, { url: e.target.value })}
            />
          )}
          {b.type === 'phone' && (
            <Input
              className="h-8"
              placeholder="+5511999999999"
              value={b.phone ?? ''}
              disabled={disabled}
              onChange={(e) => update(i, { phone: e.target.value })}
            />
          )}
        </div>
      ))}

      <p className="text-xs text-muted-foreground">
        Limites do WhatsApp: até {MAX_QUICK_REPLY} respostas rápidas <b>ou</b> até {MAX_ACTION} botões de link/telefone.
        Na <b>API Oficial</b>, botões só saem por template aprovado pela Meta.
      </p>
    </div>
  );
}
