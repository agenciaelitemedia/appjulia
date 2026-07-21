# Módulo Chat / WhatsApp

Maior domínio funcional do sistema. Inbox omnichannel com atribuição, filas, SLA, IA e integrações de telefonia.

> Detalhe interno do webhook uazapi (parsing, dedup, pipeline de histórico assíncrono): [docs/uazapi-integration.md](uazapi-integration.md).

## 1. Provedores / Canais

Campo `channel`/`channel_type`: `whatsapp_uazapi` (WhatsApp não-oficial via uazapi), `whatsapp_waba` (WhatsApp Cloud API oficial Meta), `webchat` (widget próprio), `instagram` (Direct via Meta Graph). Badge em `src/components/chat/ChatHeader.tsx` (`ChannelBadge`).

- **uazapi**: `uazapi-chat-webhook` (recebimento), `uazapi-proxy` (envio genérico), `uazapi-instance-manager`, `uazapi-admin`, `uazapi-chat-backfill`, família `uazapi-history-*` (importação assíncrona).
- **WABA (oficial)**: `waba-send` (envio), `waba-admin`, `waba-templates`, `meta-webhook` (compartilhado com Instagram/Meta Ads).
- **Instagram**: `instagram-webhook`, `instagram-send`.
- **WebChat**: `webchat-api`, `chat-public-api`.

### Envio (frontend → função → provedor) — `src/contexts/WhatsAppDataContext.tsx`
- Texto uazapi: `uazapi-proxy` `endpoint:'/send/text'`, `token=queue.evo_apikey`, `baseUrl=queue.evo_url`, body `{number, text, replyid, forward}`. Resposta: `data.key.id` (stanza WhatsApp → `message_id`), `data.id/messageId` (id interno uazapi → `external_id`).
- Texto WABA: `waba-send` `action:'send_text', queue_id, to, text`.
- Mídia uazapi: `/send/media`; áudio manda base64 direto; demais tipos mandam URL já persistida (`chat-media-upload`).
- Mídia WABA: `waba-send` `action:'send_media'` com `mediaBase64`. Áudio WebM é reconvertido para OGG/Opus estrito (WABA exige contêiner OGG real).
- **Grupos**: uazapi aceita `@g.us`; **WABA rejeita explicitamente** (erro lançado no `sendMessage`/`sendMedia`).
- Edição: só uazapi (`/message/edit`).
- Mark-as-read: uazapi `/chat/markRead`; WABA `action:'mark_read'` via `message_id` (wamid).
- Reação: `chat-message-react` grava em `chat_message_reactions`.

## 2. Modelo de Dados (Supabase)

Schema evoluiu por migrations incrementais (`ALTER TABLE ADD COLUMN IF NOT EXISTS`) — colunas usadas no frontend podem não estar no `CREATE TABLE` original.

### `chat_contacts`
`id, client_id, cod_agent, phone, name, avatar, is_group, is_archived, is_muted, unread_count, last_message_at, last_message_text`. Adicionadas depois: `channel_source` (UUID da fila — chave de roteamento), `channel_type`, `remote_jid`. Upsert on conflict `phone,client_id`.

### `chat_messages`
`id, contact_id (FK CASCADE), client_id, message_id (id externo/wamid, indexado), text, type ('text' default), from_me, status ('sent' default), media_url, file_name, caption, reply_to, metadata (jsonb), timestamp, edited_at`. Adicionadas depois: `external_id` (id interno do provedor, dedup em paralelo a `message_id`), `conversation_id` (FK), `internal_note`, `note_type`, `sender_name`, `is_forwarded`, `forwarded_score`, `channel_type`. Tipos (`type`): `text, image, video, audio, ptt, document, location, contact, sticker, revoked`.

