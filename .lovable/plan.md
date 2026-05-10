## Objetivo

Carregar todas as conversas da aba "Em atendimento" automaticamente em blocos de 500 logo no início; carregar "Resolvidos" e "Encerrados" sob demanda (na primeira ativação) também em blocos de 500, limitados a 10 blocos (5.000 registros). Evitar refetch ao sair/voltar da página, manter o realtime e ser leve para 2.000+ clientes.

## Estado atual (resumo do que já funciona)

- `WhatsAppDataContext` carrega conversas em páginas de `100`, com `loadConversations({ append })`, `hasMoreConversations`, `loadMoreConversations`.
- A lista exibida no `ChatList` usa um IntersectionObserver para chamar `loadMoreConversations` enquanto o usuário rola.
- `convQueryGroup` (`active` | `resolved` | `closed` | `resolved_closed`) determina o filtro `status` na query. **Ao trocar de aba, o estado `conversations` é substituído** (re-fetch do offset 0). Isso quebra o "carregar uma vez por aba" e desperdiça banco.
- Realtime já está em pé para INSERT/UPDATE de `chat_conversations` e atualiza o array local.
- Bootstrap dispara `loadConversations()` ao montar e ao trocar `clientId/queue/period/sortOrder`. Visibilitychange (>30s) dispara refresh silencioso.

## Estratégia proposta

### 1. Tamanho de página = 500, estado por grupo

- Trocar `CONVERSATIONS_PAGE_SIZE` para `500`.
- Em vez de um único `conversations: ChatConversation[]`, manter um **mapa por grupo**:
  ```
  conversationsByGroup: {
    active:   ChatConversation[];   // pending + open
    resolved: ChatConversation[];
    closed:   ChatConversation[];
  }
  ```
  com metadados paralelos por grupo: `{ loaded, hasMore, isAutoLoading, autoLoadDone, pagesFetched, error }`.
- O `conversations` exposto no contexto vira um `useMemo` que une os grupos atualmente "carregados" — preservando consumidores existentes sem refator amplo.

### 2. Auto-paginação eager para `active` e lazy para os outros

- Ao montar (clientId + queues prontos), iniciar **auto-loop para `active`** que chama páginas de 500 sequencialmente até `hasMore=false` ou erro. Sem cap.
- Quando o usuário ativar pela primeira vez `resolved`, `closed` ou `resolved_closed`, disparar auto-loop equivalente, **com cap de 10 páginas (5.000 registros)**. Mostrar contador "X carregados (limite atingido)" quando bater o teto.
- O loop:
  - É serial dentro do grupo (1 request em voo por grupo).
  - Tem `await sleep(120ms)` entre páginas para dar respiro ao Postgres em clientes com muito histórico.
  - É cancelado se mudar `clientId/queueScope/period/sortOrder` (chave de bootstrap).
  - É idempotente: usa `autoLoadDone[group]` + `inFlightRef` para nunca duplicar.

### 3. Cache estável — não refetch ao trocar de aba nem ao "sair e voltar"

- `WhatsAppDataProvider` já vive na raiz da árvore, então o estado React sobrevive à navegação entre rotas. **Remover** o re-fetch que dispara em `convQueryGroup` change (linhas 2217–2231) — a aba apenas seleciona qual grupo já está em memória.
- Remover o refresh em `visibilitychange` para `loadConversations` (manter para `loadContacts` se desejado, mas o realtime é suficiente). Em vez disso, ao reconectar o canal realtime após queda, fazer **delta-sync por grupo**: buscar `updated_at > maxUpdatedAtDoGrupo` em vez de recarregar tudo.
- Chave de invalidação real só muda quando `clientId | queueScope | periodFilter | sortOrder` mudam — aí sim limpamos `conversationsByGroup` e reiniciamos os loops (eager para `active`, lazy para os outros).

### 4. Realtime continua intacto

- O handler de INSERT/UPDATE classifica a conversa pelo `status` final e a insere no grupo correto (`active` para `pending|open`, `resolved`, `closed`). Se o status mudar, ela é movida entre grupos.
- Para conversas que chegarem por realtime antes do auto-loop terminar aquele grupo, deduplicamos por `id`.

