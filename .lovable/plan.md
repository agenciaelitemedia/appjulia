## Objetivo

Em `/telefonia`, ao criar/editar um ramal, o seletor "Vincular a" deve usar o componente padrão da aplicação (`TeamMemberSelect`) carregando os membros via `useTeamByClient`, incluindo o próprio usuário logado — substituindo o `Select` simples atual.

## Mudança

Refatorar `src/pages/telefonia/components/RamalDialog.tsx`:

1. Trocar a busca atual (`externalDb.getTeamMembers`) por `useTeamByClient()`, que já resolve o `client_id` do usuário logado e retorna todos os membros (mesmo padrão usado em `TransferDialog` e `CRMLeadDetailsDialog`).
2. Substituir o componente `<Select>` atual por `<TeamMemberSelect>` com:
   - `valueKey="id"` (o backend exige `assigned_member_id` numérico)
   - `showCurrentUserShortcut={false}` (o próprio usuário já aparece naturalmente na lista da equipe; injetá-lo manualmente apenas se ele não estiver no resultado de `useTeamByClient`)
   - `allowUnassigned={false}` (ramal precisa estar vinculado a alguém)
   - placeholder "Selecione um membro"
3. Manter o filtro atual que exclui membros já atribuídos a outros ramais (`assignedMemberIds`), aplicado sobre a lista de `useTeamByClient` antes de passar para o componente.
4. Garantir que o usuário logado apareça primeiro: se ele não vier em `useTeamByClient` (caso edge), injetá-lo no topo da lista com seus dados (`id`, `name`, `email`, `photo`).
5. Manter o auto-preenchimento do campo "Nome/Apelido" com o nome do membro selecionado ao criar.
6. Manter o `email`/`memberName` enviados no `onSave` (resolvidos a partir do membro selecionado pelo `id`).

## Detalhes técnicos

- Hook a usar: `useTeamByClient()` de `src/hooks/useTeamByClient.ts` (retorna `{ id, name, email, role, client_id, photo }[]`).
- Componente: `TeamMemberSelect` de `src/components/TeamMemberSelect.tsx`, modo `valueKey="id"`.
- Estado interno `selectedMemberId` muda de `string` para `string | null` (compatível com a API do componente).
- Remover a query `team-members-for-ramal` (não é mais necessária).
- Nenhuma mudança em backend, hooks de telefonia ou tipos.

## Arquivos afetados

- `src/pages/telefonia/components/RamalDialog.tsx` (única alteração)