### `chat_conversations`
`id, contact_id (FK), client_id, cod_agent, channel ('whatsapp_uazapi' default), status ('pending' default: pending|open|resolved|closed), protocol (auto via trigger #YYYY-000001), assigned_to, assigned_user_id, department, priority ('normal': urgent|high|normal|low), tags[], opened_at, first_response_at, closed_at, resolved_at, close_reason, close_note, metadata`. Adicionadas depois: `queue_id` (FK filas), `snoozed_until`, `snooze_reason`, `snoozed_by`, `active_ticket_id`, `active_ticket_number`, `active_ticket_protocol`. Trigger `trg_generate_conversation_protocol`.

### `chat_conversation_history`
`id, conversation_id (FK CASCADE), action (opened|reopened|closed|resolved|assigned|tag_added|tag_removed|note_added|snoozed|returned_to_queue), actor_name, from_value, to_value, notes, created_at` + `user_id, to_user_id, from_user_id`. Log de auditoria/timeline, intercalado com mensagens em `ChatMessages.tsx` via `ConversationEvent`.

### `chat_tags` / `chat_conversation_tags`
`chat_tags(id, name, color, client_id)`; junção `chat_conversation_tags(conversation_id, tag_id)`.

### `queues`
`id, client_id, name, channel_type ('uazapi' default: uazapi|waba), hub, evo_url/evo_apikey/evo_instance (uazapi), waba_id/waba_token/waba_number_id, is_active, is_deleted, deleted_at`. Adicionadas depois: `phone_number`, `phone_resolved_at`, `waba_webhook_status/last_error/subscribed_at`, `settings (jsonb)`.

### `queue_agent_links`
`id, queue_id (FK RESTRICT), cod_agent, is_primary`. **Constraints**: `UNIQUE(queue_id, cod_agent)`; `UNIQUE(cod_agent) WHERE is_primary=true` (um agente só pode ter UMA fila primária no sistema todo). Sincronizado para o agente externo via `sync-queue-to-agent` (propaga credenciais via `update_agent_connection`/`update_agent_waba_connection`).

### Outras tabelas de suporte
- `chat_message_reactions`: `message_id, external_message_id, reactor, emoji, from_me`.
- `chat_csat_responses`/`chat_csat_config`: pesquisa pós-encerramento (score 0-5, `status: sent|answered`).
- `chat_scheduled_messages`: `client_id, cod_agent, contact_id, conversation_id, text, scheduled_for, created_by(_name)` — processada por `chat-scheduler`.
- `chat_conversation_presence`: presença persistida por conversa.
- `chat_sla_configs`: `client_id, cod_agent, priority, first_response_minutes, nrt_response_minutes, resolution_minutes, is_active` — unique `(client_id, priority)`.
- `chat_campaigns`/`_recipients`/`_variants` (A/B)/`_schedules`.
- `user_presence`/`_heartbeats` (particionada por data)/`_daily`.
- `chat_routing_rules`/`chat_agent_capacity`.
- `chat_client_settings`: JSONB (`auto_transcribe_audio`, `events_enabled`, `event_visibility`).
- `chat_conversation_summaries`: resumos IA (`sentiment, summary, atendimento, message_count, triggered_by`).
- `uazapi_history_runs`/`_items`, `whatsapp_sync_jobs`/`_job_logs`: jobs assíncronos.
- `wavoip_device_queues`: dispositivos Wavoip ↔ filas.

## 3. Fluxo de Conversa

### Recebimento (uazapi) — `uazapi-chat-webhook`
Dedup em duas camadas: (1) match exato `message_id` OU `external_id` (índice btree); (2) fallback `ilike` por sufixo (namespaces diferentes entre provedores). Pré-filtro em lote antes de inserir (evita duplicar em batch de histórico). Persiste `chat_messages`, upsert `chat_contacts`, resolve/reabre `chat_conversations` (reabre `resolved` recente mantendo `assigned_to` ou volta a `pending`). Edição de mensagem recebida faz UPDATE casando `message_id.eq OR external_id.eq`. Descarte não roteável logado via `logDroppedMessage` (`_shared/droppedLogger.ts`).

