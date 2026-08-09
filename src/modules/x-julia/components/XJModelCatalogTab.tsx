/**
 * Catálogo editável de modelos e preços do X-Julia.
 * Os valores salvos aqui sobrepõem o catálogo padrão do código e são
 * usados pelo motor no cálculo de custo das sessões.
 */
import { useMemo, useState } from 'react';
import { CloudDownload, Download, Loader2, Plus, RefreshCw, Save, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useXJModelPricingMutations,
  useXJProviderConfig,
  type XJModelPricingRow,
  type XJRemoteModel,
} from '../hooks/useXJProviderConfig';
import { XJ_LLM_PROVIDERS } from '../module';
import { XJ_MODEL_CATALOG } from '../modelCatalog';

type Draft = {
  provider: string;
  model: string;
  input_per_1m: string;
  output_per_1m: string;
  context_tokens: string;
  note: string;
  is_active: boolean;
};

const EMPTY: Draft = {
  provider: XJ_LLM_PROVIDERS[0]?.id ?? 'lovable',
  model: '',
  input_per_1m: '0',
  output_per_1m: '0',
  context_tokens: '0',
  note: '',
  is_active: true,
};

function toDraft(row: XJModelPricingRow): Draft {
  return {
    provider: row.provider,
    model: row.model,
    input_per_1m: String(row.input_per_1m ?? 0),
    output_per_1m: String(row.output_per_1m ?? 0),
    context_tokens: String(row.context_tokens ?? 0),
    note: row.note ?? '',
    is_active: row.is_active !== false,
  };
}

