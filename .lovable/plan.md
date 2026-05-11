## Resumo do diagnóstico

O painel `BoardChatSidePanel` monta um `WhatsAppDataProvider` **isolado por card**. Dentro dele, o `ScopedChat` só renderiza `ChatHeader/ChatMessages/ChatInput` quando:

```ts
selectedContact && selectedContactId === contactId && queueReady
```

Em alguns cards essa condição nunca é atendida → spinner eterno. Não é "lentidão de mensagens" (esse caminho já foi corrigido); é o **contato selecionado nunca se materializar** no array `contacts` do provider.

## Causas raiz identificadas (ordenadas por probabilidade)

### 1. Corrida `selectContact` x bootstrap `loadContacts` (causa principal)
Sequência observada em `WhatsAppDataContext.tsx`:

1. `ScopedChat` chama `selectContact(contactId)` assim que monta.
2. `selectContact` (linha 1824) faz `setSelectedContactId` e, se o contato não existe no cache `contacts`, busca em `chat_contacts` por id e injeta via `setContacts(prev => repositionContact(prev, contact))`.
3. Em paralelo, o bootstrap do provider (linha ~2346: `loadContacts({ reset: true })`) roda assim que `selectedQueue` é hidratada pelo `setSelectedQueue(queue)` do `ScopedChat`.
4. `loadContacts({ reset: true })` faz `setContacts([])` e repopula com a página filtrada pela fila atual + filtros de período/grupo.
5. Se o contato do deal **não cai no filtro vigente** (ex.: período padrão "últimos 7 dias" e a conversa é mais antiga; ou o contato pertence a outra `channel_source`/grupo), o passo 4 **apaga** a injeção do passo 2.
6. `selectedContact = contacts.find(c => c.id === selectedContactId)` retorna `null` → o `if (!selectedContact)` mantém o skeleton para sempre.

Cards que "carregam" são exatamente aqueles cujo contato **também** aparece na primeira página do `loadContacts` filtrado.

### 2. `selectContact` falha silenciosamente quando o contato não retorna
Em `selectContact` (linha 1858), se `chat_contacts` retorna `null` (RLS, `client_id` divergente, contato apagado), seta `contactHydrationError` mas o `ScopedChat` **não consome esse estado** — só mostra skeleton. Cards apontando para conversas órfãs ficam carregando sem erro visível.

### 3. `selectedQueue` substituído por outro card aberto previamente
O `useEffect` de hidratação da fila no `ScopedChat`:
```ts
if (queue && selectedQueue?.id !== queue.id) setSelectedQueue(queue);
```
roda dentro de um provider **por painel**, então normalmente está ok — mas se o React StrictMode (dev) montar/desmontar duas vezes, ou o usuário abrir o painel, fechar e reabrir rápido, há flush de fila → reset de bootstrap → corrida do item 1 amplificada.

### 4. Provider isolado dispara realtime/queries pesadas a cada abertura
Cada `open` do Sheet = novo provider = novo bootstrap completo (queues, conversations paginadas, realtime channels). Em cards "pesados" (ex.: muitos canais/queries em curso), o `loadContacts` demora mais e a corrida do item 1 fica determinística.

## Correções propostas

### Fix A — Não deixar o bootstrap apagar o contato selecionado
Em `loadContacts` (linha 474, `WhatsAppDataContext.tsx`), ao fazer `reset`, **preservar** a entrada cujo `id === selectedContactIdRef.current` se ela já estiver no array, mesclando-a no resultado paginado.

```ts
setContacts(prev => {
  const keep = prev.find(c => c.id === selectedContactIdRef.current);
  const merged = keep && !page.some(c => c.id === keep.id) ? [keep, ...page] : page;
  return merged;
});
```

Adicionar `selectedContactIdRef` (ref espelhando `selectedContactId`) para evitar refazer o callback.

### Fix B — Hidratar contato do painel diretamente, sem depender do cache
No `ScopedChat` (`BoardChatSidePanel.tsx`), buscar o `chat_contacts` via React Query (paralelo ao `useDealConversation`) e passar o objeto pronto para `ChatHeader`/`ChatMessages` — eliminando a dependência de `selectedContact` para sair do skeleton. Mantemos `selectContact` apenas para efeitos colaterais (markAsRead, abrir conversa).

Critério de render passa a ser: `dealContact && queueReady && selectedContactId === contactId`.

### Fix C — Exibir o erro de hidratação no painel
Consumir `contactHydrationError` (e `retryHydrateSelectedContact`) do contexto dentro do `ScopedChat`. Se falhar a hidratação, mostrar mensagem + botão "Tentar novamente" em vez de skeleton infinito (espelhando o padrão já existente em `ChatMessages`).

### Fix D — Defensive: timeout de skeleton
Se após N=4s o skeleton continuar sem `selectedContact`, mostrar fallback com botão "Abrir no Chat" + razão diagnóstica (queueReady? contato hidratado? erro?). Diagnóstico claro para o usuário em vez de loop visual.

## Detalhes técnicos

- Arquivos a alterar:
  - `src/contexts/WhatsAppDataContext.tsx` — Fix A (preservar `selectedContact` em `loadContacts`)
  - `src/pages/crm-builder/components/deals/BoardChatSidePanel.tsx` — Fix B/C/D (hidratar contato local, consumir erro, timeout)
- Sem mudanças de schema/banco. Sem mudanças nas Edge Functions.
- Sem alterar `loadMessages`, que já tem retry desde a última iteração.

## Como validar

1. Abrir 5 cards consecutivos com idades de conversa variadas (recente, antiga >7 dias, de fila diferente da última usada).
2. Conferir no DevTools (Network/Console) que:
   - `chat_contacts?id=eq.X` retorna o contato em todos os casos.
   - O painel sai do skeleton em ≤2s mesmo para conversa antiga.
3. Forçar erro de RLS removendo acesso a uma fila e abrir card dela → deve mostrar mensagem de erro + botão (não skeleton).
