# Arquitetura & Camada de Dados

## Stack e Build

**Meta** (`package.json`): `version: 1.2.17` (auto-bumped no build).

**Scripts**: `dev`, `build`, `build:dev`, `lint`, `preview`, `test` (vitest), `test:watch`.

**Dependências-chave**: `react@18.3`, `react-router-dom@6.30`, `vite@5.4` + `@vitejs/plugin-react-swc`, `@tanstack/react-query@5.83`, `@supabase/supabase-js@2.91`, `jotai@2.17`, shadcn/Radix, `tailwindcss@3.4`, `recharts`, `@dnd-kit/*` (kanban CRM), `react-hook-form@7.61` + `zod@3.25`, `@tiptap/*@3.26` (editor rico), `bcryptjs@3.0.3`, `@daily-co/daily-js`/`daily-react` (vídeo), `@wavoip/wavoip-api`/`wavoip-webphone`, `jssip@3.10` (SIP), `jspdf`+`xlsx` (exports), `vitest@3.2`.

**tsconfig**: frouxo (`noImplicitAny:false`, `strictNullChecks:false`, `skipLibCheck:true`). Alias `@/* → ./src/*`.

**vite.config.ts**: porta 8080, `versionFilePlugin` custom grava `dist/version.json`, `define.__APP_VERSION__`, chama `autoBumpVersion()` no build.

## Os Dois Bancos de Dados

### Supabase (Postgres gerenciado — "Lovable Cloud")

`src/integrations/supabase/client.ts`: `createClient<Database>` com `auth.storage=localStorage`. **A auth nativa do Supabase Auth NÃO é usada** para login (login é via Postgres externo + bcrypt); o client Supabase serve para tabelas app-native, Storage, Realtime e edge functions. `project_id = zenizgyrwlonmufxnjqt`.

Schema (~177 tabelas/views em `public`), principais por domínio:

