import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ShieldAlert,
  Copy,
  Check,
  Code2,
  KeyRound,
  BookOpen,
  Play,
  Database,
  HardDrive,
  Activity,
  RefreshCw,
  AlertTriangle,
  Server,
  Lock,
  ChevronRight,
} from 'lucide-react';
import { usePermission } from '@/hooks/usePermission';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';

const EDGE_FUNCTIONS: string[] = [
  'advbox-integration', 'advbox-notify', 'advbox-query', 'advbox-sync', 'ai-provider-key-set',
  'alert-notifications-cron', 'api4com-proxy', 'api4com-webhook', 'asaas-checkout', 'asaas-configure-webhook',
  'asaas-webhook', 'assigned-user-id-backfill-cron', 'assigned-user-id-backfill', 'batch-generate-scripts',
  'chat-ai-assist', 'chat-ai-process', 'chat-automation-engine', 'chat-bulk-close', 'chat-bulk-transfer',
  'chat-campaign-dispatcher', 'chat-rebalance-overflow', 'chat-resync-timestamps', 'chat-transcribe-audio',
  'copiloto-mcp', 'copiloto-oauth', 'contract-notifications-cron', 'datajud-monitor', 'datajud-search',
  'infinitypay-checkout', 'infinitypay-webhook', 'internal-notification-dispatch', 'internal-notification-scheduler',
  'lidia-copilot', 'mercadopago-checkout', 'mercadopago-webhook', 'meta-ads', 'meta-conversions', 'meta-webhook',
  'n8n_execute-agent_and_followup-reactive', 'n8n_execute-followup-stop', 'phone-buy-plan', 'queue-checkout',
  'queue-order-checkout', 'queue-order-create', 'queue-provision', 'send-push', 'support-assistant-webhook',
  'support-group-discovery', 'support-transcribe-audio', 'telemetry', 'threecplus-proxy', 'threecplus-webhook',
  'uazapi-chat-webhook', 'uazapi-history-dispatcher', 'uazapi-history-dispatcher-heartbeat', 'uazapi-history-processor',
  'uazapi-history-resume', 'uazapi-proxy', 'video-order-checkout', 'video-order-create', 'video-provision',
  'video-room', 'waba-admin', 'waba-send', 'waba-templates', 'wavoip-call-webhook', 'wavoip-configure-webhook',
  'wavoip-connect-device', 'wavoip-device-provision', 'wavoip-disconnect-device', 'wavoip-fetch-call-details',
  'wavoip-fetch-recording', 'wavoip-providers', 'wavoip-provision-device', 'wavoip-reconcile-call',
  'wavoip-reconcile-runner', 'wavoip-rename-device', 'wavoip-sync-history', 'wavoip-transcribe-recording',
  'wavoip-verify-webhook', 'webchat-api', 'x-julia-admin', 'x-julia-engine', 'x-julia-followup-runner',
  'x-julia-processor', 'x-julia-tick', 'xj-provider-config', 'xj-zapsign', 'zapsign-download', 'zapsign-file',
];

const SECRETS: { name: string; origin: string }[] = [
  { name: 'DAILY_API_KEY', origin: 'painel Daily.co' },
  { name: 'EXTERNAL_DB_CA_CERT', origin: 'Postgres externo legado' },
  { name: 'EXTERNAL_DB_DATABASE', origin: 'Postgres externo legado' },
  { name: 'EXTERNAL_DB_HOST', origin: 'Postgres externo legado' },
  { name: 'EXTERNAL_DB_PASSWORD', origin: 'Postgres externo legado' },
  { name: 'EXTERNAL_DB_PORT', origin: 'Postgres externo legado' },
  { name: 'EXTERNAL_DB_URL', origin: 'Postgres externo legado' },
  { name: 'EXTERNAL_DB_USERNAME', origin: 'Postgres externo legado' },
  { name: 'LOVABLE_API_KEY', origin: 'gerenciado pela plataforma (não migrar)' },
  { name: 'META_APP_ID', origin: 'Meta for Developers' },
  { name: 'META_APP_SECRET', origin: 'Meta for Developers' },
  { name: 'META_WEBHOOK_VERIFY_TOKEN', origin: 'webhook Meta (definido por você)' },
  { name: 'N8N_HUB_SEND_URL', origin: 'n8n' },
  { name: 'N8N_HUB_WEBHOOK_URL', origin: 'n8n' },
  { name: 'UAZAPI_ADMIN_TOKEN', origin: 'painel UaZapi' },
  { name: 'UAZAPI_BASE_URL', origin: 'painel UaZapi' },
  { name: 'UAZAPI_WEBHOOK_URL', origin: 'URL do novo projeto (atualizar!)' },
  { name: 'VAPID_PRIVATE_KEY', origin: 'VAPID (gerar novo par)' },
  { name: 'VAPID_PUBLIC_KEY', origin: 'VAPID (gerar novo par)' },
  { name: 'VAPID_SUBJECT', origin: 'VAPID (gerar novo par)' },
  { name: 'WAVOIP_API_KEY', origin: 'painel Wavoip/ZAP Call' },
  { name: 'XJ_INTERNAL_SECRET', origin: 'gerar novo valor aleatório' },
  { name: 'ZAPSIGN_API_TOKEN', origin: 'painel ZapSign' },
];

