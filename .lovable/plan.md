
## Problema
O badge "CRM" na lista de conversas hoje usa `crm_deals.contact_phone` para detectar vínculo. É **frágil**: se o telefone do contato/deal for editado, o vínculo visual quebra mesmo o deal continuando atrelado àquela conversa.

## Vínculo correto (forte e imutável)
Os deals do CRM Builder já guardam o vínculo com a conversa em:
```
crm_deals.custom_fields -> 'links' -> 'chat' -> 'conversation_id'
```
Esse é o mesmo caminho usado por:
- Triggers `sync_deal_to_conversation` / `sync_conversation_to_deal`
- Hook `useChatDealLink` (header do chat)
- `useCardLinks.getChatLink` (CRM Builder)

`conversation_id` é UUID e nunca muda → vínculo estável.

## Mudanças

### 1. Substituir hook `useCRMBuilderPhones` por `useCRMBuilderLinkedConversations`
Novo arquivo: `src/hooks/useCRMBuilderLinkedConversations.ts`

- Query em `crm_deals` filtrando por `client_id` e `status != archived`.
- Seleciona apenas `custom_fields`.
- Extrai `custom_fields.links.chat.conversation_id` de cada deal.
- Retorna um `Set<string>` de `conversation_id`s vinculados.
- Mantém `staleTime: 60_000`.

### 2. Atualizar `src/components/chat/ChatList.tsx`
- Remover import e uso de `useCRMBuilderPhones`.
- Usar `useCRMBuilderLinkedConversations()`.
- No mapeamento de cada conversa, calcular:
  ```ts
  hasCrmCard={linkedConversationIds?.has(conversation.id) ?? false}
  ```
  (em vez do match por telefone normalizado)

### 3. Ajustar visual do badge em `src/components/chat/ChatContactItem.tsx`
Conforme pedido: **somente o ícone do CRM**, sem o texto "CRM".
- Manter o fundo azul (`bg-blue-600`), `rounded-full` (mais clean só com ícone), tamanho compacto (`h-5 w-5` flex center).
- Manter ícone `Kanban` (azul/branco) e o `Tooltip` "Este contato possui card no CRM".
- Remover o texto "CRM" ao lado do ícone.

### 4. Limpeza
- Remover o arquivo `src/hooks/useCRMBuilderPhones.ts` (não será mais usado).

## Resultado
- Badge CRM aparece de forma confiável sempre que existir um deal vinculado àquela conversa, independente de mudanças no telefone do contato ou do deal.
- Visual mais enxuto: apenas o ícone Kanban em pílula azul redonda, com tooltip explicativo.
