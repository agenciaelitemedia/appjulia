# CRM, Agentes de IA, Followup, Contratos, Jurídico, Copiloto, Admin

Dois clients de dados coexistem: **`externalDb`** (Postgres externo, via edge function `db-query`) para CRM de leads/agentes/followup/contratos; **`supabase`** nativo para CRM Builder/billing/config de IA.

## 1. CRM (Leads) — `src/pages/crm/`

Painel de leads captados via WhatsApp pelos agentes Julia, com pipeline de estágios. Fonte: Postgres externo via `externalDb.raw` (`src/pages/crm/hooks/useCRMData.ts`).

- `crm_atendimento_stages` — estágios do funil (`id, name, color, position, is_active`).
- `crm_atendimento_cards` — leads/cards (`id, helena_count_id, cod_agent, contact_name, whatsapp_number, business_name, stage_id, notes, stage_entered_at, owner_name`).
- `crm_atendimento_history` — histórico de mudança de estágio (`card_id, from_stage_id, to_stage_id, changed_by, changed_at`). Detecta `has_contract_history` (transição para estágios "Contrato em Curso"/"Contrato Assinado").
- `vw_painelv2_desempenho_julia_all`/`_julia` — views agregadas de conversas/sessões Julia, filtradas por `cod_agent` e período (`America/Sao_Paulo`).
- `externalDb.getCrmAgentsForUser(user.id)` → agentes visíveis (`cod_agent, owner_name, owner_business_name`).

**Contrato vinculado a um lead** (`ContractInfo`): `zapsing_doctoken` (token ZapSign), `status_document`, `signer_*`, `data_contrato`, `data_assinatura`, `resumo_do_caso`, `case_title/category`. `ContractInfoDialog.tsx`.

**Followup integrado**: `CRMFollowupInfo` (`step_number, node_count, followup_from/to, is_infinite, stage_label` ex. "1/4"/"∞/∞") — badge no card via `useFollowupActiveLeads.ts`.

**Monitoramento** (`CRMMonitoringPage.tsx`): `StuckLeadsAlert` (leads parados, `days_stuck`), `StageBottlenecks` (gargalos, `count` vs `avg_count`), `AgentWorkloadChart`, `ActivityTimeline`.

**Estatísticas** (`CRMStatisticsPage.tsx`): `ConversionFunnelChart`, `AverageTimeChart`, `AgentPerformanceTable` (`total_leads, qualified_leads, qualified_rate, contract_leads, contract_rate, avg_time_days`).

## 2. CRM Builder (Kanban) — `src/pages/crm-builder/`

Kanban customizável multi-board, **Supabase nativo** (separado do CRM de leads acima).

- `crm_boards`: `id, client_id, cod_agent, name, description, icon, color, position, is_archived`.
- `crm_pipelines`: colunas do board (`pipeline_id` referenciado por deals).
- `crm_deals` (select explícito de colunas — evita tráfego desnecessário em boards com milhares de deals): `id, board_id, pipeline_id, position, title, description, value, currency, priority, status, contact_name, contact_phone, contact_email, assigned_to, assigned_user_id, tags, due_date, expected_close_date, stage_entered_at, created_by, updated_by, cod_agent, client_id, custom_fields (jsonb — inclui links.chat/links.julia)`.
  - `status: 'open'|'won'|'lost'|'archived'`. Listagem sempre `.neq('status','archived')`.
  - `DealHistoryAction: 'created'|'moved'|'updated'|'note_added'|'won'|'lost'|'archived'`.
  - Posição ao criar: `max(position do pipeline) + 1`.
  - Mover deal entre boards (`useMoveDealToBoard.ts`) marca o deal antigo `status:'archived'`.
  - Realtime com guard `isMovingRef` + debounce para não sobrescrever estado otimista durante drag concorrente.
  - Auditoria via `logCRMAudit()` (`useCRMAuditLog.ts`).

**Painel de chat no card**: `BoardChatSidePanel.tsx`, `DealJuliaPanel.tsx`, `useDealConversation.ts`, `useDealJuliaContext.ts` — vinculam deal a uma conversa/contato.

