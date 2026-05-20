# Plano de Correção de Segurança — Atende Julia

Gerado a partir do scan Supabase Lov em 2026-05-06. Total: **22 findings críticos**.

## Contexto arquitetural (importante antes de qualquer fix)

- O frontend **não usa Supabase Auth** (`supabase.auth.signIn` etc. não aparecem em `src/`). Todas as requisições do navegador chegam ao Postgres como **role `anon`**.
- Por isso as tabelas atuais têm policies `USING (true)` para `{public}` — é o que mantém o app funcionando hoje.
- Endurecer RLS sem antes mover essas leituras para edge functions (com service role) ou implementar Supabase Auth **quebra** chat, CRM, telefonia, dashboards e admin.
- A maior parte da inteligência de negócios vive no **banco externo** (`EXTERNAL_DB_*`) acessado via `db-query`. Mas as tabelas do scan (chat_*, crm_*, queues, phone_*, telephony_*, julia_*) estão no Supabase e são lidas direto pelo cliente.

## Estratégia recomendada (4 fases)

### Fase 1 — Hardening "zero risco" (pode ser aplicado já)
Itens que não dependem de migrar leituras do frontend:

| # | Finding | Ação |
|---|---------|------|
| 1 | `crm_audit_log` RLS desabilitada | Ativar RLS + policies: INSERT permissivo (logs vêm de triggers/edge functions), SELECT só service_role. |
| 2 | `crm_checklists` / `crm_checklist_items` RLS desabilitada | Ativar RLS + policy `USING (true)` temporária para manter o app funcional, marcado para refatorar. |
| 3 | Bucket `avatars` permite DELETE/UPDATE anônimo | Restringir DELETE/UPDATE a `authenticated` com `storage.foldername(name)[1] = auth.uid()::text`. **Atenção**: só seguro depois que o upload de avatar passar por edge function ou Supabase Auth. Por enquanto: restringir só a `authenticated`. |
| 4 | Bucket `creatives` permite INSERT/DELETE anônimo | Idem: restringir a `authenticated` ou exigir token de edge function. |
| 5 | `realtime.messages` sem policies | Adicionar policy mínima: só topics começando com `client:<client_id>:...` autorizados via JWT. Hoje, sem JWT, isso bloquearia tudo — manter docs e aplicar com Fase 4. |

### Fase 2 — Credenciais / API keys (alta prioridade)
Tabelas que **não devem** ser lidas pelo cliente nunca:

| Tabela | Onde é lida no frontend | Refactor necessário |
|--------|------------------------|---------------------|
| `julia_payment_config` | `pages/admin/pedidos/components/PaymentSettingsDialog.tsx` | Criar edge function `payments-config` (GET/PUT) com check de admin via header. Restringir tabela a `service_role`. |
| `queues.evo_apikey`, `waba_token`, `page_access_token`, etc. | `ChatChannelsConfig.tsx`, `useQueueProviders.ts`, `useUazapiHistoryRuns.ts`, `SyncWhatsappTab.tsx`, `ChatPage.tsx`, `useDealConversation.ts`, `WhatsAppDataContext.tsx`, `ContactDetailPanel.tsx`, `ChatSidePanel.tsx`, `ChatHeader.tsx`, `BulkCloseConversationsCard.tsx`, `ChatMetricsPage.tsx` | **Criar view `queues_public`** com `security_invoker=on` que esconde colunas sensíveis (`evo_apikey`, `waba_token`, `page_access_token`, `webhook_token`, `secret`). Apontar todas as leituras de UI para a view. Manter tabela base lida só por edge functions. |
| `queue_providers` (mesmas colunas) | `useQueueProviders.ts`, `ChatChannelsConfig.tsx` | Idem com view `queue_providers_public`. |
| `instagram_config` | grep para confirmar | View pública sem tokens. |
| `phone_config` / `phone_extensions` / `telephony_providers` (senhas SIP, api_token) | `PhoneContext.tsx`, `useTelefoniaData.ts`, `useTelefoniaAdmin.ts`, `MeusRamaisTab.tsx`, `SipManualCredentialsDialog.tsx`, `useTelephonyProviders.ts`, `CallHistoryAdminTab.tsx` | Edge function `telephony-credentials` que devolve config SIP para o agente logado (após validar via header `x-cod-agent` + secret interno). Views públicas sem senhas para listagens. |
| `support_assistant_config` | `SupportAssistantPage.tsx` | Edge function `support-config` (apenas admin). |
| `generation_agent_prompt_cases` (Bearer ZapSign) | `useAgentPrompts.ts`, `LegalCasesTab.tsx`, `useLegalCaseUsage.ts` | View sem `zapsign_token` / `zapsign_doc_token`. Tabela base só service_role. |
| `chat_webhooks.secret` | `ChatWebhooksPage.tsx` | View pública sem `secret`. Endpoint dedicado para revelar/rotacionar secret. |
| `chat_api_keys` (key_hash, key_prefix) | `useChatApiKeys.ts` | View com `key_prefix` mascarado. Comparações de hash só em edge function. |
| `chat_user_security` (TOTP/backup_codes) | grep | Policy `USING (user_identifier = current_user_identifier())` ou mover totalmente para edge function. |

