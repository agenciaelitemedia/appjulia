import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { maskPhone, unmask } from '../extend/masks';

interface PhoneListEditorProps {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}

/** Lista de números de WhatsApp — vários destinatários por notificação. */
export function PhoneListEditor({ value, onChange, disabled }: PhoneListEditorProps) {
  const [draft, setDraft] = useState('');

  const add = () => {
    const digits = unmask(draft);
    if (digits.length < 10) {
      toast.error('Informe o DDD + número (mínimo 10 dígitos)');
      return;
    }
    const full = digits.startsWith('55') ? digits : `55${digits}`;
    if (value.includes(full)) {
      toast.error('Este número já está na lista');
      return;
    }
    onChange([...value, full]);
    setDraft('');
  };

  const remove = (phone: string) => onChange(value.filter((p) => p !== phone));

  return (
    <div className="space-y-2">
      <Label className="text-sm">Números que recebem este alerta</Label>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(maskPhone(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          placeholder="(11) 99999-9999"
          disabled={disabled}
        />
        <Button type="button" variant="outline" onClick={add} disabled={disabled}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {value.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum número cadastrado.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {value.map((phone) => (
            <Badge key={phone} variant="secondary" className="gap-1 py-1">
              {maskPhone(phone.replace(/^55/, ''))}
              <button
                type="button"
                onClick={() => remove(phone)}
                disabled={disabled}
                className="ml-1 rounded-full hover:text-destructive"
                aria-label={`Remover ${phone}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
