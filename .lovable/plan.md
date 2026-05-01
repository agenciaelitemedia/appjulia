## Objetivo

No `/chat`, garantir 3 coisas:

1. **Skeleton de carregamento sempre aparece** quando a lista está sendo carregada (entrada na página, troca de fila, troca de período, refresh manual).
2. **Realtime sempre ativo** — novas conversas/mensagens entram instantaneamente no topo, sem precisar reload.
3. **Mais rápido**: reduzir trabalho do servidor, do JS e do React no caminho crítico da listagem.

---

## Situação atual (resumo do código)

- `WhatsAppDataContext.loadContacts({ reset })` faz `SELECT *` em `chat_contacts` com `range(0, 49)` filtrado por `client_id`, `channel_source` (queue) e `last_message_at >= cutoff`. O loader marca `isLoading=true` durante o fetch, e o `ChatList` mostra 8 skeletons quando `isLoading === true`.
- **Problema 1 (skeleton)**: O effect que dispara `loadContacts({ reset: true })` só roda depois que `clientId` e `activeQueueIds` resolvem. Antes disso, `isLoading` ainda é `false` (estado inicial), então o usuário vê **lista vazia** ou "Nenhuma conversa" por uma fração de segundo, em vez de skeleton. Além disso, o `ChatPageContent` já chama `loadContacts()` no mount, criando uma janela ainda maior em que `isLoading` pode estar `false`.
- **Problema 2 (realtime)**: Já existem 3 channels (`chat_contacts`, `chat_messages`, `chat_conversations`). Funcionam, mas têm 2 ineficiências:
  - Cada UPDATE em `chat_contacts` re-ordena o array inteiro (`prev.map(...).sort(...)`) e cada INSERT de mensagem também re-ordena `contacts`. Em listas grandes isso causa re-render pesado.
  - Cada UPDATE em `chat_conversations` chama `loadConvCounts()` (uma query extra ao banco) — totalmente redundante porque o estado em memória já tem todos os pending/open.
- **Problema 3 (perf da lista)**:
  - `loadContacts` usa `select('*')` (puxa todas as colunas, inclusive metadados pesados).
  - O `ChatList` faz vários `useMemo` que iteram sobre `conversations` e `contacts` em cada keystroke / cada update realtime (sortedConversations, statusByContact, baseForCounts, pendingConvCount/openConvCount, slaStatusByContact).
  - A lista renderiza `visibleContacts.map(...)` sem virtualização — com 50–500 itens e cada `ChatContactItem` tendo avatar + badges + cálculos derivados, fica pesado.
  - O `ChatPageContent` chama `loadContacts()` no mount e o context tem outro `useEffect` que também chama `loadContacts({ reset: true })` quando `clientId/queue/period` mudam → **fetch duplicado** no primeiro load.

---

## Mudanças propostas

### 1) Skeleton sempre visível enquanto carrega

- No `WhatsAppDataContext`:
  - Inicializar `const [isLoading, setIsLoading] = useState(true)` (era `false`) — assim, do primeiro render até o primeiro fetch terminar, a UI já mostra skeleton.
  - Em `loadContacts`, manter `setIsLoading(true)` no início de cada `reset` (já faz). Garantir que `setIsLoading(false)` só ocorra no `finally` (já faz).
  - Quando `clientId` ainda não resolveu OU `queuesLoading === true`, o loader retorna cedo — nesse caso **não** colocar `isLoading=false`. Isso mantém o skeleton até o contexto estar pronto para a primeira query real.
- Remover o `loadContacts()` duplicado em `ChatPageContent.useEffect` (o context já dispara via effect quando `clientId/queue/period/activeQueueIds` mudam). Manter só a lógica de "pending contact id" do sessionStorage.

### 2) Realtime mais leve e sempre ligado

- Em `chat_contacts` UPDATE/INSERT: substituir `prev.map(...).sort(...)` por uma operação que (a) atualiza/insere o item e (b) **move só o item alterado para a posição correta** com uma busca binária ou um simples splice — evita resort O(n log n) a cada mensagem.
- Remover as duas chamadas a `loadConvCounts()` dentro do channel de `chat_conversations` (linhas ~1868, 1874, 1880). Os totalizers já são derivados de `conversations` em memória — esse channel já mantém `conversations` atualizado.
- Remover o estado `convCounts` e a função `loadConvCounts` (não são mais usados — `pendingConvCount`/`openConvCount` vêm do memo no `ChatList`).
- Manter o canal `chat_contacts` como está, mas trocar o `filter` para incluir também `channel_source=in.(activeQueueIds)` quando possível — diminui o ruído de updates de filas que o usuário nem vê. (Postgres realtime aceita `in`, mas o cliente Supabase não — então deixar o filtro client-side como está, só descrever que continua funcionando.)

