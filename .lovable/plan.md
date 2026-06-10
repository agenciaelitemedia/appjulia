## Problema

Roniel (`role='time'`, vinculado a Mario via `parent_user_id`, sem `client_id` próprio) cai no branch `requester` do `useTickets`, que filtra por `requester_user_id = roniel.id` — e como nenhum ticket foi aberto por ele, a lista vem vazia. Os 9 chamados existentes têm `requester_client_id = 30` e `requester_user_id = 2` (Mario).

A regra atual em `useTicketRole()`:
- `isAdmin` → `agent`
- `user.role === 'user'` → `manager`
- demais (incluindo `time`, `advogado`, `colaborador`) → `requester`

## Plano

Tratar membros do escritório (`role` em `time | advogado | colaborador | comercial`) como **manager do escritório**: enxergam todos os chamados do `client_id` efetivo (herdado do dono via `parent_user_id`).

### 1. `src/pages/tickets/hooks/useTickets.ts`

- **`useTicketRole()`**: ampliar o branch `manager` para qualquer usuário não-admin cujo `role !== 'requester-only'`. Hoje só `requester` puro seria alguém sem vínculo — na prática, todo usuário interno do escritório deve ver os chamados do cliente. Nova regra:
  - `isAdmin` → `agent`
  - usuário autenticado com `client_id` resolvível → `manager`
  - fallback → `requester` (mantém para casos sem vínculo)

- **`useTickets`**: usar `resolveEffectiveClientId(user)` (já existe em `src/lib/resolveEffectiveClientId.ts`) para obter o `client_id` do dono quando o usuário-membro não tem `client_id` direto. Resolver de forma assíncrona dentro do `queryFn` e usar esse valor no filtro `requester_client_id`. Adicionar o `effectiveClientId` à `queryKey` para invalidação correta.

- **`useTicketMutations.create`**: ao criar ticket, gravar `requester_client_id` usando o `effectiveClientId` resolvido (não apenas `user.client_id`), garantindo que tickets abertos por membros fiquem vinculados ao escritório.

### 2. Header do `TicketsPage`

O texto do subtítulo usa `role === 'requester'` / `manager`. Manter o texto de manager para todos os membros do escritório (já fica adequado: "Chamados do seu escritório").

### Fora do escopo

- RLS de `support_tickets` já é permissiva (`ALL true`), então não há mudança no banco.
- Schema dos tickets não muda.
- Comportamento de admin (suporte Julia) permanece igual.

## Resultado esperado

Roniel passa a ser tratado como `manager` com `client_id` efetivo = 30 e visualizará os 9 chamados do escritório de Mario. Qualquer outro membro de equipe (advogado/colaborador) terá o mesmo comportamento.