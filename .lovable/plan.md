
Objetivo: fazer a lista de “Responsável” no CRM usar exatamente a mesma base da página Equipes quando o usuário logado for perfil `user`.

Problema encontrado:
- Hoje o CRM usa uma lógica própria em `useTeamForCurrentUser`.
- Para perfil `user`, a página Equipes chama `externalDb.getTeamMembers(user.id, false)`.
- No CRM, o hook atual chama `externalDb.getTeamMembers(principalId, true)`, o que diverge da regra da página Equipes e pode trazer lista errada ou não carregar como esperado.

Implementação:
1. Ajustar `src/pages/crm/hooks/useCRMData.ts`
   - Corrigir `useTeamForCurrentUser` para seguir esta regra:
     - Se `authUser.role === 'user'`:
       - usar `principalId = authUser.id`
       - buscar membros com `externalDb.getTeamMembers(principalId, false)` exatamente como na página Equipes
       - incluir também o próprio titular na lista
     - Se `authUser.role` for membro de equipe (`time`, `advogado`, `comercial`):
       - buscar o registro do usuário atual na tabela `users`
       - resolver `principalId = user_id`
       - buscar membros com `externalDb.getTeamMembers(principalId, false)`
       - incluir também o titular na lista
   - Manter deduplicação e ordenação alfabética.
   - Remover a dependência da flag `true` no CRM para que a origem dos nomes seja a mesma da Equipe.

2. Garantir que o CRM inteiro use essa lista corrigida
   - `CRMLeadDetailsDialog.tsx` já consome `useTeamForCurrentUser`; ao corrigir o hook, a lista do popover “Responsável” passa a usar a mesma equipe da página Equipes.
   - `CRMPage.tsx` também já usa esse hook no filtro por responsável; ele será corrigido junto automaticamente.

3. Refinar fallback e consistência
   - Se o titular não vier no retorno de `getTeamMembers`, adicioná-lo manualmente no topo/lote antes da ordenação.
   - Deduplicar por `id` e, se necessário, por nome normalizado para evitar repetição do titular.

Arquivos a ajustar:
- `src/pages/crm/hooks/useCRMData.ts`
- Possível ajuste leve de renderização em `src/pages/crm/components/CRMLeadDetailsDialog.tsx` apenas se for necessário melhorar estado vazio/loading

Detalhe técnico:
```text
Página Equipes (fonte correta para perfil user):
  getTeamMembers(user.id, false)

CRM corrigido:
  perfil user:
    principalId = authUser.id
    members = getTeamMembers(principalId, false)
    lista = [titular, ...members]

  perfil team/advogado/comercial:
    SELECT user_id, name FROM users WHERE id = authUser.id
    principalId = user_id
    members = getTeamMembers(principalId, false)
    SELECT name FROM users WHERE id = principalId
    lista = [titular, ...members]
```

Validação após implementar:
- Logado como perfil `user`: conferir se a lista de responsáveis bate com a página Equipes + inclui o titular.
- Logado como membro de equipe: conferir se a lista mostra a equipe do `user_id` pai + titular.
- Confirmar que o filtro por responsável no CRM usa exatamente os mesmos nomes da lista do detalhe do card.
