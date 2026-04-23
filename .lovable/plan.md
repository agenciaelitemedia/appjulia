

# Histórico via webhook: ignorar grupos + acompanhar progresso no Histórico de Sincronização

## Problema

Quando o UaZapi entrega o evento `history` / `messages.set` / `message.history`, o `processHistorySet` roda em segundo plano (`EdgeRuntime.waitUntil`) sem nenhuma visibilidade. Não dá pra acompanhar quantos contatos/mensagens entraram, e grupos podem acabar sendo processados se `ALLOW_GROUPS = true`. Além disso, mensagens entram como `read`, mas o requisito agora é `pending` quando recebidas (não-`from_me`) e `read` apenas para `from_me`.

## Solução

Quando o webhook do UaZapi receber `history` / `messages.set` / `message.history`, criar **automaticamente** um job na tabela `whatsapp_sync_jobs` com `phase = 'history_sync'`, ignorar grupos sempre (independente de `ALLOW_GROUPS`), processar em lotes e atualizar contadores em tempo real. O job aparece no Histórico de Sincronização e pode ser acompanhado igual aos jobs manuais.

### 1. `supabase/functions/uazapi-chat-webhook/index.ts`

**Bloco `history` / `messages.set` / `message.history` (linhas 505–524):**
- Antes de chamar `processHistorySet`, **filtrar grupos** (`remoteJid.endsWith('@g.us')`) — sempre, ignorando `ALLOW_GROUPS`. Histórico de grupo nunca entra.
- Agrupar por `remoteJid` apenas dos individuais → calcular `total_numbers` e `numbers` (lista de telefones únicos).
- Criar registro em `whatsapp_sync_jobs`:
  - `phase = 'history_sync'`
  - `status = 'running'`
  - `client_id = queue.client_id`, `client_name`, `queue_id = queue.id`, `queue_name = queue.name`
  - `cod_agent` / `agent_name` resolvidos a partir do `agents` via `client_id` (best-effort, fallback null)
  - `total_numbers = N` (qtd de chats individuais), `numbers = [{phone, message_count}]`
  - `evo_url = queue.evo_url`, `evo_token = queue.evo_apikey`
  - `started_at = now()`
- Para cada `phone` agrupado, criar log em `whatsapp_sync_job_logs` com `status = 'pending'`.
- Repassar `jobId` para `processHistorySet`.

**`processHistorySet` (linhas 164–351):**
- Adicionar parâmetro `jobId: string | null`.
- **Remover** filtro condicional de grupo (linha 176) e tornar incondicional: `if (isGroup) continue;` (já garantido upstream, mas deixar por segurança).
- A cada chat processado, atualizar:
  - `whatsapp_sync_job_logs` (`update` por `job_id + phone`): `status = 'ok'|'error'`, `messages_found`, `messages_inserted`, `contact_created`, `processed_at = now()`, `error` se houver.
  - `whatsapp_sync_jobs`: incrementar `processed_numbers`, `inserted_messages`, `inserted_contacts` (usar `update` com `select` atual — sem RPC).
- **Status das mensagens (revisão do requisito atual):**
  - `from_me = true` → `status = 'read'`
  - `from_me = false` → `status = 'pending'` (NÃO `delivered`, NÃO `read`) — mensagens recebidas no histórico ficam pendentes; usuário marca lida ao abrir conversa.
  - Não incrementar `unread_count` em `chat_contacts` nem `chat_conversations` (mantém regra atual).
- Ao fim do loop, marcar job como `status = 'done'` (ou `'partial'` se houve erros) + `finished_at = now()`.
- Se zero chats individuais: criar job mesmo assim com `status = 'done'`, `total_numbers = 0` (registro de "histórico recebido, sem indivíduos").

**Erros fatais:** envolver o corpo de `processHistorySet` em try/catch externo que grava `status = 'error'` + `error = message` + `finished_at` no job.

### 2. `src/pages/configuracoes/hooks/useWhatsappSyncJobs.ts`

Adicionar `'history_sync'` ao tipo `phase` (já existe a string, só garantir tipagem).

### 3. `src/pages/configuracoes/components/SyncHistoryTab.tsx`

- Na coluna "Cliente / Fila", quando `phase === 'history_sync'`, exibir badge auxiliar "Histórico WhatsApp" (cor azul-claro) ao lado do nome da fila.
- Esconder botão "Reiniciar" para jobs com `phase === 'history_sync'` (não faz sentido — vem do webhook).
- Esconder botão "Cancelar" para `history_sync` (não há mecanismo para abortar processamento server-side — termina rápido).
- Demais comportamentos (logs, polling 5s, contadores) reaproveitam a infra existente.

### 4. Distinção de comportamento

| Origem | Cria job? | Filtra grupos? | Status mensagens recebidas | Incrementa unread? |
|---|---|---|---|---|
| `history` / `messages.set` / `message.history` (webhook) | **Sim, automático** | **Sempre** | `pending` | Não |
| Wizard manual (`uazapi-history-import`) | Sim (já existente) | N/A (telefones específicos) | `read` (mantém atual) | Não |
| Backfill on-demand (`uazapi-chat-backfill`) | Não | N/A | `read` (mantém atual) | Não |
| Real-time (`messages` upsert) | Não | Conforme `ALLOW_GROUPS` | `delivered` | Sim |

## Arquivos afetados

- `supabase/functions/uazapi-chat-webhook/index.ts` — criação automática de job, filtro de grupos, atualização de contadores, status `pending` para recebidas.
- `src/pages/configuracoes/hooks/useWhatsappSyncJobs.ts` — tipagem `phase` (já comporta).
- `src/pages/configuracoes/components/SyncHistoryTab.tsx` — badge "Histórico WhatsApp" + esconder ações inaplicáveis.

## Validação

1. Disparar evento `messages.set` no UaZapi → ver job aparecer em **Configurações → Histórico de Sincronização** com badge "Histórico WhatsApp" e contadores subindo em tempo real (polling 5s).
2. Confirmar em `chat_contacts` que **nenhum contato `is_group = true`** foi inserido pelo histórico.
3. Mensagens recebidas (`from_me = false`) do histórico aparecem com `status = 'pending'` em `chat_messages`; mensagens enviadas (`from_me = true`) com `status = 'read'`.
4. Nenhum contato/conversa teve `unread_count` incrementado.
5. Job finaliza com `status = 'done'` e `finished_at` preenchido; logs por telefone disponíveis no drawer "Ver logs".

