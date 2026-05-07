## Diagnóstico

A lógica de SLA em `evaluateSla` (`src/hooks/useChatSlaConfigs.ts`) **já implementa** exatamente o comportamento que você descreveu:

1. Sem `first_response_at` → **FRT** (1ª Resposta).
2. Com `first_response_at` E `last_message_from_me === false` E `last_customer_message_at` presente → **NRT** (Próxima Resposta).
3. Com `first_response_at` E última mensagem do atendente → **TTR** (Resolução).

**O problema:** os campos `last_customer_message_at` e `last_message_from_me` **não existem** na tabela `chat_conversations` (confirmado: a tabela só tem `opened_at`, `first_response_at`, `closed_at`, `resolved_at`, etc.). Em `ChatList`, `ChatHeader`, `ChatContactItem` e `ContactDetailPanel`, esses dois campos sempre chegam como `null` via `(conv as any).last_customer_message_at ?? null`. 

Resultado: o ramo **NRT nunca é alcançado**. Após a primeira resposta o badge cai sempre em **TTR** (Resolução), independente de a última mensagem ser do lead.

## Solução — Derivar os dois campos a partir de `chat_messages`

Em vez de adicionar colunas e triggers (mais invasivo), criar um hook que enriquece as conversas visíveis com os metadados da última mensagem real, em uma única query batch. Isso mantém a verdade no `chat_messages` e funciona com os dados já existentes.

### 1. Novo hook `useConversationsLastMessageMeta`
`src/hooks/useConversationsLastMessageMeta.ts`

Recebe um array de `conversationId[]`. Faz uma única query:

```text
chat_messages
  .select('conversation_id, timestamp, from_me')
  .in('conversation_id', ids)
  .eq('internal_note', false)   // notas internas não contam
  .order('timestamp', { ascending: false })
```

E em JS reduz para um `Map<convId, { lastTs, lastFromMe, lastCustomerTs }>`:
- `lastTs` / `lastFromMe`: primeira ocorrência por conversa (a mais recente).
- `lastCustomerTs`: primeira ocorrência onde `from_me === false`.

Com `staleTime` curto (~15 s) e `refetchOnWindowFocus`, query keyed por `[ids.sort().join(',')]`. Limite de 200 conversas por chamada (alinhado com a paginação atual).

### 2. Integração nos pontos de avaliação
Em cada um destes locais, antes de chamar `evaluateSla`, ler do mapa:

- `src/components/chat/ChatList.tsx` (linha ~179) — para o badge na lista.
- `src/components/chat/ChatContactItem.tsx` (linha ~118) — badge do item.
- `src/components/chat/ChatHeader.tsx` (linha ~236) — badge no header da conversa.
- `src/components/chat/ContactDetailPanel.tsx` (linha ~179) — painel lateral.

`ChatList` busca o lote (`useConversationsLastMessageMeta(visibleConvIds)`) e propaga via prop opcional `lastMessageMeta?: { last_customer_message_at, last_message_from_me }` para `ChatContactItem`. `ChatHeader` e `ContactDetailPanel` chamam o hook só para o `selectedConversation.id`.

### 3. Tipagem
Acrescentar campos opcionais em `src/types/conversation.ts` e remover os `(conv as any)` casts para deixar o contrato explícito (os campos continuam opcionais — `WhatsAppDataContext` não os preenche, são derivados separadamente).

### 4. Sem mudança de UI
O `SlaBadge` já mostra o `slaTypeLabel` correto (1ª Resposta / Próx. Resposta / Resolução) e tooltips por tipo — a correção da fonte de dados é suficiente para o badge mudar de FRT → NRT durante a conversa quando o lead voltar a falar.

## Arquivos a alterar

- **Criar** `src/hooks/useConversationsLastMessageMeta.ts`
- **Editar** `src/components/chat/ChatList.tsx` (buscar batch + passar prop)
- **Editar** `src/components/chat/ChatContactItem.tsx` (aceitar prop `lastMessageMeta`, usar no `evaluateSla`)
- **Editar** `src/components/chat/ChatHeader.tsx` (hook single-id)
- **Editar** `src/components/chat/ContactDetailPanel.tsx` (hook single-id)
- **Editar** `src/types/conversation.ts` (manter campos opcionais; documentar origem derivada)

## O que não muda

- `evaluateSla` permanece intacto.
- `chat_conversations` não ganha colunas — sem migração.
- Nenhum impacto em `chat-return-chat` (já usa CTE direta em `chat_messages`).