### 5. UI / `ChatList`

- Os contadores por aba (já corretos hoje na busca) passam a usar `conversationsByGroup[group].length` quando `autoLoadDone=true`, ou `length + " (carregando…)"` enquanto o loop roda.
- IntersectionObserver para `loadMoreConversations` torna-se redundante para a aba ativa (auto-loop já carrega tudo); mantemos apenas como fallback caso o auto-loop tenha sido pausado por erro.
- Indicador discreto no rodapé da lista: "Carregando bloco 3/∞" para `active`, "Carregando bloco 3/10" para resolved/closed.

### 6. Performance e proteção do banco (importante p/ 2k+ clientes)

- Página única de 500 + sleep entre páginas + concorrência máxima 1 por grupo → no pior caso 3 grupos, mas resolved/closed só rodam após interação do usuário, então o pico no boot é **1 query/cliente em voo**.
- Garantir que a query `chat_conversations` use o índice `(client_id, queue_id, status, updated_at desc)`. Vou verificar a presença e propor um migration de índice se faltar.
- `select` continua usando `CONV_COLUMNS` (já enxuto). Sem `count: 'exact'` — usamos `length === PAGE_SIZE` para inferir `hasMore`, como hoje.
- `staleTime` conceitual = sessão inteira; nada de polling.

## Arquivos a editar

1. `src/contexts/WhatsAppDataContext.tsx`
   - `CONVERSATIONS_PAGE_SIZE = 500`.
   - Substituir `conversations` state por `conversationsByGroup` + metadados.
   - Reescrever `loadConversations` como `loadConversationsPage(group, { offset })` puro.
   - Adicionar `runAutoLoad(group, { maxPages })` com cancelamento via `AbortController`/ref de epoch.
   - Bootstrap: dispara `runAutoLoad('active', { maxPages: Infinity })`.
   - Effect que observa `convQueryGroup`: se aba virou `resolved`/`closed`/`resolved_closed` e `autoLoadDone[g]` é falso, dispara `runAutoLoad(g, { maxPages: 10 })`. **Não** re-fetcha se já feito.
   - Realtime handler: roteia por `status` para o grupo correto; remove do grupo antigo se status mudou.
   - `conversations` derivado por `useMemo`.
   - Remover refresh de `loadConversations` no `visibilitychange`; manter delta-sync leve por grupo.

2. `src/components/chat/ChatList.tsx`
   - Indicador de progresso por aba (bloco X/Y).
   - Sentinel mantido como fallback.
   - Contadores por aba lidos do novo metadata.

3. (Opcional, se índice não existir) novo migration:
   - `create index if not exists idx_chat_conversations_client_queue_status_updated on public.chat_conversations (client_id, queue_id, status, updated_at desc);`

## Detalhes técnicos

- **Cancelamento**: `bootstrapKeyRef` + `epochRef` por grupo. Cada iteração do loop confere `if (epoch !== currentEpoch) return;` antes do `setState`.
- **Deduplicação**: `Set<id>` por grupo, calculada na hora do merge.
- **Erro/backoff**: erro em uma página pausa o loop daquele grupo, marca `error`, mantém o que já carregou e expõe `retryAutoLoad(group)` no contexto. UI mostra botão "Tentar novamente".
- **Limite de 10 páginas**: ao bater 10, marca `autoLoadDone=true` e `cappedAt=10`. Botão manual "Carregar mais 500" continua disponível para resolved/closed acima do cap.
- **Compat**: `loadMoreConversations` e `hasMoreConversations` continuam exportados; passam a referir o **grupo da aba ativa**.

## Validação

- Verificar no DevTools que: ao mudar de aba, **nenhuma** request adicional é feita se o grupo já carregou.
- Verificar que o canal realtime continua atualizando contadores sem refetch.
- Testar em cliente com 5k+ conversas: auto-loop completa o eager `active` sem travar a UI; abas resolved/closed param em 10 blocos.

## Fora de escopo

- Persistência em IndexedDB entre reloads do navegador (poderia ser próxima iteração).
- Mudança de UI das abas/cores (já feito anteriormente).
