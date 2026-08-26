import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { firstNameOf, validateWhatsappBr } from '../lib/audienceCsv';

export interface ManualEntry {
  name: string;
  phone: string;
  valid: boolean;
  error?: string;
  raw: string;
}

/** Interpreta linhas "Nome; 5511999999999" (ou apenas o número). */
export function parseManualLines(text: string): ManualEntry[] {
  const seen = new Set<string>();
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/[;,\t]/).map((p) => p.trim());
      const phoneRaw = parts.length > 1 ? parts[parts.length - 1] : parts[0];
      const name = parts.length > 1 ? parts.slice(0, -1).join(' ') : '';
      const check = validateWhatsappBr(phoneRaw);
      if (check.ok && seen.has(check.phone)) {
        return { name, phone: check.phone, valid: false, error: 'Duplicado', raw: line };
      }
      if (check.ok) seen.add(check.phone);
      return { name, phone: check.phone, valid: check.ok, error: check.reason, raw: line };
    });
}

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export function AudienceManualStep({ value, onChange }: Props) {
  const entries = useMemo(() => parseManualLines(value), [value]);
  const valid = entries.filter((e) => e.valid);
  const invalid = entries.filter((e) => !e.valid);

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Um contato por linha — <code>Nome; WhatsApp</code></Label>
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={8}
          placeholder={'Maria Souza; 5511987654321\nJoão Lima; 11988887777'}
          className="font-mono text-xs"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">{valid.length} válidos</Badge>
        {invalid.length > 0 && <Badge variant="destructive">{invalid.length} inválidos</Badge>}
      </div>
      {invalid.length > 0 && (
        <ScrollArea className="max-h-32 rounded-md border p-2">
          <div className="space-y-1 text-xs">
            {invalid.slice(0, 60).map((e, i) => (
              <div key={i} className="flex gap-2">
                <span className="truncate">{e.raw}</span>
                <span className="ml-auto text-destructive">{e.error}</span>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
      <p className="text-[11px] text-muted-foreground">
        O primeiro nome é derivado automaticamente do nome informado{' '}
        {valid[0]?.name ? `(ex.: "${firstNameOf(valid[0].name)}")` : ''}.
      </p>
    </div>
  );
}
