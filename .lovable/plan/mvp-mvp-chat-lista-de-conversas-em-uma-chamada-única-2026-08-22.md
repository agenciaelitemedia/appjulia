# MVP /mvp-chat — lista de conversas em uma chamada única

Protótipo isolado da lista do `/chat`, visualmente e funcionalmente idêntico (inclusive abrir a conversa), mas alimentado por **uma única chamada** que já devolve o card pronto e com **filtros aplicados no banco**.

Regra de ouro: nada existente é alterado. Nenhuma query, action, função de banco, hook ou componente atual é tocado. Tudo novo fica em um único diretório e reaproveita o que já existe via `extend/`.

---

## Mapeamento atual (como o card é montado hoje)

Cada linha da lista do `/chat` hoje é o resultado de ~10 fontes carregadas **depois** da lista aparecer:

| Informação no card | Origem hoje | Banco |
|---|---|---|
| Nome, foto, telefone, prévia, hora, não-lidas, grupo | `chat_contacts` (paginado 1 página por vez) | Supabase |
| Fila, status (Aguardando/Atendimento), responsável, prioridade, protocolo, snooze, canal | `chat_conversations` (páginas grandes em background) | Supabase |
| Etiquetas | `chat_conversation_tags` + `chat_tags` | Supabase |
| SLA (badge de estouro/risco) | `chat_sla_configs` + `chat_messages` (última msg por conversa) | Supabase |
| Badge TICKET #N | `chat_conversations.active_ticket_id` + `support_tickets` | Supabase |
| Badge CRM Builder (Quadro · Etapa) | `crm_deals` + `crm_boards` + `crm_pipelines` (varre `custom_fields.links`) | Supabase |
| Fila tem agente Júlia? (`cod_agent`) | `queue_agent_links` + `queues` | Supabase |
| Badge JULIA #cod · Etapa do CRM da Júlia | `crm_atendimento_cards` + `crm_atendimento_stages` (por telefone + cod_agent) | **Externo** |
| Júlia ativa/humano assumiu | `sessions.active` (por telefone + cod_agent) | **Externo** |
| Badge META ADS · anúncio | `campaing_ads` (+ `sessions`) por telefone | **Externo** |
| Nome do responsável legível | `users`/equipe do cliente | **Externo** |

Consequências que o MVP resolve: o card "pisca" (etapa/campanha/Júlia chegam depois), filtros de etapa, modo Júlia/humano, responsável e período são aplicados **no cliente** sobre uma janela parcial de dados — então contadores e filtros ficam imprecisos, e um lead fora da paginação local não entra no filtro.

---

## Arquitetura do MVP

Uma edge function nova, `mvp-chat-list-feed`, faz exatamente 2 SQLs (uma por banco), mescla e devolve as linhas já filtradas, ordenadas e paginadas. O frontend faz **1 request**.

```text
/mvp-chat  ──1 POST──►  mvp-chat-list-feed
                            ├─ SQL A (Supabase) : mvp_chat_list_feed(...)  → 1 query com todos os joins
                            └─ SQL B (Externo)  : 1 query única (stages + sessions + campanhas por telefone)
                                                   ▼
                                          merge + filtros externos + ordenação + limit/offset
                                                   ▼
                                       rows[] já com TODOS os badges do card
```

Por que 2 SQLs e não 1: os dados de CRM da Júlia, sessão e Meta Ads vivem no Postgres legado, sem FDW para o Supabase. O plano trata "query única" como **um round-trip único do frontend com filtros no servidor**. A fase 2 (opcional, mapeada abaixo) elimina a segunda SQL.

### SQL A — função nova no Supabase (somente leitura, aditiva)

`mvp_chat_list_feed(p_client_id, p_queue_ids, p_status, p_tab, p_owner, p_search, p_from, p_to, p_only_mine_open, p_ticket, p_tag_ids, p_sort, p_limit, p_offset)`

Retorna uma linha por **conversa líder** de cada contato (mesma regra já documentada: maior `updated_at`, desempate `opened_at`/`created_at`) com, em colunas/JSON:

- contato (nome, avatar, phone, is_group, unread, prévia, `last_message_at`)
- conversa (status efetivo, fila + nome da fila, `assigned_to`, prioridade, protocolo, canal, snooze, `first_response_at`)
- `tags` agregadas em JSON
- ticket ativo (número, status, prioridade, assunto)
- vínculo CRM Builder (quadro/etapa/cores) resolvido por `conversation_id` **e** por `contact_id`
- `cod_agent` da fila (via `queue_agent_links`)
- metadados da última mensagem para SLA (`last_inbound_at`, `last_outbound_at`) via lateral indexada
- `total_count` e contadores por status na mesma passagem (window functions), para os badges Aguardando/Atendimento/Resolvidos serem exatos

