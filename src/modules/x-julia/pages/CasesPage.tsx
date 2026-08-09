import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { XJLayout } from '../components/XJLayout';
import {
  useXJCaseKnowledge,
  useXJCaseMutations,
  useXJCaseQuestions,
  useXJCases,
} from '../hooks/useXJCases';
import { useXJPermissions } from '../extend/auth';

export default function XJCasesPage() {
  const { data: cases = [], isLoading } = useXJCases();
  const { create, update, remove } = useXJCaseMutations();
  const permissions = useXJPermissions('x_julia_cases');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedId && cases.length) setSelectedId(cases[0].id);
  }, [cases, selectedId]);

  const selected = cases.find((c) => c.id === selectedId) ?? null;

  return (
    <XJLayout
      title="Casos jurídicos X-Julia"
      description="Perguntas de triagem, critérios de qualificação e base de conhecimento"
      actions={
        permissions.canCreate && (
          <Button size="sm" onClick={() => create.mutate({ name: 'Novo caso', category: 'Geral' })}>
            <Plus className="mr-1.5 h-4 w-4" /> Novo caso
          </Button>
        )
      }
    >
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Casos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {isLoading && <Skeleton className="h-32 w-full" />}
            {!isLoading && cases.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum caso cadastrado.</p>
            )}
            {cases.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedId(item.id)}
                className={`w-full rounded-md px-2 py-2 text-left text-sm transition-colors ${
                  selectedId === item.id ? 'bg-muted font-medium' : 'hover:bg-muted/60'
                }`}
              >
                <span className="block">{item.name}</span>
                <span className="block text-xs text-muted-foreground">{item.category}</span>
              </button>
            ))}
          </CardContent>
        </Card>

        {selected ? (
          <CaseEditor
            key={selected.id}
            legalCase={selected}
            canEdit={permissions.canEdit}
            canDelete={permissions.canDelete}
            onSave={(patch) => update.mutate({ id: selected.id, patch })}
            onRemove={() => {
              remove.mutate(selected.id);
              setSelectedId(null);
            }}
          />
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              Selecione um caso para editar.
            </CardContent>
          </Card>
        )}
      </div>
    </XJLayout>
  );
}

