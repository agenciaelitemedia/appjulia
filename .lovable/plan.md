# Permissões de quadro: bypass de admin/owner e modo Perfil combinado

## Comportamento atual (verificado no código)

- `useEffectiveBoardPermission` já concede acesso total a admin e owner (`isFullAccessUser` → `admin | user | colaborador`). ✅ isso já atende "admin e owner veem e gerenciam tudo".
- No modo **Perfil**, tanto `useEffectiveBoardPermission` quanto o filtro de listagem em `useCRMBoards` consideram **apenas** regras `subject_type='role'`. Regras individuais (`subject_type='user'`) adicionadas ao quadro são ignoradas nesse modo — este é o ponto a corrigir.
- No modo **Usuário** o inverso já é intencional: só regras por usuário contam.

## Mudança

No modo **Perfil**, aceitar união: perfil do usuário **OU** o usuário estar explicitamente listado nas regras. Modo **Usuário** e **Desativada** ficam iguais.

### Arquivos

1. `src/pages/crm-builder/hooks/useCRMBoardPermissions.ts` — em `useEffectiveBoardPermission`, ajustar o `matches` do modo `role`:
   - manter: `subject_type='role' && subject_id === role`
   - adicionar: `OR subject_type='user' && subject_id === uid`
2. `src/pages/crm-builder/hooks/useCRMBoards.ts` — no filtro de listagem, aplicar a mesma união no modo `role` para que o quadro apareça também para usuários adicionados individualmente.

## Fora do escopo

- UI do `PermissionsManager` (já permite adicionar usuários individuais nos dois modos — nada muda visualmente).
- Regras de admin/owner (já corretas).
- Modo Usuário e Desativada (sem alteração).
