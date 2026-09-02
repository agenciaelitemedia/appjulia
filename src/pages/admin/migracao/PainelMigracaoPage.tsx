import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ShieldAlert, Copy, Check, Code2, KeyRound } from 'lucide-react';
import { usePermission } from '@/hooks/usePermission';

const EDGE_FUNCTIONS: string[] = [
  'advbox-integration',
  'advbox-notify',
  'advbox-query',
  'advbox-sync',
  'ai-provider-key-set',
  'alert-notifications-cron',
  'api4com-proxy',
  'api4com-webhook',
  'asaas-checkout',
  'asaas-configure-webhook',
  'asaas-webhook',
  'assigned-user-id-backfill-cron',
  'assigned-user-id-backfill',
  'batch-generate-scripts',
  'chat-ai-assist',
  'chat-ai-process',
  'chat-automation-engine',
  'chat-bulk-close',
  'chat-bulk-transfer',
  'chat-campaign-dispatcher',
  'chat-contacts-enrich',
  'chat-flow-engine',
  'chat-flow-scheduler',
  'chat-media-download',
  'chat-media-upload',
  'chat-message-react',
  'chat-public-api',
  'chat-rebalance-overflow',
  'chat-reset',
  'chat-resync-timestamps',
  'chat-return-chat',
  'chat-route-conversation',
  'chat-scheduler',
  'chat-transcribe-audio',
  'chat-webhook-dispatcher',
  'client-automation-flags',
  'consulta-documento',
  'contract-notifications-cron',
  'contract-notifications-queue',
  'copilot-chat',
  'copiloto-mcp',
  'copiloto-oauth',
  'crm-copilot-monitor',
  'datajud-monitor',
  'datajud-search',
  'db-query',
  'dsp-audience',
  'dsp-campaign-control',
  'dsp-campaign-prepare',
  'dsp-campaign-scheduler',
  'dsp-campaign-worker',
  'dsp-optout-scan',
  'image-proxy',
  'infinitypay-checkout',
  'infinitypay-webhook',
  'instagram-send',
  'instagram-webhook',
  'internal-notification-dispatch',
  'internal-notification-scheduler',
  'julia-chat-list-feed',
  'lidia-copilot',
  'link-preview',
  'mercadopago-checkout',
  'mercadopago-webhook',
  'meta-ads',
  'meta-auth',
  'meta-conversions',
  'meta-send-test',
  'meta-webhook',
  'n8n_execute-agent_and_followup-reactive',
  'n8n_execute-followup-stop',
  'n8n_execute',
  'prompt-generator',
  'queue-maintenance',
  'queue-management',
  'queue-order-checkout',
  'queue-order-create',
  'queue-provision',
  'queue-resolve-phone',
  'refresh-contact-avatar',
  'seed-uazapi-provider',
  'send-push',
  'support-assistant-webhook',
  'support-group-discovery',
  'support-transcribe-audio',
  'sync-queue-to-agent',
  'team-member-cleanup-conversations',
  'telemetry',
  'telephony-notify-paid',
  'telephony-order-checkout',
  'telephony-order-create',
  'telephony-provision',
  'threecplus-proxy',
  'threecplus-webhook',
  'ticket-media-upload',
  'uazapi-admin',
  'uazapi-chat-backfill',
  'uazapi-chat-webhook',
  'uazapi-history-cancel',
  'uazapi-history-dispatcher-heartbeat',
  'uazapi-history-dispatcher',
  'uazapi-history-force-resync',
  'uazapi-history-import',
  'uazapi-history-processor',
  'uazapi-history-resume',
  'uazapi-history-warmup',
  'uazapi-instance-manager',
  'uazapi-proxy',
  'vellip-webhook',
  'video-order-checkout',
  'video-order-create',
  'video-provision',
  'video-room',
  'waba-admin',
  'waba-send',
  'waba-templates',
  'wavoip-call-webhook',
  'wavoip-configure-webhook',
  'wavoip-connect-device',
  'wavoip-device-provision',
  'wavoip-disconnect-device',
  'wavoip-fetch-call-details',
  'wavoip-fetch-recording',
  'wavoip-providers',
  'wavoip-provision-device',
  'wavoip-reconcile-call',
  'wavoip-reconcile-runner',
  'wavoip-rename-device',
  'wavoip-sync-history',
  'wavoip-transcribe-recording',
  'wavoip-verify-webhook',
  'webchat-api',
  'x-julia-admin',
  'x-julia-engine',
  'x-julia-followup-runner',
  'x-julia-processor',
  'x-julia-tick',
  'xj-provider-config',
  'xj-zapsign',
  'zapsign-download',
  'zapsign-file',
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
  { name: 'LOVABLE_API_KEY', origin: 'gerenciado pela plataforma (não migrar manualmente)' },
  { name: 'META_APP_ID', origin: 'Meta for Developers' },
  { name: 'META_APP_SECRET', origin: 'Meta for Developers' },
  { name: 'META_WEBHOOK_VERIFY_TOKEN', origin: 'definido por você (webhook Meta)' },
  { name: 'N8N_HUB_SEND_URL', origin: 'n8n' },
  { name: 'N8N_HUB_WEBHOOK_URL', origin: 'n8n' },
  { name: 'UAZAPI_ADMIN_TOKEN', origin: 'painel UaZapi' },
  { name: 'UAZAPI_BASE_URL', origin: 'painel UaZapi' },
  { name: 'UAZAPI_WEBHOOK_URL', origin: 'URL do novo projeto (atualizar!)' },
  { name: 'VAPID_PRIVATE_KEY', origin: 'VAPID (web push) — pode gerar novo par' },
  { name: 'VAPID_PUBLIC_KEY', origin: 'VAPID (web push) — pode gerar novo par' },
  { name: 'VAPID_SUBJECT', origin: 'VAPID (web push) — pode gerar novo par' },
  { name: 'WAVOIP_API_KEY', origin: 'painel Wavoip' },
  { name: 'XJ_INTERNAL_SECRET', origin: 'gerar novo valor aleatório' },
  { name: 'ZAPSIGN_API_TOKEN', origin: 'painel ZapSign' },
];