**Outros**: `CustomFieldsManager` (campos dinâmicos por board), `AutomationsManager` (`useCRMAutomations`), `BoardAnalyticsDashboard` (`PipelineFunnelChart`, `PipelineAvgTimeChart`, `DealsValueDistribution`).

## 3. Agentes de IA — `src/pages/agents/` + `src/pages/agente/`

**Conceito central `cod_agent`**: agente de IA configurado para um `client`, vinculado a um `user`, com plano, prompt, horário de atendimento e opcionalmente fila/instância WhatsApp.

**Criação** (`CreateAgentWizard.tsx`, `useAgentSave.ts`) — transacional com rollback manual:
1. Valida CPF/CNPJ (`checkFederalIdExists`).
2. Cria/reaproveita `client` + `user` (senha temporária, `bcryptjs`).
3. Cria `agent`.
4. Em erro: `rollback()` deleta agent/user/client desta transação (só deleta user/client se não têm outros agentes vinculados).
5. `insertAgentChangeLog`; `ensureChatClientSettings`.

Wizard: `ClientStep`, `UserStep`, `PlanStep`, `ConfigStep`, `PromptStep`, `BusinessHoursEditor`.

**Instâncias WhatsApp** — `src/pages/agente/meus-agentes/`: `ConfigureInstanceDialog`+`useConfigureInstance` (provider uazapi/WABA via `ProviderSelector`), `QRCodeDialog`+`useQRCodePolling`, `ConnectionStatusBadge`, `WabaSetupDialog`, `useDeleteInstance`. Edge functions: `uazapi-instance-manager`, `uazapi-proxy`, `uazapi-admin`, `uazapi-chat-webhook`, `waba-admin`, `waba-send`, `waba-templates`.

