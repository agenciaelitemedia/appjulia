# Checklist de migração — 2026-09-02

## 1. Secrets a recriar no novo projeto (nomes apenas — valores NUNCA saem daqui)

Os valores continuam apenas no cofre de secrets. Copie-os pela UI autenticada (Cloud → Secrets) ou obtenha novamente no provedor de origem.

| Secret | Origem do valor |
|---|---|
| `DAILY_API_KEY` | painel Daily.co |
| `EXTERNAL_DB_CA_CERT` | Postgres externo legado |
| `EXTERNAL_DB_DATABASE` | Postgres externo legado |
| `EXTERNAL_DB_HOST` | Postgres externo legado |
| `EXTERNAL_DB_PASSWORD` | Postgres externo legado |
| `EXTERNAL_DB_PORT` | Postgres externo legado |
| `EXTERNAL_DB_URL` | Postgres externo legado |
| `EXTERNAL_DB_USERNAME` | Postgres externo legado |
| `LOVABLE_API_KEY` | gerado automaticamente pelo Lovable AI (não migrar manualmente) |
| `META_APP_ID` | Meta for Developers |
| `META_APP_SECRET` | Meta for Developers |
| `META_WEBHOOK_VERIFY_TOKEN` | definido por você (webhook Meta) |
| `N8N_HUB_SEND_URL` | n8n |
| `N8N_HUB_WEBHOOK_URL` | n8n |
| `UAZAPI_ADMIN_TOKEN` | painel UaZapi |
| `UAZAPI_BASE_URL` | painel UaZapi |
| `UAZAPI_WEBHOOK_URL` | URL do novo projeto (atualizar!) |
| `VAPID_PRIVATE_KEY` | VAPID (web push) — pode gerar novo par |
| `VAPID_PUBLIC_KEY` | VAPID (web push) — pode gerar novo par |
| `VAPID_SUBJECT` | VAPID (web push) — pode gerar novo par |
| `WAVOIP_API_KEY` | painel Wavoip |
| `XJ_INTERNAL_SECRET` | gerar novo valor aleatório |
| `ZAPSIGN_API_TOKEN` | painel ZapSign |

> Após migrar, reaponte todos os webhooks de terceiros (Meta, UaZapi, Asaas, Mercado Pago, InfinityPay, api4com, 3cplus, Wavoip, ZapSign) para as novas URLs de função.

## 2. Edge Functions (141)

- `advbox-integration`
- `advbox-notify`
- `advbox-query`
- `advbox-sync`
- `ai-provider-key-set`
- `alert-notifications-cron`
- `api4com-proxy`
- `api4com-webhook`
- `asaas-checkout`
- `asaas-configure-webhook`
- `asaas-webhook`
- `assigned-user-id-backfill`
- `assigned-user-id-backfill-cron`
- `batch-generate-scripts`
- `chat-ai-assist`
- `chat-ai-process`
- `chat-automation-engine`
- `chat-bulk-close`
- `chat-bulk-transfer`
- `chat-campaign-dispatcher`
- `chat-contacts-enrich`
- `chat-flow-engine`
- `chat-flow-scheduler`
- `chat-media-download`
- `chat-media-upload`
- `chat-message-react`
- `chat-public-api`
- `chat-rebalance-overflow`
- `chat-reset`
- `chat-resync-timestamps`
- `chat-return-chat`
- `chat-route-conversation`
- `chat-scheduler`
- `chat-transcribe-audio`
- `chat-webhook-dispatcher`
- `client-automation-flags`
- `consulta-documento`
- `contract-notifications-cron`
- `contract-notifications-queue`
- `copilot-chat`
- `copiloto-mcp`
- `copiloto-oauth`
- `crm-copilot-monitor`
- `datajud-monitor`
- `datajud-search`
- `db-query`
- `dsp-audience`
- `dsp-campaign-control`
- `dsp-campaign-prepare`
- `dsp-campaign-scheduler`
- `dsp-campaign-worker`
- `dsp-optout-scan`
- `image-proxy`
- `infinitypay-checkout`
- `infinitypay-webhook`
- `instagram-send`
- `instagram-webhook`
- `internal-notification-dispatch`
- `internal-notification-scheduler`
- `julia-chat-list-feed`
- `lidia-copilot`
- `link-preview`
- `mercadopago-checkout`
- `mercadopago-webhook`
- `meta-ads`
- `meta-auth`
- `meta-conversions`
- `meta-send-test`
- `meta-webhook`
- `n8n_execute`
- `n8n_execute-agent_and_followup-reactive`
- `n8n_execute-followup-stop`
- `prompt-generator`
- `queue-maintenance`
- `queue-management`
- `queue-order-checkout`
- `queue-order-create`
- `queue-provision`
- `queue-resolve-phone`
- `refresh-contact-avatar`
- `seed-uazapi-provider`
- `send-push`
- `support-assistant-webhook`
- `support-group-discovery`
- `support-transcribe-audio`
- `sync-queue-to-agent`
- `team-member-cleanup-conversations`
- `telemetry`
- `telephony-notify-paid`
- `telephony-order-checkout`
- `telephony-order-create`
- `telephony-provision`
- `threecplus-proxy`
- `threecplus-webhook`
- `ticket-media-upload`
- `uazapi-admin`
- `uazapi-chat-backfill`
- `uazapi-chat-webhook`
- `uazapi-history-cancel`
- `uazapi-history-dispatcher`
- `uazapi-history-dispatcher-heartbeat`
- `uazapi-history-force-resync`
- `uazapi-history-import`
- `uazapi-history-processor`
- `uazapi-history-resume`
- `uazapi-history-warmup`
- `uazapi-instance-manager`
- `uazapi-proxy`
- `vellip-webhook`
- `video-order-checkout`
- `video-order-create`
- `video-provision`
- `video-room`
- `waba-admin`
- `waba-send`
- `waba-templates`
- `wavoip-call-webhook`
- `wavoip-configure-webhook`
- `wavoip-connect-device`
- `wavoip-device-provision`
- `wavoip-disconnect-device`
- `wavoip-fetch-call-details`
- `wavoip-fetch-recording`
- `wavoip-providers`
- `wavoip-provision-device`
- `wavoip-reconcile-call`
- `wavoip-reconcile-runner`
- `wavoip-rename-device`
- `wavoip-sync-history`
- `wavoip-transcribe-recording`
- `wavoip-verify-webhook`
- `webchat-api`
- `x-julia-admin`
- `x-julia-engine`
- `x-julia-followup-runner`
- `x-julia-processor`
- `x-julia-tick`
- `xj-provider-config`
- `xj-zapsign`
- `zapsign-download`
- `zapsign-file`

O código completo (funções + `_shared` + `config.toml` + 366 migrations) está no zip `migracao-supabase-codigo-2026-09-02.zip`.

## 3. Ordem sugerida de migração

1. Criar o novo projeto Supabase.
2. Aplicar as migrations de `supabase/migrations/` em ordem alfabética (elas já contêm tabelas, GRANTs, RLS, funções, triggers e cron).
3. Recriar os secrets da tabela acima no novo projeto.
4. Fazer deploy das Edge Functions do zip.
5. Exportar os dados do projeto atual (Cloud → Advanced settings → Export data) e importar no novo.
6. Recriar buckets de Storage e políticas em `storage.objects`.
7. Reapontar webhooks externos e atualizar `.env` do frontend (URL + publishable key).
8. Validar login, chat, CRM, telefonia e disparos antes de desligar o antigo.
