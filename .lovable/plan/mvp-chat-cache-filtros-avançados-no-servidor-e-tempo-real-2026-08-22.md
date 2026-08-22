# MVP Chat: cache, filtros avançados no servidor e tempo real

Três frentes sobre o protótipo `/mvp-chat`, sem tocar no `/chat` atual nem no `db-query`.

## 1. Cache server-side do banco legado

Hoje toda página do feed abre conexão com o Postgres legado e roda a query de CRM da Júlia + sessões + Meta Ads — é o trecho mais lento (~1,5–2,2 s dos ~2,5 s totais).

- Nova tabela no Cloud `mvp_chat_legacy_cache`: chave `client_id` + `phone_key` + `cod_agent`, colunas com etapa (id/nome/cor), `has_julia_card`, `session_is_active`, `campaign` (jsonb) e `fetched_at`. Índice único na chave e índice em `fetched_at`. GRANTs para `service_role` (só a Edge Function lê/escreve) e RLS habilitada sem policy pública.
- A Edge Function passa a: ler o cache das chaves da página → consultar o legado **apenas** para as chaves ausentes ou com `fetched_at` mais antigo que a janela de TTL → gravar/atualizar o resultado (upsert em lote).
- Invalidação por janela de tempo: TTL padrão de 60 s para conversas com mensagem recente (últimas 24 h) e 10 min para conversas antigas; `?refresh=1` (flag no corpo) força bypass do cache no botão "Recarregar".
- Fallback: se o legado falhar, servir o valor do cache mesmo vencido e sinalizar `external_stale: true` nos `timings` (o painel de performance passa a mostrar `cache_hits`, `cache_misses` e se houve dado velho).

## 2. Filtros avançados equivalentes ao /chat, todos no servidor

- **Responsável**: virar multi-seleção (`owners: string[]`) combinável com "sem responsável", em vez do único `owner` de hoje. Nova lista de responsáveis vinda dos `assigned_to` distintos do cliente.
- **Etapa do CRM**: passa a aceitar múltiplas etapas e filtrar por `stage_id` (mais estável que o nome usado hoje); a lista de etapas deixa de ser derivada das linhas carregadas e passa a vir do legado (com cache), então filtrar por etapa sem cards na página atual funciona.
- **Status de SLA**: novo filtro `sla_status` (`on_track`, `at_risk`, `breached`) aplicado **no SQL**, replicando a regra do `evaluateSla` (FRT quando não há primeira resposta, NRT quando a última mensagem é do cliente, TTR depois) com os alvos de `chat_sla_configs` por prioridade e os defaults por prioridade quando não há config. Cada linha volta com `sla_status`, `sla_type` e `sla_remaining_minutes` já calculados, para o card exibir o badge sem recalcular.
- **CRM Builder / ticket / Meta Ads / etiquetas / filas / prioridade / período**: mantidos, mas todos combináveis entre si e refletidos nos totalizadores, que passam a ser calculados sobre o conjunto **já filtrado** (inclusive filtros do legado, hoje pós-merge com recontagem parcial).
- Ordenação ganha `sla` (mais críticos primeiro).
- A barra de filtros recebe os novos controles (responsáveis multi, etapas multi, SLA) e um resumo de "filtros ativos" com limpar individual.

## 3. Tempo real

- Assinatura Realtime na página do MVP para `chat_messages` (INSERT) e `chat_conversations` (UPDATE/INSERT) do cliente, com um único canal criado no `useEffect` e removido no unmount.
- Patch incremental no estado do feed: mensagem nova atualiza `last_message_text`, `last_message_at`, `unread_count` e reordena a linha; mudança de conversa atualiza status/responsável/prioridade/etiquetas da linha. Sem refetch da página inteira.
- Quando o evento cria uma conversa/contato que ainda não está na lista, ou muda algo que afeta o filtro ativo, agenda um refetch com debounce (~1,5 s) da primeira página em vez de mutar às cegas.
- Contadores atualizam junto com os patches; badge "novas conversas" quando o usuário está com scroll longe do topo.
- Habilitar Realtime nas tabelas envolvidas via migração, caso ainda não estejam na publicação.

## Detalhes técnicos

- Arquivos afetados: `supabase/functions/mvp-chat-list-feed/index.ts` (cache + novos parâmetros), função SQL `mvp_chat_list_feed` (novos filtros, SLA e totalizadores), `src/modules/mvp-chat/api/types.ts`, `api/fetchMvpChatFeed.ts`, `hooks/useMvpChatFeed.ts` (patches em tempo real), novo `hooks/useMvpChatRealtime.ts`, `hooks/useMvpChatOptions.ts` (responsáveis + etapas), `components/MvpChatFilters.tsx`, `components/MvpChatRow.tsx` (badge de SLA vindo do servidor), `components/MvpChatPerfPanel.tsx` (métricas de cache) e `pages/MvpChatPage.tsx`.
- Migrações: criação de `mvp_chat_legacy_cache` com GRANTs e RLS, atualização da função `mvp_chat_list_feed` e publicação Realtime das tabelas de chat.
- Escopo isolado: nada em `src/components/chat/`, `useChatSlaConfigs.ts` ou `db-query` é alterado — a lógica de SLA é reimplementada em SQL espelhando as mesmas regras.
