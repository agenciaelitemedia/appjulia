# Integração UaZapi — Detalhe Técnico

Complementa [docs/chat.md](chat.md). Cobre o parsing interno do webhook e o pipeline de histórico assíncrono.

## `uazapi-chat-webhook/index.ts` (~1800 linhas) — eventos de entrada

`POST ?queue_id={id}`. Resolve `queues` (`id, client_id, channel_type, evo_url, evo_apikey, waba_token, waba_number_id`).

**Aliasing de evento**: `EVENT_ALIAS` mapeia nomes uazapi (underscore) → nomes Evolution/Baileys (dot): `messages_update→messages.update`, `connection→connection.update`, etc.

### Branches
- **connection.update**: só log.
- **messages.update** (status + edições): `collectMessageIds` junta ids de vários campos possíveis; `resolveChatMessageRowIds` faz match exato + fallback ILIKE por sufixo (ids prefixados tipo `3EB0:xxx`). Edição atualiza `text`+`edited_at`. Status via `STATUS_MAP` (`'0'→failed,'1'→pending,'2'→sent,'3'→delivered,'4'/'5'→read`) com `STATUS_RANK` garantindo que status **nunca regride** (ex.: read→delivered é bloqueado).
- **messages.delete**: `type='revoked'`, `text='🚫 Mensagem apagada'`.
- **contacts.update / groups.update / chats.update**: atualiza nome/avatar/arquivado/mutado/não-lidas; dispara `refresh-contact-avatar` em background quando a foto muda.
- **history/messages.set**: extrai mensagens, enfileira via `enqueueHistoryRun` (não processa inline).

### Loop principal (mensagem por mensagem)
1. **chatId**: de vários campos possíveis. **Grupo** = presença de `@g.us` na JID (estrito, ignora flags `isGroup` para evitar falso positivo).
2. **Gate de grupo**: se grupo e `chat_client_settings.settings.ALLOW_GROUPS=false` (cache 60s) → descarta + `logDroppedMessage(reason='group_blocked')`.
3. **messageId** ausente → descarta (`reason='no_id'`).
4. **Edição via upsert**: detecta `protocolMessage.editedMessage`; se identificado, UPDATE em vez de INSERT.
5. **Dedup**: lookup `client_id`+(`message_id.eq OR external_id.eq`); se existe, aplica bump de status (nunca regride) e `continue`.
6. **Resolução de telefone do par**: para grupos usa o id do grupo; para individual escaneia candidatos (`fromMe` usa `to`/`recipient`, senão `sender_pn/PhoneNumber/phone/from/sender/...`), rejeita `@lid`/`@g.us`, normaliza 8-13 dígitos (regra BR do 9º dígito). Sem telefone → descarta.
7. **Upsert de contato** (`chat_contacts`, conflict `phone,client_id`): `channel_type='whatsapp_uazapi'`, `channel_source=queueId`, `remote_jid` normalizado, `unread_count` incrementado só se `!fromMe`. Lógica evita sobrescrever nome real com nome tipo-telefone.
8. **Enriquecimento de perfil**: fire-and-forget `fetchWhatsappProfile` atualiza avatar/nome.
9. **Backfill 1x**: contato novo não-grupo → dispara `uazapi-chat-backfill` (limit 50).
10. **Resolução de conversa**: (1) ativa `pending`/`open`; (2) reabre `resolved` mais recente; (3) cria nova `pending`. Race fallback re-seleciona.
11. **Reações**: **não** vão para `chat_messages` — resolvem alvo por `message_id`, deletam reação anterior do mesmo `reactor`, inserem em `chat_message_reactions`.
12. **Quoted/reply**: `resolveQuotedMeta` (`_shared/quotedMessage.ts`) monta `{id,text,from_me,sender_name,type}` do original ou de conteúdo embutido.
13. **Insert de mensagem**: `chat_messages` com `metadata` incluindo `sender_id, sender_name, is_ptt, duration, mimetype, quoted_message`. Duplicado (`23505`) tolerado.
14. **Auto-transcrição de áudio**: se `AUTO_TRANSCRIBE_AUDIO` ligado (client + fila), dispara `chat-transcribe-audio`.

**Extração de mídia**: `extractMessageType` mapeia `mediaType`/mimetype para `text/image/video/audio/ptt/document/sticker/location/contact/reaction/revoked` (GIF→video). `extractMediaUrl` prefere `content.URL`, depois `fileURL/mediaUrl` decriptado, evita `.enc`. **O webhook não baixa mídia** — só grava `media_url`; download real é via `chat-media-download`, só disparado no caminho de importação de histórico.

