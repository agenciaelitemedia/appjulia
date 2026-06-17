## Problema

Após a distribuição automática, `chat_conversations.assigned_to` passou a guardar **`user_id`** (string numérica) em vez do nome do atendente. Os componentes da UI ainda renderizam o valor cru, então aparece algo como `"4821"` no lugar de `"João Silva"`.

Pontos onde o valor cru vaza hoje:

- `src/components/chat/ChatContactItem.tsx:381` — pílula "atribuído".
- `src/components/chat/ChatHeader.tsx:545-548, 594, 787` — header e modal de transferência.
- `src/components/chat/ContactDetailPanel.tsx:452-453` — painel de detalhes.

A lista do CRM legado e os filtros em `ChatList.tsx` (linhas 588-595, 681-683, etc.) já comparam tanto contra `String(user?.id)` quanto contra `user?.name`, então só precisam ler o valor cru — não a versão "bonita".

## Solução

Centralizar a tradução `assigned_to → nome` num único hook reaproveitável, sem mexer na engine de distribuição nem na coluna do banco.

### 1. Novo hook `useAssigneeNameResolver`

Arquivo novo: `src/hooks/useAssigneeNameResolver.ts`.

- Usa `useTeamByClient()` (já existente, retorna `{ id, name, ... }[]` do mesmo `client_id`).
- Constrói um `Map<string, string>` de `String(member.id) → member.name`.
- Exporta `resolveAssigneeName(value: string | null | undefined): string | null`:
  - `null`/vazio → `null`.
  - Se for puramente numérico e existir no map → retorna o nome do membro.
  - Caso contrário (string já é nome — legado / atribuição manual antiga) → devolve o valor original.
- Retorna `{ resolve, isLoading }` para os componentes consumirem.

Pequeno utilitário puro `resolveAssigneeName(value, teamIndex)` exportado também, para reuso em loops (ex.: ChatList já monta `convMetaByContact`).

### 2. Aplicar resolver nos pontos de exibição

- **`ChatList.tsx`**: ao montar `convMetaByContact` (linha 327) e ao passar `assignedAgentName` para `ChatContactItem` (linha 1653), resolver o `assignedTo` antes de exibir. **Não alterar** os blocos de filtro (`ownerFilter`) — eles continuam comparando contra o valor cru (`String(user?.id)` ou `user?.name`).
- **`ChatContactItem.tsx`**: nenhum cálculo extra; recebe o nome já resolvido via prop como hoje.
- **`ChatHeader.tsx`**: usar `resolve(selectedConversation.assigned_to)` nas linhas 545-548, 594 e no `currentAssignee` enviado ao `TransferDialog` (787). Para a comparação `isAssignedToMe` (395) manter a lógica atual mas estender para também aceitar `assigned_to === String(currentUser.id)`.
- **`ContactDetailPanel.tsx`**: aplicar resolver na linha 453.

### 3. Sem mudanças em

- Banco de dados / migrations.
- Engine `chat-route-conversation` (continua escrevendo `user_id`, que é o padrão novo).
- Filtros e RLS.
- Webhook UaZapi.

## Detalhes técnicos

- `useTeamByClient` já cacheia por 5 min via React Query, então o overhead extra é desprezível mesmo em listas grandes.
- O resolver é tolerante: enquanto o time ainda está carregando, devolve o valor original — evita "flash" de "Não Atribuído".
- Mantém retrocompatibilidade com conversas antigas onde `assigned_to` é o nome em texto.

## Arquivos tocados

```
src/hooks/useAssigneeNameResolver.ts          (novo)
src/components/chat/ChatList.tsx              (resolve antes do display)
src/components/chat/ChatHeader.tsx            (resolve em 3 lugares + isAssignedToMe)
src/components/chat/ContactDetailPanel.tsx    (resolve em 1 lugar)
```

## Fora do escopo

- Backfill de conversas antigas com nome no `assigned_to`.
- Mostrar avatar do atendente atribuído (próxima iteração se quiser).