### Recebimento (Realtime frontend) — `WhatsAppDataContext.tsx`
3 canais Supabase Realtime: `chat_contacts`, `chat_messages` (dedup via `knownMessageIds` ref), `chat_conversations`. No INSERT inbound (`!from_me && !internal_note`): incrementa `unread_count` via RPC atômico `increment_contact_unread` (evita race entre agentes simultâneos), reposiciona contato, dispara `chat-automation-engine` (`message_received`) e `chat-webhook-dispatcher` (`message_received`) fire-and-forget.

### Envio
Mensagem otimista (`status:'sending'`) local antes da chamada; sucesso → `sent` com `message_id`/`external_id`; erro → `failed` (toast via `normalizeSendError()`: timelock uazapi, janela 24h WABA expirada, número inválido, rejeição genérica).

### Atribuição / Transferência / Devolução
- **Assumir** (`handleTakeOver`): `assignConversation(id, userName, userId)` seta `assigned_to`/`assigned_user_id`; `pending→open`; evento `assigned` em histórico; desativa a Julia (`disableJuliaOnAssignOrTransfer` — desliga sessão via `externalDb.getSessionStatus` + `n8n_execute-followup-stop`).
- Primeira resposta também auto-atribui se ainda não houver `assigned_to`, seta `first_response_at` + `status='open'`.
- **Transferir** (`TransferDialog.tsx`): seleciona membro do time, `assignConversation`.
- **Devolver à fila** (`ReturnToQueueDialog.tsx`): zera `assigned_to`/`assigned_user_id`, força `pending`, evento `returned_to_queue`.
- **Claim guard** (`ChatInput.tsx`): só permite enviar se `noteMode` OU (`isAssignedToMe && status in [pending,open]`); banner "Assuma esta conversa" quando não atribuído.

### Snooze — `SnoozeDialog.tsx`
Presets (1h, 4h, amanhã 9h, 2 dias, 1 semana) ou custom; `snoozed_until/reason/by` + evento `snoozed`. Aba "todas" esconde contatos com `snoozed_until` futuro.

### Resolver / Encerrar / Reabrir
`updateConversationStatus()`: `resolved`→`resolved_at`; `closed`→`closed_at`(+`close_note`); reabertura limpa `closed_at`/`resolved_at`. Em resolved/closed dispara `chat-webhook-dispatcher` (`conversation_resolved`) e `chat-ai-assist` (`incremental_summary`, nota interna automática). **CSAT ao encerrar** (`CSATDialog.tsx`): nota de encerramento opcional; se "enviar pesquisa", insere placeholder em `chat_csat_responses` + envia mensagem de pesquisa.

## 4. Filas (Queues)

- `queues` guarda credenciais por canal; toda `chat_conversations` tem `queue_id`.
- `queue_agent_links` vincula fila↔agente-IA (`cod_agent`), máx. 1 fila primária/agente. Hooks `useQueueAgentLink(s)`/`useAgentQueueLink`.
- **Sincronização** `sync-queue-to-agent`: credenciais da fila → registro do agente externo (`update_agent_connection`/`update_agent_waba_connection`). Webchat/Instagram não sincronizam.
- **Resolução de fila efetiva por contato** (`getEffectiveQueue`): 1) conversa ativa em memória, 2) conversa mais recente com `queue_id`, 3) `contact.channel_source` (se UUID), 4) qualquer fila ativa do canal, 5) fila selecionada no topo.
- **Roteamento automático** (`useChatRouting.ts`): `chat_routing_rules` (condições channel/tag/priority/keyword/business_hours/queue/contact_is_new; estratégias round_robin/least_busy/specific_agent/manual_pool/random) + `chat_agent_capacity` (status online/away/busy/offline, `max_concurrent`, `current_load`). Executado por `chat-route-conversation` + `chat-automation-engine`.
- **Acesso por fila**: `useUserQueueAccess`/`queue_members` restringe filas visíveis por atendente.

## 5. Recursos

