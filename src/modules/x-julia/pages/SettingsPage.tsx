/**
 * Configuração do X-Julia — provedores de LLM/voz ativos, modelos liberados
 * e chave padrão de cada provedor (write-only).
 */
import { useEffect, useState } from 'react';
import { KeyRound, Loader2, Save } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { XJLayout } from '../components/XJLayout';
import { XJModelCatalogTab } from '../components/XJModelCatalogTab';
import { useXJProviderConfig, useXJProviderConfigMutations, type XJModelPricingRow } from '../hooks/useXJProviderConfig';
import { XJ_LLM_PROVIDERS, XJ_VOICE_PROVIDERS } from '../module';
import { formatContext, formatUsd, getXJModelInfo } from '../modelCatalog';

interface ProviderDef {
  id: string;
  label: string;
  models: string[];
  needsKey: boolean;
}

const LLM_DEFS: ProviderDef[] = XJ_LLM_PROVIDERS.map((p) => ({
  id: p.id,
  label: p.label,
  models: p.models,
  needsKey: p.needsKey,
}));

const VOICE_DEFS: ProviderDef[] = XJ_VOICE_PROVIDERS.map((p) => ({
  id: p.id,
  label: p.label,
  models: [],
  needsKey: true,
}));

export default function XJSettingsPage() {
  const { data, isLoading } = useXJProviderConfig();
  const { saveProvider } = useXJProviderConfigMutations();

  return (
    <XJLayout
      title="Configuração do X-Julia"
      description="Provedores disponíveis, modelos liberados e chave padrão de cada provedor"
    >
      <Tabs defaultValue="llm">
        <TabsList>
          <TabsTrigger value="llm">Provedores de LLM</TabsTrigger>
          <TabsTrigger value="voice">Provedores de voz</TabsTrigger>
          <TabsTrigger value="catalog">Catálogo de modelos</TabsTrigger>
        </TabsList>

        <TabsContent value="llm" className="mt-4 space-y-3">
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            LLM_DEFS.map((def) => (
              <ProviderCard
                key={def.id}
                def={def}
                kind="llm"
                setting={data?.providers.find((p) => p.provider === def.id && p.kind === 'llm')}
                catalog={data?.model_pricing ?? []}
                onSave={(payload) => saveProvider.mutate({ ...payload, provider: def.id, kind: 'llm' })}
                saving={saveProvider.isPending}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="voice" className="mt-4 space-y-3">
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            VOICE_DEFS.map((def) => (
              <ProviderCard
                key={def.id}
                def={def}
                kind="voice"
                setting={data?.providers.find((p) => p.provider === def.id && p.kind === 'voice')}
                catalog={data?.model_pricing ?? []}
                onSave={(payload) => saveProvider.mutate({ ...payload, provider: def.id, kind: 'voice' })}
                saving={saveProvider.isPending}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="catalog" className="mt-4">
          <XJModelCatalogTab />
        </TabsContent>
      </Tabs>
    </XJLayout>
  );
}

function ProviderCard({
  def,
  kind,
  setting,
  catalog,
  onSave,
  saving,
}: {
  def: ProviderDef;
  kind: 'llm' | 'voice';
  setting?: { is_enabled: boolean; enabled_models: string[]; default_key_masked: string | null };
  catalog: XJModelPricingRow[];
  onSave: (payload: { is_enabled: boolean; enabled_models: string[]; default_key?: string }) => void;
  saving: boolean;
}) {
  const [enabled, setEnabled] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [keyInput, setKeyInput] = useState('');

  // Lista de modelos exibida vem do catálogo (xj_model_pricing ativos) — assim,
  // ao atualizar o catálogo, os provedores refletem os novos modelos.
  const catalogModels = useMemo(
    () =>
      Array.from(
        new Set(
          catalog
            .filter((r) => r.provider === def.id && r.is_active !== false)
            .map((r) => r.model),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [catalog, def.id],
  );

  const availableModels = useMemo(() => {
    const base = catalogModels.length ? catalogModels : def.models;
    // mantém visíveis modelos já liberados que saíram do catálogo
    return Array.from(new Set([...base, ...(setting?.enabled_models ?? [])]));
  }, [catalogModels, def.models, setting?.enabled_models]);

  useEffect(() => {
    setEnabled(!!setting?.is_enabled);
    setModels(setting?.enabled_models ?? []);
  }, [setting]);

  const toggleModel = (model: string) =>
    setModels((prev) => (prev.includes(model) ? prev.filter((m) => m !== model) : [...prev, model]));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          {def.label}
          {!def.needsKey && <Badge variant="secondary">sem chave</Badge>}
          {setting?.default_key_masked && (
            <Badge variant="outline">
              <KeyRound className="mr-1 h-3 w-3" /> {setting.default_key_masked}
            </Badge>
          )}
        </CardTitle>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Ativo</span>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {kind === 'llm' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>Modelos liberados para os agentes</Label>
              {availableModels.length > 0 && (
                <div className="flex gap-1">
                  <Button type="button" size="sm" variant="ghost" onClick={() => setModels(availableModels)}>
                    Liberar todos
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setModels([])}>
                    Limpar
                  </Button>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {availableModels.map((model) => {
                const info = getXJModelInfo(def.id, model);
                return (
                  <button
                    key={model}
                    type="button"
                    onClick={() => toggleModel(model)}
                    title={info?.note}
                    className="rounded-full border px-2.5 py-1 text-left text-xs transition data-[on=true]:border-primary data-[on=true]:bg-primary/10"
                    data-on={models.includes(model)}
                  >
                    <span className="font-medium">{model}</span>
                    {info && (
                      <span className="ml-1.5 text-muted-foreground">
                        in {formatUsd(info.inputPer1M)} · out {formatUsd(info.outputPer1M)} · {formatContext(info.context)}
                      </span>
                    )}
                  </button>
                );
              })}
              {availableModels.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Nenhum modelo no catálogo para este provedor — importe modelos na aba "Catálogo de modelos".
                </p>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              A lista vem do catálogo de modelos ativos deste provedor. Apenas os modelos marcados aqui ficam
              disponíveis para os agentes. Preços em dólar por 1 milhão de tokens (entrada/saída).
            </p>
          </div>
        )}

        {def.needsKey && (
          <div className="space-y-1.5 md:max-w-md">
            <Label>Chave padrão do sistema</Label>
            <Input
              type="password"
              autoComplete="off"
              placeholder={setting?.default_key_masked ? 'Chave configurada — digite para substituir' : 'Cole a chave de API'}
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              A chave é gravada apenas no backend e nunca é exibida por completo.
            </p>
          </div>
        )}

        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={saving}
            onClick={() => {
              onSave({
                is_enabled: enabled,
                enabled_models: models,
                ...(def.needsKey && keyInput.trim() ? { default_key: keyInput.trim() } : {}),
              });
              setKeyInput('');
            }}
          >
            {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
            Salvar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}