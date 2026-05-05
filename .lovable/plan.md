## Problema

Os badges das abas **Em Abertos** e **Em Atendimento** atualizam corretamente conforme os filtros (Responsável, Período, Etapa, SLA, Julia/Humano), porque a contagem percorre o universo completo de `conversations` (carregado server-side, sem paginação por contato).

A **lista de contatos abaixo das abas**, no entanto, é montada a partir de `filteredContacts` do `WhatsAppDataContext`, que parte de `contacts` (paginado por scroll infinito) e só aplica `activeTab`, `searchQuery` e `conversationStatusFilter`. Os demais filtros (owner, periodo, etapa, SLA, modo) são aplicados depois em `applyClientFilters`, mas apenas sobre o subconjunto **já paginado**.

Resultado: o badge mostra "12" mas a lista exibe 2 ou nenhum contato, e o usuário tem a sensação de que "os contatos não mudam quando filtros são selecionados".

## Solução

Reconstruir `visibleContacts` no `ChatList` a partir do mesmo universo usado para os contadores (`conversations`), garantindo que cada conversa pending/open que case com TODOS os filtros (incluindo a aba ativa de status) gere um item na lista, mesmo que o contato não esteja entre os já paginados em `contacts`.

### Fluxo

```text
conversations (universo completo)
   │
   ├─ aplica filtros (status da aba + tab indiv/grupos + search + owner +
   │                  período + etapa + SLA + modo + open-scope + snooze)
   │
   ├─ extrai contact_ids elegíveis (deduplicados, ordenados por updated_at desc)
   │
   ├─ resolve cada id em `contacts` (cache local)
   │     └─ se faltar, dispara fetch on-demand de `chat_contacts`
   │        (single round-trip via supabase.from('chat_contacts').in('id', missingIds))
   │
   └─ renderiza ChatContactItem na ordem do conversations sortido
```

A contagem (`pendingConvCount`/`openConvCount`) e a lista passam a derivar **da mesma fonte** com **os mesmos predicados** — apenas mudando o status efetivo. Badge e lista ficam sempre coerentes.

## Mudanças técnicas

**Arquivo principal:** `src/components/chat/ChatList.tsx`

1. Extrair os predicados de filtro de conversa em um único helper `passesAllFilters(conv, contact)` reutilizado por contagem e lista.
2. Substituir `visibleContacts = applyClientFilters(filteredContacts).filter(isVisibleByOpenScope)` por uma derivação a partir de `sortedConversations` filtrando pelo `conversationStatusFilter` ativo (pending/open) e mapeando para contatos.
3. Para contatos elegíveis ainda não presentes em `contacts`, montar uma lista `missingContactIds` e renderizar usando dados mínimos vindos da própria conversa enquanto um efeito faz o fetch (`useChatContactsByIds(missingIds)`).
4. Manter `applyClientFilters` somente para o caso `conversationStatusFilter === 'all'` (aba "Todos" do popover de filtros), onde precisamos partir de `contacts` porque o universo de status é misto.

**Novo hook:** `src/hooks/useChatContactsByIds.ts`
- `useQuery` com chave `['chat-contacts-by-ids', ids]`, busca `id, name, phone, avatar, is_group, cod_agent, channel_source, channel_type, last_message_at, last_message_text, unread_count` em lote.
- Faz merge no cache do contexto via `setQueryData` ou retorna o array para uso local; opcional: expor `addContactsToCache` no `WhatsAppDataContext` para alimentar `contacts` e evitar duplicar dados.

**Sem mudanças** em `WhatsAppDataContext.filteredContacts` (continua válido para outros consumidores).

## Critérios de aceitação

- Selecionar **Responsável = "Meus atendimentos"** atualiza imediatamente a lista das duas abas e os badges batem com a quantidade exibida.
- Selecionar **Etapa**, **Período**, **SLA Estourado/Em risco** ou **Julia/Humano** filtra a lista das duas abas em tempo real.
- Mudar entre **Em Abertos** ↔ **Em Atendimento** mantém os filtros ativos aplicados.
- O badge de cada aba é sempre igual ao número de itens que aparecem ao clicar nela (margem de erro 0).
- Contatos que correspondem aos filtros mas ainda não foram paginados aparecem na lista (com avatar/nome carregados sob demanda) sem necessidade de scroll para "puxar" mais.
