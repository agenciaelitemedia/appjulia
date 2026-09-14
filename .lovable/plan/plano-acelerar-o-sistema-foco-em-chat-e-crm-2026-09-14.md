# Plano: acelerar o sistema (foco em chat e CRM)

## O que a medição mostrou (dados reais do banco agora)

Ranking de tempo total gasto no banco (desde o último reinício):

| Onde | Chamadas | Tempo médio | Tempo total |
|---|---|---|---|
| Leitura da fila de entrada do WhatsApp | 208.380 | 138 ms | ~8 horas |
| Idem (2ª variação da mesma leitura) | 148.971 | 31 ms | ~1,3 hora |
| Marcações de status na mesma fila | 16,6 milhões | 0,13 ms | ~36 min |
| Contagem de atendimentos por atendente | 352.206 | 5,9 ms | ~35 min |
| Lista de conversas do escritório | 30.954 | 24 ms | ~12 min |
| Cards do CRM (lista com quadro/etapa) | 71.299 | 4,3 ms | ~5 min |

Ou seja: **a fila de entrada do WhatsApp consome mais tempo de banco do que todo o resto do sistema somado.** Chat e CRM ficam lentos porque disputam o mesmo banco com essa fila.

Causas confirmadas:

1. A fila (`chat_inbound_queue`) guarda **307.380 registros já processados** e ocupa 519 MB. Cada leitura carrega o conteúdo bruto dos eventos, o que torna a busca por itens pendentes cara mesmo existindo índice.
2. O índice atual da fila cobre situação/prazo, mas não a ordenação usada, então cada busca ainda ordena um volume grande.
3. Eventos que o processador **descarta sem fazer nada** (conversas, presença, grupos) foram gravados na fila: mais de 74 mil registros gravados e lidos para nada.
4. A tabela de mensagens tem **6 GB para 1,65 milhão de mensagens** — cerca de 3,7 KB por mensagem, porque o pacote bruto do WhatsApp é guardado inteiro em cada linha.
5. A contagem de "atendimentos por atendente" é recarregada a cada 30 segundos por usuário logado, lendo todas as conversas do escritório (352 mil execuções).
6. 18,9 milhões de transações desfeitas desde o último reinício — sinal de gravações repetidas que colidem e são refeitas, típico do fluxo da fila.

Banco hoje: memória 61%, disco 54%, conexões 20/120, tamanho 10,31 GB. Não é falta de servidor — é volume de trabalho desnecessário.

## O que será feito

### 1. Limpeza e enxugamento da fila de entrada (maior ganho)
- Apagar os registros já concluídos com mais de 3 dias e criar limpeza automática diária.
- Não gravar mais na fila os eventos que o processador descarta (conversas, presença, grupos): eles passam a ser respondidos na hora, sem ocupar espaço.
- Índice novo, específico para "itens pendentes na ordem de chegada", para a busca ler apenas o que precisa.
- Ler o conteúdo bruto do evento só depois de reservar o item, em vez de carregar tudo já na busca.

Efeito esperado: a leitura mais cara do sistema cai de ~138 ms para poucos milissegundos, liberando o banco para o chat e o CRM.

### 2. Contagem de atendimentos sem varrer o escritório inteiro
- Trocar a leitura de todas as conversas por uma contagem agrupada no próprio banco (já existe função equivalente) e subir o intervalo de atualização de 30 s para 60 s, mantendo tempo real por evento quando a conversa muda.

### 3. Lista de conversas e do CRM
- Reduzir os campos trazidos na lista de conversas para os que a tela realmente exibe, e paginar de forma consistente.
- Ajustar o índice do CRM para o filtro real usado (escritório + situação + data de criação), hoje atendido por índices parciais que não cobrem a ordenação.

### 4. Peso das mensagens no disco
- Parar de guardar o pacote bruto completo de cada mensagem; manter apenas os campos usados (mídia, resposta, encaminhamento).
- Rotina de compactação para as mensagens antigas, liberando vários GB e acelerando toda leitura de histórico.

### 5. Manutenção e higiene
- Limpeza de registros mortos nas tabelas de chat (163 mil linhas mortas em mensagens).
- Revisar as rotinas automáticas de 1 minuto: hoje são 9 rodando a cada minuto; as que raramente têm trabalho passam a intervalos maiores.
- Retenção para as tabelas de log que já passam de 300 MB (histórico importado, mensagens descartadas, logs de webhook).

## Ordem de execução e verificação

1. Fila de entrada (itens 1) — medir de novo o tempo médio da leitura.
2. Contagem de atendimentos e listas (itens 2 e 3) — conferir que os números exibidos continuam idênticos.
3. Peso das mensagens (item 4) — conferir tamanho da tabela antes/depois e abrir conversas antigas.
4. Manutenção (item 5) — reconferir o ranking de consultas lentas ao final.

Nenhuma mensagem, conversa, contato ou card é apagado em nenhuma etapa.

## Detalhes técnicos

- Migração: `DELETE` em lotes de `chat_inbound_queue` com `status='done'` e `processed_at < now() - interval '3 days'`; job `pg_cron` diário; `CREATE INDEX chat_inbound_queue_pending_order_idx ON chat_inbound_queue (next_attempt_at, created_at) WHERE status='pending'`; `VACUUM ANALYZE` pós-limpeza.
- `supabase/functions/uazapi-chat-webhook/index.ts`: mover a lista `SKIPPABLE_EVENTS` do worker para o webhook (short-circuit antes do insert), preservando `connection`/`messages`/`messages_update`/`history`/`contacts`/`call`.
- `src/routes/api/public/chat-inbound-worker.ts`: busca passa a selecionar `id, queue_id, event_name, attempts` e o `payload` é lido no claim; manter `BATCH_SIZE=250`, `CONCURRENCY=50`.
- `src/hooks/useChatLiveLoads.ts` / `useChatAgentCapacity.ts`: usar RPC `chat_agent_load_by_queue`, `refetchInterval` 60 s, invalidação por Realtime.
- Índices: `crm_deals (client_id, status, created_at DESC)`; revisar `chat_conversations` seleção de colunas em `chat_list_feed`/hooks da lista.
- `chat_messages`: parar de gravar `raw_payload` completo no webhook (manter campos derivados em `metadata`); migração de compactação por faixas de data com `NULL` em `raw_payload` para mensagens com mais de 30 dias.
- Retenção: `uazapi_history_items` (2,29 GB), `chat_dropped_messages` (319 MB), `webhook_logs` (50 MB) com janelas de 30–90 dias via `pg_cron`.
