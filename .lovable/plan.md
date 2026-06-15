## Objetivo
Permitir o backfill (restauração) de histórico para grupos do WhatsApp **apenas quando** o cliente tem `ALLOW_GROUPS = true` em `chat_client_settings`. Quando o flag estiver desligado, mantém o comportamento atual (grupos são ignorados).

## Onde fica a regra hoje
Edge Function `supabase/functions/uazapi-chat-backfill/index.ts` (linhas 144–150) descarta sempre o backfill se o `chat_id`/contato for de grupo (`@g.us`), marcando `history_backfilled = true` e retornando `skipped: 'group_history_ignored'`.

Adicionalmente, o filtro de mensagens (linha 210) remove qualquer mensagem que `isGroupMessage()` reconheça, mesmo quando a busca for de um grupo.

## Mudança proposta
1. Em `uazapi-chat-backfill`, ao detectar que o chat é grupo:
   - Buscar `chat_client_settings.settings->>'ALLOW_GROUPS'` do `client_id` da fila.
   - Se `ALLOW_GROUPS = false` (ou registro inexistente) → manter o skip atual.
   - Se `ALLOW_GROUPS = true` → seguir o fluxo de backfill em modo grupo:
     - `targetChatId` = JID de grupo (`<id>@g.us`) em vez de forçar `@s.whatsapp.net`.
     - Pular as validações de telefone (8–13 dígitos) que só fazem sentido para contatos pessoais.
     - **Não** aplicar `messages.filter(!isGroupMessage)` quando o próprio chat é grupo (caso contrário tudo seria descartado).
     - Persistir as mensagens normalmente em `chat_messages`, mantendo `channel_type = 'whatsapp_uazapi'` e marcando `metadata.backfilled = true`.

2. Nenhuma mudança de UI nem de schema. A flag `ALLOW_GROUPS` continua sendo gerenciada na tela atual de Configurações > Chat.

## Itens fora do escopo
- Não altera o filtro de grupos do webhook em tempo real (`uazapi-chat-webhook`) — só backfill sob demanda.
- Não altera o `uazapi-history-processor` em massa, que continua ignorando grupos.
- Não cria toggle por fila — o critério continua sendo por cliente (`ALLOW_GROUPS`).

## Riscos / pontos de atenção
- Volume: grupos podem trazer muitas mensagens; manter o `limit` atual (default 50) por chamada.
- `sender_name`: em grupo, o autor real vem em `msg.participant`/`key.participant`. Vamos preencher `sender_name` com o melhor disponível (`pushName` → `participant`).
- Idempotência mantida via `onConflict: 'message_id', ignoreDuplicates: true`.