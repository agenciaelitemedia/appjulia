

# Ajustes na Sincronização WhatsApp

Dois ajustes pequenos e focados, sem mudar a arquitetura existente.

## 1. Botões "Parar" e "Reiniciar" no Histórico

Na aba **Histórico de Sincronização** (`SyncHistoryTab.tsx`), adicionar duas ações por linha:

- **Parar (X vermelho)** — já existe para `status='running'`. Vou ampliar: também permitir parar quando `cancel_requested` já foi pedido mas ainda está rodando (no-op visual, mantém clock).
- **Reiniciar (RotateCw)** — disponível para jobs em qualquer estado finalizado (`done`, `partial`, `error`, `cancelled`). Reusa os mesmos `numbers`, `client_id`, `queue_id`, `cod_agent`, `date_from`, `date_to` do job original e:
  1. Cria um novo registro em `whatsapp_sync_jobs` (status `running`, phase `message_find`).
  2. Invoca `uazapi-history-import` com o novo `job_id`.
  3. Toast de sucesso + invalidação da lista.

A idempotência já garantida (upsert por `message_id` em `chat_messages` e por `client_id+phone` em `chat_contacts`) faz com que reiniciar nunca duplique nada — só preenche o que faltou.

**Arquivos:**
- `src/pages/configuracoes/hooks/useWhatsappSyncJobs.ts` — novo hook `useRestartSyncJob(jobId)`.
- `src/pages/configuracoes/components/SyncHistoryTab.tsx` — botão `RotateCw` ao lado dos demais, com `AlertDialog` de confirmação ("Reiniciar buscará novamente todos os números — mensagens já existentes não serão duplicadas. Continuar?").

## 2. Mensagens importadas entram como LIDAS no /chat

O chat usa `chat_contacts.unread_count` para o badge de não lidas. Hoje, ao backfillar mensagens recebidas (`from_me=false`), o `unread_count` do contato fica como estava (0 para contato novo, valor anterior para contato existente). Isso já é "praticamente lido", mas para garantir que o backfill **nunca** marque nada como não lido:

**Em `supabase/functions/uazapi-history-import/index.ts`**:
- Ao criar um novo contato: já insere `unread_count: 0` explicitamente.
- Ao final do processamento de cada número (após inserir as mensagens): forçar `update chat_contacts set unread_count = 0, history_backfilled = true where id = contactId`. Isso cobre o caso de webhooks/realtime concorrentes terem incrementado o contador durante o backfill.

Sem mudanças no frontend do chat — o badge naturalmente fica zerado.

## Resumo de Arquivos

- **Editar:** `supabase/functions/uazapi-history-import/index.ts` (forçar `unread_count = 0`)
- **Editar:** `src/pages/configuracoes/hooks/useWhatsappSyncJobs.ts` (hook de restart)
- **Editar:** `src/pages/configuracoes/components/SyncHistoryTab.tsx` (botão Reiniciar + diálogo)

Sem migrations, sem mudanças de schema, sem impacto em outros módulos.