### Fase 3 — PII de clientes/leads (precisa de Supabase Auth)
Tabelas com dados pessoais que dependem de saber **quem é o usuário** no momento da query:

| Tabela | Escopo correto |
|--------|----------------|
| `chat_messages` (190k) | `client_id = auth.jwt()->>'client_id'` |
| `chat_conversations` (8.370) | idem |
| `chat_csat_responses` | idem |
| `crm_deals` | `client_id` ou `cod_agent` no JWT |
| `crm_internal_notes` | `cod_agent = auth.jwt()->>'cod_agent'` |
| `datajud_monitored_processes` | `user_id = auth.uid()` |
| `datajud_notification_config` | idem |
| `julia_orders`, `telephony_orders` | service_role para escrita, leitura do próprio cliente via JWT |
| `phone_call_logs` | `client_id` no JWT |
| `vellip_call_logs` | `cod_agent` no JWT |
| `contract_deletion_audit` | apenas admins (`has_role(auth.uid(),'admin')`) |
| `support_team_members` | `authenticated` apenas |
| `push_subscriptions` | `user_id = auth.uid()` |

**Pré-requisito:** o frontend precisa fazer login real no Supabase Auth (email/senha ou OAuth), e o JWT precisa carregar `client_id` + `cod_agent` no `app_metadata`. Hoje o app tem auth próprio fora do Supabase — essa migração é a maior parte do esforço.

### Fase 4 — Realtime
Após Fase 3, adicionar policies em `realtime.messages` para escopar subscriptions por `client_id` no JWT, evitando que um cliente escute eventos de outro tenant.

## Riscos de NÃO corrigir
- **Vazamento total de credenciais**: qualquer pessoa com a anon key (que aparece em build do frontend) pode hoje extrair tokens MercadoPago/Asaas, WhatsApp/WABA, SIP, ZapSign, support API.
- **Vazamento de 190k+ mensagens** entre advogados e clientes (sigilo profissional, LGPD).
- **Tomada de conta**: TOTP secrets expostos permitem geração de códigos MFA para qualquer conta autenticada.
- **Reputação e LGPD**: dados sensíveis (CPF, processos jurídicos, conversas) acessíveis por scraping anônimo.

## Próximos passos sugeridos
1. **Aprovar Fase 1** (baixo risco) — eu aplico em 1 migration.
2. **Priorizar Fase 2.a** — `julia_payment_config`, `support_assistant_config`, `chat_user_security` (maior risco, menor uso no frontend).
3. **Planejar Fase 2.b** — views + edge functions para queues/telephony.
4. **Decidir sobre Supabase Auth** — requisito para Fase 3.
