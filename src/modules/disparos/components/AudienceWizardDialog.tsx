import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, ArrowRight, Filter, Loader2, PencilLine, Save, Upload } from 'lucide-react';
import { useAuth } from '../extend/auth';
import { displayPhone } from '../extend/phone';
import { useCreateAudience, useResolveAudiencePreview, type NewAudienceContact } from '../hooks/useDspAudiences';
import type { AudienceCsvResult } from '../lib/audienceCsv';
import type { DspAudienceFilterSpec } from '../types';
import { AudienceCsvStep } from './AudienceCsvStep';
import { AudienceFilterBuilder } from './AudienceFilterBuilder';
import { AudienceManualStep, parseManualLines } from './AudienceManualStep';

type Source = 'csv' | 'manual' | 'filter';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientId: string | null;
}

const SOURCES: { key: Source; label: string; description: string; icon: any }[] = [
  { key: 'csv', label: 'Importar CSV', description: 'Planilha com nome e WhatsApp, com vínculo de colunas.', icon: Upload },
  { key: 'manual', label: 'Cadastro manual', description: 'Digite os contatos um a um.', icon: PencilLine },
  { key: 'filter', label: 'Buscar na Julia', description: 'Contatos, tags, filas, CRM, contratos e follow-up.', icon: Filter },
];

export function AudienceWizardDialog({ open, onOpenChange, clientId }: Props) {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [source, setSource] = useState<Source>('csv');
  const [csvResult, setCsvResult] = useState<AudienceCsvResult | null>(null);
  const [manualText, setManualText] = useState('');
  const [filters, setFilters] = useState<DspAudienceFilterSpec>({});
  const [filterTotal, setFilterTotal] = useState<number | null>(null);
  const [filterSample, setFilterSample] = useState<{ phone: string; name: string | null }[]>([]);

  const resolvePreview = useResolveAudiencePreview();
  const createAudience = useCreateAudience();

  const manualEntries = useMemo(() => parseManualLines(manualText).filter((e) => e.valid), [manualText]);

  const reviewRows = useMemo(() => {
    if (source === 'csv') return (csvResult?.valid ?? []).map((r) => ({ name: r.name, phone: r.phone }));
    if (source === 'manual') return manualEntries.map((r) => ({ name: r.name, phone: r.phone }));
    return filterSample.map((r) => ({ name: r.name ?? '', phone: r.phone }));
  }, [source, csvResult, manualEntries, filterSample]);

  const reviewTotal = source === 'filter' ? (filterTotal ?? 0) : reviewRows.length;

  const reset = () => {
    setStep(1);
    setName('');
    setDescription('');
    setSource('csv');
    setCsvResult(null);
    setManualText('');
    setFilters({});
    setFilterTotal(null);
    setFilterSample([]);
  };

  const close = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const validateFilters = async () => {
    if (!clientId) return;
    const res = await resolvePreview.mutateAsync({ client_id: clientId, filters });
    setFilterTotal(res.total);
    setFilterSample(res.sample ?? []);
  };

  const canAdvance = () => {
    if (step === 1) return name.trim().length >= 2;
    if (step === 2) {
      if (source === 'csv') return (csvResult?.valid.length ?? 0) > 0;
      if (source === 'manual') return manualEntries.length > 0;
      return (filterTotal ?? 0) > 0;
    }
    return true;
  };

  const save = async () => {
    if (!clientId) return;
    let contacts: NewAudienceContact[] = [];
    if (source === 'csv') {
      contacts = (csvResult?.valid ?? []).map((r) => ({
        phone_e164: r.phone,
        name: r.name || null,
        first_name: r.first_name || null,
        email: r.email,
        document: r.variables.documento ?? null,
        extra: Object.keys(r.variables).length ? r.variables : null,
      }));
    } else if (source === 'manual') {
      contacts = manualEntries.map((r) => ({ phone_e164: r.phone, name: r.name || null }));
    }

    await createAudience.mutateAsync({
      client_id: clientId,
      name,
      description: description || null,
      source,
      filters: source === 'filter' ? filters : null,
      created_by: user?.name ?? user?.email ?? null,
      contacts,
    });
    close(false);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo público</DialogTitle>
          <DialogDescription>Etapa {step} de 3 — grupos de contatos reutilizáveis nas campanhas.</DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Nome do público</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Leads sem resposta 30d" />
              </div>
              <div className="space-y-1.5">
                <Label>Descrição (opcional)</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {SOURCES.map((s) => {
                const Icon = s.icon;
                const active = source === s.key;
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setSource(s.key)}
                    className={`rounded-lg border p-3 text-left transition ${
                      active ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                    }`}
                  >
                    <Icon className="mb-2 h-5 w-5 text-primary" />
                    <p className="text-sm font-medium">{s.label}</p>
                    <p className="text-xs text-muted-foreground">{s.description}</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            {source === 'csv' && <AudienceCsvStep result={csvResult} onResult={setCsvResult} />}
            {source === 'manual' && <AudienceManualStep value={manualText} onChange={setManualText} />}
            {source === 'filter' && (
              <AudienceFilterBuilder
                clientId={clientId}
                filters={filters}
                onChange={(f) => {
                  setFilters(f);
                  setFilterTotal(null);
                }}
                onValidate={validateFilters}
                validating={resolvePreview.isPending}
                total={filterTotal}
              />
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{reviewTotal.toLocaleString('pt-BR')} contatos no público</Badge>
              {source === 'filter' && reviewTotal > reviewRows.length && (
                <span className="text-xs text-muted-foreground">
                  mostrando os primeiros {reviewRows.length}
                </span>
              )}
            </div>
            <ScrollArea className="h-72 rounded-md border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/80">
                  <tr>
                    <th className="p-2 text-left font-medium">Nome</th>
                    <th className="p-2 text-left font-medium">WhatsApp</th>
                  </tr>
                </thead>
                <tbody>
                  {reviewRows.slice(0, 500).map((r, i) => (
                    <tr key={`${r.phone}-${i}`} className="border-t">
                      <td className="p-2">{r.name || <span className="text-muted-foreground">sem nome</span>}</td>
                      <td className="p-2 font-mono">{displayPhone(r.phone)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={() => (step === 1 ? close(false) : setStep(step - 1))}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {step === 1 ? 'Cancelar' : 'Voltar'}
          </Button>
          {step < 3 ? (
            <Button onClick={() => setStep(step + 1)} disabled={!canAdvance()}>
              Continuar
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={save} disabled={createAudience.isPending || reviewTotal === 0}>
              {createAudience.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Salvar público
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
