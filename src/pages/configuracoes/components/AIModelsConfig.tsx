import { useState } from 'react';
import {
  MessageSquare, BarChart2, MessagesSquare, FileText, AudioLines,
  Bot, Headphones, ScrollText, Settings, RotateCcw, Plus, Trash2, Star, KeyRound, Phone,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useAIModelsConfig, type AIFeature, type AIProvider, DEFAULT_PROMPTS } from '@/hooks/useAIModelsConfig';
import { useAIModelList } from '@/hooks/useAIModelList';
import { useProviderKey } from '@/hooks/useProviderKey';

interface AgentDef {
  feature: AIFeature;
  icon: React.ReactNode;
  title: string;
  description: string;
  hasPrompt: boolean;
}

const AGENTS: AgentDef[] = [
  {
    feature: 'chat_assist',
    icon: <MessageSquare className="w-4 h-4 text-blue-500" />,
    title: 'AIAssistPanel (Chat)',
    description: 'Sugestão de resposta e análise de sentimento no painel de IA das conversas (edge: chat-ai-assist). Endpoints: Lovable AI Gateway ou OpenRouter.',
    hasPrompt: false,
  },
  {
    feature: 'chat_resume',
    icon: <FileText className="w-4 h-4 text-amber-500" />,
    title: 'Resumo de Conversa',
    description: 'Resumo automático ao resolver/encerrar conversa e em ações manuais (edge: chat-ai-assist). Endpoints: Lovable ou OpenRouter.',
    hasPrompt: true,
  },
  {
    feature: 'chat_transcription',
    icon: <AudioLines className="w-4 h-4 text-cyan-500" />,
    title: 'Transcrição de Áudio',
    description: 'Transcreve áudios recebidos/enviados nas conversas (edge: chat-transcribe-audio). Requer modelo com suporte a áudio. Endpoints: Lovable ou OpenRouter.',
    hasPrompt: true,
  },
  {
    feature: 'copilot_crm',
    icon: <BarChart2 className="w-4 h-4 text-green-500" />,
    title: 'Copiloto CRM (Monitor)',
    description: 'Monitor automático de leads e oportunidades no CRM com tool use (edge: crm-copilot-monitor). Endpoints: Lovable ou OpenRouter.',
    hasPrompt: false,
  },
  {
    feature: 'copilot_chat',
    icon: <MessagesSquare className="w-4 h-4 text-purple-500" />,
    title: 'Copiloto Chat Julia',
    description: 'Chat interativo sobre CRM, conversas e relatórios, com streaming (edge: copilot-chat). Endpoints: Lovable ou OpenRouter.',
    hasPrompt: false,
  },
  {
    feature: 'chat_autoreply',
    icon: <Bot className="w-4 h-4 text-rose-500" />,
    title: 'Autoresposta Chat',
    description: 'Classifica mensagens recebidas e gera respostas automáticas (edge: chat-ai-process). Regras de autoreply podem sobrescrever o modelo. Endpoints: Lovable ou OpenRouter.',
    hasPrompt: false,
  },
  {
    feature: 'support_transcription',
    icon: <Headphones className="w-4 h-4 text-teal-500" />,
    title: 'Transcrição Suporte',
    description: 'Transcreve áudio e descreve imagens no grupo de suporte (edge: support-transcribe-audio). Requer modelo com áudio/visão. Endpoints: Lovable ou OpenRouter.',
    hasPrompt: false,
  },
  {
    feature: 'script_generation',
    icon: <ScrollText className="w-4 h-4 text-indigo-500" />,
    title: 'Geração de Roteiros',
    description: 'Gera roteiros jurídicos, individual e em lote (edge: prompt-generator e batch-generate-scripts). Endpoints: Lovable ou OpenRouter.',
    hasPrompt: false,
  },
  {
    feature: 'wavoip_transcription',
    icon: <Phone className="w-4 h-4 text-cyan-600" />,
    title: 'Transcrição de Chamadas Wavoip',
    description: 'Modelo de STT (áudio→texto) que transcreve a gravação da chamada no formato "Atendente:/Cliente:" (edge: wavoip-transcribe-recording). Use um modelo de transcrição, ex.: openai/gpt-4o-mini-transcribe. Depende da flag "Transcrição" no plano do cliente.',
    hasPrompt: true,
  },
  {
    feature: 'wavoip_call_summary',
    icon: <FileText className="w-4 h-4 text-cyan-800" />,
    title: 'Resumo de Chamadas Wavoip',
    description: 'Modelo de chat que gera um resumo compacto a partir da transcrição já gerada (opera apenas sobre o texto — não recebe o áudio). Configurável independentemente do modelo de transcrição. Depende da flag "Resumo da gravação" no plano do cliente.',
    hasPrompt: true,
  },
];

