## Diagnóstico

Confirmei no banco: para o contato de teste existem 5 resumos `auto_close` gerados hoje, mas **cada um está atrelado a um `conversation_id` diferente** (uma nova conversa é criada a cada reabertura). O hook `useConversationSummaries` filtra apenas por `conversation_id` da conversa atual, então ao reabrir a conversa a aba "Resumo" fica vazia mesmo com resumos persistidos.

A persistência no edge function `chat-ai-assist` está OK — o problema é 100% de leitura/UI.

## Correções

### 1. Buscar resumos por contato (não só pela conversa atual)
Arquivo: `src/hooks/useConversationSummaries.ts`

- Adicionar parâmetro `contactId` ao hook.
- Trocar `SELECT ... WHERE conversation_id = X` por `SELECT ... WHERE contact_id = Y ORDER BY created_at DESC` (todos os resumos históricos do contato aparecem, independente da conversa em que foram gerados).
- Manter `generateSummary`, `checkAutoSummary` e `getAfterTsForNext` escopados à `conversationId` atual (não muda a geração).
- Realtime channel: filtrar por `contact_id=eq.<id>` em vez de `conversation_id`.
- Ajustar `queryKey` para `['conv-summaries', contactId]`.

### 2. Passar contactId no consumidor
Arquivo: `src/components/chat/ConversationSummaries.tsx`

- Repassar `contactId` para o hook.
- Card colapsado por padrão:
  - Header sempre visível (data, contagem, badge auto/manual).
  - Preview: primeiras ~2 linhas / ~180 chars do `summary` com "…" quando truncado.
  - Botão/chevron "Ver mais" ↔ "Ver menos" alterna estado local por card.
  - Ao expandir: mostra período completo, sentimento, resumo integral e atendimento (o layout atual).
- Sem mudanças no comportamento de "Gerar Resumo" / "Novo Resumo".

### 3. Não quebrar callers
- `ContactDetailPanel.tsx` já passa `contactId={contact.id}` — nenhum ajuste necessário além da assinatura interna.
- `useChurnSignals` faz query direta, não usa o hook — intocado.
- O edge function e a tabela permanecem inalterados; nenhuma migração necessária.

## Resultado esperado

- Reabrir a conversa do 34 98886-0163 mostra os 5 resumos históricos na aba **Resumo** do painel de detalhes.
- Cada resumo aparece colapsado com prévia curta; clicar expande o conteúdo completo.
- Resumos gerados por `auto_resolve`/`auto_close` continuam persistindo (já funcionavam) e agora ficam visíveis mesmo após reabertura.