Implementada como função SQL `SECURITY DEFINER` com nome prefixado `mvp_` (sem colisão com nada existente), somente `SELECT`, `GRANT EXECUTE` apenas para os papéis necessários.

### SQL B — uma query no banco externo

Dentro da própria edge function nova (conexão postgresjs seguindo o padrão do projeto: detecção de socket Unix, normalização do CA). Uma única SQL com CTEs recebendo os arrays de telefones e pares `(telefone, cod_agent)` vindos do resultado da SQL A:

```text
WITH stages AS (...crm_atendimento_cards + stages...),
     sess   AS (...sessions.active...),
     camps  AS (...campaing_ads + sessions...)
SELECT ... FULL OUTER JOIN por telefone normalizado
```

Nenhuma action do `db-query` é criada ou alterada — a função nova tem sua própria conexão.

### Filtros suportados (todos server-side)

Filas selecionadas · Aguardando/Atendimento/Resolvidos/Fechados · Individual/Grupos · Responsável (meu / sem responsável / membro) · Período (hoje, 7d, 30d, mês, mês anterior, tudo) · Busca (nome/telefone) · Etiquetas · SLA (estourado / em risco) · **Etapa do CRM da Júlia** · **Modo Júlia vs humano** · **Tem card no CRM Builder** · **Veio de Meta Ads** · Tem ticket aberto · Ordenação (mais recente / mais antigo / não-lidos).

Os três marcados em negrito hoje só existem como filtro parcial no cliente; no MVP são aplicados no servidor após o merge, antes da paginação — é isso que torna filtros e contadores precisos.

---

## Estrutura de arquivos (tudo concentrado)

```text
src/modules/mvp-chat/
  module.ts                  rota, título, permissão de leitura
  routes.tsx                 <Route path="/mvp-chat">
  extend/
    db.ts                    re-export supabase (nada de acesso novo espalhado)
    auth.ts                  re-export useAuth / isOwnerUser
    ui.ts                    re-export dos componentes shadcn usados
    chat.ts                  re-export ChatContactItem, badges, MascoteLoader (reuso visual, sem editar)
  api/
    fetchMvpChatFeed.ts      1 invoke da edge function, tipos da resposta
    types.ts                 MvpChatRow, MvpChatFilters, MvpChatCounters
  hooks/
    useMvpChatFeed.ts        React Query + infinite scroll + keepPreviousData
    useMvpChatFilters.ts     estado dos filtros sincronizado com a URL
  components/
    MvpChatList.tsx          lista virtualizada
    MvpChatRow.tsx           card (usa ChatContactItem via extend, dados já prontos)
    MvpChatFilters.tsx       barra de filtros + contadores
    MvpChatPerfPanel.tsx     painel de diagnóstico: nº de requests, ms da SQL A, ms da SQL B, ms total, linhas
  pages/
    MvpChatPage.tsx          página completa

supabase/functions/mvp-chat-list-feed/index.ts
supabase/migrations/<ts>_mvp_chat_list_feed.sql   (função + índices de apoio, apenas CREATE)
```

Registro da rota: uma linha em `App.tsx` importando `mvpChatRoutes` — única alteração fora do diretório, e apenas adição.

Clicar em uma linha navega para `/chat?contact=<id>` (a lista real assume dali), como já faz o módulo X-Julia.

---

## Ordem de execução

1. Migration com a função `mvp_chat_list_feed` + índices de apoio (`CREATE INDEX IF NOT EXISTS`, sem `CONCURRENTLY`).
2. Edge function `mvp-chat-list-feed` (SQL A + SQL B + merge + filtros + paginação, com `timings` na resposta).
3. Módulo `src/modules/mvp-chat/` com `extend/`, hooks e página.
4. Rota em `App.tsx`.
5. Validação: comparar lado a lado com `/chat` (mesmo cliente e filas) — mesma contagem por aba, mesmos badges nos 20 primeiros cards, e medir requests/tempo no painel de performance.

## Fase 2 (mapeada, fora deste MVP)

Tabela-projeção no Supabase (`mvp_chat_external_facts`: telefone, cod_agent, etapa, sessão ativa, campanha) sincronizada pelos webhooks que já gravam no banco legado + cron de reconciliação. Com ela a SQL B desaparece e a lista passa a ser **literalmente uma única query SQL**, com todos os filtros indexados.
