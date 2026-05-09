# Sincronizar chat do /crm-builder com /chat

## Problema atual

`BoardChatSidePanel` (ícone de chat no card do CRM Builder) abre um `WhatsAppDataProvider` isolado e chama apenas `selectContact(contactId)`. Diferente do `/chat`, **a fila do deal não é selecionada**, então o provider não carrega `chat_conversations` correspondentes. Resultado:

- `selectedConversation` fica `null` no `ChatInput` → o cálculo `canSend = noteMode || (isAssignedToMe && isActiveStatus)` sempre falha.
- Não aparece o banner "assumir conversa", nem o status (open/pending/resolved/closed) é respeitado.
- O `ChatHeader` perde ações dependentes da conversa (transferir, encerrar, prioridade).
- Comportamento divergente do `/chat`, podendo permitir/bloquear ações de forma inconsistente.

A fonte da verdade já existe (`WhatsAppDataContext` + `ChatInput` + `ChatHeader`). O painel lateral só precisa "preparar" o provider exatamente como o `/chat` faz.

## Solução

Ajustar **apenas `src/pages/crm-builder/components/deals/BoardChatSidePanel.tsx`** para:

1. Após resolver o deal via `useDealConversation` (já retorna `queueId`, `queueName`, `contactId`), chamar `setSelectedQueue({ id: queueId, name: queueName, ... })` antes/junto de `selectContact(contactId)`.
2. Aguardar `loadConversations` concluir (estado `hasLoadedConversationsOnce` ou polling do `selectedConversation`) antes de renderizar `ChatHeader`/`ChatMessages`/`ChatInput`. Skeleton enquanto carrega.
3. Se a fila do deal **não** estiver na allowlist do usuário (`useUserQueueAccess`), mostrar bloco informativo "Você não tem acesso a esta fila" com botão "Abrir no /chat" — mesma regra de visibilidade do `/chat`.
4. Se `useDealConversation` retornar `null` (vínculo inválido / fila soft-deleted), manter o estado vazio atual.
5. Manter o `ScopedChat` dentro do `WhatsAppDataProvider` isolado (não vazar estado para o `/chat`).

### Diagrama de fluxo

```text
Card click → BoardChatSidePanel
   │
   ├─ useDealConversation(deal) → { conversationId, contactId, queueId, queueName, status }
   │
   └─ <WhatsAppDataProvider>
         └─ ScopedChat
              1. setSelectedQueue({ id: queueId, name: queueName })
              2. selectContact(contactId)
              3. aguarda conversations carregar
              4. renderiza ChatHeader + ChatMessages + ChatInput
                 (mesmo canSend / claim / status do /chat)
```

## Detalhes técnicos

- Reutilizar `useUserQueueAccess` para decidir o bloqueio antes de chamar `setSelectedQueue`.
- O tipo `SelectedQueue` está exportado em `WhatsAppDataContext`; passar pelo menos `{ id, name }`.
- Não alterar `ChatInput`, `ChatHeader`, `ChatMessages` nem o `WhatsAppDataContext` — qualquer regra futura de "quem pode conversar" continuará valendo automaticamente nos dois lugares.
- Não tocar em `useDealConversation` (já entrega tudo necessário).
- Sem mudanças de banco de dados, sem novas dependências.

## Arquivos afetados

- `src/pages/crm-builder/components/deals/BoardChatSidePanel.tsx` (único arquivo editado)

## Fora do escopo

- Mudanças de UI no `/chat`.
- Mudanças no `ChatContainer` ou no contexto principal.
- Ajustes em outros pontos do CRM Builder.