const BOOTSTRAP_SQL = `CREATE OR REPLACE FUNCTION public.exec_sql(sql_query text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  EXECUTE sql_query;
  RETURN jsonb_build_object('ok', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM, 'detail', SQLSTATE);
END;
$$;

GRANT EXECUTE ON FUNCTION public.exec_sql TO service_role;
GRANT EXECUTE ON FUNCTION public.exec_sql TO authenticated;
GRANT EXECUTE ON FUNCTION public.exec_sql TO anon;`;

const SKIP_DATA_DEFAULT = new Set([
  'uazapi_history_items', 'chat_dropped_messages', 'webhook_logs', 'webhook_queue',
  'chat_legacy_cache', 'migration_runs', 'migration_steps',
]);

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
      {label}
    </Button>
  );
}

function StatusBadge({ status }: { status?: string }) {
  const variant =
    status === 'finished' ? 'default' :
    status === 'running' ? 'secondary' :
    status === 'failed' ? 'destructive' :
    status === 'skipped' || status === 'needs_bootstrap' ? 'outline' : 'secondary';
  return <Badge variant={variant}>{status || 'pending'}</Badge>;
}

export default function PainelMigracaoPage() {
  const { isAdmin } = usePermission();
  const [targetUrl, setTargetUrl] = useState('');
  const [targetKey, setTargetKey] = useState('');
  const [runId, setRunId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('instrucoes');
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [precheckResult, setPrecheckResult] = useState<any>(null);
  const [schemaResult, setSchemaResult] = useState<any>(null);
  const [tables, setTables] = useState<string[]>([]);
  const [tableResults, setTableResults] = useState<Record<string, any>>({});
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const [buckets, setBuckets] = useState<any[]>([]);
  const [storageResult, setStorageResult] = useState<any>(null);
  const [steps, setSteps] = useState<any[]>([]);
  const [runStatus, setRunStatus] = useState<string>('pending');

  useEffect(() => {
    if (!runId) return;
    const interval = setInterval(() => loadRun(runId), 3000);
    loadRun(runId);
    return () => clearInterval(interval);
  }, [runId]);

  async function loadRun(id: string) {
    const { data: run } = await supabase.from('migration_runs').select('*').eq('id', id).single();
    if (run) setRunStatus(run.status);
    const { data: stepRows } = await supabase
      .from('migration_steps')
      .select('*')
      .eq('run_id', id)
      .order('created_at', { ascending: true });
    if (stepRows) setSteps(stepRows);
  }

  async function call(action: string, options?: any) {
    if (!targetUrl || !targetKey) throw new Error('Preencha URL e service_role key do destino');
    setLoading((l) => ({ ...l, [action]: true }));
    try {
      const { data, error } = await supabase.functions.invoke('migracao-executar', {
        body: {
          action,
          run_id: runId,
          target_url: targetUrl,
          target_service_role_key: targetKey,
          options,
        },
      });
      if (error) throw error;
      if (data?.run_id && !runId) setRunId(data.run_id);
      return data;
    } finally {
      setLoading((l) => ({ ...l, [action]: false }));
    }
  }

  async function runPrecheck() {
    try {
      const res = await call('precheck');
      setPrecheckResult(res.result);
      if (res.result?.target_exec_sql_exists) toast.success('Conexão OK e exec_sql existe no destino');
      else toast.error('Destino conectado, mas exec_sql não existe. Execute o bootstrap na aba Schema.');
    } catch (e: any) {
      toast.error(e.message || 'Falha no pré-checagem');
    }
  }

  async function runSchema(dryRun = false) {
    try {
      const res = await call('schema', { dry_run: dryRun });
      setSchemaResult(res.result);
      if (!dryRun && res.result?.bootstrap_required) {
        toast.error('Bootstrap necessário: execute o SQL inicial no destino.');
      } else if (!dryRun) {
        toast.success(`DDL aplicado: ${res.result?.tables_applied || 0} tabelas`);
      }
    } catch (e: any) {
      toast.error(e.message || 'Falha no schema');
    }
  }

  async function loadTables() {
    const { data, error } = await (supabase as any)
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_type', 'BASE TABLE')
      .order('table_name');
    if (error) {
      toast.error(error.message);
      return;
    }
    const names = (data || [])
      .map((t: any) => t.table_name as string)
      .filter((n: string) => !n.startsWith('migration_') && !SKIP_DATA_DEFAULT.has(n));
    setTables(names);
  }

  async function copyTable(table: string) {
    setLoading((l) => ({ ...l, [`data:${table}`]: true }));
    try {
      let offset = 0;
      let total = 0;
      while (true) {
        const res = await call('data_chunk', { table, offset });
        total += res.result?.rows_copied || 0;
        setTableResults((prev) => ({
          ...prev,
          [table]: { ...res.result, totalCopied: total },
        }));
        if (!res.result?.next_offset) break;
        offset = res.result.next_offset;
      }
      toast.success(`${table}: ${total} registros copiados`);
    } catch (e: any) {
      toast.error(e.message || `Falha ao copiar ${table}`);
    } finally {
      setLoading((l) => ({ ...l, [`data:${table}`]: false }));
    }
  }

  async function copyAllTables() {
    if (!tables.length) await loadTables();
    for (const t of tables.length ? tables : []) {
      await copyTable(t);
    }
  }

  async function runVerify() {
    try {
      const res = await call('verify');
      setVerifyResult(res.result);
      toast.success(`Verificação: ${res.result?.ok_count}/${res.result?.total} tabelas iguais`);
    } catch (e: any) {
      toast.error(e.message || 'Falha na verificação');
    }
  }

  async function loadBuckets() {
    const { data, error } = await supabase.storage.listBuckets();
    if (error) {
      toast.error(error.message);
      return;
    }
    setBuckets(data || []);
  }

  async function copyStorage(bucket?: string) {
    try {
      const res = await call('storage_chunk', { bucket });
      setStorageResult(res.result);
      toast.success(`Storage copiado: ${res.result?.copied || 0} objetos`);
    } catch (e: any) {
      toast.error(e.message || 'Falha no storage');
    }
  }

  if (!isAdmin) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Acesso restrito</AlertTitle>
          <AlertDescription>Apenas administradores podem acessar o Painel de Migração.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Painel de Migração</h1>
          <Badge variant="secondary">temporário</Badge>
          {runStatus && <StatusBadge status={runStatus} />}
        </div>
        <p className="text-muted-foreground text-sm">
          Migração do Lovable Cloud para um Supabase externo. Preencha as credenciais do destino e execute por etapas.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Server className="h-4 w-4" /> Destino</CardTitle>
          <CardDescription>URL e service_role key do novo projeto Supabase. O service_role key nunca sai do navegador.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2">
            <label className="text-sm font-medium">URL do projeto (ex: https://xyz.supabase.co)</label>
            <Input value={targetUrl} onChange={(e) => setTargetUrl(e.target.value.trim())} placeholder="https://..." />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Service Role Key</label>
            <Input type="password" value={targetKey} onChange={(e) => setTargetKey(e.target.value.trim())} placeholder="eyJ..." />
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="instrucoes"><BookOpen className="h-4 w-4 mr-2" />Instruções</TabsTrigger>
          <TabsTrigger value="precheck"><Activity className="h-4 w-4 mr-2" />Pré-checagem</TabsTrigger>
          <TabsTrigger value="schema"><Database className="h-4 w-4 mr-2" />Schema</TabsTrigger>
          <TabsTrigger value="dados"><Database className="h-4 w-4 mr-2" />Dados</TabsTrigger>
          <TabsTrigger value="storage"><HardDrive className="h-4 w-4 mr-2" />Storage</TabsTrigger>
          <TabsTrigger value="verify"><Check className="h-4 w-4 mr-2" />Verificar</TabsTrigger>
          <TabsTrigger value="functions"><Code2 className="h-4 w-4 mr-2" />Functions</TabsTrigger>
          <TabsTrigger value="secrets"><KeyRound className="h-4 w-4 mr-2" />Secrets</TabsTrigger>
        </TabsList>

        <TabsContent value="instrucoes" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Roadmap de migração</CardTitle>
              <CardDescription>Execute na ordem. O sistema orquestra via Edge Function; DDL pesado recomenda pg_dump.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {[
                'Preencha URL + service_role key do destino.',
                'Pré-checagem: teste conexão e verifique se exec_sql existe no destino.',
                'Schema: se exec_sql não existir, execute o SQL de bootstrap no SQL Editor do destino.',
                'Dados: copie as tabelas desejadas. Para as maiores, prefira pg_dump.',
                'Storage: crie buckets e copie objetos.',
                'Verificação: compare contagens.',
                'Pós-migração: reaponte webhooks, domínios e secrets.',
              ].map((s, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="font-mono text-muted-foreground">{i + 1}.</span>
                  <span>{s}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Limitações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>Este painel não executa pg_dump. Para tabelas grandes (chat_messages, uazapi_history_items), use pg_dump | pg_restore ou COPY direto da sua máquina.</p>
              <p>Edge Functions (~141) e secrets (23) são listados, mas devem ser deployados/cadastrados manualmente no destino.</p>
              <p>Após a migração, reaponte todos os webhooks de terceiros (Meta, UaZapi, Wavoip, ZapSign, etc.) para as novas URLs.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="precheck" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-4">
              <div>
                <CardTitle>Pré-checagem</CardTitle>
                <CardDescription>Testa conexão e existência de exec_sql no destino.</CardDescription>
              </div>
              <Button onClick={runPrecheck} disabled={loading['precheck'] || !targetUrl || !targetKey}>
                {loading['precheck'] ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                Testar destino
              </Button>
            </CardHeader>
            <CardContent>
              {precheckResult ? (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span>Source Postgres</span><code>{String(precheckResult.source_version)}</code></div>
                  <div className="flex justify-between"><span>Target Postgres</span><code>{String(precheckResult.target_version)}</code></div>
                  <div className="flex justify-between items-center">
                    <span>exec_sql no destino</span>
                    <Badge variant={precheckResult.target_exec_sql_exists ? 'default' : 'destructive'}>
                      {precheckResult.target_exec_sql_exists ? 'Existe' : 'Não existe'}
                    </Badge>
                  </div>
                  {precheckResult.target_exec_sql_error && (
                    <Alert variant="destructive" className="mt-2">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Bootstrap necessário</AlertTitle>
                      <AlertDescription>{precheckResult.target_exec_sql_error}</AlertDescription>
                    </Alert>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">Clique em "Testar destino" para começar.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schema" className="mt-4 space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>DDL gerado por introspecção</AlertTitle>
            <AlertDescription>
              Cria tabelas e colunas. Para funções, triggers, índices, constraints, policies e matviews, use pg_dump ou aplique manualmente após a carga.
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader className="flex-row items-center justify-between gap-4">
              <div>
                <CardTitle>1. Bootstrap exec_sql</CardTitle>
                <CardDescription>Execute este SQL no SQL Editor do destino antes de aplicar o schema.</CardDescription>
              </div>
              <CopyButton value={BOOTSTRAP_SQL} label="Copiar SQL" />
            </CardHeader>
            <CardContent>
              <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-48">{BOOTSTRAP_SQL}</pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between gap-4">
              <div>
                <CardTitle>2. Gerar / aplicar schema</CardTitle>
                <CardDescription>Preview não altera o destino. Aplicar cria as tabelas.</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => runSchema(true)} disabled={loading['schema'] || !targetUrl || !targetKey}>Preview</Button>
                <Button onClick={() => runSchema(false)} disabled={loading['schema'] || !targetUrl || !targetKey}>
                  {loading['schema'] ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                  Aplicar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {schemaResult?.bootstrap_required && (
                <Alert variant="destructive">
                  <AlertTitle>exec_sql não existe no destino</AlertTitle>
                  <AlertDescription>Execute o SQL de bootstrap acima antes de aplicar.</AlertDescription>
                </Alert>
              )}
              {schemaResult?.ddl && (
                <>
                  <div className="text-sm text-muted-foreground">Tabelas: {schemaResult.tables || 0}</div>
                  <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-96">{schemaResult.ddl_preview || schemaResult.ddl}</pre>
                </>
              )}
              {!schemaResult && <p className="text-muted-foreground text-sm">Clique em Preview para ver o DDL.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dados" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-4">
              <div>
                <CardTitle>Cópia de dados</CardTitle>
                <CardDescription>Copia linha a linha via HTTP. Use pg_dump para tabelas grandes.</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={loadTables} disabled={loading['loadTables']}>Listar tabelas</Button>
                <Button onClick={copyAllTables} disabled={loading['copyAll'] || !targetUrl || !targetKey || !tables.length}>
                  {loading['copyAll'] ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                  Copiar todas
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {tables.length === 0 ? (
                <p className="text-muted-foreground text-sm">Clique em "Listar tabelas".</p>
              ) : (
                <div className="grid gap-2 max-h-[600px] overflow-auto">
                  {tables.map((t) => {
                    const res = tableResults[t];
                    return (
                      <div key={t} className="flex items-center justify-between gap-3 p-2 border rounded">
                        <div className="flex items-center gap-2 min-w-0">
                          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <code className="text-xs truncate">{t}</code>
                          {res && (
                            <span className="text-xs text-muted-foreground">
                              {res.totalCopied ?? res.rows_copied ?? 0} / {res.total_rows ?? '-'}
                            </span>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyTable(t)}
                          disabled={loading[`data:${t}`] || !targetUrl || !targetKey}
                        >
                          {loading[`data:${t}`] ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="storage" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-4">
              <div>
                <CardTitle>Storage</CardTitle>
                <CardDescription>Cria buckets e copia objetos.</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={loadBuckets}>Listar buckets</Button>
                <Button onClick={() => copyStorage()} disabled={loading['storage'] || !targetUrl || !targetKey}>Copiar todos</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {buckets.length === 0 && <p className="text-muted-foreground text-sm">Clique em "Listar buckets".</p>}
              <div className="flex flex-wrap gap-2">
                {buckets.map((b) => (
                  <Badge key={b.id} variant={b.public ? 'default' : 'secondary'}>
                    {b.name} {b.public ? '(público)' : '(privado)'}
                  </Badge>
                ))}
              </div>
              {buckets.map((b) => (
                <Button key={b.id} variant="outline" size="sm" onClick={() => copyStorage(b.id)} disabled={loading['storage']}>
                  Copiar {b.name}
                </Button>
              ))}
              {storageResult && (
                <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-48">{JSON.stringify(storageResult, null, 2)}</pre>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="verify" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-4">
              <div>
                <CardTitle>Verificação</CardTitle>
                <CardDescription>Compara número de linhas entre origem e destino.</CardDescription>
              </div>
              <Button onClick={runVerify} disabled={loading['verify'] || !targetUrl || !targetKey}>
                {loading['verify'] ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Activity className="h-4 w-4 mr-2" />}
                Verificar
              </Button>
            </CardHeader>
            <CardContent>
              {verifyResult ? (
                <div className="space-y-2">
                  <div className="text-sm font-medium">
                    Iguais: {verifyResult.ok_count} / {verifyResult.total}
                  </div>
                  <Progress value={verifyResult.total ? (verifyResult.ok_count / verifyResult.total) * 100 : 0} />
                  <ScrollArea className="h-[400px] border rounded">
                    <div className="p-2 space-y-1">
                      {verifyResult.tables?.map((r: any) => (
                        <div key={r.table} className={cn('flex justify-between text-xs p-1 rounded', r.ok ? 'bg-green-50' : 'bg-red-50')}>
                          <code>{r.table}</code>
                          <span className={cn(r.ok ? 'text-green-700' : 'text-red-700')}>
                            {r.source} → {r.target}
                          </span>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">Clique em Verificar.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="functions" className="mt-4">
          <Card>
            <CardHeader className="flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Edge Functions ({EDGE_FUNCTIONS.length})</CardTitle>
                <CardDescription>Deploy no destino com: supabase functions deploy</CardDescription>
              </div>
              <CopyButton value={EDGE_FUNCTIONS.join('\n')} label="Copiar lista" />
            </CardHeader>
            <CardContent>
              <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                {EDGE_FUNCTIONS.map((fn) => (
                  <code key={fn} className="text-xs font-mono bg-muted rounded px-2 py-1 break-all">{fn}</code>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="secrets" className="mt-4">
          <Card>
            <CardHeader className="flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Secrets ({SECRETS.length})</CardTitle>
                <CardDescription>Somente nomes e origem. Cadastre no destino via Supabase CLI.</CardDescription>
              </div>
              <CopyButton value={SECRETS.map((s) => s.name).join('\n')} label="Copiar nomes" />
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="divide-y">
                {SECRETS.map((s) => (
                  <li key={s.name} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <code className="text-xs font-mono">{s.name}</code>
                    <span className="text-xs text-muted-foreground">{s.origin}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4" /> Log da execução</CardTitle>
          <AlertDescription>Atualizado a cada 3 segundos. run_id: {runId || '-'}</AlertDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[240px] border rounded p-2">
            {steps.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma etapa executada.</p>
            ) : (
              <div className="space-y-2">
                {steps.map((s) => (
                  <div key={s.id} className="flex items-start justify-between gap-3 text-sm p-2 rounded hover:bg-muted">
                    <div className="min-w-0">
                      <div className="font-medium">{s.step_name}</div>
                      <div className="text-xs text-muted-foreground truncate">{s.message || s.status}</div>
                    </div>
                    <StatusBadge status={s.status} />
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
