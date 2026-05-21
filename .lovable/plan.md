
## Objetivo

Hoje um mesmo contato (ex.: `5534988860163`) aparece simultaneamente em **Em aberto** e em **Resolvidos / Fechados** porque ele possui vários tickets ativos em filas diferentes. Cada aba filtra contatos olhando se *qualquer* conversa do contato bate com o status — então um contato com `pending` na fila MRA e `resolved` na fila MKT Natal aparece nas duas.

Queremos que cada contato apareça em **uma única aba**, decidida pelo estado da conversa mais recente (`updated_at` desc; em empate, `opened_at` desc) considerando a tupla `(contact + client + queue + channel)`.

Importante: a estrutura de tickets por fila no banco **não muda** — todos os tickets continuam existindo. A mudança é apenas na visualização da lista do chat.

## Regra de dedupe

Para cada `contact_id` do cliente atual:

1. Buscar **todas** as conversas do contato (todos os status, todas as filas/canais).
2. Escolher a "conversa líder" = a com maior `updated_at` (desempate: `opened_at` desc, depois `created_at` desc).
3. Calcular o "status efetivo" da líder com a mesma regra já existente:
   - `pending` + `assigned_to` preenchido → tratado como `open`.
   - Demais valores mantidos: `pending`, `open`, `resolved`, `closed`.
4. Mapear status efetivo → grupo de aba:
   - `pending`, `open` → aba **Em aberto** (`active`)
   - `resolved` → aba **Resolvidos**
   - `closed` → aba **Fechados**
   - Aba combinada **Resolvidos/Fechados** recebe contatos cujo líder é `resolved` ou `closed`.
5. O contato só entra na aba se o grupo da aba == grupo do líder.
6. A `selectedConversation` (conversa exibida ao clicar no contato) passa a ser **a conversa líder**, e não mais "primeira pending/open encontrada". Assim o usuário vê o ticket mais atual ao abrir o chat — independente da fila.

## Por que isso exige um mapa "todos os status"

O estado `conversations` em `WhatsAppDataContext.tsx` é carregado por **grupo** (active, resolved, closed) de forma preguiçosa. Se o usuário está na aba "Em aberto", o grupo `closed` pode não estar em memória — então não dá para saber se a conversa mais recente do contato é, na verdade, `closed`. Precisamos de uma fonte enxuta com **uma linha por contato**, contendo só o necessário para decidir o grupo.

## Implementação

### 1. Hook novo: `useContactLatestConversation`
Local: `src/hooks/useContactLatestConversation.ts` (novo).

- Faz uma query enxuta a `chat_conversations` filtrada por `client_id` (e respeitando filas não-soft-deletadas, espelhando o filtro que já existe no contexto).
- Colunas: `contact_id, status, assigned_to, queue_id, channel, updated_at, opened_at, snoozed_until, id, protocol`.
- Agrupa por `contact_id` no frontend e retorna `Map<contact_id, LeaderConv>` onde `LeaderConv` é a conversa de maior `updated_at`.
- Assina `postgres_changes` em `chat_conversations` (filtrado por `client_id`) para manter o mapa em tempo real (insert/update → recomputa líder daquele contato; delete → recomputa).
- Expõe `{ leaderByContact, isLoading }`.

Esse hook substitui — para fins de dedupe da lista — a necessidade de ter todos os grupos carregados em `conversations`.

### 2. Integrar no `WhatsAppDataContext.tsx`

- Chamar `useContactLatestConversation(clientId, allowedQueueIds)` dentro do provider.
- Expor `leaderByContact` no value do contexto (novo campo opcional para futuros usos).
- Alterar `filteredContacts` (linhas ~2047–2098):
  - Substituir o filtro atual (`contactIdsWithStatus.includes(c.id)`) por:
    ```ts
    const leader = leaderByContact.get(c.id);
    if (!leader) return false; // contato sem ticket fica fora das abas de status
    const group = leaderGroup(leader); // 'active' | 'resolved' | 'closed'
    if (filter === 'all')              return true;
    if (filter === 'resolved_closed')  return group === 'resolved' || group === 'closed';
    return group === filter || (filter === 'open' && group === 'active') || (filter === 'pending' && group === 'active');
    ```
  - Continuar respeitando snooze pelo líder (`leader.snoozed_until`).
- Alterar `selectedConversation` (linhas ~2040–2045): em vez de "primeiro pending/open", usar a conversa líder do `selectedContactId` (buscando primeiro em `conversations` carregadas; se não estiver carregada — porque o grupo do líder ainda não foi carregado — usar `leaderByContact` para obter o `id` e carregar sob demanda via `loadConversationsPage`/select pontual).

### 3. Contadores (`totalUnreadCount`, `individualUnreadCount`, `groupUnreadCount`)
Permanecem somando `contacts.unread_count` (não mudam — unread é por contato no schema atual).

Os contadores por aba que hoje vivem em `effectiveStatusCounts` (linhas ~823) devem passar a contar **contatos únicos** por grupo usando `leaderByContact`, para baterem com a nova listagem deduplicada.

### 4. UI
Sem mudança visual obrigatória. Opcional (fora deste escopo, perguntar depois): mostrar um pequeno badge "+N filas" no item do contato quando ele tiver mais de um ticket ativo, para o atendente saber que existem outros tickets do mesmo lead em outras filas.

### 5. Memória do projeto
Atualizar `mem://features/chat/conversation-reopen-rules.md` com nota: "Na UI da lista do chat, contatos são deduplicados pela conversa de maior `updated_at`; o ticket por fila continua existindo no banco". Adicionar entrada nova `mem://ui/patterns/chat-contact-deduplication`.

## Arquivos tocados

```text
src/hooks/useContactLatestConversation.ts        (novo)
src/contexts/WhatsAppDataContext.tsx             (filteredContacts, selectedConversation, counts)
mem://ui/patterns/chat-contact-deduplication     (novo)
mem://features/chat/conversation-reopen-rules    (nota adicionada)
```

Sem migrations. Sem mudanças em edge functions. Sem alteração no fluxo de criação/reabertura de tickets.

## Validação

1. Caso real `5534988860163`: ao aplicar, deve aparecer **apenas** na aba "Em aberto" (líder = `pending` MRA de 21/05 23:00), sumindo da aba "Resolvidos / Fechados".
2. Resolver o ticket líder dele → contato migra para "Resolvidos" em tempo real (via subscription), e os tickets pending mais antigos em outras filas só voltam a "promover" o contato se receberem nova atividade que avance o `updated_at`.
3. Contato com apenas tickets `closed` antigos aparece só em "Fechados".
4. Contagens por aba batem com a contagem visível de itens listados.
