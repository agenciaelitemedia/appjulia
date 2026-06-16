## Objetivo
Permitir que o owner do client_id libere o módulo **Equipe** para seus membros do time, junto dos demais módulos.

## Mudança
- `src/pages/equipe/components/ModuleCheckboxList.tsx`: remover `'team'` da constante `excludedModules`, mantendo apenas `'settings'` como bloqueado para o papel TIME.

Com isso, se o owner tiver permissão de visualizar o módulo `team`, ele aparecerá automaticamente na lista de checkboxes ao criar/editar um membro do time e poderá ser delegado.

## Observações
- A delegação continua respeitando a regra existente: o módulo só aparece se o owner (parent) tiver `can_view = true` nele.
- Nenhuma alteração de schema, RLS ou backend é necessária — o controle já é feito via `AuthContext.hasPermission` e `parent_user_id`.
