
## Objetivo

No `/chat`, carregar contatos sob demanda (50 por página, com auto-load ao chegar no fim da lista) e definir o filtro de período padrão como **7 dias** sempre que o usuário entrar no chat.

## Situação atual

- `WhatsAppDataContext.loadContacts()` faz um único `SELECT * FROM chat_contacts` sem `LIMIT` nem `RANGE`, trazendo TODOS os contatos da fila de uma vez. Isso deixa o carregamento inicial lento.
- `ChatList.tsx` renderiza `visibleContacts.map(...)` direto dentro de um `ScrollArea` — sem sentinel/IntersectionObserver, sem botão "carregar mais".
- O filtro de período (`periodFilter`) começa em `'all'`. Não há persistência nem default de 7 dias.

## Mudanças

### 1) Paginação no contexto (`src/contexts/WhatsAppDataContext.tsx`)

- Trocar `loadContacts()` para suportar paginação:
  - Nova assinatura: `loadContacts(opts?: { reset?: boolean })`.
  - Usa `.range(offset, offset + PAGE_SIZE - 1)` com `PAGE_SIZE = 50`.
  - Filtra **no servidor** por `last_message_at >= (hoje - 7 dias)` quando o filtro de período padrão estiver ativo, para que a paginação respeite o recorte temporal e o "fim da lista" seja real.
  - Mantém estado `contactsHasMore: boolean` e `contactsOffset: number`.
  - `reset: true` zera offset e substitui a lista; sem reset, faz append (deduplicando por `id`).
- Novo método exposto: `loadMoreContacts()` — incrementa offset e chama o loader.
- Novo state exposto: `hasMoreContacts`, `isLoadingMoreContacts`.
- `loadContacts` continua sendo chamado no mount; resets adicionais são disparados quando `selectedQueue` ou o **filtro de período** mudam.
- Filtro de período é elevado para o contexto (hoje vive só no `ChatList`) para que a query do banco use o mesmo recorte. Default = `'last7days'`.

### 2) Filtro de período default = 7 dias

- Em `ChatList.tsx`, mover `periodFilter` / `setPeriodFilter` para o `WhatsAppDataContext`.
- Inicialização: `useState<PeriodFilter>('last7days')`.
- Toda vez que o usuário entra no `/chat` (mount do `WhatsAppDataProvider`), o filtro inicia em `last7days`. Sem persistência em localStorage — sempre 7 dias por padrão, conforme pedido.
- A query de `loadContacts` aplica `gte('last_message_at', subDays(today, 7).toISOString())` quando `periodFilter === 'last7days'`. Para os outros valores (`today`, `yesterday`, `thisMonth`, `last3Months`, `all`), aplica o range correspondente; `'all'` não aplica filtro de data.
- O filtro client-side existente em `applyClientFilters` continua, mas redundante para período (vira no-op quando server já filtrou).

### 3) Infinite scroll no `ChatList.tsx`

- Substituir o `ScrollArea` que envolve a lista por um `<div ref={listRef} className="flex-1 overflow-y-auto">` para ter controle direto do scroll (igual ao `ChatMessages.tsx`).
- Adicionar um sentinel `<div ref={bottomSentinelRef} />` no final da lista renderizada.
- `IntersectionObserver` no sentinel: quando entra na viewport e `hasMoreContacts && !isLoadingMoreContacts`, dispara `loadMoreContacts()`.
- Indicador de "carregando mais" (spinner pequeno) acima do sentinel quando `isLoadingMoreContacts`.
- Quando `!hasMoreContacts && visibleContacts.length > 0`, exibe rodapézinho "Fim da lista".

### 4) Considerações

- A lista renderizada (`visibleContacts`) ainda passa por filtros client-side (SLA, modo IA, responsável, etapa). Como o servidor agora retorna apenas 50 por vez, alguns filtros client-side podem reduzir a página exibida. Isso é aceitável: o auto-load continua disparando até preencher ou esgotar — adicionar um "auto-load até render >= 20 ou !hasMore" para evitar páginas quase vazias quando filtros agressivos estão ativos.
- Realtime de novas mensagens continua funcionando (já trata `INSERT`/`UPDATE` em `chat_contacts`); novos contatos entram no topo independentemente da paginação.
- `loadConversations` continua carregando todas as conversas pending/open da fila (necessário para badges/SLA), mas isso já é leve. Não muda nesta tarefa.

## Detalhes técnicos

```text
WhatsAppDataContext
├─ state: contactsOffset, hasMoreContacts, isLoadingMoreContacts, periodFilter
├─ loadContacts({ reset })  → range(offset, offset+49) + gte(last_message_at, periodCutoff)
├─ loadMoreContacts()        → loadContacts({ reset: false })
└─ effect: ao mudar queue/period → loadContacts({ reset: true })

ChatList
├─ remove state local de periodFilter (vem do contexto)
├─ <div ref=listRef overflow-y-auto>
│    {visibleContacts.map(...)}
│    {isLoadingMoreContacts && <Spinner/>}
│    <div ref=bottomSentinelRef/>
│  </div>
└─ IntersectionObserver(bottomSentinelRef) → loadMoreContacts()
```

## Arquivos a editar

- `src/contexts/WhatsAppDataContext.tsx` — paginação, periodFilter no contexto, query com range + filtro de data.
- `src/components/chat/ChatList.tsx` — infinite scroll, consumir periodFilter do contexto, remover state local.
- `src/types/chat.ts` (se necessário) — expor novos campos no `ChatContextValue`.
