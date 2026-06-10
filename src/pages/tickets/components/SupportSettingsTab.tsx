import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Save, Hash } from 'lucide-react';
import { toast } from '@/components/ui/sonner';
import { useSupportConfig, useSupportConfigMutations } from '../hooks/useTickets';
import { PRIORITY_LABEL, type TicketPriority, type SlaTarget } from '../types';
import { useProtocolPreview, renderProtocolMaskPreview } from '@/lib/protocol';

export function SupportSettingsTab() {
  const { departments, categories, settings } = useSupportConfig();
  const { saveDepartment, deleteDepartment, saveCategory, deleteCategory, saveSettings, reapplySlaToOpenTickets } = useSupportConfigMutations();

  const [newDept, setNewDept] = useState('');
  const [newCat, setNewCat] = useState('');
  const [newCatDept, setNewCatDept] = useState<string>('');

  // SLA editável localmente, persistido no save
  const [sla, setSla] = useState<Record<TicketPriority, SlaTarget>>(() => settings?.sla ?? {} as Record<TicketPriority, SlaTarget>);
  const [csatEnabled, setCsatEnabled] = useState(settings?.csat_enabled ?? true);
  const [reapplyOnSave, setReapplyOnSave] = useState(false);
  const [protocolMask, setProtocolMask] = useState(settings?.protocol_mask ?? 'AAAAMMDDNNNNNN');
  const [protocolAutoSend, setProtocolAutoSend] = useState<boolean>(settings?.protocol_auto_send ?? false);
  const [protocolTemplate, setProtocolTemplate] = useState<string>(
    settings?.protocol_send_template ?? 'Olá {nome}! Seu chamado foi aberto. Protocolo: {protocolo}. Assunto: {assunto}.',
  );

  useEffect(() => {
    if (settings) {
      setSla(settings.sla);
      setCsatEnabled(settings.csat_enabled);
      setProtocolMask(settings.protocol_mask ?? 'AAAAMMDDNNNNNN');
      setProtocolAutoSend(settings.protocol_auto_send ?? false);
      setProtocolTemplate(
        settings.protocol_send_template ?? 'Olá {nome}! Seu chamado foi aberto. Protocolo: {protocolo}. Assunto: {assunto}.',
      );
    }
  }, [settings]);

  const protocolPreview = useProtocolPreview(protocolMask, 1);

  const saveProtocolMask = () => {
    saveSettings.mutate({
      protocol_mask: protocolMask,
      protocol_auto_send: protocolAutoSend,
      protocol_send_template: protocolTemplate,
    } as any, {
      onSuccess: () => toast.success('Máscara de protocolo salva'),
      onError: (e: any) => toast.error('Falha ao salvar: ' + (e?.message ?? 'erro')),
    });
  };

  const addDept = () => {
    if (!newDept.trim()) return;
    saveDepartment.mutate({ name: newDept.trim() }, { onSuccess: () => setNewDept('') });
  };
  const addCat = () => {
    if (!newCat.trim()) return;
    saveCategory.mutate({ name: newCat.trim(), department_id: newCatDept || null }, { onSuccess: () => { setNewCat(''); } });
  };
  const saveSla = () => {
    saveSettings.mutate({ sla, csat_enabled: csatEnabled }, {
      onSuccess: async () => {
        toast.success('Configurações salvas');
        if (reapplyOnSave) {
          try {
            const n = await reapplySlaToOpenTickets.mutateAsync(sla as any);
            toast.success(`SLA reaplicado em ${n} ticket(s) aberto(s)`);
          } catch (e: any) {
            toast.error('Falha ao reaplicar SLA: ' + (e?.message ?? 'erro'));
          }
        }
      },
    });
  };

  const reapplyNow = () => {
    reapplySlaToOpenTickets.mutate(sla as any, {
      onSuccess: (n) => toast.success(`SLA reaplicado em ${n} ticket(s) aberto(s)`),
      onError: (e: any) => toast.error('Falha ao reaplicar SLA: ' + (e?.message ?? 'erro')),
    });
  };

  const priorities = Object.keys(PRIORITY_LABEL) as TicketPriority[];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Departamentos */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Departamentos</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input value={newDept} onChange={(e) => setNewDept(e.target.value)} placeholder="Novo departamento" onKeyDown={(e) => e.key === 'Enter' && addDept()} />
            <Button size="icon" onClick={addDept} disabled={saveDepartment.isPending}><Plus className="h-4 w-4" /></Button>
          </div>
          <div className="space-y-1">
            {departments.length === 0 && <p className="text-sm text-muted-foreground">Nenhum departamento.</p>}
            {departments.map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span>{d.name}</span>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteDepartment.mutate(d.id)}><Trash2 className="h-3.5 w-3.5 text-muted-foreground" /></Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Categorias */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Categorias</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Nova categoria" onKeyDown={(e) => e.key === 'Enter' && addCat()} />
            <Select value={newCatDept} onValueChange={setNewCatDept}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Depto" /></SelectTrigger>
              <SelectContent>{departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
            </Select>
            <Button size="icon" onClick={addCat} disabled={saveCategory.isPending}><Plus className="h-4 w-4" /></Button>
          </div>
          <div className="space-y-1">
            {categories.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma categoria.</p>}
            {categories.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <span>{c.name} {c.department_id && <span className="text-xs text-muted-foreground">· {departments.find((d) => d.id === c.department_id)?.name ?? ''}</span>}</span>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteCategory.mutate(c.id)}><Trash2 className="h-3.5 w-3.5 text-muted-foreground" /></Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* SLA + CSAT */}
      <Card className="lg:col-span-2">
        <CardHeader className="pb-3"><CardTitle className="text-base">SLA por prioridade (minutos)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {priorities.map((p) => (
              <div key={p} className="space-y-2 rounded-md border p-3">
                <p className="text-sm font-medium">{PRIORITY_LABEL[p]}</p>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">1ª resposta</Label>
                  <Input
                    type="number"
                    value={sla[p]?.firstResponseMins ?? ''}
                    onChange={(e) => setSla((s) => ({ ...s, [p]: { ...s[p], firstResponseMins: Number(e.target.value) } }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Resolução</Label>
                  <Input
                    type="number"
                    value={sla[p]?.resolutionMins ?? ''}
                    onChange={(e) => setSla((s) => ({ ...s, [p]: { ...s[p], resolutionMins: Number(e.target.value) } }))}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between border-t pt-3">
            <div className="flex items-center gap-2">
              <Switch checked={csatEnabled} onCheckedChange={setCsatEnabled} id="csat" />
              <Label htmlFor="csat">Pesquisa de satisfação (CSAT) ao resolver</Label>
            </div>
            <Button onClick={saveSla} disabled={saveSettings.isPending}><Save className="h-4 w-4 mr-1" /> Salvar</Button>
          </div>
          <div className="flex items-center justify-between border-t pt-3">
            <div className="flex items-center gap-2">
              <Switch checked={reapplyOnSave} onCheckedChange={setReapplyOnSave} id="reapply" />
              <Label htmlFor="reapply">Reaplicar SLA aos tickets já abertos ao salvar</Label>
            </div>
            <Button variant="outline" onClick={reapplyNow} disabled={reapplySlaToOpenTickets.isPending}>
              {reapplySlaToOpenTickets.isPending ? 'Reaplicando...' : 'Reaplicar agora'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Protocolo */}
      <Card className="lg:col-span-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Hash className="h-4 w-4 text-primary" /> Máscara de Protocolo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Máscara</Label>
              <Input
                value={protocolMask}
                onChange={(e) => setProtocolMask(e.target.value.toUpperCase())}
                placeholder="AAAAMMDDNNNNNN"
                className="font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Pré-visualização</Label>
              <div className="h-9 px-3 rounded-md border bg-muted/40 flex items-center font-mono text-sm">
                {protocolPreview || '—'}
              </div>
            </div>
          </div>
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground space-y-1">
            <div className="font-medium text-foreground">Tokens disponíveis</div>
            <div className="grid sm:grid-cols-2 gap-x-4 gap-y-0.5 font-mono">
              <span><strong>AAAA</strong> — Ano (4 dígitos)</span>
              <span><strong>AA</strong> — Ano (2 dígitos)</span>
              <span><strong>MM</strong> — Mês</span>
              <span><strong>DD</strong> — Dia</span>
              <span><strong>HH</strong> — Hora</span>
              <span><strong>II</strong> — Minuto</span>
              <span><strong>SSSSSS</strong> — Sequencial do mês (largura = nº de S)</span>
              <span><strong>NNNNNN</strong> — Sequencial do dia (largura = nº de N)</span>
            </div>
            <div className="pt-1">Qualquer outro caractere é literal. Ex.: <code className="font-mono">220022AAAAMMDDNNNNNN</code> → <code className="font-mono">{renderProtocolMaskPreview('220022AAAAMMDDNNNNNN', 1)}</code></div>
          </div>
          <div className="border-t pt-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="protocol-auto-send" className="text-sm">Envio automático do protocolo ao abrir ticket</Label>
                <p className="text-xs text-muted-foreground">
                  Quando ativado, ao abrir um ticket vinculado a um contato/fila do WhatsApp, o protocolo é enviado automaticamente.
                </p>
              </div>
              <Switch
                id="protocol-auto-send"
                checked={protocolAutoSend}
                onCheckedChange={setProtocolAutoSend}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Mensagem enviada com o protocolo</Label>
              <Textarea
                value={protocolTemplate}
                onChange={(e) => setProtocolTemplate(e.target.value)}
                disabled={!protocolAutoSend}
                className="min-h-[90px] font-mono text-sm"
                placeholder="Olá {nome}! Seu chamado foi aberto. Protocolo: {protocolo}. Assunto: {assunto}."
              />
              <p className="text-xs text-muted-foreground">
                Placeholders: <code className="font-mono">{'{protocolo}'}</code>, <code className="font-mono">{'{numero}'}</code>, <code className="font-mono">{'{assunto}'}</code>, <code className="font-mono">{'{nome}'}</code>, <code className="font-mono">{'{prioridade}'}</code>.
              </p>
            </div>
          </div>
          <div className="flex justify-end pt-1">
            <Button onClick={saveProtocolMask} disabled={saveSettings.isPending || !protocolMask.trim()}>
              <Save className="h-4 w-4 mr-1" /> Salvar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