**Filas** (`src/pages/agente/filas/`): tabela `queues` (ver [docs/chat.md](chat.md#4-filas-queues)). `useAgentQueues.ts`/`useAgentQueueLimits.ts` (limite por plano). Diálogos: `QueueQRCodeDialog`, `QueueWizardDialog`, `ManageAgentsDialog`, `DisconnectWabaDialog`, `RestoreQueueDialog`, `DeleteQueueDialog`, `QueueAccessDialog`. Edge functions: `queue-provision`, `queue-resolve-phone`, `queue-order-checkout`/`create`, `queue-maintenance`, `sync-queue-to-agent`.

## 4. Followup — `src/pages/agente/followup/`

Cadências automáticas de reengajamento (Postgres externo, via `externalDb.raw`):

- **`followup_config`**: `id, cod_agent, step_cadence/msg_cadence/title_cadence (jsonb), start_hours, end_hours, auto_message, followup_from, followup_to`. 1 registro/`cod_agent` (upsert manual). Tratamento defensivo contra double-encoding JSON.
- **`followup_queue`**: fila de envios por lead — `id, cod_agent, session_id, step_number, send_date, state, history, name_client, hub, chat_memory`. **Estados: `SEND` ("Em FollowUp") / `STOP` ("Parados")**. Query usa `DISTINCT ON (cod_agent, session_id)` ordenado por `send_date DESC` (1 lead = múltiplas linhas históricas, só a mais recente é o estado atual).
- **`followup_history`**: mensagens efetivamente enviadas (`followup_queue_id` FK, `created_at`).

**Métricas**: `useFollowupSentCount`, `useFollowupDailyMetrics`, `useFollowupReturnRate`, `useFollowupPreviousPeriodStats`. Mutations: `useUpdateQueueState`, `useRestartQueueItem`, `useFinalizeQueueItem`.

**Parar followup via n8n** — `n8n_execute-followup-stop`: recebe `{codAgent, sessionId}`, gera variantes de telefone BR, chama `db-query` action `followup_stop` (lógica real fica no `db-query`).

## 5. Contratos — `src/pages/estrategico/contratos/` + `admin/contrato/`

Fonte externa — `JuliaContrato`: `cod_agent, agent_id, name, business_name, client_id, perfil_agent, session_id, total_msg, whatsapp, cod_document, zapsing_doctoken, status_document, situacao, data_contrato, data_assinatura, resumo_do_caso, signer_*, case_title/category, is_confirm`. `JuliaContratoSummary`: `totalContratos, contratosAssinados, contratosEmCurso, taxaAssinatura`.

**Assinatura ZapSign**: `zapsign-file` (`GET /api/v1/docs/{doc_token}/`, monta ZIP via `jszip`), `zapsign-download`. Link público: `https://app.zapsign.com.br/verificar/{zapsign_doctoken}`.

**Notificações** — `contract-notifications-cron` (cron, Postgres externo direto via `postgres` client):
- Fluxo "LEAD_FOLLOWUP": filtra `status_document==='CREATED'`, dedupe via `contract_notification_logs` (Supabase), envia via `createMessagingAdapter` (`_shared/messaging-factory.ts`).
- Segundo fluxo: `stepTrigger` `'GENERATED'` (status CREATED) ou `'SIGNED'` (status SIGNED) — notificações configuráveis por etapa.
- `contract-notifications-queue` — provável enfileiramento de envios individuais.

**Template**: `admin/contrato/ContratoTemplatePage.tsx`. **Página estratégica**: `ContratosPage.tsx` (`ContratosTable`, `ContratosSummary`, `ContratosEvolutionChart`, `ContratoDetailsDialog`).

## 6. Integrações Jurídicas

### Advbox
`IntegrationPage.tsx` (`useAdvboxIntegration`): seleciona `cod_agent`, token mascarado, testar conexão. `advbox-sync` conecta no Postgres externo direto (postgresjs + CA cert); `decryptToken()` com `ADVBOX_ENCRYPTION_KEY` — **token armazenado criptografado**. Páginas: `ProcessesPage`, `NotificationRulesPage`, `LogsPage`, `QueriesPage`. Edge functions: `advbox-integration`, `advbox-query`, `advbox-notify`.

### DataJud (CNJ)
`DataJudSearchPage.tsx`: `SearchBar`, `TribunalSelector`, `ProcessCard`, `MovementTimeline`, `AddProcessDialog`, `BulkImportDialog`, `AlertsPanel`, `MonitoringTab`. Hooks: `useDataJudSearch`, `useMonitoredProcesses`, `useProcessAlerts`, `useNotificationConfig`. `useEnsureDataJudModule.ts` auto-registra o módulo. Edge functions: `datajud-search`, `datajud-monitor` (cron).

### Consulta Documento
`consulta-documento` — consulta de documento (CPF/CNPJ ou processo), provável enriquecimento de dados de signatário.

## 7. Copiloto / IA Admin

**Infra de IA compartilhada** (`supabase/functions/_shared/aiGateway.ts`):
- Gateway padrão: **Lovable AI Gateway** (`LOVABLE_API_KEY`), fallback opcional **OpenRouter** configurável por feature em `client_ai_model_config` (`feature, model, provider, prompt`).
- **Modelos padrão por feature**: `chat_assist`, `chat_resume`, `chat_transcription`, `copilot_crm`, `copilot_chat`, `chat_autoreply`, `support_transcription`, `wavoip_call_summary` → `google/gemini-2.5-flash`; `script_generation` → `google/gemini-3-flash-preview`; `wavoip_transcription` → `openai/gpt-4o-mini-transcribe`. **Nenhum modelo Anthropic/Claude** nesta infra.
- `resolveAI(supabase, feature, fallbackModel)` — chamado por todas as functions de IA, permite trocar modelo/provider sem redeploy.

**`prompt-generator`**/`batch-generate-scripts`: feature `script_generation` → `google/gemini-3-flash-preview`. Geram prompt/roteiro do agente a partir de caso jurídico + template + config.

**Admin de prompts** (`src/pages/admin/prompts/`): `PromptsTab`, `TemplatesTab`, `PromptConfigTab`, `GenerateScriptTab`, `LegalCasesTab`, `AgentPromptWizard` (steps: AgentSearch→CaseSelect→TemplateSelect→AIConfig→FinalPrompt), `DiffViewer` + histórico com diff (prompts/templates/casos).

**`copilot-chat`**: feature `copilot_chat` → `google/gemini-2.5-flash`; assistente dentro do CRM.

**`crm-copilot-monitor`**: feature `copilot_crm`; monitora o CRM e gera insights (job periódico) → `admin/copiloto/InsightsMonitorTab.tsx`.

## 8. Admin

### Permissões (`src/pages/admin/permissoes/`, Postgres externo)
- `AppRole = admin|colaborador|user|time|advogado|comercial`. `ModuleCategory = principal|crm|agente|sistema|admin|financeiro`.
- `PermissionRow`: `moduleCode, moduleName, category, canView, canCreate, canEdit, canDelete, isDefault`.
- `UserWithPermissions`: `id, name, email, role, use_custom_permissions, is_active, parent_user_id, remember_token`.
- Hooks: `useUsersWithPermissions`, `useUserPermissions`, `useModules`, `useRoleDefaultPermissions`, `useUpdateUserPermissions`, `useUpdateRoleDefaultPermissions`.
- Componentes: `PermissionMatrix`, `UserPermissionEditor`, `RoleDefaultsDialog`, `UserEditDialog`.

### Módulos dinâmicos (`src/pages/admin/modulos/`)
`ModuleFormData`: `code, name, description?, category, icon?, route?, menu_group?, is_menu_visible, display_order, is_active`. Padrão **auto-registro**: dezenas de hooks `useEnsure*Module.ts` (ex.: `useEnsureTicketsModule`, `useEnsureDataJudModule`, `useEnsureCrmComercialModule`) — cada módulo opcional garante sua entrada em `modules` na 1ª montagem, sem migration manual, refletindo no menu (`invalidateQueries(['menu-modules'])`) e na matriz de permissões.

### Planos, Pedidos, Meta Ads
- `admin/planos/PlanosPage.tsx`: CRUD de planos comerciais.
- `admin/pedidos/` (`julia_orders`, Supabase, via `useOrders.ts`): `id, customer_*, plan_name, plan_price, billing_period, status, order_nsu, checkout_url, infinitypay_transaction_nsu, receipt_url, paid_amount, installments, webhook_payload, cod_agent, payment_gateway, mp_preference_id, mp_payment_id, net_amount, fee_amount, contract_body`. Multi-gateway (InfinityPay + Mercado Pago + Asaas). `OrderDetailSheet.tsx`, `PaymentSettingsDialog.tsx`.
- `admin/meta-ads/`: `MetaAdsTestPage`, `AdAccountSelector`, `CampaignsList`, `ConversionsTest`, `MetaAdsAuth`. Edge functions: `meta-ads`, `meta-auth`, `meta-conversions`, `meta-send-test`, `meta-webhook`.

## Dashboard e Estratégico

**Dashboard** (`src/pages/Dashboard.tsx`, `useDashboardData.ts`, Postgres externo): `DashboardAgent`, `DashboardFiltersState` (`search, agentCodes, dateFrom, dateTo`), `RecentLead`, `DashboardEvolutionData`, `DashboardActivity`, `DashboardStats`/`_Previous` (`totalLeads, totalMessages, conversions, activeAgents, totalSessions, mqlCount`), `DashboardFunnelData`. `calculateChange()` calcula variação % vs período anterior. Componentes: `DashboardEvolutionChart`, `DashboardFunnelChart`, `DashboardTripleFunnel`, `DashboardActivityTimeline`.

**Estratégico** (`src/pages/estrategico/hooks/useJuliaData.ts`, mesma base `vw_painelv2_desempenho_julia*`): `useJuliaAgents`, `useJuliaSessoes(filters)` (filtro `cod_agent` + período + `perfilAgent: SDR|CLOSER|ALL`), `useJuliaSessoesPrevious`, `useJuliaContratos`. Sub-páginas: `DesempenhoPage.tsx`, `CampanhasPage.tsx` (funil por grupo/plataforma, heatmap, top campanhas).
