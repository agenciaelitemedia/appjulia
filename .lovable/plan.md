## Objetivo

Remover os cards `InlineSummaryCard` da timeline do chat. Os resumos automáticos já aparecem como nota interna (`📋 Resumo automático…`) inserida pela Edge Function `chat-ai-assist`, então o card inline está duplicando a informação.

A aba **"Resumos"** no painel de detalhes do contato continua intocada.

## Mudanças

**`src/components/chat/ChatMessages.tsx`**
- Remover import de `InlineSummaryCard`.
- Remover import de `useConversationSummaries` e `ConversationSummary` (não usados mais).
- Remover a chamada `const { summaries } = useConversationSummaries(...)`.
- Remover a variante `| { kind: 'summary'; ... }` de `TimelineItem`.
- Remover o bloco que mapeia `summaries` em `sumItems` e o merge por timestamp.
- Remover `summaries` do array de dependências do `useMemo`.
- Remover o `case`/branch que renderiza `<InlineSummaryCard>` no loop de render (linha ~469).

**`src/components/chat/InlineSummaryCard.tsx`**
- Deletar o arquivo (nenhum outro consumidor — `rg` confirma uso único em `ChatMessages.tsx`).

## Não muda

- Nota interna `📋 Resumo automático (resolvida/encerrada)` continua sendo inserida pela Edge Function e aparece normalmente na timeline como mensagem interna.
- Aba "Resumos" em `ContactDetailPanel` continua listando todos os resumos históricos por `contact_id`.
- Geração automática/manual de resumo, persistência em `chat_conversation_summaries` e realtime seguem iguais.
