# Diagnóstico de lentidão — plano de correção

Investiguei o banco de produção (queries mais lentas, índices, tamanho de tabelas, cron) e a lentidão **não vem da sua conta em si**: vem de pressão global no banco compartilhado, causada principalmente por consultas de deduplicação de mensagens do webhook do WhatsApp. Abaixo o que os dados mostram e o que propomo corrigir.

## O que os dados mostram (medido, não suposição)

1. **Gargalo nº 1 — deduplicação de mensagens com `ILIKE` (chat_messages)**
   O conjunto de consultas `message_id ilike ... OR external_id ilike ...` soma **~1.24 bilhão de ms** de tempo de execução, com média de **2 a 5,6 segundos por chamada** e picos de 8s. São ~700 mil chamadas. Origem: `supabase/functions/uazapi-chat-webhook/index.ts` (`resolveChatMessageRowIds`, fase 2 de fallback, linhas 201-242). O fallback deveria ser "raro", mas está sendo executado em massa — sempre que a busca exata não acha nada (webhooks de status de mensagens que não existem no banco), o sistema cai no `ILIKE` com padrão iniciando em `%`, o que gera varredura pesada. Já existem **1,84 milhão de seq scans** em `chat_messages` (1,4 milhão de linhas, 5 GB).

2. **Gargalo nº 2 — fila de histórico do UaZapi**
   `uazapi_history_items` tem **1.339.942 linhas / 2,28 GB** e nenhuma é pendente (fila vazia, tudo já processado). Mesmo assim, a consulta `status = ? AND processed_at >= ?` roda 193 mil vezes a ~300 ms — **não existe índice composto `(status, processed_at)`**. E o monitor da tela de Configurações faz **9 pollings simultâneos entre 4s e 15s**.

3. **Disco em 80% + tabelas de log sem expurgo**
   - `cron.job_run_details`: **1,5 GB** / 342 mil linhas, nunca limpo.
   - `uazapi_history_items`: 2,28 GB de histórico já processado.
   - `chat_dropped_messages`: 317 MB.
   - `_http_response`: 492 MB.
   Banco total: 10,14 GB. WAL em 1,3 GB.

4. **Índices redundantes em `chat_messages` (1,6 GB só de índice)**
   - `idx_chat_messages_text_trgm` — 309 MB, **27 usos**.
   - `idx_chat_messages_caption_trgm` — **0 usos**.
   - `idx_chat_messages_message_id` (114 MB, 999 usos) é duplicata de `idx_chat_messages_message_id_unique` (3,5 mi usos).
   - `idx_chat_messages_contact_external` — 169 MB, 187 usos.
   Cada índice extra encarece **toda inserção de mensagem** (são 1,1 milhão de inserts registrados).

5. **Escritas de altíssimo volume**
   - `UPDATE chat_contacts SET unread_count` — **2,07 milhões de chamadas** (95.695 s totais).
   - `UPDATE uazapi_history_items` — 2,13 milhões de chamadas.
   - **16,6 milhões de transações revertidas** e **27 deadlocks** desde o último boot: sinal de disputa por linha (conflito entre webhook, processador de histórico e frontend gravando o mesmo contato).

6. **Cron denso**: 8 jobs rodando a cada minuto e 8 a cada 2-5 minutos, todos via HTTP para edge functions. Somados, competem com o tráfego dos usuários.

## Plano de correção (em ordem de impacto)

### Fase 1 — matar o gargalo do `ILIKE` (impacto imediato, maior ganho)
- Em `resolveChatMessageRowIds`: substituir o fallback `ILIKE` por uma **coluna normalizada + índice btree**. Criar `message_id_suffix` (parte após o último `:`) preenchida por trigger/generated column em `chat_messages`, com índice btree, e usar `.in.()` sobre ela. Elimina o padrão `%:id` por completo.
- Limitar o fallback: no máximo N ids por chamada e só quando a fase 1 falhar para *todos* os ids (hoje um lote grande gera OR com 24+ termos).
- Adicionar cache negativo curto (ex.: ids de status não encontrados nos últimos minutos) para não repetir a busca do mesmo id.

### Fase 2 — índices e expurgo
- Criar `idx_uazapi_history_items_status_processed (status, processed_at DESC)`.
- Remover índices mortos/duplicados de `chat_messages`: `caption_trgm`, `text_trgm` (ou substituir por busca via `chat_list_feed`), `idx_chat_messages_message_id`. Libera ~430 MB e acelera inserts.
- Criar rotina de retenção (cron diário):
  - `cron.job_run_details` > 7 dias;
  - `uazapi_history_items` com `status='done'` > 30 dias;
  - `chat_dropped_messages` > 30 dias.
  Estimativa: liberar 3-4 GB, tirando o disco da faixa de 80%.

### Fase 3 — reduzir polling e contenção
- `useUazapiHistoryRuns`: consolidar os 9 pollings em 1-2 consultas agregadas e subir os intervalos para 15-30s; só pollar quando a aba do monitor estiver visível.
- Revisar os updates de `unread_count`: agrupar/debounce no frontend e evitar reescrever quando o valor já é 0 (hoje há 2 milhões de updates, boa parte redundante).
- Revisar jobs de cron de 1 minuto: onde o SLA permitir, mover para 2-5 minutos.

### Fase 4 — verificação
- Reset de `pg_stat_statements` após as mudanças e nova medição (tempo médio das consultas de chat, seq scans em `chat_messages`, uso de disco).
- Comparar tempo de resposta do `chat_list_feed` antes/depois no painel de performance do próprio JulIA Chat.

## Detalhes técnicos
- Alterações de banco via migração (colunas geradas, índices, funções de retenção, agendamento em `cron`).
- Alteração de código em `supabase/functions/uazapi-chat-webhook/index.ts` e nos hooks de polling listados.
- Nenhuma mudança de comportamento visível ao usuário; a dedução de mensagens continua com a mesma semântica (exata primeiro, sufixo depois).
- Risco: remoção de índices trigrama pode afetar buscas por texto em mensagens — vale confirmar se a busca de mensagens por conteúdo é usada antes de remover `text_trgm`.

## Antes de executar
Preciso confirmar dois pontos com você:
1. Podemos aplicar retenção/expurgo (apagar histórico já processado e logs antigos) ou esses dados precisam ser preservados/arquivados?
2. A busca por conteúdo de mensagem (texto dentro da conversa) é usada no dia a dia? Isso define se removemos o índice de 309 MB.
