## Objetivo

No `ChatList.tsx`, melhorar a busca server-side em dois pontos:

1. **Respeitar as abas/filtros ativos** — hoje a busca substitui a lista por todos os contatos retornados, ignorando aba Individual/Grupos, status (Em Aberto / Em Atendimento / Resolvidas) e demais filtros (modo Julia/Humano, atendente, fila, etapa, período). Os badges de contagem também não refletem os totais reais da busca.
2. **Paginar progressivamente** — hoje a query retorna no máximo 100 e exibe tudo de uma vez. Quando houver mais resultados, mostrar `Carregar mais (X de XXX)`. Quando todos forem carregados, mostrar `Fim da lista (XXX de XXX)`. Mesmo padrão visual já usado fora do modo busca (linhas ~1342–1365).

Tudo acontece no `src/components/chat/ChatList.tsx`. Sem alteração de schema, RLS, contexto ou tipos.

---

## 1) Busca segmentada por aba e filtros

Comportamento novo quando `isSearching === true`:

- Aplicar aos resultados da busca os mesmos predicados já usados em `visibleContacts` / `baseForCounts`:
  - Aba **Individual / Grupos** (`activeTab` via `matchesActiveTab`).
  - Filtro de **status** da conversa (`conversationStatusFilter`: `pending` / `open` / `resolved_closed`) usando o mesmo cálculo de `effectiveStatus` (pending+assignee → open).
  - Filtros de **modo** (Julia/Humano via `getConversationMode`), **atendente** (`ownerFilter`), **fila** (`selectedQueue`), **etapa** (`stageIds` + `stageByPhone`), **período** (`periodFilter`) e restrição de open por usuário não-privilegiado (`isVisibleByOpenScope`).
  - Snooze (`snoozed_until > now`) continua escondendo o contato.

Implementação:

- Em `displayContacts`, ao invés de só ordenar `searchResults.contacts`, percorrer `searchResults.conversations` (que já vem do servidor), aplicar todos os predicados acima e retornar os contatos correspondentes (dedupe por `contact_id`). Para contatos sem conversa, manter o contato apenas quando o filtro de status atual for compatível com "todos" (na prática hoje sempre há uma aba ativa — se não houver conversa, só aparece em `resolved_closed` quando não houver match; vamos manter o comportamento atual de pular se `conversationStatusFilter` é pending/open).
- Para `displayConvsByContact`, manter a montagem atual (já funciona), apenas restringindo às conversas que passaram pelo filtro.

Contadores das abas durante a busca:

- Reaproveitar o loop existente de `pendingConvCount/openConvCount/closedConvCount`, mas quando `isSearching` for true, alimentá-lo a partir de `searchResults.conversations` (universo da busca) ao invés de `conversations`. Mantém todos os outros predicados. Resultado: os badges Em Aberto / Em Atendimento e o ícone de Resolvidas mostram o total da busca em cada aba.

## 2) Paginação progressiva da busca

Trocar a query única por uma query paginada com count exato:

- Estado local: `searchPage` (number, começa em 1) + tamanho de página `SEARCH_PAGE_SIZE = 50`.
- `useQuery` com `queryKey: ['chat-list-search', clientId, trimmedSearch, searchPage]`:
  - Primeiro `select(..., { count: 'exact' })` em `chat_contacts` filtrando por `client_id` + `or(name.ilike%/phone.ilike%)`, `range(0, page * SEARCH_PAGE_SIZE - 1)`, ordenado por `last_message_at desc nulls last`.
  - Em seguida `chat_conversations.in('contact_id', ids)` igual hoje.
  - Retornar `{ contacts, conversations, total }`.
- Resetar `searchPage` para 1 sempre que `trimmedSearch` mudar (via `useEffect`).
- `keepPreviousData: true` (placeholderData) para não “piscar” a lista ao paginar.

UI no rodapé da lista (substitui o ramo `!isSearching` atual quando estiver buscando):

- Contagem visível filtrada após aplicar os predicados de aba: `displayContacts.length`. O total geral da busca: `searchResults.total`.
- Se `displayContacts.length < total` e há mais páginas no servidor (`searchResults.contacts.length < total`):
  - Botão `Carregar mais (X de XXX)` onde `X = searchResults.contacts.length` e `XXX = searchResults.total`. Click → `setSearchPage(p => p + 1)`. Spinner enquanto `isFetching`.
- Quando `searchResults.contacts.length >= total`:
  - Texto `Fim da lista (XXX de XXX)`.
- Manter o mesmo comportamento já existente para o modo não-busca (load-more incremental dos contatos do contexto), apenas exibindo também `(X de XXX)` ali se o contexto fornecer um total — fora do escopo se o total não estiver disponível; nesse caso manter os textos atuais. (Decisão: mostrar o `(X de XXX)` apenas no modo busca, onde temos o `count` exato; no modo padrão manter "Carregar mais conversas" e "Fim da lista" como hoje, conforme o usuário pediu “mesmo padrão do chat”.)

## Detalhes técnicos

- Arquivo: `src/components/chat/ChatList.tsx` (todas as mudanças).
- Reaproveitar `getDateRange`, `applyClientFilters`, `getConversationMode`, `matchesActiveTab`, `isVisibleByOpenScope`, `stageByPhone`.
- Nenhuma mudança em `WhatsAppDataContext`, hooks de dados ou Supabase.
- Cuidado: ao filtrar `displayContacts` pelo `conversationStatusFilter`, o sentinel infinito (`bottomSentinelRef`) deve permanecer escondido durante a busca (já está sob `!isSearching`). Manter assim.
- O sentinel `convSentinelRef` (carrega mais conversas para badges) também não deve disparar durante a busca; condicionar seu `IntersectionObserver` a `!isSearching`.

## Fora de escopo

- Server-side filters por aba/status (continua sendo client-side sobre os 50/100 carregados; aceitável porque a busca limita o universo).
- Mudança no padrão da lista padrão (não-busca).
- Ajustes em hooks externos, schema, RLS ou edge functions.
