## Objetivo

Na caixa de transferência do chat (TransferDialog), exibir ao lado do nome de cada usuário a quantidade de conversas atualmente atribuídas a ele, no formato `(x)`.

## Mudanças

### 1. Novo hook `src/hooks/useChatAssignedCountsByMember.ts`
- Consulta `chat_conversations` filtrando por `client_id` do usuário logado e `status in ('open','pending')`.
- Agrupa por `assigned_to` (que hoje armazena o **nome** do membro) e retorna `Record<string, number>` (nome → count).
- `staleTime: 30s`, `refetchInterval: 60s`.
- Invalidação simples por canal realtime em `chat_conversations` (mesmo padrão de `useTeamDashboardMetrics`).
- Exporta também um helper `getCountFor(name)` que normaliza (trim) o nome.

### 2. `src/components/TeamMemberSelect.tsx`
- Adicionar prop opcional `memberCounts?: Record<string, number>` e `countLabel?: (n: number) => string` (default `(n) => `(${n})``).
- Quando `memberCounts` estiver presente, renderizar o número entre parênteses ao lado do `m.name` na lista (e também no atalho "Atribuir a mim", usando o nome do usuário logado).
- Sem mudanças em layout/estilo — apenas um `<span className="text-xs text-muted-foreground">(N)</span>` após o nome.
- Não exibir nada se a contagem for `undefined` ou `0` (mostrar `(0)` quando 0 — confirmar abaixo? Por padrão mostrar `(N)` sempre, inclusive 0, para dar transparência).

### 3. `src/components/chat/TransferDialog.tsx`
- Consumir o novo hook e passar `memberCounts` ao `TeamMemberSelect`.
- Nenhuma outra alteração.

## Fora de escopo
- Demais consumidores de `TeamMemberSelect` (CRM, tasks, etc.) continuam sem contagem — prop é opcional.
- Sem mudanças de schema, RLS ou edge functions.
