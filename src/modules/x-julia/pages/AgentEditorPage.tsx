import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { XJLayout } from '../components/XJLayout';
import { XJActivationTab } from '../components/XJActivationTab';
import { normalizeXJBusinessHours, type XJBusinessHours } from '../lib/xjBusinessHours';
import { useXJAgent, useXJAgentMutations, useXJAgentQueueLinks, useXJPromptVersions } from '../hooks/useXJAgents';
import { useXJCadences } from '../hooks/useXJFollowups';
import { useXJQueues } from '../extend/queues';
import { useXJPermissions } from '../extend/auth';
import { useXJProviderConfig, useXJProviderConfigMutations } from '../hooks/useXJProviderConfig';
import {
  XJ_CONTRACT_PROVIDERS,
  XJ_FOLLOWUP_CONTENT_TYPES,
  XJ_LLM_PROVIDERS,
  XJ_STAGES,
  XJ_STAGE_LABELS,
  XJ_VOICE_PROVIDERS,
} from '../module';
import { formatContext, formatModelPricing, formatUsd, getXJModelInfo } from '../modelCatalog';

export default function XJAgentEditorPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const { data: agent, isLoading } = useXJAgent(agentId);
  const { update, savePromptVersion } = useXJAgentMutations();
  const permissions = useXJPermissions('x_julia_agents');
  const canEdit = permissions.canEdit;

  const [form, setForm] = useState<Record<string, any>>({});
  const [stagePrompts, setStagePrompts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!agent) return;
    setForm({
      name: agent.name,
      persona: agent.persona ?? '',
      tone: agent.tone ?? '',
      system_prompt: agent.system_prompt ?? '',
      llm_provider: agent.llm_provider,
      llm_model: agent.llm_model,
      llm_fallback_enabled: agent.llm_fallback_enabled,
      voice_enabled: agent.voice_enabled,
      voice_provider: agent.voice_provider ?? 'elevenlabs',
      voice_id: agent.voice_id ?? '',
      llm_key_mode: agent.llm_key_mode ?? 'default',
      voice_key_mode: agent.voice_key_mode ?? 'default',
      contract_provider: agent.contract_provider ?? 'internal',
      contract_template: agent.contract_template ?? '',
      mirror_to_crm_builder: agent.mirror_to_crm_builder,
      max_turns: agent.max_turns ?? 40,
      is_active: agent.is_active,
      activation: (agent as any).activation ?? {},
      business_hours: normalizeXJBusinessHours((agent as any).business_hours),
    });
    setStagePrompts(agent.stage_prompts ?? {});
  }, [agent]);

  const { data: providerConfig } = useXJProviderConfig(agent?.client_id);
  const { saveClientKey } = useXJProviderConfigMutations();
  const [clientKeyInput, setClientKeyInput] = useState('');
  const [voiceKeyInput, setVoiceKeyInput] = useState('');

  // Só aparecem provedores ativados em Configuração do X-Julia (fallback: todos).
  const llmProviders = useMemo(() => {
    const enabled = (providerConfig?.providers ?? []).filter((p) => p.kind === 'llm' && p.is_enabled);
    if (!enabled.length) return XJ_LLM_PROVIDERS;
    const known = XJ_LLM_PROVIDERS.filter((p) => enabled.some((e) => e.provider === p.id));
    const extra = enabled
      .filter((e) => !XJ_LLM_PROVIDERS.some((p) => p.id === e.provider))
      .map((e) => ({ id: e.provider, label: e.provider, models: [] as string[] }));
    return [...known, ...extra];
  }, [providerConfig]);

  const voiceProviders = useMemo(() => {
    const enabled = (providerConfig?.providers ?? []).filter((p) => p.kind === 'voice' && p.is_enabled);
    if (!enabled.length) return XJ_VOICE_PROVIDERS;
    return XJ_VOICE_PROVIDERS.filter((p) => enabled.some((e) => e.provider === p.id));
  }, [providerConfig]);

  // Modelos: apenas os liberados no provedor (Configuração do X-Julia). Se nenhum foi
  // liberado, cai para o catálogo ativo e, por último, para a lista estática.
  // Sempre inclui o modelo atual do agente.
  const models = useMemo(() => {
    const provider = form.llm_provider;
    const staticModels = XJ_LLM_PROVIDERS.find((p) => p.id === provider)?.models ?? [];
    const catalogModels = (providerConfig?.model_pricing ?? [])
      .filter((r) => r.provider === provider && r.is_active !== false)
      .map((r) => r.model);
    const setting = (providerConfig?.providers ?? []).find((p) => p.kind === 'llm' && p.provider === provider);
    const allowed = setting?.enabled_models ?? [];

    let list: string[] = allowed.length ? [...allowed] : catalogModels.length ? [...catalogModels] : [...staticModels];
    if (form.llm_model && !list.includes(form.llm_model)) list = [form.llm_model, ...list];
    return Array.from(new Set(list));
  }, [form.llm_provider, form.llm_model, providerConfig]);

  const clientKeyStatus = (kind: 'llm' | 'voice', provider?: string) =>
    (providerConfig?.client_keys ?? []).find((k) => k.kind === kind && k.provider === provider)?.masked ?? null;

  const set = (key: string, value: any) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = () => {
    if (!agentId) return;
    update.mutate({
      id: agentId,
      patch: {
        ...form,
        voice_id: form.voice_id || null,
        contract_template: form.contract_template || null,
        max_turns: Number(form.max_turns) || 40,
        activation: form.activation ?? {},
        business_hours: normalizeXJBusinessHours(form.business_hours),
      } as any,
    });
  };

  if (isLoading || !agent) {
    return (
      <XJLayout title="Agente X-Julia">
        <Skeleton className="h-64 w-full" />
      </XJLayout>
    );
  }

  return (
    <XJLayout
      title={agent.name}
      description="Configuração completa do agente autônomo"
      actions={
        canEdit && (
          <Button size="sm" onClick={handleSave} disabled={update.isPending}>
            {update.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
            Salvar
          </Button>
        )
      }
    >
      <Tabs defaultValue="geral">
        <TabsList className="flex-wrap">
          <TabsTrigger value="geral">Geral</TabsTrigger>
          <TabsTrigger value="prompt">Prompt</TabsTrigger>
          <TabsTrigger value="ativacao">Ativação</TabsTrigger>
          <TabsTrigger value="llm">LLM & Voz</TabsTrigger>
          <TabsTrigger value="filas">Filas</TabsTrigger>
          <TabsTrigger value="followups">Followups</TabsTrigger>
          <TabsTrigger value="contrato">Contrato</TabsTrigger>
        </TabsList>

        <TabsContent value="geral" className="mt-4 space-y-4">
          <Card>
            <CardContent className="grid gap-4 pt-6 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input value={form.name ?? ''} onChange={(e) => set('name', e.target.value)} disabled={!canEdit} />
              </div>
              <div className="space-y-1.5">
                <Label>Tom de voz</Label>
                <Input
                  value={form.tone ?? ''}
                  placeholder="Ex.: cordial, objetivo, acolhedor"
                  onChange={(e) => set('tone', e.target.value)}
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>Persona</Label>
                <Textarea
                  rows={3}
                  value={form.persona ?? ''}
                  onChange={(e) => set('persona', e.target.value)}
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Máximo de turnos por sessão</Label>
                <Input
                  type="number"
                  value={form.max_turns ?? 40}
                  onChange={(e) => set('max_turns', e.target.value)}
                  disabled={!canEdit}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Agente ativo</p>
                  <p className="text-xs text-muted-foreground">Atende mensagens das filas vinculadas</p>
                </div>
                <Switch
                  checked={!!form.is_active}
                  onCheckedChange={(v) => set('is_active', v)}
                  disabled={!canEdit}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3 md:col-span-2">
                <div>
                  <p className="text-sm font-medium">Espelhar no CRM Builder</p>
                  <p className="text-xs text-muted-foreground">Cria também card no CRM Builder além do CRM X-Julia</p>
                </div>
                <Switch
                  checked={!!form.mirror_to_crm_builder}
                  onCheckedChange={(v) => set('mirror_to_crm_builder', v)}
                  disabled={!canEdit}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="prompt" className="mt-4 space-y-4">
          <PromptTab
            agentId={agentId!}
            canEdit={canEdit}
            systemPrompt={form.system_prompt ?? ''}
            onSystemPromptChange={(v) => set('system_prompt', v)}
            stagePrompts={stagePrompts}
            onStagePromptChange={(stage, v) => setStagePrompts((prev) => ({ ...prev, [stage]: v }))}
            onSaveVersion={(label) =>
              savePromptVersion.mutate({
                agentId: agentId!,
                systemPrompt: form.system_prompt ?? '',
                stagePrompts,
                label,
              })
            }
            saving={savePromptVersion.isPending}
          />
        </TabsContent>

        <TabsContent value="ativacao" className="mt-4">
          <XJActivationTab
            canEdit={canEdit}
            activation={form.activation ?? {}}
            onActivationChange={(patch) => set('activation', { ...(form.activation ?? {}), ...patch })}
            businessHours={form.business_hours}
            onBusinessHoursChange={(value: XJBusinessHours) => set('business_hours', value)}
            voiceEnabled={!!form.voice_enabled}
            onVoiceEnabledChange={(v) => set('voice_enabled', v)}
          />
        </TabsContent>

        <TabsContent value="llm" className="mt-4 space-y-4">
          <Card>
            <CardContent className="grid gap-4 pt-6 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Provedor de LLM</Label>
                <Select
                  value={form.llm_provider}
                  onValueChange={(v) => {
                    set('llm_provider', v);
                    const setting = (providerConfig?.providers ?? []).find(
                      (p) => p.kind === 'llm' && p.provider === v,
                    );
                    const first =
                      setting?.enabled_models?.[0] ??
                      (providerConfig?.model_pricing ?? []).find(
                        (r) => r.provider === v && r.is_active !== false,
                      )?.model ??
                      XJ_LLM_PROVIDERS.find((p) => p.id === v)?.models?.[0];
                    if (first) set('llm_model', first);
                  }}
                  disabled={!canEdit}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {llmProviders.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Modelo</Label>
                <Select value={form.llm_model} onValueChange={(v) => set('llm_model', v)} disabled={!canEdit}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {models.map((m) => {
                      const info = getXJModelInfo(form.llm_provider, m);
                      return (
                        <SelectItem key={m} value={m}>
                          {m}
                          {info ? ` — in ${formatUsd(info.inputPer1M)} / out ${formatUsd(info.outputPer1M)} por 1M · ${formatContext(info.context)}` : ''}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {(() => {
                  const info = getXJModelInfo(form.llm_provider, form.llm_model);
                  const pricing = formatModelPricing(form.llm_provider, form.llm_model);
                  if (!info) return <p className="text-xs text-muted-foreground">Custo deste modelo não catalogado.</p>;
                  return (
                    <p className="text-xs text-muted-foreground">
                      {info.note} {pricing}
                    </p>
                  );
                })()}
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3 md:col-span-2">
                <div>
                  <p className="text-sm font-medium">Fallback automático</p>
                  <p className="text-xs text-muted-foreground">Se o provedor falhar, usa Lovable AI</p>
                </div>
                <Switch
                  checked={!!form.llm_fallback_enabled}
                  onCheckedChange={(v) => set('llm_fallback_enabled', v)}
                  disabled={!canEdit}
                />
              </div>

              <div className="space-y-3 rounded-lg border p-3 md:col-span-2">
                <div className="space-y-1.5 md:max-w-xs">
                  <Label>Chave da API do LLM</Label>
                  <Select
                    value={form.llm_key_mode ?? 'default'}
                    onValueChange={(v) => set('llm_key_mode', v)}
                    disabled={!canEdit}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Padrão do sistema</SelectItem>
                      <SelectItem value="custom">Personalizada do escritório</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.llm_key_mode === 'custom' && (
                  <div className="space-y-1.5 md:max-w-md">
                    <Label className="flex items-center gap-2">
                      Chave de {form.llm_provider}
                      {clientKeyStatus('llm', form.llm_provider) && (
                        <Badge variant="outline">{clientKeyStatus('llm', form.llm_provider)}</Badge>
                      )}
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        type="password"
                        autoComplete="off"
                        placeholder="Cole a chave deste escritório"
                        value={clientKeyInput}
                        onChange={(e) => setClientKeyInput(e.target.value)}
                        disabled={!canEdit}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!canEdit || !clientKeyInput.trim() || saveClientKey.isPending}
                        onClick={() => {
                          saveClientKey.mutate({
                            client_id: String(agent.client_id),
                            provider: form.llm_provider,
                            kind: 'llm',
                            api_key: clientKeyInput.trim(),
                          });
                          setClientKeyInput('');
                        }}
                      >
                        Salvar chave
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3 md:col-span-2">
                <div>
                  <p className="text-sm font-medium">Respostas em áudio</p>
                  <p className="text-xs text-muted-foreground">Envia áudio quando o lead manda áudio</p>
                </div>
                <Switch
                  checked={!!form.voice_enabled}
                  onCheckedChange={(v) => set('voice_enabled', v)}
                  disabled={!canEdit}
                />
              </div>
              {form.voice_enabled && (
                <>
                  <div className="space-y-1.5">
                    <Label>Provedor de voz</Label>
                    <Select value={form.voice_provider} onValueChange={(v) => set('voice_provider', v)} disabled={!canEdit}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {voiceProviders.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Voice ID</Label>
                    <Input value={form.voice_id ?? ''} onChange={(e) => set('voice_id', e.target.value)} disabled={!canEdit} />
                  </div>
                  <div className="space-y-3 rounded-lg border p-3 md:col-span-2">
                    <div className="space-y-1.5 md:max-w-xs">
                      <Label>Chave da API de voz</Label>
                      <Select
                        value={form.voice_key_mode ?? 'default'}
                        onValueChange={(v) => set('voice_key_mode', v)}
                        disabled={!canEdit}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="default">Padrão do sistema</SelectItem>
                          <SelectItem value="custom">Personalizada do escritório</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {form.voice_key_mode === 'custom' && (
                      <div className="space-y-1.5 md:max-w-md">
                        <Label className="flex items-center gap-2">
                          Chave de {form.voice_provider}
                          {clientKeyStatus('voice', form.voice_provider) && (
                            <Badge variant="outline">{clientKeyStatus('voice', form.voice_provider)}</Badge>
                          )}
                        </Label>
                        <div className="flex gap-2">
                          <Input
                            type="password"
                            autoComplete="off"
                            placeholder="Cole a chave deste escritório"
                            value={voiceKeyInput}
                            onChange={(e) => setVoiceKeyInput(e.target.value)}
                            disabled={!canEdit}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!canEdit || !voiceKeyInput.trim() || saveClientKey.isPending}
                            onClick={() => {
                              saveClientKey.mutate({
                                client_id: String(agent.client_id),
                                provider: form.voice_provider,
                                kind: 'voice',
                                api_key: voiceKeyInput.trim(),
                              });
                              setVoiceKeyInput('');
                            }}
                          >
                            Salvar chave
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="filas" className="mt-4">
          <QueuesTab agentId={agentId!} canEdit={canEdit} />
        </TabsContent>

        <TabsContent value="followups" className="mt-4">
          <FollowupsTab agentId={agentId!} canEdit={canEdit} />
        </TabsContent>

        <TabsContent value="contrato" className="mt-4">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-1.5 md:max-w-sm">
                <Label>Provedor de assinatura</Label>
                <Select value={form.contract_provider} onValueChange={(v) => set('contract_provider', v)} disabled={!canEdit}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {XJ_CONTRACT_PROVIDERS.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Template do contrato (Markdown, aceita placeholders)</Label>
                <Textarea
                  rows={14}
                  className="font-mono text-xs"
                  value={form.contract_template ?? ''}
                  onChange={(e) => set('contract_template', e.target.value)}
                  disabled={!canEdit}
                  placeholder="{{nome}}, {{cpf}}, {{caso}}, {{valor}}..."
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </XJLayout>
  );
}

function PromptTab({
  agentId,
  canEdit,
  systemPrompt,
  onSystemPromptChange,
  stagePrompts,
  onStagePromptChange,
  onSaveVersion,
  saving,
}: {
  agentId: string;
  canEdit: boolean;
  systemPrompt: string;
  onSystemPromptChange: (v: string) => void;
  stagePrompts: Record<string, string>;
  onStagePromptChange: (stage: string, v: string) => void;
  onSaveVersion: (label?: string) => void;
  saving: boolean;
}) {
  const { data: versions = [] } = useXJPromptVersions(agentId);
  const [label, setLabel] = useState('');

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Prompt do sistema</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            rows={12}
            className="font-mono text-xs"
            value={systemPrompt}
            onChange={(e) => onSystemPromptChange(e.target.value)}
            disabled={!canEdit}
          />
          <div className="space-y-3">
            <p className="text-sm font-medium">Instruções por etapa</p>
            {XJ_STAGES.map((stage) => (
              <div key={stage} className="space-y-1.5">
                <Label className="text-xs">{XJ_STAGE_LABELS[stage]}</Label>
                <Textarea
                  rows={2}
                  className="text-xs"
                  value={stagePrompts[stage] ?? ''}
                  onChange={(e) => onStagePromptChange(stage, e.target.value)}
                  disabled={!canEdit}
                />
              </div>
            ))}
          </div>
          {canEdit && (
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Rótulo da versão</Label>
                <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Opcional" />
              </div>
              <Button size="sm" onClick={() => { onSaveVersion(label || undefined); setLabel(''); }} disabled={saving}>
                {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
                Salvar versão
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Versões</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {versions.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma versão salva.</p>}
          {versions.map((v: any) => (
            <div key={v.id} className="rounded-md border p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">v{v.version} · {v.label}</span>
                {canEdit && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      onSystemPromptChange(v.system_prompt ?? '');
                      Object.entries((v.stage_prompts ?? {}) as Record<string, string>).forEach(([stage, text]) =>
                        onStagePromptChange(stage, text),
                      );
                    }}
                  >
                    Restaurar
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {new Date(v.created_at).toLocaleString('pt-BR')} · {v.created_by ?? '—'}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function QueuesTab({ agentId, canEdit }: { agentId: string; canEdit: boolean }) {
  const { data: queues = [], isLoading } = useXJQueues();
  const { data: links = [], toggle } = useXJAgentQueueLinks(agentId);
  const linkedIds = new Set(links.map((l: any) => l.queue_id));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Filas atendidas por este agente</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading && <Skeleton className="h-24 w-full" />}
        {!isLoading && queues.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma fila encontrada para este escritório.</p>
        )}
        {queues.map((queue) => (
          <div key={queue.id} className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">{queue.name}</p>
              <p className="text-xs text-muted-foreground">
                {queue.channel_type ?? 'whatsapp'}{queue.phone_number ? ` · ${queue.phone_number}` : ''}
              </p>
            </div>
            <Switch
              checked={linkedIds.has(queue.id)}
              onCheckedChange={(v) => toggle.mutate({ queueId: queue.id, linked: v })}
              disabled={!canEdit}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function FollowupsTab({ agentId, canEdit }: { agentId: string; canEdit: boolean }) {
  const {
    data: cadences = [],
    isLoading,
    createCadence,
    updateCadence,
    removeCadence,
    addStep,
    updateStep,
    removeStep,
  } = useXJCadences(agentId);
  const [name, setName] = useState('');

  return (
    <div className="space-y-4">
      {canEdit && (
        <Card>
          <CardContent className="flex flex-wrap items-end gap-2 pt-6">
            <div className="space-y-1.5">
              <Label className="text-xs">Nova cadência</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Sem resposta na triagem" />
            </div>
            <Button
              size="sm"
              disabled={!name.trim() || createCadence.isPending}
              onClick={async () => {
                await createCadence.mutateAsync({ name: name.trim() });
                setName('');
              }}
            >
              <Plus className="mr-1.5 h-4 w-4" /> Criar
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading && <Skeleton className="h-40 w-full" />}
      {!isLoading && cadences.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhuma cadência configurada.</p>
      )}

      {cadences.map((cadence) => (
        <Card key={cadence.id}>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base">{cadence.name}</CardTitle>
              {cadence.stage && <Badge variant="secondary">{XJ_STAGE_LABELS[cadence.stage as any] ?? cadence.stage}</Badge>}
              <Badge variant={cadence.is_active ? 'default' : 'outline'}>
                {cadence.is_active ? 'Ativa' : 'Inativa'}
              </Badge>
            </div>
            {canEdit && (
              <div className="flex items-center gap-2">
                <Switch
                  checked={cadence.is_active}
                  onCheckedChange={(v) => updateCadence.mutate({ id: cadence.id, patch: { is_active: v } })}
                />
                <Button size="sm" variant="ghost" onClick={() => removeCadence.mutate(cadence.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Etapa alvo</Label>
                <Select
                  value={cadence.stage ?? 'any'}
                  onValueChange={(v) => updateCadence.mutate({ id: cadence.id, patch: { stage: v === 'any' ? null : v } })}
                  disabled={!canEdit}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Qualquer etapa</SelectItem>
                    {XJ_STAGES.map((s) => (
                      <SelectItem key={s} value={s}>{XJ_STAGE_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm">Parar quando o lead responder</span>
                <Switch
                  checked={cadence.stop_on_reply}
                  onCheckedChange={(v) => updateCadence.mutate({ id: cadence.id, patch: { stop_on_reply: v } })}
                  disabled={!canEdit}
                />
              </div>
            </div>

            {(cadence.steps ?? []).map((step) => (
              <div key={step.id} className="grid gap-2 rounded-lg border p-3 md:grid-cols-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Atraso (min)</Label>
                  <Input
                    type="number"
                    value={step.delay_minutes}
                    onChange={(e) => updateStep.mutate({ id: step.id, patch: { delay_minutes: Number(e.target.value) } })}
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Tipo</Label>
                  <Select
                    value={step.content_type}
                    onValueChange={(v) => updateStep.mutate({ id: step.id, patch: { content_type: v } })}
                    disabled={!canEdit}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {XJ_FOLLOWUP_CONTENT_TYPES.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Modo</Label>
                  <Select
                    value={step.content_mode}
                    onValueChange={(v) => updateStep.mutate({ id: step.id, patch: { content_mode: v as any } })}
                    disabled={!canEdit}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">Texto fixo</SelectItem>
                      <SelectItem value="ai">Gerado pela IA</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end justify-end">
                  {canEdit && (
                    <Button size="sm" variant="ghost" onClick={() => removeStep.mutate(step.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="space-y-1.5 md:col-span-4">
                  <Label className="text-xs">
                    {step.content_mode === 'ai' ? 'Instrução para a IA' : 'Mensagem'}
                  </Label>
                  <Textarea
                    rows={2}
                    value={(step.content_mode === 'ai' ? step.generation_prompt : step.text_content) ?? ''}
                    onChange={(e) =>
                      updateStep.mutate({
                        id: step.id,
                        patch:
                          step.content_mode === 'ai'
                            ? { generation_prompt: e.target.value }
                            : { text_content: e.target.value },
                      })
                    }
                    disabled={!canEdit}
                  />
                </div>
                {step.content_type !== 'text' && (
                  <div className="space-y-1.5 md:col-span-4">
                    <Label className="text-xs">URL da mídia / link</Label>
                    <Input
                      value={(step.content_type === 'link' ? step.link_url : step.media_url) ?? ''}
                      onChange={(e) =>
                        updateStep.mutate({
                          id: step.id,
                          patch: step.content_type === 'link' ? { link_url: e.target.value } : { media_url: e.target.value },
                        })
                      }
                      disabled={!canEdit}
                    />
                  </div>
                )}
              </div>
            ))}

            {canEdit && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => addStep.mutate({ cadenceId: cadence.id, position: (cadence.steps ?? []).length })}
              >
                <Plus className="mr-1.5 h-4 w-4" /> Adicionar passo
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}