function CaseEditor({
  legalCase,
  canEdit,
  canDelete,
  onSave,
  onRemove,
}: {
  legalCase: any;
  canEdit: boolean;
  canDelete: boolean;
  onSave: (patch: any) => void;
  onRemove: () => void;
}) {
  const [form, setForm] = useState<Record<string, any>>({
    name: legalCase.name,
    category: legalCase.category,
    summary: legalCase.summary ?? '',
    qualification_criteria: legalCase.qualification_criteria ?? '',
    disqualification_criteria: legalCase.disqualification_criteria ?? '',
    fee_description: legalCase.fee_description ?? '',
    min_ticket: legalCase.min_ticket ?? '',
    contract_template: legalCase.contract_template ?? '',
    contract_fields: Array.isArray(legalCase.contract_fields) ? legalCase.contract_fields : [],
    is_active: legalCase.is_active,
  });
  const set = (key: string, value: any) => setForm((prev) => ({ ...prev, [key]: value }));

  const fields: Array<{ key: string; label?: string; validation?: string }> = form.contract_fields ?? [];
  const setField = (index: number, patch: Record<string, string>) =>
    set(
      'contract_fields',
      fields.map((f, i) => (i === index ? { ...f, ...patch } : f)),
    );

  const questions = useXJCaseQuestions(legalCase.id);
  const knowledge = useXJCaseKnowledge(legalCase.id);
  const [newQuestion, setNewQuestion] = useState('');
  const [newSlot, setNewSlot] = useState('');
  const [kbTitle, setKbTitle] = useState('');
  const [kbContent, setKbContent] = useState('');

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <CardTitle className="text-base">{legalCase.name}</CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant={form.is_active ? 'default' : 'outline'}>{form.is_active ? 'Ativo' : 'Inativo'}</Badge>
          {canEdit && (
            <Button
              size="sm"
              onClick={() =>
                onSave({ ...form, min_ticket: form.min_ticket === '' ? null : Number(form.min_ticket) })
              }
            >
              Salvar
            </Button>
          )}
          {canDelete && (
            <Button size="sm" variant="ghost" onClick={onRemove}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="geral">
          <TabsList>
            <TabsTrigger value="geral">Geral</TabsTrigger>
            <TabsTrigger value="perguntas">Perguntas</TabsTrigger>
            <TabsTrigger value="contrato">Contrato</TabsTrigger>
            <TabsTrigger value="base">Base de conhecimento</TabsTrigger>
          </TabsList>

          <TabsContent value="geral" className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={form.name} onChange={(e) => set('name', e.target.value)} disabled={!canEdit} />
            </div>
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Input value={form.category} onChange={(e) => set('category', e.target.value)} disabled={!canEdit} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Resumo</Label>
              <Textarea rows={2} value={form.summary} onChange={(e) => set('summary', e.target.value)} disabled={!canEdit} />
            </div>
            <div className="space-y-1.5">
              <Label>Critérios de qualificação</Label>
              <Textarea
                rows={4}
                value={form.qualification_criteria}
                onChange={(e) => set('qualification_criteria', e.target.value)}
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Critérios de desqualificação</Label>
              <Textarea
                rows={4}
                value={form.disqualification_criteria}
                onChange={(e) => set('disqualification_criteria', e.target.value)}
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Honorários (descrição)</Label>
              <Input value={form.fee_description} onChange={(e) => set('fee_description', e.target.value)} disabled={!canEdit} />
            </div>
            <div className="space-y-1.5">
              <Label>Ticket mínimo (R$)</Label>
              <Input
                type="number"
                value={form.min_ticket}
                onChange={(e) => set('min_ticket', e.target.value)}
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Template de contrato específico</Label>
              <Textarea
                rows={6}
                className="font-mono text-xs"
                value={form.contract_template}
                onChange={(e) => set('contract_template', e.target.value)}
                disabled={!canEdit}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3 md:col-span-2">
              <span className="text-sm">Caso ativo (aparece na triagem)</span>
              <Switch checked={!!form.is_active} onCheckedChange={(v) => set('is_active', v)} disabled={!canEdit} />
            </div>
          </TabsContent>

          <TabsContent value="contrato" className="mt-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              Campos obrigatórios para gerar o contrato deste caso. O agente pede um por mensagem, nesta ordem, confirma
              tudo com o lead e só gera o contrato quando todos estiverem preenchidos.
            </p>
            {fields.map((f, i) => (
              <div key={`${f.key}-${i}`} className="flex flex-wrap items-center gap-2 rounded-lg border p-2">
                <span className="w-6 text-center text-xs text-muted-foreground">{i + 1}</span>
                <Input
                  className="min-w-[220px] flex-1"
                  placeholder="Rótulo mostrado ao lead"
                  value={f.label ?? ''}
                  onChange={(e) => setField(i, { label: e.target.value })}
                  disabled={!canEdit}
                />
                <Input
                  className="max-w-[180px]"
                  placeholder="campo (slot)"
                  value={f.key ?? ''}
                  onChange={(e) => setField(i, { key: e.target.value })}
                  disabled={!canEdit}
                />
                <Input
                  className="max-w-[140px]"
                  placeholder="validação"
                  value={f.validation ?? ''}
                  onChange={(e) => setField(i, { validation: e.target.value })}
                  disabled={!canEdit}
                />
                {canEdit && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => set('contract_fields', fields.filter((_, idx) => idx !== i))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            {!fields.length && (
              <p className="text-sm text-muted-foreground">
                Nenhum campo definido: o agente vai seguir apenas o que estiver escrito no prompt do escritório.
              </p>
            )}
            {canEdit && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => set('contract_fields', [...fields, { key: '', label: '', validation: 'texto' }])}
              >
                Adicionar campo
              </Button>
            )}
          </TabsContent>

          <TabsContent value="perguntas" className="mt-4 space-y-3">
            {(questions.data ?? []).map((q) => (
              <div key={q.id} className="flex items-center gap-2 rounded-lg border p-2">
                <Input
                  value={q.question}
                  onChange={(e) => questions.update.mutate({ id: q.id, patch: { question: e.target.value } })}
                  disabled={!canEdit}
                />
                <Input
                  className="max-w-[160px]"
                  placeholder="slot"
                  value={q.slot_key ?? ''}
                  onChange={(e) => questions.update.mutate({ id: q.id, patch: { slot_key: e.target.value } })}
                  disabled={!canEdit}
                />
                {canEdit && (
                  <Button size="sm" variant="ghost" onClick={() => questions.remove.mutate(q.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            {canEdit && (
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[240px] flex-1 space-y-1.5">
                  <Label className="text-xs">Nova pergunta</Label>
                  <Input value={newQuestion} onChange={(e) => setNewQuestion(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Slot</Label>
                  <Input value={newSlot} onChange={(e) => setNewSlot(e.target.value)} placeholder="ex.: tempo_servico" />
                </div>
                <Button
                  size="sm"
                  disabled={!newQuestion.trim()}
                  onClick={async () => {
                    await questions.add.mutateAsync({ question: newQuestion.trim(), slot_key: newSlot.trim() || undefined });
                    setNewQuestion('');
                    setNewSlot('');
                  }}
                >
                  <Plus className="mr-1.5 h-4 w-4" /> Adicionar
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="base" className="mt-4 space-y-3">
            {(knowledge.data ?? []).map((item) => (
              <div key={item.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{item.title}</p>
                  {canEdit && (
                    <Button size="sm" variant="ghost" onClick={() => knowledge.remove.mutate(item.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {item.content && <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{item.content}</p>}
              </div>
            ))}
            {canEdit && (
              <div className="space-y-2 rounded-lg border p-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Título</Label>
                  <Input value={kbTitle} onChange={(e) => setKbTitle(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Conteúdo</Label>
                  <Textarea rows={4} value={kbContent} onChange={(e) => setKbContent(e.target.value)} />
                </div>
                <Button
                  size="sm"
                  disabled={!kbTitle.trim()}
                  onClick={async () => {
                    await knowledge.add.mutateAsync({ title: kbTitle.trim(), content: kbContent });
                    setKbTitle('');
                    setKbContent('');
                  }}
                >
                  <Plus className="mr-1.5 h-4 w-4" /> Adicionar à base
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}