- **Chat/Inbox** (maior domínio, ~50 tabelas): `chat_conversations`, `chat_messages`, `chat_contacts`, `chat_conversation_participants/presence/tags/summaries/history`, `chat_message_reactions`, `chat_mentions`, `chat_departments`, `chat_agent_capacity`, `chat_routing_rules`, `chat_saved_views`, `chat_bots`/`_flows`/`_flow_runs`, `chat_automation_rules`/`_logs`, `chat_campaigns`/`_recipients`/`_variants`/`_schedules`, `chat_ai_autoreply_rules`/`_logs`/`chat_ai_classifications`, `chat_kb_articles`/`_categories`, `chat_csat_config`/`_responses`, `chat_sla_configs`, `chat_api_keys`, `chat_webhooks`/`_deliveries`, `chat_crm_links`, `chat_client_settings`, `chat_role_permissions`, `chat_audit_log`, `chat_lgpd_requests`, `chat_scheduled_messages`, `chat_dropped_messages`, `chat_return_chat_runs`, `chat_bulk_close_logs`, `chat_analytics_daily`, `webchat_config`/`_sessions`.
- **CRM (app-native)**: `crm_boards`, `crm_pipelines`, `crm_deals`/`_deal_history`, `crm_checklists`/`_items`, `crm_custom_fields`, `crm_internal_notes`, `crm_automation_rules`/`_logs`, `crm_audit_log`, `crm_copilot_config`/`_settings`/`_insights`/`_chat_messages`. CRM comercial: `crm_comercial_cards`/`_stages`/`_history`.
- **Tickets/Suporte**: `support_tickets`/`_ticket_messages`/`_ticket_counters`/`_protocol_counters`, `support_categories`/`_departments`/`_team_members`/`_settings`, `support_assistant_config`, `support_monitored_groups`/`_group_messages`.
- **Tarefas/Gamificação**: `tasks`/`task_items`/`task_categories`/`task_templates`/`_points_ledger`.
- **Telemetria/Presença**: `user_activity_log`, `user_device_log`, `user_performance_log`, `user_presence`/`_daily`/`_heartbeats` (particionada por mês), `mv_user_chat_daily`, `mv_user_phone_daily`, `mv_user_sessions_daily`, `user_presence_status`, `user_last_activity`, `user_device_latest`.
- **Telefonia**: `phone_call_logs`, `phone_config`, `phone_extensions`/`_extension_plans`/`_user_plans` (api4com); `vellip_call_logs`; Wavoip: `wavoip_devices`/`_device_members`/`_device_queues`/`_call_logs`/`_providers`/`_plans`/`_orders`/`_user_plans`/`_reconcile_queue`; `telephony_orders`/`_providers`.
- **Filas**: `queues`, `queue_agent_links`, `queue_providers`/`_plans`/`_orders`/`_user_plans`; view `active_queues`.
- **Vídeo (Daily.co)**: `video_call_records`, `video_orders`/`_plans`/`_user_plans`.
- **WhatsApp/uazapi (histórico)**: `uazapi_history_items`/`_runs`, `whatsapp_sync_jobs`/`_job_logs`, `dispatcher_heartbeat`, view `uazapi_history_pending_by_client`. `waba_templates`, `instagram_config`.
- **Jurídico**: `datajud_monitored_processes`/`_alerts`/`_notification_config`. Advbox vive no banco externo.
- **IA/Geração de conteúdo**: `generation_agent_prompts`/`_prompt_versions`/`_prompt_cases`, `generation_legal_cases`/`_versions`, `generation_templates`/`_template_versions`, `generation_prompt_config`; `ai_provider_keys`, `ai_usage_logs`, `client_ai_model_config`/`_list`.
- **Billing**: `julia_orders`, `julia_plans`, `julia_payment_config`, `julia_contract_template`; `contract_notification_configs`/`_logs`, `contract_deletion_audit`.
- **Ajuda**: `help_posts`/`_categories`/`_post_views`/`help_studio_editors`.
- **Notificações**: `push_notifications`, `push_subscriptions`, `internal_notifications`/`_recipients`.
- **Misc**: `user_avatars`, `module_embeds`, `quick_messages`, `link_preview_cache`, `webhook_logs`, `webhook_queue`.
- **Funções RPC**: `clear_user_presence`, `get_infra_stats`, `generate_ticket_protocol`, `gen_wavoip_friendly_code`, `map_priority_chat_to_crm`/`_crm_to_chat`, `get_return_chat_candidates`, `get_task_ranking`, `get_team_online_seconds_by_day`, `increment_contact_unread`, `increment_help_post_view`.

### Postgres Externo (legado — dados core de agentes/leads)

Acesso **exclusivo** via edge function `db-query` (`supabase/functions/db-query/index.ts`, ~3600 linhas) + wrapper `src/lib/externalDb.ts` (classe `ExternalDatabase`, singleton `externalDb`).

**Conexão**: driver `postgresjs`. Pool singleton por isolate (`max:5`, `prepare:false`, `connect_timeout:15s`, `statement_timeout:30s`, timezone `America/Sao_Paulo`). SSL via `EXTERNAL_DB_CA_CERT` ou `require`. Porta default `25061` (managed DB DigitalOcean). Retry com backoff no server **e** no cliente (`externalDb.invoke`, até 5 tentativas com jitter, detectando 502/503/504).

