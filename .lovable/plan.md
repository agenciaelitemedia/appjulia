## Contexto

O usuário `tellmoitas@gmail.com` tem `role = 'colaborador'`. Hoje o CRM Builder trata como "owner" apenas `role ∈ {'admin','user'}` (espelhando `get_principal_users`), então ele cai no filtro de Perfil/Usuário e some com boards restritos — comportamento errado, já que colaborador é papel privilegiado no restante do sistema.

O padrão consolidado em várias telas para "papel privilegiado do escritório" é:

```
['admin', 'colaborador', 'user']
```

Aparece em:
- `src/components/chat/ChatList.tsx` — `PRIVILEGED_ROLES`
- `src/pages/tarefas/components/AddRankedTasksDialog.tsx` — `ALLOWED_FULL_LIST_ROLES`
- `src/pages/agente/filas/components/QueueCard.tsx` — `DELETE_ALLOWED_ROLES`
- `src/pages/crm-builder/CRMBuilderPage.tsx` e `BoardPage.tsx` — `canManage`

Ou seja: existe uma regra de fato repetida por todo o projeto, mas nenhum helper único.

## Objetivo

Criar um único helper de "owner/titular do escritório" com essa regra (`admin | user | colaborador`), passar a usá-lo no CRM Builder para corrigir o caso `tellmoitas`, e adotar o mesmo helper nos demais pontos que replicam a lista inline.

## Passos

1. **Criar helper compartilhado** `src/lib/auth/isOwner.ts`:
   - Constante `OWNER_ROLES = ['admin', 'user', 'colaborador'] as const`.
   - `export function isOwnerUser(user): boolean` — `true` quando `user.role ∈ OWNER_ROLES`.
   - `export function useIsOwner(): boolean` — wrapper sobre `useAuth()`.
   - Comentário no topo: "titular do escritório = admin | user | colaborador; alinhado a `PRIVILEGED_ROLES` do chat, `ALLOWED_FULL_LIST_ROLES` de tarefas e `DELETE_ALLOWED_ROLES` de filas. `get_principal_users` (backend) cobre apenas admin+user; colaborador é privilegiado no cliente mas não é retornado como principal na gestão de equipe — comportamento intencional."

2. **CRM Builder — usar o helper e corrigir o bug**:
   - `src/pages/crm-builder/hooks/useCRMBoardPermissions.ts`
     - Remover `isClientOwnerUser` local; importar `isOwnerUser`.
     - `useIsBoardOwner` → `useIsOwner()`.
     - `isFullAccessUser` continua: `role === 'admin' || isOwnerUser(user)` (i.e. admin OU titular). Resultado: `colaborador` ganha bypass total no Builder.
   - `src/pages/crm-builder/hooks/useCRMBoards.ts`
     - Trocar `isClientOwnerUser` pelo helper novo; comportamento idêntico ao ponto acima.

3. **Consolidar demais pontos que replicam a lista** (sem mudar comportamento observável):
   - `src/components/chat/ChatList.tsx` — `PRIVILEGED_ROLES` → usar `isOwnerUser`.
   - `src/pages/tarefas/components/AddRankedTasksDialog.tsx` — `ALLOWED_FULL_LIST_ROLES` → helper.
   - `src/pages/agente/filas/components/QueueCard.tsx` — `DELETE_ALLOWED_ROLES` → helper.
   - `src/pages/crm-builder/CRMBuilderPage.tsx` e `BoardPage.tsx` — `canManage = isOwnerUser(user)`.
   - `src/pages/tickets/hooks/useTickets.ts` — `useTicketRole` usa `useIsOwner()` para `manager` (colaborador já cai em `manager` pelo fallback `if (user)`; comportamento equivalente).

4. **Não mexer** em `getPrincipalUsers` (backend) nem em `AuthContext`.

## Resultado esperado

- `tellmoitas@gmail.com` (colaborador) volta a ver todos os boards do CRM Builder com bypass completo, igual a admin/user titular.
- Membros `time`, `advogado`, `comercial` continuam sujeitos ao filtro Perfil/Usuário.
- Uma única definição frontend de "owner do escritório", reutilizada em chat, tarefas, filas, tickets e CRM Builder.

## Detalhes técnicos

- Arquivo novo: `src/lib/auth/isOwner.ts` (~20 linhas).
- Nenhuma migration; nenhuma mudança de RLS ou edge function.
- Refactor puro no restante — mesma lista de papéis, deduplicada.