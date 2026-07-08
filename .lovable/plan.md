# Vínculo CRM some ao reconectar a fila — causa e correção

## Diagnóstico (lead 5584991382710)

O contato tem **7 conversas distintas** (`chat_conversations`), todas na mesma fila. A cada desconexão/reconexão da fila (ou reabertura após `resolved`), o sistema cria uma **nova linha em `chat_conversations` com novo UUID**, mesmo sendo o mesmo contato.

Resultado: **6 cards duplicados em `crm_deals`** para o mesmo contato — um por `conversation_id`.

**Causa raiz:** `useChatDealLink.ts` procura o deal apenas por:

```ts
.contains('custom_fields', { links: { chat: { conversation_id } } })
```

Como o `conversation_id` muda a cada nova conversa, o botão CRM no `ChatHeader` não encontra o deal antigo, mostra "não vinculado" e o `CreateCrmCardSheet` cria um novo deal duplicado.

## Correção proposta — vínculo com `contact_id` + `contact_phone` (dupla âncora)

Passar a persistir `contact_id` no vínculo é a melhor solução: `contact_id` é estável (UUID do contato), enquanto `conversation_id` é volátil e `contact_phone` pode variar por normalização/formatação. Usar as três chaves em ordem de prioridade dá segurança máxima.

Novo formato de `crm_deals.custom_fields.links.chat`:

```json
{
  "chat": {
    "contact_id": "aca8f97c-3a90-46f5-bad7-c95f44915979",
    "contact_phone": "5584991382710",
    "contact_name": "...",
    "conversation_id": "<atual>"
  }
}
```

`contact_id` vira a **âncora primária** do vínculo; os outros campos ficam para retrocompatibilidade e diagnóstico.

### 1. `src/hooks/useChatDealLink.ts` — lookup em 3 estágios + auto-heal

Nova assinatura: `useChatDealLink(conversationId, clientId, contactId?, contactPhone?)`.

Ordem de busca (para no primeiro hit):
1. `contains(custom_fields, { links: { chat: { contact_id } } })` — âncora estável.
2. `contains(custom_fields, { links: { chat: { conversation_id } } })` — compat com deals antigos.
3. `contains(custom_fields, { links: { chat: { contact_phone } } })` — fallback para deals antigos sem `contact_id`.

Todas com `client_id = clientId` e `status != 'archived'`, ordenado por `created_at desc limit 1`.

**Auto-heal:** ao achar via estágio 2 ou 3, faz `UPDATE crm_deals` mergindo `contact_id` e `conversation_id` atuais no `custom_fields.links.chat` (preserva `julia` e demais campos). Próximas consultas caem no estágio 1.

### 2. `src/components/chat/CreateCrmCardSheet.tsx` — guarda contra duplicidade

Antes de criar:
- Buscar deal aberto do mesmo `client_id` por `contact_id` (com fallback para `contact_phone`).
- Se existir: mostrar aviso "Este contato já possui card no CRM" com botão **"Vincular a este card"** que faz o self-heal e fecha o sheet, em vez de criar novo.
- Só permite criar se o usuário confirmar explicitamente que quer um segundo card.

Ao criar, gravar `contact_id`, `contact_phone`, `contact_name` e `conversation_id` no `links.chat`.

### 3. Ajustes de leitura

Onde o vínculo é lido (`DealCard`, `DealDetailsSheet`, `getChatLink` em `useCardLinks.ts`, `useChatConversationPreview`), aceitar `contact_id` como campo opcional e, quando presente, preferi-lo para resolver a conversa ativa (ex.: `SELECT id FROM chat_conversations WHERE contact_id = ... ORDER BY updated_at DESC LIMIT 1`). Sem regressão para deals antigos que só têm `conversation_id`.

## Fora de escopo

- Não mexer em `chat_crm_links` (integrações legadas).
- Não alterar a lógica que cria novas conversas ao reconectar/auto-resolve.
- Não deduplicar os 6 cards já existentes deste lead — requer decisão manual.
- Sem migration de schema; tudo em `custom_fields` (já `jsonb`).

## Arquivos a editar

- `src/hooks/useChatDealLink.ts` — busca em 3 estágios + self-heal com `contact_id`.
- `src/components/chat/CreateCrmCardSheet.tsx` — detectar deal existente por `contact_id`/telefone e oferecer vincular; gravar `contact_id` ao criar.
- `src/pages/crm-builder/hooks/useCardLinks.ts` — `getChatLink`/`useChatConversationPreview` passam a considerar `contact_id`.
- Call sites de `useChatDealLink` (ChatHeader / ChatCrmButton) — passar `contactId` e `contactPhone` já disponíveis no contexto.

## Resultado esperado

Ao reconectar a fila e abrir uma nova conversa com o mesmo contato, o vínculo é encontrado pelo `contact_id` (estável) e o botão CRM permanece azul apontando ao card original. Deals antigos são "curados" automaticamente na primeira abertura pós-deploy, sem intervenção manual.