**Tabelas** (deduzidas das queries):
- `users` — `id, name, email, password (bcrypt), role, cod_agent, client_id, user_id (FK auto-referente = usuário pai/titular), evo_url/evo_instance/evo_apikey/hub, data_mask, use_custom_permissions, is_active, remember_token`.
- `clients` — tenant real: `name, business_name, federal_id (CNPJ), email, phone, endereço, photo (logo)`.
- `agents` — agente IA de WhatsApp: `cod_agent, client_id, user_id (owner), settings (jsonb), prompt, is_closer, agent_plan_id, due_date, status, hub/evo_*/waba_id/waba_token/waba_number_id, last_used`.
- `user_agents` — N:N usuário↔agente: `user_id, agent_id (NULL=monitora), cod_agent, can_edit_prompt, can_edit_config`.
- `agents_plan` — `name, limit (leads), satus [sic] (bool ativo)`.
- `sessions` — `id, whatsapp_number, agent_id, active`.
- `log_messages` — `session_id, created_at` (conta leads do mês).
- `crm_atendimento_cards` / `crm_atendimento_stages` — CRM de atendimento (kanban por telefone): `whatsapp_number, cod_agent, stage_id, card_id`.
- `campaing_ads` [sic] — leads de Meta Ads: `campaign_data (jsonb), session_id, created_at`.
- `modules` / `user_permissions` / `role_default_permissions` — sistema de permissões (criadas via `init_permission_system`).
- View `vw_equipe` — equipe por client_id (roles admin/user/colaborador/time/advogado/comercial).
- Tabelas Advbox: `advbox_integration`, `advbox_rules`, `advbox_processes_cache`, `advbox_notification_logs`, `advbox_client_queries`, `advbox_lead_syncs`.
- Views de performance (usadas em Dashboard/Estratégico): `vw_painelv2_desempenho_julia_all`, `vw_painelv2_desempenho_julia`.

**Actions do `db-query`** (~120, todas via `sql.unsafe(query, params)` parametrizado):
- CRUD genérico: `select` (colunas/orderBy **interpolados sem sanitização** — risco se o chamador passar valor não confiável), `insert`/`update`/`delete` (com RETURNING; `agents.settings` tem tratamento especial de JSONB).
- **`raw`** — **executa SQL arbitrário**: `sql.unsafe(query, params)` sem allowlist. Exposto no frontend via `externalDb.raw({query, params})`. **Superfície de risco crítica.**
- Auth/tenant: `login` (bcrypt, herda `client_id` do pai), `change_password`, `reset_user_password`, `get_effective_client_id` (COALESCE user→pai→user_agent), `get_client`/`update_client`/`insert_client`/`delete_client`, `search_clients`, `check_federal_id_exists`.
- Agentes/equipe: `get_user_agents`, `get_agents_list`, `search_agents`, `get_next_agent_code`, `insert_agent`/`update_agent`/`delete_agent`/`get_agent_details`/`get_agent_by_cod`, `insert_user_agent`/`delete_user_agent`/`update_user_agent_ownership`/`update_user_agent_permissions`, `update_agent_connection`/`update_agent_waba_connection`, `get_team_by_client`/`get_team_members`, `insert_team_member`/`update_team_member`/`delete_team_member`, `get_crm_agents_for_user`, `get_plans`.
- Sessões/CRM/chat: `get_session_status`/`update_session_status`/`get_inactive_sessions`, **`chat_bootstrap`** (agregador: campanhas Meta Ads + etapa CRM + status de sessão em 1 round-trip, com lógica de variantes de telefone BR), `followup_stop`.
- Permissões/módulos/filas: `init_permission_system` (cria as tabelas), `get_user_permissions`/`get_modules`/`get_menu_modules`/`create_module`/`update_module`/`delete_module`, `get_role_default_permissions`/`update_role_default_permissions`, `update_user_permissions`/`get_users_with_permissions`, `init_queue_access_system`/`get_user_queue_access`/`set_queue_members`, `init_embed_system`/`resolve_module_embed`.
- Advbox: `advbox_*` (get/save/delete integration, rules, processes, notification_logs, client_queries, lead_syncs).
- Diagnóstico: `ping`, `get_external_infra_stats`, `diagnose_agents_settings`/`normalize_agents_settings`.

**Tratamento de `settings` JSONB**: `normalizeSettings` desfaz até 3 níveis de double-stringify; inserts/updates usam `CASE WHEN jsonb_typeof(...)='string' THEN (v #>> '{}')::jsonb ELSE v END`.

## Autenticação & Autorização