### 3) Performance da listagem

- **Query enxuta**: trocar `select('*')` em `loadContacts` por uma lista explícita de colunas usadas na lista (`id, client_id, cod_agent, channel_source, channel_type, phone, name, avatar, is_group, is_archived, is_muted, unread_count, last_message_at, last_message_text, created_at, updated_at`). Reduz payload e parsing.
- **Índice no banco** (migration): criar índice composto em `chat_contacts (client_id, channel_source, last_message_at DESC NULLS LAST)` se ainda não existir. Acelera o `range(0, 49)` que é o caminho crítico de cada abertura do chat. Antes da migration, rodar `read_query` para confirmar que o índice ainda não existe.
- **Virtualização da lista**: trocar o `visibleContacts.map(...)` por `react-window` (`FixedSizeList`, altura ~76px por item) dentro do container `flex-1 overflow-y-auto`. Mantém o sentinel do infinite scroll após o último item visível usando o callback `onItemsRendered`. Renderizar apenas ~15 DOM nodes em vez de 50–500. (Adicionar dependência `react-window` + `@types/react-window`.)
- **Memos**: o `pendingConvCount/openConvCount` já roda em uma única passada — manter. Garantir que `convMetaByContact`, `statusByContact`, `slaStatusByContact` reusem `sortedConversations` em vez de re-iterar `conversations` (já fazem em parte). Sem mudança grande aqui, só verificação.
- **Eliminar fetch duplicado** no mount (item 1 acima).

### 4) Indicador "Atualizando…" durante refetch silencioso

- Quando `isLoading === true` e a lista já tem itens (caso de troca de fila/período), em vez de esconder a lista atual e mostrar 8 skeletons cheios, mostrar uma faixa fina no topo com `Loader2` + texto "Atualizando…" e manter os itens antigos visíveis até o novo fetch terminar. Para o **primeiro** load (lista vazia + `isLoading`), continuar com os 8 skeletons cheios — essa é a "visão de carregando" que o usuário pediu.

---

## Detalhes técnicos

```text
WhatsAppDataContext
├─ useState<boolean>(isLoading) inicial = true   (antes: false)
├─ loadContacts: select('id,name,phone,…') (sem '*')
├─ realtime chat_contacts UPDATE: sem resort completo, só reposicionar item
├─ realtime chat_conversations: remover loadConvCounts() (3 chamadas)
└─ remove loadConvCounts() / convCounts state

ChatPage.tsx
└─ remove loadContactsRef.current() do mount (context já carrega)

ChatList.tsx
├─ react-window FixedSizeList no lugar do .map
├─ banner "Atualizando…" quando isLoading && contacts.length > 0
└─ skeleton cheio só quando isLoading && contacts.length === 0

DB
└─ index: chat_contacts (client_id, channel_source, last_message_at DESC NULLS LAST)
```

## Arquivos a editar

- `src/contexts/WhatsAppDataContext.tsx` — `isLoading` inicial, query enxuta, realtime sem resort/sem loadConvCounts.
- `src/components/chat/ChatList.tsx` — virtualização com `react-window`, banner de refetch, skeleton só no primeiro load.
- `src/pages/chat/ChatPage.tsx` — remover `loadContactsRef.current()` do mount (mantém só o pending contact).
- `package.json` — adicionar `react-window` + `@types/react-window`.
- Migration SQL — `CREATE INDEX IF NOT EXISTS idx_chat_contacts_client_queue_lastmsg ON chat_contacts (client_id, channel_source, last_message_at DESC NULLS LAST);` (após confirmar via `read_query` que ainda não existe).

## O que NÃO muda

- Filtros, totalizers, lógica de SLA, modo IA, tags, snooze, multi-fila — tudo permanece igual.
- Default do filtro de período continua `last7days`.
- Page size continua 50; infinite scroll continua via `IntersectionObserver` no sentinel (agora ancorado ao final virtualizado).