export function XJModelCatalogTab() {
  const { data, isLoading } = useXJProviderConfig();
  const { savePricing, deletePricing, seedPricing, fetchProviderModels, importProviderModels } =
    useXJModelPricingMutations();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [newRow, setNewRow] = useState<Draft>(EMPTY);
  const [remoteProvider, setRemoteProvider] = useState<string>(XJ_LLM_PROVIDERS[0]?.id ?? 'lovable');
  const [remoteModels, setRemoteModels] = useState<XJRemoteModel[] | null>(null);
  const [remoteFilter, setRemoteFilter] = useState('');
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const rows = useMemo(() => data?.model_pricing ?? [], [data]);
  const defaultCount = Object.keys(XJ_MODEL_CATALOG).length;

  const filteredRemote = useMemo(() => {
    const list = remoteModels ?? [];
    const q = remoteFilter.trim().toLowerCase();
    if (!q) return list;
    return list.filter((m) => m.model.toLowerCase().includes(q) || (m.note ?? '').toLowerCase().includes(q));
  }, [remoteModels, remoteFilter]);

  const selectedModels = useMemo(
    () => (remoteModels ?? []).filter((m) => selected[m.model]),
    [remoteModels, selected],
  );

  const loadRemote = () => {
    setRemoteModels(null);
    setSelected({});
    fetchProviderModels.mutate(
      { provider: remoteProvider },
      { onSuccess: (list) => setRemoteModels(list) },
    );
  };

  const draftFor = (row: XJModelPricingRow) =>
    drafts[`${row.provider}/${row.model}`] ?? toDraft(row);

  const patch = (row: XJModelPricingRow, part: Partial<Draft>) =>
    setDrafts((prev) => ({
      ...prev,
      [`${row.provider}/${row.model}`]: { ...draftFor(row), ...part },
    }));

  const submit = (d: Draft) =>
    savePricing.mutate({
      provider: d.provider.trim(),
      model: d.model.trim(),
      input_per_1m: Number(d.input_per_1m.replace(',', '.')) || 0,
      output_per_1m: Number(d.output_per_1m.replace(',', '.')) || 0,
      context_tokens: Number(d.context_tokens.replace(/\D/g, '')) || 0,
      note: d.note.trim() || null,
      is_active: d.is_active,
    });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Adicionar ou atualizar modelo</CardTitle>
          <CardDescription>
            Preços em dólar por 1 milhão de tokens. Salvar um provedor+modelo já existente atualiza os valores.
            Estes valores substituem o catálogo padrão no cálculo de custo das sessões.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-6">
            <div className="space-y-1.5">
              <Label>Provedor</Label>
              <Input
                list="xj-provider-list"
                value={newRow.provider}
                onChange={(e) => setNewRow({ ...newRow, provider: e.target.value })}
                placeholder="lovable"
              />
              <datalist id="xj-provider-list">
                {XJ_LLM_PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Modelo</Label>
              <Input
                value={newRow.model}
                onChange={(e) => setNewRow({ ...newRow, model: e.target.value })}
                placeholder="google/gemini-3.6-flash"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Entrada / 1M</Label>
              <Input
                value={newRow.input_per_1m}
                onChange={(e) => setNewRow({ ...newRow, input_per_1m: e.target.value })}
                inputMode="decimal"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Saída / 1M</Label>
              <Input
                value={newRow.output_per_1m}
                onChange={(e) => setNewRow({ ...newRow, output_per_1m: e.target.value })}
                inputMode="decimal"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Contexto (tokens)</Label>
              <Input
                value={newRow.context_tokens}
                onChange={(e) => setNewRow({ ...newRow, context_tokens: e.target.value })}
                inputMode="numeric"
              />
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-6">
            <div className="space-y-1.5 md:col-span-5">
              <Label>Observação de uso</Label>
              <Input
                value={newRow.note}
                onChange={(e) => setNewRow({ ...newRow, note: e.target.value })}
                placeholder="Rápido e barato; padrão recomendado."
              />
            </div>
            <div className="flex items-end justify-end gap-2">
              <Button
                size="sm"
                disabled={!newRow.model.trim() || !newRow.provider.trim() || savePricing.isPending}
                onClick={() => {
                  submit(newRow);
                  setNewRow(EMPTY);
                }}
              >
                {savePricing.isPending ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-1.5 h-4 w-4" />
                )}
                Adicionar
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between border-t pt-3">
            <p className="text-xs text-muted-foreground">
              O catálogo padrão do sistema tem {defaultCount} modelos e continua valendo para tudo que não estiver na lista abaixo.
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={seedPricing.isPending}
                onClick={() => seedPricing.mutate({ force: false })}
              >
                <Download className="mr-1.5 h-4 w-4" /> Importar padrão
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={seedPricing.isPending}
                onClick={() => seedPricing.mutate({ force: true })}
              >
                Restaurar valores padrão
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CloudDownload className="h-4 w-4" /> Buscar modelos no provedor
          </CardTitle>
          <CardDescription>
            Consulta a lista de modelos direto na API do provedor de LLM (usa a chave configurada). O OpenRouter
            também devolve preços e contexto automaticamente; nos demais, revise os valores depois de importar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[220px] space-y-1.5">
              <Label>Provedor</Label>
              <Select value={remoteProvider} onValueChange={setRemoteProvider}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {XJ_LLM_PROVIDERS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" onClick={loadRemote} disabled={fetchProviderModels.isPending}>
              {fetchProviderModels.isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-1.5 h-4 w-4" />
              )}
              Buscar modelos
            </Button>
            {remoteModels && (
              <div className="relative min-w-[200px] flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder="Filtrar modelos…"
                  value={remoteFilter}
                  onChange={(e) => setRemoteFilter(e.target.value)}
                />
              </div>
            )}
          </div>

          {remoteModels && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {remoteModels.length} modelo(s) encontrados · {selectedModels.length} selecionado(s)
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setSelected(
                        Object.fromEntries(filteredRemote.map((m) => [m.model, true])) as Record<string, boolean>,
                      )
                    }
                  >
                    Selecionar visíveis
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setSelected({})}>
                    Limpar
                  </Button>
                  <Button
                    size="sm"
                    disabled={!selectedModels.length || importProviderModels.isPending}
                    onClick={() =>
                      importProviderModels.mutate(
                        { provider: remoteProvider, models: selectedModels },
                        { onSuccess: () => setSelected({}) },
                      )
                    }
                  >
                    {importProviderModels.isPending ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-1.5 h-4 w-4" />
                    )}
                    Importar selecionados
                  </Button>
                </div>
              </div>
              <ScrollArea className="h-64 rounded-lg border">
                <div className="divide-y">
                  {filteredRemote.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground">Nenhum modelo para este filtro.</p>
                  ) : (
                    filteredRemote.map((m) => (
                      <label
                        key={m.model}
                        className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted/50"
                      >
                        <Checkbox
                          checked={!!selected[m.model]}
                          onCheckedChange={(v) =>
                            setSelected((prev) => ({ ...prev, [m.model]: !!v }))
                          }
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{m.model}</p>
                          {m.note && <p className="truncate text-xs text-muted-foreground">{m.note}</p>}
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {m.input_per_1m != null && m.output_per_1m != null && (
                            <Badge variant="secondary" className="text-[11px]">
                              ${m.input_per_1m} / ${m.output_per_1m} por 1M
                            </Badge>
                          )}
                          {!!m.context_tokens && (
                            <Badge variant="outline" className="text-[11px]">
                              {Number(m.context_tokens).toLocaleString('pt-BR')} ctx
                            </Badge>
                          )}
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </ScrollArea>
            </>
          )}
        </CardContent>
      </Card>

      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Nenhum preço personalizado. Use "Importar padrão" para começar a partir do catálogo do sistema.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Modelos personalizados ({rows.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {rows.map((row) => {
              const d = draftFor(row);
              return (
                <div
                  key={`${row.provider}/${row.model}`}
                  className="grid items-end gap-2 rounded-lg border p-2 md:grid-cols-12"
                >
                  <div className="md:col-span-3">
                    <p className="truncate text-sm font-medium">{row.model}</p>
                    <p className="text-xs text-muted-foreground">{row.provider}</p>
                  </div>
                  <Input
                    className="md:col-span-1"
                    value={d.input_per_1m}
                    inputMode="decimal"
                    onChange={(e) => patch(row, { input_per_1m: e.target.value })}
                  />
                  <Input
                    className="md:col-span-1"
                    value={d.output_per_1m}
                    inputMode="decimal"
                    onChange={(e) => patch(row, { output_per_1m: e.target.value })}
                  />
                  <Input
                    className="md:col-span-2"
                    value={d.context_tokens}
                    inputMode="numeric"
                    onChange={(e) => patch(row, { context_tokens: e.target.value })}
                  />
                  <Input
                    className="md:col-span-3"
                    value={d.note}
                    placeholder="observação"
                    onChange={(e) => patch(row, { note: e.target.value })}
                  />
                  <div className="flex items-center justify-end gap-1.5 md:col-span-2">
                    <Switch
                      checked={d.is_active}
                      onCheckedChange={(v) => patch(row, { is_active: v })}
                      aria-label="Ativo"
                    />
                    <Button size="icon" variant="ghost" onClick={() => submit(d)} title="Salvar">
                      <Save className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" title="Remover">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover {row.model} do catálogo?</AlertDialogTitle>
                          <AlertDialogDescription>
                            O modelo volta a usar o preço padrão do sistema (ou custo zero, se não existir lá).
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() =>
                              deletePricing.mutate({ provider: row.provider, model: row.model })
                            }
                          >
                            Remover
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              );
            })}
            <p className="pt-1 text-xs text-muted-foreground">
              Colunas: entrada / 1M · saída / 1M · contexto (tokens) · observação. Valores em US$.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