Arquivos: `src/contexts/AuthContext.tsx`, `src/types/permissions.ts`, `src/lib/resolveEffectiveClientId.ts`.

**Fluxo de login**:
1. `externalDb.login(email, password)` → bcrypt no `db-query` (nunca no browser).
2. `is_active===false` → bloqueia.
3. `checkVersionAndReloadIfNeeded()` **antes** de montar estado.
4. `hydrateClientPhoto` → `setUser` → persiste `localStorage` (`AUTH_USER`, `AUTH_LAST_ACTIVITY`).
5. `loadPermissions(userId)` → `createPermissionMap`.
6. Telemetria não-bloqueante: `logUserActivity('login')` + `collectClientEnvironment`/`logUserDevice`.

**Objeto `User`**: `id, name, email, role, cod_agent?, client_id?, user_id?, evo_url/evo_instance/evo_apikey?, data_mask?, hub?, avatar?, client_name?, use_custom_permissions?, is_active?`.

**Roles**: `AppRole = admin | colaborador | user | time | advogado | comercial`. `admin` sempre passa em `hasPermission`. `admin`/`user` são titulares; `time`/`advogado`/`comercial` são membros de equipe.

**Permissões por módulo**: `ModuleCode` (~45 codes fixos + `| string` para embeds dinâmicos). `UserPermission {module_code, module_name, category, can_view, can_create, can_edit, can_delete}`. `hasPermission(moduleCode, action='view')`: admin→true; senão consulta o mapa. Custom por usuário (`use_custom_permissions`) ou herdado de `role_default_permissions`.

**resolveEffectiveClientId**: `user.client_id` se existir; senão `externalDb.getEffectiveClientId(id)`; senão varre `getUserAgents` procurando o 1º `client_id`. Mesma lógica no `restoreSession`.

**Inatividade/logout**: `INACTIVITY_TIMEOUT_MS = 30min` (const real — comentários no código dizem "1h", desatualizados). Rastreia `mousemove/mousedown/keydown/touchstart/scroll/wheel` + `visibilitychange`, throttle 5s. Checagem a cada 30s. Expira → `logUserActivity('logout_inactivity')`, `clearPresence` (RPC `clear_user_presence`), limpa storage, `window.location.replace('/login')`. Sincroniza entre abas via `storage` event.

**Avatar**: prioridade `user_avatars.photo_url` (Supabase, por usuário) → fallback `clients.photo` (externo). Dois caches localStorage.

## Multi-tenancy

**Isolamento é feito na APLICAÇÃO, não no banco.**

- Chave de tenant = `client_id` (tabela `clients`, externa). Sub-usuários herdam via `COALESCE` no `login`/`get_effective_client_id`/`resolveEffectiveClientId`.
- Filtragem ocorre nas queries do `db-query` e nos hooks do frontend.
- **Supabase RLS é permissiva**: `CREATE POLICY ... FOR ALL USING (true) WITH CHECK (true)` — confirmado em ~100 migrations (269 ocorrências de `USING(...)` em 100 arquivos, padrão dominante `true`). RLS habilitada mas não restringe nada — isolamento depende só da app.
- **Consequência**: `db-query` com `verify_jwt` default + `raw`/`select` genéricos + RLS `true` = modelo de tenant "confiança no cliente".

## Edge Functions (116 diretórios em `supabase/functions/`)

Ver `supabase/config.toml` para o mapa completo de `verify_jwt`. Resumo por domínio (ver docs específicos para detalhe funcional):

