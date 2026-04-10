

## Plano: Corrigir lista de responsáveis no CRM

### Problema
A função `useTeamMembersForAgent` busca o owner do `cod_agent` e carrega os membros da equipe dele. Porém, quando o `cod_agent` não é encontrado na view, o fallback usa o ID do usuário logado. Se esse usuário for um membro de equipe (sub-usuário), ele não tem membros vinculados a si, resultando em lista vazia.

### Solução
Modificar `useTeamMembersForAgent` para:

1. **Buscar o `cod_agent` owner normalmente** via `vw_list_client-agents-users`
2. **Se não encontrar**, determinar o "usuário principal":
   - Consultar `parent_user_id` do usuário logado no banco externo
   - Se tiver `parent_user_id`, usar esse como o userId para buscar a equipe
   - Se não tiver, usar o próprio ID (é o titular)
3. **Carregar o titular + membros da equipe** usando esse userId principal
4. **Incluir o próprio titular na lista** buscando seu nome via query

### Arquivo alterado
- `src/pages/crm/hooks/useCRMData.ts` — função `useTeamMembersForAgent`

### Detalhe técnico
```text
Fluxo atual:
  cod_agent → vw_list → userId → getTeamMembers(userId)
  fallback: userId = loggedInUser.id

Fluxo novo:
  cod_agent → vw_list → userId → getTeamMembers(userId)
  fallback:
    1. SELECT parent_user_id FROM users WHERE id = loggedInUser.id
    2. principalId = parent_user_id ?? loggedInUser.id
    3. SELECT name FROM users WHERE id = principalId  (para incluir titular)
    4. getTeamMembers(principalId, true)
    5. Combinar titular + membros, deduplicar, ordenar A-Z
```