- **Notas internas**: `sendInternalNote()` → `internal_note:true`, `note_type` (info/question/urgent). Suportam @menções (`src/lib/chat/mentions.ts`). Escopadas por `conversation_id`.
- **Citadas/quoted**: `metadata.quoted_message{id,text,from_me,sender_name,type}`; fallback via `withDerivedQuote()` indexando `message_id/external_id/id`.
- **Encaminhadas**: `ForwardDialog.tsx`, flag `forward:true`, marca `is_forwarded:true`.
- **Agendadas**: `ScheduleMessageDialog.tsx` → `chat_scheduled_messages`; processadas por `chat-scheduler` (cron).
- **Grupos**: `chat_contacts.is_group`; abas individual/grupos (persistido `localStorage chat:activeTab`); WABA bloqueia envio a grupos.
- **Busca**: `ChatSearchDialog.tsx` (na conversa) + busca global por nome/telefone (variantes BR via `src/lib/phoneVariants.ts`).
- **Mídia**: `chat-media-upload` (outbound antes de enviar), `chat-media-download` (inbound criptografada; retry state machine `idle|loading|success|transient_failed|permanent_failed`, backoff 30s, máx 3). `MediaLightbox.tsx`.
- **Reações**: `chat-message-react` → `chat_message_reactions`; Realtime via `useMessageReactions.ts`.
- **Campanhas em massa**: `chat-campaign-dispatcher` (variantes A/B, agendamento), `chat-bulk-close`.
- **Transcrição de áudio**: `chat-transcribe-audio` — manual ou automática (gate duplo: flag do cliente E da fila via `chat_client_settings`/`useQueueAutomationFlags`).
- **IA**: `chat-ai-assist` (incremental_summary no fechamento, full_summary sob demanda → `chat_conversation_summaries`), `chat-ai-process`, `chat-return-chat` (worker "Retornar Chat"). `copilot-chat` é módulo separado.
- **SLA**: `useChatSlaConfigs.ts`, defaults hardcoded por prioridade. `evaluateSla()`: 3 fases — **FRT** (aguardando 1ª resposta desde `opened_at`), **NRT** (última msg do cliente, aguardando resposta desde `last_customer_message_at`), **TTR** (aguardando resolução desde `opened_at`); status `on_track|at_risk (≤25% restante)|breached`. `SlaBadge.tsx`.
- **Presença**: `useConversationPresence.ts` (Realtime Presence efêmero, sem DB) + `useGlobalPresence.ts` (singleton por client_id). Separado: `user_presence_heartbeats` (telemetria histórica).
- **Dropped messages**: `_shared/droppedLogger.ts` — auditoria de mensagens não persistidas (roteamento falho etc).
- **Histórico uazapi**: pipeline assíncrono `uazapi-history-dispatcher`/`-processor`/`-warmup`/`-resume`/`-cancel`/`-force-resync`/`-dispatcher-heartbeat` sobre `uazapi_history_runs`/`_items`.
- **Telefonia integrada**: `WavoipCallButton.tsx`/`WavoipCallDialog.tsx` + família `wavoip-*`; alternativa SIP nativa (`PhoneContext`/`usePhone`); `UpsellCallDialog.tsx` quando VOIP indisponível.

## 6. Vínculo Chat ↔ Ticket

- `chat_conversations.active_ticket_id/_number/_protocol` mantidos por trigger de banco em `support_tickets`.
- `useTicketLinkedConversations.ts`: mapeia `conversation_id → TicketConversationLink`; invalida via Realtime em mudanças de `support_tickets`.
- Botão "Abrir ticket" em `ChatHeader.tsx`: se já existe ticket vinculado + permissão de ver → `ChatTicketDetailSidePanel.tsx`; senão, com permissão de criar → `ChatTicketSidePanel.tsx`.
- `ChatTicketSidePanel.tsx` (painel lateral, portal): form pré-preenchido (nome/telefone bloqueados), responsável, departamento/categoria, prioridade. Ao criar: `conversation_id`, `contact_id`, `metadata:{is_group, group_jid, source:'chat'}`.
