# Sincronizar o histórico do ZAP Call com o histórico real da Wavoip

## Diagnóstico (confirmado no banco e no código)

- Dos 313 registros em `wavoip_call_logs`, **0 vieram do poll `wavoip-sync-history`** e só **2 vieram do webhook**. Todo o resto foi gravado pelo próprio discador no navegador (`webphone`) ou pelo `wavoip-fetch-call-details` (só roda quando o discador vê o fim de uma chamada de saída).
- **84 ligações estão travadas em "CHAMANDO"** (status `ringing`, sem `ended_at`) — 65 só no dispositivo "84 998185064 (Clientes Flávia)". São ligações recebidas que o discador viu tocar, mas cujo término nunca foi registrado.
- **Webhook nunca entregou eventos** para nenhum dispositivo (`webhook_status = never` em todos, checado hoje 13:15). A função `wavoip-configure-webhook` tenta registrar em endpoints inexistentes (`/devices/webhook` com `Bearer device_token`), quando a API real é `POST/PUT /devices/:device_id/webhook` autenticado com o **JWT do provedor**.
- O poll `wavoip-sync-history` também bate em endpoints inexistentes (`/calls`, `/v1/calls`, `/devices/calls` com `device_token`). A API real é `GET /v2/devices/:id/calls` com JWT do provedor. Por isso roda a cada 5 min e não traz nada.
- A fila de reconciliação (`wavoip_reconcile_queue`) está vazia: só é alimentada pelo webhook, que não recebe nada.

Conclusão: hoje a tela "Histórico" mostra apenas o que o navegador do atendente conseguiu ver. Ligações recebidas no celular, ligações de outros atendentes e o desfecho das chamadas que tocaram não chegam. Todos os dispositivos já têm `provider_id` e `wavoip_device_id` gravados, então há tudo para consertar.

## O que será feito

### 1. Corrigir o poll de histórico (`wavoip-sync-history`)
- Buscar o JWT do provedor via `wavoip-providers` (`get_token`) e chamar `GET {api_base}/v2/devices/{wavoip_device_id}/calls`.
- Mapear os campos do retorno para `wavoip_call_logs` (status canônico, direção, números, horários, duração, motivo de encerramento) reutilizando o mesmo mapeamento já usado em `wavoip-fetch-call-details`.
- Upsert por `whatsapp_call_id`, sem sobrescrever `recording_*`/`transcription_*`; preencher `contact_id`/`contact_phone_e164`/`conversation_id` com o helper compartilhado.
- Incluir também dispositivos desconectados que tiveram atividade nos últimos 30 dias (hoje só sincroniza `connected`).
- Registrar no log da função quantas chamadas vieram por dispositivo e erros de API, em vez de silenciar.

### 2. Fechar as ligações travadas em "CHAMANDO"
- No mesmo poll: qualquer registro com status não terminal há mais de 15 min é enfileirado em `wavoip_reconcile_queue`, para o `wavoip-reconcile-call` buscar o desfecho em `GET /calls/whatsapp/:id`.
- Se a API não conhecer a chamada, marcar como `not_answered` com `ended_at = started_at`, para não ficar eterna em "CHAMANDO".
- Backfill único dos 84 registros atuais por esse mesmo caminho.

### 3. Corrigir o registro automático do webhook (`wavoip-configure-webhook`)
- Usar `PUT`/`POST {api_base}/devices/{wavoip_device_id}/webhook` com JWT do provedor, body `{ url, events: ['CALL','RECORD','DEVICE'] }`.
- Gravar resultado em `wavoip_devices.webhook_status/webhook_last_error` para o `wavoip-verify-webhook` parar de exibir "Nenhum evento recebido" quando o problema for o registro em si.

### 4. Tela `/wavoip` → Histórico
- Botão "Sincronizar com Wavoip" que chama `wavoip-sync-history` para o `client_id` atual e recarrega a lista (o botão "processar fila" atual só roda a reconciliação).
- Rótulo de origem passa a diferenciar `Webhook`, `Sincronização` e `Discador`.

## Detalhes técnicos

- Arquivos: `supabase/functions/wavoip-sync-history/index.ts`, `supabase/functions/wavoip-configure-webhook/index.ts`, `src/pages/wavoip/components/CallHistoryTab.tsx`, `src/pages/wavoip/hooks/useWavoipCallHistory.ts` (apenas invalidação após sync).
- O cron `wavoip-sync-history-every-5-min` já existe e passa a funcionar sem alteração; o cron `wavoip-reconcile-runner` (1 min) esvazia a fila.
- Sem migração de schema: `wavoip_device_id`, `provider_id`, `wavoip_reconcile_queue` e as colunas de vínculo já existem.
- Validação: após deploy, chamar a função para `client_id 300` e conferir que `metadata.source = 'sync-history'` passa de 0 para > 0 e que `stuck_open` cai de 84.