- **Core**: `db-query` (gateway externo).
- **Chat/Inbox**: `chat-webhook-dispatcher`, `chat-public-api`/`webchat-api`, `chat-ai-assist`/`chat-ai-process`, `chat-automation-engine`, `chat-campaign-dispatcher`, `chat-route-conversation`, `chat-scheduler`, `chat-return-chat`, `chat-bulk-close`, `chat-contacts-enrich`, `chat-media-upload`/`download`, `chat-transcribe-audio`, `chat-message-react`, `chat-reset`, `team-member-cleanup-conversations`, `link-preview`, `image-proxy`.
- **uazapi/WhatsApp**: `uazapi-proxy` [no-jwt], `uazapi-chat-webhook`, `uazapi-admin`, `uazapi-instance-manager`, `uazapi-chat-backfill`, família `uazapi-history-*` [dispatcher/heartbeat no-jwt].
- **WABA**: `waba-admin`/`waba-send` [no-jwt], `waba-templates`, `meta-webhook` [no-jwt], `meta-auth`, `meta-send-test`.
- **Instagram**: `instagram-webhook`, `instagram-send`.
- **Meta Ads**: `meta-ads` [no-jwt], `meta-conversions` [no-jwt].
- **CRM/Copilot IA**: `copilot-chat`, `crm-copilot-monitor`, `prompt-generator`, `batch-generate-scripts`.
- **Advbox**: `advbox-integration`, `advbox-sync`, `advbox-notify` [no-jwt], `advbox-query` [no-jwt].
- **DataJud/documentos**: `datajud-search`/`datajud-monitor` [no-jwt], `consulta-documento`, `zapsign-file`/`zapsign-download`.
- **Telefonia**: `api4com-proxy`/`webhook` [no-jwt], `threecplus-proxy`/`webhook` [no-jwt], `vellip-webhook` [no-jwt], `telephony-order-create`/`checkout`, `telephony-provision`, `telephony-notify-paid`.
- **Wavoip**: `wavoip-provision-device`/`connect-device` [no-jwt], `wavoip-device-provision`, `wavoip-disconnect/rename-device`, `wavoip-call-webhook` [no-jwt], `wavoip-configure/verify-webhook`, `wavoip-fetch-recording` [no-jwt], `wavoip-fetch-call-details`, `wavoip-transcribe-recording`, `wavoip-sync-history`, `wavoip-reconcile-call`/`runner`, `wavoip-providers`.
- **Filas**: `queue-order-create`/`checkout` [no-jwt], `queue-provision` [no-jwt], `queue-management`, `queue-maintenance`, `queue-resolve-phone`, `sync-queue-to-agent`.
- **Vídeo**: `video-order-create`/`checkout`, `video-provision`, `video-room`.
- **Pagamentos**: `asaas-checkout`/`webhook`/`configure-webhook` [no-jwt], `infinitypay-checkout`/`webhook` [no-jwt], `mercadopago-checkout`/`webhook`.
- **Suporte/tickets**: `support-assistant-webhook` [no-jwt], `support-transcribe-audio` [no-jwt], `support-group-discovery` [no-jwt], `ticket-media-upload`.
- **Notificações**: `send-push` [no-jwt], `internal-notification-dispatch`/`scheduler` [no-jwt], `contract-notifications-cron` [no-jwt]/`queue`.
- **IA/config**: `ai-provider-key-set` [no-jwt], `client-automation-flags`.
- **Cron/infra**: `assigned-user-id-backfill`/`cron` [no-jwt], `telemetry` [no-jwt], `n8n_execute`/`n8n_execute-followup-stop` [no-jwt].

## Versionamento

`vite-plugin-auto-version.ts` (`autoBumpVersion`, só no build): MAJOR.MINOR = maior entre `package.json` e `public/version.json`; PATCH auto-incrementa a cada build. `versionFilePlugin` grava `dist/version.json` no `closeBundle`. `src/lib/appVersion.ts` (`checkVersionAndReloadIfNeeded`): compara `/version.json` com `__APP_VERSION__`; se diferente → toast + `forceReloadForNewVersion()` (desregistra SW, limpa caches, preserva só `AUTH_USER`/`AUTH_LAST_ACTIVITY`, recarrega com `?v=timestamp`). Pula em preview hosts. Chamado no `login()` antes de montar o app.

## Roteamento (`src/App.tsx`)