function AgentSettingsDialog({
  agent, open, onOpenChange, initialTab,
}: {
  agent: AgentDef;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialTab: string;
}) {
  const { getPrompt, upsertModel } = useAIModelsConfig();
  const { items, createItem, updateItem, deleteItem } = useAIModelList(agent.feature);
  const { status: keyStatus, setKey } = useProviderKey('openrouter');

  const [draftPrompt, setDraftPrompt] = useState(getPrompt(agent.feature));
  const [savingPrompt, setSavingPrompt] = useState(false);

  const [newLabel, setNewLabel] = useState('');
  const [newModel, setNewModel] = useState('');
  const [newProvider, setNewProvider] = useState<AIProvider>('openrouter');

  const [keyInput, setKeyInput] = useState('');
  const [savingKey, setSavingKey] = useState(false);

  const handleSavePrompt = async () => {
    setSavingPrompt(true);
    try {
      await upsertModel.mutateAsync({ feature: agent.feature, prompt: draftPrompt.trim() ? draftPrompt : null });
      toast.success('Prompt salvo');
    } catch {
      toast.error('Erro ao salvar prompt');
    } finally {
      setSavingPrompt(false);
    }
  };

  const handleAddModel = async () => {
    if (!newLabel.trim() || !newModel.trim()) {
      toast.error('Informe rótulo e modelo');
      return;
    }
    try {
      await createItem.mutateAsync({
        label: newLabel.trim(),
        model: newModel.trim(),
        provider: newProvider,
        sort_order: items.length + 1,
      });
      setNewLabel('');
      setNewModel('');
      setNewProvider('openrouter');
      toast.success('Modelo adicionado');
    } catch {
      toast.error('Erro ao adicionar modelo');
    }
  };

  const handleSaveKey = async () => {
    setSavingKey(true);
    try {
      await setKey.mutateAsync(keyInput.trim());
      setKeyInput('');
      toast.success(keyInput.trim() ? 'Chave salva' : 'Chave removida');
    } catch {
      toast.error('Erro ao salvar chave');
    } finally {
      setSavingKey(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-4 h-4" /> Configurações — {agent.title}
          </DialogTitle>
          <DialogDescription>{agent.description}</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue={initialTab}>
          <TabsList>
            <TabsTrigger value="models">Modelos</TabsTrigger>
            {agent.hasPrompt && <TabsTrigger value="prompt">Prompt</TabsTrigger>}
            <TabsTrigger value="key">Chave OpenRouter</TabsTrigger>
          </TabsList>

          {/* Models list */}
          <TabsContent value="models" className="space-y-3">
            <div className="space-y-2 max-h-[280px] overflow-y-auto">
              {items.map((it) => (
                <div key={it.id} className="flex items-center gap-2 rounded-md border p-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{it.label}</span>
                      {it.is_default && <Star className="w-3 h-3 text-amber-500" />}
                      <Badge variant={it.provider === 'lovable' ? 'secondary' : 'outline'} className="text-[10px]">
                        {it.provider}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground font-mono truncate block">{it.model}</span>
                  </div>
                  {!it.is_default && (
                    <Button
                      type="button" variant="ghost" size="icon"
                      title="Remover" onClick={() => deleteItem.mutate(it.id)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <div className="rounded-md border p-3 space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Adicionar modelo</div>
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Rótulo (ex: GPT-4o)" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
                <Input placeholder="Modelo (ex: openai/gpt-4o)" value={newModel} onChange={(e) => setNewModel(e.target.value)} />
              </div>
              <div className="flex items-center gap-2">
                <Select value={newProvider} onValueChange={(v) => setNewProvider(v as AIProvider)}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lovable">Lovable AI</SelectItem>
                    <SelectItem value="openrouter">OpenRouter</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="button" onClick={handleAddModel} className="ml-auto">
                  <Plus className="w-4 h-4 mr-1" /> Adicionar
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Modelos OpenRouter exigem a chave configurada na aba "Chave OpenRouter".
              </p>
            </div>
          </TabsContent>

          {/* Prompt editor */}
          {agent.hasPrompt && (
            <TabsContent value="prompt" className="space-y-2">
              <Textarea
                value={draftPrompt}
                onChange={(e) => setDraftPrompt(e.target.value)}
                className="min-h-[240px] font-mono text-xs"
                placeholder={DEFAULT_PROMPTS[agent.feature]}
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setDraftPrompt(DEFAULT_PROMPTS[agent.feature])} disabled={savingPrompt}>
                  <RotateCcw className="w-4 h-4 mr-1" /> Restaurar padrão
                </Button>
                <Button type="button" onClick={handleSavePrompt} disabled={savingPrompt}>
                  {savingPrompt ? 'Salvando…' : 'Salvar prompt'}
                </Button>
              </div>
            </TabsContent>
          )}

          {/* OpenRouter API key */}
          <TabsContent value="key" className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <KeyRound className="w-4 h-4 text-muted-foreground" />
              {keyStatus.configured
                ? <span>Chave configurada: <span className="font-mono">{keyStatus.masked}</span></span>
                : <span className="text-muted-foreground">Nenhuma chave OpenRouter configurada.</span>}
            </div>
            <Input
              type="password"
              placeholder="sk-or-..."
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              A chave é compartilhada por todos os agentes que usam OpenRouter e fica armazenada de forma segura
              (não é exposta ao navegador). Deixe em branco e salve para remover.
            </p>
            <div className="flex justify-end">
              <Button type="button" onClick={handleSaveKey} disabled={savingKey}>
                {savingKey ? 'Salvando…' : 'Salvar chave'}
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FeatureCard({ agent }: { agent: AgentDef }) {
  const { getModel, upsertModel } = useAIModelsConfig();
  const { items } = useAIModelList(agent.feature);
  const { status: keyStatus } = useProviderKey('openrouter');

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState('models');

  const currentModel = getModel(agent.feature);

  // Fixed Lovable default (Gemini Flash) — always available, never -pro.
  const LOVABLE_DEFAULT = {
    id: '__lovable_default',
    feature: agent.feature,
    label: 'Lovable AI · Gemini 2.5 Flash (padrão)',
    model: 'google/gemini-2.5-flash',
    provider: 'lovable' as AIProvider,
    is_default: true,
    sort_order: -1,
    created_at: '',
  };

  // Filter out any Lovable *-pro entries; keep all OpenRouter entries as-is.
  const filteredItems = items.filter(
    (i) => !(i.provider === 'lovable' && /-pro($|-)/i.test(i.model)),
  );

  // Compose: fixed Lovable default first + the rest (avoid duplicates of the default model).
  const baseOptions = [
    LOVABLE_DEFAULT,
    ...filteredItems.filter((i) => i.model !== LOVABLE_DEFAULT.model),
  ];

  // Ensure the currently selected model is selectable even if not in the curated list.
  const options = baseOptions.some((i) => i.model === currentModel)
    ? baseOptions
    : [
        ...baseOptions,
        {
          id: '__current',
          feature: agent.feature,
          label: currentModel,
          model: currentModel,
          provider: 'openrouter' as AIProvider,
          is_default: false,
          sort_order: 999,
          created_at: '',
        },
      ];

  const handleSelect = async (model: string) => {
    const item = options.find((i) => i.model === model);
    const provider: AIProvider = item?.provider ?? 'lovable';
    try {
      await upsertModel.mutateAsync({ feature: agent.feature, model, provider });
      if (provider === 'openrouter' && !keyStatus.configured) {
        toast.warning('Modelo OpenRouter selecionado — configure a chave nas configurações.');
        setSettingsTab('key');
        setSettingsOpen(true);
      } else {
        toast.success('Modelo atualizado');
      }
    } catch {
      toast.error('Erro ao salvar modelo');
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          {agent.icon}
          {agent.title}
        </CardTitle>
        <CardDescription>{agent.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <Select value={currentModel} onValueChange={handleSelect}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Selecione um modelo" />
            </SelectTrigger>
            <SelectContent>
              {options.map((m) => (
                <SelectItem key={m.id} value={m.model}>
                  {m.label}{m.provider === 'openrouter' ? ' · OpenRouter' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button" variant="outline" size="icon"
            title="Configurações"
            onClick={() => { setSettingsTab('models'); setSettingsOpen(true); }}
          >
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>

      {settingsOpen && (
        <AgentSettingsDialog
          agent={agent}
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          initialTab={settingsTab}
        />
      )}
    </Card>
  );
}

export function AIModelsConfig() {
  const { isLoading } = useAIModelsConfig();

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {AGENTS.map((a) => (
          <Card key={a.feature}>
            <CardHeader className="pb-3">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-64 mt-1" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-9 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {AGENTS.map((agent) => (
        <FeatureCard key={agent.feature} agent={agent} />
      ))}
    </div>
  );
}
