import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { VideoPlan } from '@/pages/video/contratar/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: VideoPlan | null;
  onSave: (plan: Partial<VideoPlan>) => void;
}

const parseSetup = (v: string): number | null => {
  const s = v.trim();
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

const toStr = (v: number | null | undefined) =>
  v === null || v === undefined ? '' : String(v);

export function PlanDialog({ open, onOpenChange, plan, onSave }: Props) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [includedMinutes, setIncludedMinutes] = useState(5000);
  const [maxRooms, setMaxRooms] = useState(2);
  const [recordingIncl, setRecordingIncl] = useState(false);
  const [transcriptionIncl, setTranscriptionIncl] = useState(false);
  const [priceM, setPriceM] = useState(0);
  const [priceQ, setPriceQ] = useState(0);
  const [priceS, setPriceS] = useState(0);
  const [priceA, setPriceA] = useState(0);
  const [extraSize, setExtraSize] = useState(1000);
  const [extraPrice, setExtraPrice] = useState(0);
  const [recAddon, setRecAddon] = useState<string>('');
  const [trAddon, setTrAddon] = useState<string>('');
  const [setupM, setSetupM] = useState<string>('');
  const [setupQ, setSetupQ] = useState<string>('');
  const [setupS, setSetupS] = useState<string>('');
  const [setupA, setSetupA] = useState<string>('');
  const [sortOrder, setSortOrder] = useState(0);

  useEffect(() => {
    if (plan) {
      setName(plan.name);
      setSlug(plan.slug ?? '');
      setDescription(plan.description ?? '');
      setIsActive(plan.is_active);
      setIncludedMinutes(Number(plan.included_minutes) || 0);
      setMaxRooms(Number(plan.max_concurrent_rooms) || 1);
      setRecordingIncl(plan.recording_included);
      setTranscriptionIncl(plan.transcription_included);
      setPriceM(Number(plan.price_monthly) || 0);
      setPriceQ(Number(plan.price_quarterly) || 0);
      setPriceS(Number(plan.price_semiannual) || 0);
      setPriceA(Number(plan.price_annual) || 0);
      setExtraSize(Number(plan.extra_minutes_pack_size) || 1000);
      setExtraPrice(Number(plan.extra_minutes_pack_price) || 0);
      setRecAddon(toStr(plan.recording_addon_price));
      setTrAddon(toStr(plan.transcription_addon_price));
      setSetupM(toStr(plan.setup_fee_monthly));
      setSetupQ(toStr(plan.setup_fee_quarterly));
      setSetupS(toStr(plan.setup_fee_semiannual));
      setSetupA(toStr(plan.setup_fee_annual));
      setSortOrder(Number(plan.sort_order) || 0);
    } else {
      setName(''); setSlug(''); setDescription(''); setIsActive(true);
      setIncludedMinutes(5000); setMaxRooms(2);
      setRecordingIncl(false); setTranscriptionIncl(false);
      setPriceM(0); setPriceQ(0); setPriceS(0); setPriceA(0);
      setExtraSize(1000); setExtraPrice(0);
      setRecAddon(''); setTrAddon('');
      setSetupM(''); setSetupQ(''); setSetupS(''); setSetupA('');
      setSortOrder(0);
    }
  }, [plan, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{plan ? 'Editar Plano' : 'Novo Plano'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Pro" />
            </div>
            <div>
              <Label>Slug (opcional)</Label>
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="ex: pro" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Minutos inclusos / mês</Label>
              <Input type="number" value={includedMinutes} onChange={(e) => setIncludedMinutes(Number(e.target.value))} min={0} />
            </div>
            <div>
              <Label>Salas simultâneas</Label>
              <Input type="number" value={maxRooms} onChange={(e) => setMaxRooms(Number(e.target.value))} min={1} />
            </div>
            <div>
              <Label>Ordem de exibição</Label>
              <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 border-t pt-3">
            <div className="flex items-center gap-2">
              <Switch checked={recordingIncl} onCheckedChange={setRecordingIncl} />
              <Label>Gravação inclusa</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={transcriptionIncl} onCheckedChange={setTranscriptionIncl} />
              <Label>Transcrição inclusa</Label>
            </div>
            <div>
              <Label>Add-on Gravação (R$/mês)</Label>
              <Input type="number" value={recAddon} onChange={(e) => setRecAddon(e.target.value)} min={0} step={0.01} placeholder="vazio = padrão" disabled={recordingIncl} />
            </div>
            <div>
              <Label>Add-on Transcrição (R$/mês)</Label>
              <Input type="number" value={trAddon} onChange={(e) => setTrAddon(e.target.value)} min={0} step={0.01} placeholder="vazio = padrão" disabled={transcriptionIncl} />
            </div>
          </div>

          <div className="border-t pt-3">
            <Label className="text-base">Preço por periodicidade (R$)</Label>
            <div className="grid grid-cols-2 gap-4 mt-2">
              <div><Label>Mensal</Label><Input type="number" value={priceM} onChange={(e) => setPriceM(Number(e.target.value))} min={0} step={0.01} /></div>
              <div><Label>Trimestral</Label><Input type="number" value={priceQ} onChange={(e) => setPriceQ(Number(e.target.value))} min={0} step={0.01} /></div>
              <div><Label>Semestral</Label><Input type="number" value={priceS} onChange={(e) => setPriceS(Number(e.target.value))} min={0} step={0.01} /></div>
              <div><Label>Anual</Label><Input type="number" value={priceA} onChange={(e) => setPriceA(Number(e.target.value))} min={0} step={0.01} /></div>
            </div>
          </div>

          <div className="border-t pt-3">
            <Label className="text-base">Pacote de minutos extras</Label>
            <div className="grid grid-cols-2 gap-4 mt-2">
              <div><Label>Tamanho do pacote (min)</Label><Input type="number" value={extraSize} onChange={(e) => setExtraSize(Number(e.target.value))} min={100} step={100} /></div>
              <div><Label>Preço por pacote (R$)</Label><Input type="number" value={extraPrice} onChange={(e) => setExtraPrice(Number(e.target.value))} min={0} step={0.01} /></div>
            </div>
          </div>

          <div className="border-t pt-3">
            <Label className="text-base">Taxa de Setup por periodicidade (R$)</Label>
            <p className="text-xs text-muted-foreground">Vazio = sem taxa · 0 = grátis · &gt;0 = cobrar</p>
            <div className="grid grid-cols-2 gap-4 mt-2">
              <div><Label>Setup Mensal</Label><Input type="number" value={setupM} onChange={(e) => setSetupM(e.target.value)} min={0} step={0.01} placeholder="vazio = sem taxa" /></div>
              <div><Label>Setup Trimestral</Label><Input type="number" value={setupQ} onChange={(e) => setSetupQ(e.target.value)} min={0} step={0.01} placeholder="vazio = sem taxa" /></div>
              <div><Label>Setup Semestral</Label><Input type="number" value={setupS} onChange={(e) => setSetupS(e.target.value)} min={0} step={0.01} placeholder="vazio = sem taxa" /></div>
              <div><Label>Setup Anual</Label><Input type="number" value={setupA} onChange={(e) => setSetupA(e.target.value)} min={0} step={0.01} placeholder="vazio = sem taxa" /></div>
            </div>
          </div>

          <div>
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição do plano..." />
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={isActive} onCheckedChange={setIsActive} />
            <Label>Ativo</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            disabled={!name}
            onClick={() => onSave({
              name,
              slug: slug.trim() || null,
              description: description || null,
              is_active: isActive,
              included_minutes: includedMinutes,
              max_concurrent_rooms: maxRooms,
              recording_included: recordingIncl,
              transcription_included: transcriptionIncl,
              price_monthly: priceM,
              price_quarterly: priceQ,
              price_semiannual: priceS,
              price_annual: priceA,
              extra_minutes_pack_size: extraSize,
              extra_minutes_pack_price: extraPrice,
              recording_addon_price: parseSetup(recAddon),
              transcription_addon_price: parseSetup(trAddon),
              setup_fee_monthly: parseSetup(setupM),
              setup_fee_quarterly: parseSetup(setupQ),
              setup_fee_semiannual: parseSetup(setupS),
              setup_fee_annual: parseSetup(setupA),
              sort_order: sortOrder,
            })}
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}