Providers aninhados: `QueryClientProvider` → `TooltipProvider` → `DebugProvider` → `BrowserRouter` → `AuthProvider` → `UaZapiProvider` → `WavoipProvider` → `ErrorBoundary` → `Suspense`. Rotas lazy exceto `Login`/`Dashboard`/`NotFound`/`RedirectPage`/`ComprarPage`/`JoinCallPage`. `MainLayout` envolve o grupo autenticado.

**Rotas públicas**: `/login`, `/redirect`, `/comprar`, `/comprar/sucesso`, `/call/:roomName`, `/tv/master` (só auth).

**Rotas autenticadas** (dentro de `MainLayout`) e seu `ProtectedRoute module=`:

| Rota | Módulo |
|---|---|
| `/`, `/dashboard` | — (só auth) |
| `/crm/leads` | `crm_leads` |
| `/crm/lead-estatisticas` | `crm_statistics` |
| `/crm/lead-monitoramento` | `crm_monitoring` |
| `/estrategico/desempenho`, `/estrategico/campanhas` | `strategic_perf` |
| `/estrategico/contratos` | `strategic_contract` |
| `/agente/meus-agentes(/:codAgent/editar)` | `agent_management` |
| `/agente/filas` | `filas` |
| `/agente/followup` | `followup` |
| `/configuracoes` | `configuracoes` |
| `/chat` + 24 sub-rotas | **sem proteção de módulo** |
| `/biblioteca` | `library` |
| `/equipe` | `team` |
| `/advbox/*` | **sem proteção de módulo** |
| `/crm-builder(/:boardId)` | `crm_leads` |
| `/datajud` | `datajud` |
| `/casos-juridicos` | `legal_cases` |
| `/notificacoes-contrato` | `contract_notifications` |
| `/telefonia` | `telephony` |
| `/comercial/crm` | `crm_comercial` |
| `/suporte-assistente` | `support_assistant` |
| `/mensagens-rapidas` | `quick_messages` |
| `/atendimento-humano` | `human_support` |
| `/contatos` | `contacts` |
| `/tarefas` | `tasks` |
| `/notificar-clientes` | `notify_customers` |
| `/tickets(/:id)` | `support_tickets` |
| `/ajuda/*` | `help_center` |
| `/admin/agentes*`, `/admin/modulos`, `/admin/permissoes`, `/admin/meta-*`, `/admin/monitoramento`, `/admin/operacoes`, `/admin/webhook-monitor`, `/admin/contrato-template`, `/admin/video` | `admin_agents` |
| `/admin/copiloto` | `copilot_admin` |
| `/admin/telefonia` | `telephony_admin` |
| `/wavoip` | `wavoip` |
| `/admin/wavoip` | `wavoip_admin` |
| `/admin/chat` | `chat_admin` |
| `/admin/prompts` | `prompt_generator` |
| `/admin/pedidos` | `julia_orders` |
| `/admin/planos` | `julia_plans` |
| `/admin/notificacoes-push` | `push_notifications` |
| `/admin/embeds` | `admin_embeds` |
| `/sys/:code` | — (embeds dinâmicos via `resolve_module_embed`) |
| `/telefonia/contratar`, `/filas/contratar`, `/video/contratar` | — (só auth) |

## Achados-chave

1. Arquitetura híbrida: Supabase (~177 tabelas) + Postgres externo legado, acessado só via `db-query`.
2. Auth própria (bcrypt), não Supabase Auth; sessão `localStorage`; timeout 30min.
3. Multi-tenancy por aplicação; RLS Supabase permissiva não isola tenant no banco.
4. Superfície de risco: `raw` (SQL arbitrário) + `select` genérico sem sanitização + 40+ functions sem `verify_jwt`.
5. Permissões: módulo × ação, defaults por role ou custom por usuário, tabelas criadas dinamicamente.
6. Versionamento auto-bump de PATCH + force-reload no login.
7. Chat é o maior domínio (~50 tabelas, 24 sub-rotas) mas sem proteção de módulo no router.