**Auditoria de descarte**: `_shared/droppedLogger.ts` (`logDroppedMessage`) grava em `chat_dropped_messages` (`reason: no_phone|group_blocked|no_id|group_no_id`). Fire-and-forget, nunca quebra o webhook.

## `uazapi-proxy/index.ts` — passthrough genérico de envio

`POST {method, endpoint, body, token, baseUrl}`. Whitelist de prefixos: `/chat/`, `/message/`, `/send/`, `/instance/`, `/labels/`, `/group/`, `/call/`, `/business/`, `/chatwoot/`, `/community/`. Sem acesso a banco — é onde o frontend manda mensagens de saída.

## `uazapi-instance-manager/index.ts` — lifecycle por fila

Actions: `create` (`/instance/init` + configura webhook), `reconfigure_webhook(_all)`, `connect` (QR), `status`, `disconnect`, `delete`. `DEFAULT_WEBHOOK_EVENTS = connection, messages, messages_update, history, chats, contacts, groups, presence, call`.

## `uazapi-admin/index.ts` — gestão a nível de agente (banco externo)

Conecta no Postgres externo direto. `create_instance` grava credenciais em `agents` (`hub='uazapi', evo_url, evo_apikey, evo_instance`). `delete_instance`, `list_instances`, `create_instance_support` (webhook para `support-assistant-webhook`, eventos `['messages']`).

## `uazapi-chat-backfill/index.ts` — histórico por contato sob demanda

`POST {queue_id, contact_id, chat_id|phone, limit=50}`. Pula se já backfilled ou grupo bloqueado. Chama `{evo_url}/message/find`. Upsert em `chat_messages` (conflict `message_id`, `status='read'`, `metadata.backfilled:true`). Sempre marca `history_backfilled=true` mesmo em erro (evita retry loop).

## Pipeline de Histórico (dump em tempo real)

### Máquina de estados
- **`uazapi_history_runs`**: 1 por dump (status `pending|running|done|partial`, contadores de mensagens/duplicatas/contatos).
- **`uazapi_history_items`**: 1 por chat dentro de um run (`status: pending|running|ok|skipped|error`, `payload jsonb`, `attempts`, `worker_id`, `locked_at`).
- **`dispatcher_heartbeat`**: saúde do pool de workers.
- Legado (importação em job): `whatsapp_sync_jobs`/`_job_logs`.

### Fluxo
`webhook.enqueueHistoryRun` → insere run+items → `uazapi-history-dispatcher` (via cron heartbeat) mantém pool de até **10 workers** (`uazapi-history-resume`) → cada worker drena via RPC `uazapi_pick_pending_items` (`SELECT FOR UPDATE SKIP LOCKED`) → processa (dedup por `external_id`, `status='read'`, `unread_count` sempre forçado a 0, batch de 100) → `finalizeRunsCoalesced` agrega.

- **`uazapi-history-processor`**: variante síncrona por payload direto (`{run_id, payload}`), agrupa por telefone real (rejeita `@lid`), skip incremental de mensagens mais antigas que `last_message_at`.
- **`uazapi-history-dispatcher`**: orquestrador persistente, ajusta pool (2/<100 pendentes, 5/<500, 10/senão), auto-reagenda tick em 10s.
- **`uazapi-history-dispatcher-heartbeat`**: cron de 1min, chama `{action:'tick'}` no dispatcher — rede de segurança se o isolate dele morreu.
- **`uazapi-history-import`**: importação em lote por job (`whatsapp_sync_jobs`), usa `message_id` prefixado `backfill:{contactId}:{id}` para dedup, dispara `chat-media-download` para mídia.
- **`uazapi-history-warmup`**: pede ao provedor (`message/history-sync`) para reenviar histórico via webhook.
- **`uazapi-history-cancel`**: seta `cancel_requested=true` em job rodando.
- **`uazapi-history-force-resync`**: desconecta/reconecta a instância para forçar o WhatsApp a re-empurrar histórico.

## `seed-uazapi-provider/index.ts`

Upsert em `queue_providers` (`provider_type='uazapi'`, credenciais de env). Bootstrapping inicial de um client novo.

## Resumo de campos-chave

- **`chat_messages`**: sem `media_path` gravado pelo webhook/backfill/history — só `media_url` até `chat-media-download` rodar.
- **status**: `received` (inbound); `sent→delivered→read` (nunca regride); histórico/backfill sempre `read`.
- **direção**: bool `from_me`, sem coluna separada.
- **Endpoints uazapi usados**: `/instance/init|connect|status|logout|disconnect`, `/instance` (DELETE), `/instance/all`, `/admin/instances`, `/webhook`, `/message/find`, `/message/history-sync`.
