import { useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Download, Upload } from 'lucide-react';
import { downloadCsv } from '../extend/csv';
import {
  AUDIENCE_CSV_FIELDS,
  AUDIENCE_CSV_MAX_ROWS,
  CSV_IGNORE,
  autoMapAudienceHeaders,
  buildAudienceTemplateCsv,
  parseCsv,
  validateAudienceCsv,
  type AudienceCsvField,
  type AudienceCsvResult,
} from '../lib/audienceCsv';

interface Props {
  result: AudienceCsvResult | null;
  onResult: (r: AudienceCsvResult | null) => void;
}

export function AudienceCsvStep({ result, onResult }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<{ headers: string[]; rows: string[][]; truncated: boolean } | null>(null);
  const [mapping, setMapping] = useState<Record<number, AudienceCsvField | typeof CSV_IGNORE>>({});

  const hasPhone = useMemo(() => Object.values(mapping).includes('whatsapp'), [mapping]);

  const handleFile = async (file: File) => {
    const text = await file.text();
    const p = parseCsv(text);
    const base = { headers: p.headers, rows: p.rows, truncated: p.truncated };
    const auto = autoMapAudienceHeaders(p.headers);
    setParsed(base);
    setMapping(auto);
    if (Object.values(auto).includes('whatsapp')) onResult(validateAudienceCsv(base, auto));
    else onResult(null);
  };

  const remap = (idx: number, field: string) => {
    const next = { ...mapping, [idx]: field as AudienceCsvField | typeof CSV_IGNORE };
    setMapping(next);
    if (parsed && Object.values(next).includes('whatsapp')) onResult(validateAudienceCsv(parsed, next));
    else onResult(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
          <Upload className="mr-2 h-4 w-4" />
          {parsed ? 'Trocar arquivo' : 'Selecionar arquivo .csv'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => downloadCsv('modelo-publico.csv', buildAudienceTemplateCsv())}
        >
          <Download className="mr-2 h-4 w-4" />
          Baixar modelo
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = '';
          }}
        />
        <span className="text-xs text-muted-foreground">Até {AUDIENCE_CSV_MAX_ROWS.toLocaleString('pt-BR')} linhas</span>
      </div>

      {parsed && (
        <div className="space-y-3">
          <Label className="text-xs font-medium">Vincule as colunas da planilha aos campos do público</Label>
          <ScrollArea className="max-h-56 rounded-md border p-3">
            <div className="grid gap-2 md:grid-cols-2">
              {parsed.headers.map((h, idx) => (
                <div key={`${h}-${idx}`} className="flex items-center gap-2">
                  <span className="w-1/2 truncate text-xs text-muted-foreground" title={h}>{h || `Coluna ${idx + 1}`}</span>
                  <Select value={String(mapping[idx] ?? CSV_IGNORE)} onValueChange={(v) => remap(idx, v)}>
                    <SelectTrigger className="h-8 flex-1 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={CSV_IGNORE}>Não importar</SelectItem>
                      {AUDIENCE_CSV_FIELDS.map((f) => (
                        <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </ScrollArea>

          {!hasPhone && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Selecione qual coluna contém o WhatsApp para continuar.
            </div>
          )}
        </div>
      )}

      {result && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{result.rows.length} linhas lidas</Badge>
            <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">{result.valid.length} válidos</Badge>
            {result.invalid.length > 0 && <Badge variant="destructive">{result.invalid.length} inválidos</Badge>}
            {result.duplicates > 0 && <Badge variant="outline">{result.duplicates} duplicados</Badge>}
            {result.truncated && <Badge variant="outline">arquivo truncado</Badge>}
          </div>

          {result.invalid.length > 0 && (
            <ScrollArea className="max-h-40 rounded-md border p-3">
              <div className="space-y-1 text-xs">
                {result.invalid.slice(0, 100).map((r) => (
                  <div key={r.index} className="flex items-center gap-2">
                    <span className="text-muted-foreground">linha {r.index}</span>
                    <span className="truncate">{r.name || '—'}</span>
                    <span className="ml-auto text-destructive">{r.error}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      )}
    </div>
  );
}
