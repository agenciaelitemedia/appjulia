

## Diagnóstico: por que a sincronização da UaZapi parou pela metade

Após você reconectar, o servidor UaZapi disparou **40 webhooks de `messages:replay` em ~10 segundos** (cada um com 200 mensagens). O frontend está vazio porque:

1. O webhook enfileira tudo corretamente — **40 runs** foram criados em `uazapi_history_runs`, com **888 items** em `uazapi_history_items`.
2. O `uazapi-history-processor` é invocado **em paralelo (uma instância por run)**. Como cada invocação carrega 200 mensagens + abre conexões para 20–28 chats simultâneos, o EdgeRuntime satura, mata as instâncias e o processor abandona o trabalho **no meio do run**.
3. Resultado: cada run termina com ~5–13 items `ok` e o restante fica eternamente `pending`. Os mais recentes nem chegaram a processar nada (`ok=0`).
4. Não existe **retentativa** dos items `pending` — eles ficam órfãos e nada nunca é inserido em `chat_contacts`/`chat_messages` para esses chats.

Estado atual: **53 contatos** criados em `chat_contacts` para o cliente 30 (apenas dos items `ok`); **650 items pending** parados.

```text
UaZapi reconecta
   │
   ▼  40 webhooks em rajada
uazapi-chat-webhook ─┐
   │                 │ enqueueHistoryRun ✅ (40 runs criados)
   │                 └─ dispatchHistoryProcessor (40x em paralelo)
   ▼
uazapi-history-processor ✗ EdgeRuntime satura → instâncias morrem
   │
   ▼ items: 238 ok ✅, 650 pending 💀 (nunca retomados)
```

## Correções

### 1. Worker de retomada (cron) para items `pending`
Criar **`uazapi-history-resume`** edge function que:
- Roda a cada 1 min via `pg_cron`
- Pega items `status='pending'` mais antigos que 30s (lote de 5 por execução)
- Reprocessa cada um chamando `/message/find` na UaZapi para o `remote_jid` daquele item, inserindo em `chat_messages` e `chat_contacts`
- Atualiza item para `ok`/`error` e ajusta `processed_chats`/status do run pai (vira `done` ou `partial` quando tudo termina)

### 2. Serializar dispatch no webhook
Em `uazapi-chat-webhook` → `dispatchHistoryProcessor`:
- Não disparar mais a fan-out paralela. Apenas **enfileirar** (já faz) e marcar `status='pending'`
- O `uazapi-history-resume` (cron) faz todo o trabalho — webhook responde 200 em milissegundos sem invocar processor

### 3. Reduzir lote do processor
Quando o resume chamar o processor, passar **`max_items=5`** para evitar saturação. Processor processa, devolve, próximo tick continua.

### 4. Botão "Reprocessar pendentes" na aba Histórico UaZapi
Em `/configuracoes` aba **Histórico UaZapi**, botão que invoca manualmente `uazapi-history-resume` com `force=true` para destravar a fila imediatamente sem esperar o cron.

### 5. Banner de pendência na aba Histórico UaZapi
Mostrar no topo: `"⚠ X items aguardando processamento"` (count de `uazapi_history_items` com `status='pending'`), com data do mais antigo.

## Arquivos afetados
- `supabase/functions/uazapi-history-resume/index.ts` (novo — worker cron)
- `supabase/functions/uazapi-history-processor/index.ts` (aceitar `max_items` e processar items pending por id)
- `supabase/functions/uazapi-chat-webhook/index.ts` (parar de invocar processor diretamente — só enfileira)
- `supabase/migrations/<ts>_history_resume_cron.sql` (pg_cron job a cada 1 min + grant)
- `src/pages/configuracoes/components/UazapiHistoryTab.tsx` (banner + botão "Reprocessar pendentes")
- `src/pages/configuracoes/hooks/useUazapiHistoryRuns.ts` (novo hook `useUazapiHistoryPending`)

## Resultado esperado
- Os 650 items `pending` atuais serão drenados em ~10 min após o cron entrar em ação
- Novas reconexões nunca mais saturarão: o webhook só enfileira, o cron drena no ritmo do EdgeRuntime
- Painel mostra contagem viva de pendências e botão para forçar drain