/** Código-fonte das Edge Functions embutido no build (sem chamadas de rede). */
const FUNCTION_SOURCES = import.meta.glob('/supabase/functions/*/index.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

function downloadFile(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function buildEdgeFunctionsFile() {
  const entries = Object.entries(FUNCTION_SOURCES).sort(([a], [b]) => a.localeCompare(b));
  const body = entries
    .map(([path, src]) => {
      const fn = path.split('/').slice(-2)[0];
      return `// ═══ ${fn} ═══\n${src}`;
    })
    .join('\n\n');
  return { count: entries.length, content: body };
}

function buildSecretsFile() {
  const lines = SECRETS.map((s) => `  ${s.name}: '', // ${s.origin}`).join('\n');
  return `// Nomes dos secrets a recadastrar no novo projeto.\n// Os valores NÃO são exportados: copie-os na interface autenticada de Secrets.\nexport const SECRETS = {\n${lines}\n} as const;\n\nexport type SecretKey = keyof typeof SECRETS;\n`;
}

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

export default function PainelMigracaoPage() {
  const { isAdmin } = usePermission();

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
    <div className="p-6 space-y-6 max-w-5xl">
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Painel de Migração</h1>
          <Badge variant="secondary">temporário</Badge>
        </div>
        <p className="text-muted-foreground text-sm">
          Apenas o essencial para a migração: as Edge Functions a publicar e os nomes dos secrets a recadastrar.
          Nenhum valor de secret é exibido aqui.
        </p>
      </header>

      <Tabs defaultValue="functions">
        <TabsList>
          <TabsTrigger value="functions">
            <Code2 className="h-4 w-4 mr-2" />
            Edge Functions ({EDGE_FUNCTIONS.length})
          </TabsTrigger>
          <TabsTrigger value="secrets">
            <KeyRound className="h-4 w-4 mr-2" />
            Secrets ({SECRETS.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="functions" className="mt-4">
          <Card>
            <CardHeader className="flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Edge Functions</CardTitle>
                <CardDescription>
                  Publique cada função no novo projeto a partir de <code>supabase/functions/</code>.
                </CardDescription>
              </div>
              <CopyButton value={EDGE_FUNCTIONS.join('\n')} label="Copiar lista" />
            </CardHeader>
            <CardContent>
              <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                {EDGE_FUNCTIONS.map((fn) => (
                  <li key={fn} className="text-xs font-mono bg-muted rounded px-2 py-1 break-all">
                    {fn}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="secrets" className="mt-4">
          <Card>
            <CardHeader className="flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Secrets</CardTitle>
                <CardDescription>
                  Somente nomes e origem do valor. Copie os valores na interface autenticada de Secrets.
                </CardDescription>
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
              <Alert>
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>Valores não são exibidos</AlertTitle>
                <AlertDescription>
                  Após migrar, reaponte os webhooks de terceiros (Meta, UaZapi, Asaas, Mercado Pago, InfinityPay,
                  api4com, 3cplus, Wavoip, ZapSign) para as novas URLs de função.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
