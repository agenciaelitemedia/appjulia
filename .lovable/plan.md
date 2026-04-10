

## Plano: Corrigir lista de responsáveis + Filtro por responsável no CRM

### Problema atual
O hook `useTeamMembersForAgent` tenta resolver a equipe a partir do `cod_agent` do card. Quando não encontra, faz fallback usando o `user_id` do usuário logado, mas a lógica de resolver o "principal" (titular) está inconsistente — usa `user_id` como `parent_user_id` mas esse campo no banco externo indica o ID do usuário pai apenas para membros de equipe (perfil `time`/`advogado`/`comercial`), e para o titular é `NULL` ou o próprio ID.

### Solução

#### 1. Corrigir `useTeamMembersForAgent` (src/pages/crm/hooks/useCRMData.ts)

Simplificar a lógica: não depender mais do `cod_agent` para resolver a equipe. Usar diretamente o `authUser` do contexto:

- **Se `user.role === 'user'`** (titular): `principalId = user.id` → buscar equipe com `getTeamMembers(user.id, true)` + incluir o próprio titular na lista
- **Se `user.role` é `time`/`advogado`/`comercial`** (membro): buscar `user_id` do registro do usuário na tabela `users` (que contém o ID do pai) → `principalId = user_id_do_registro` → buscar equipe do titular + incluir titular na lista

Manter deduplicação e ordenação alfabética.

#### 2. Criar hook `useTeamForCurrentUser` (mesmo arquivo)

Novo hook dedicado que retorna a lista de membros da equipe do usuário logado (independente do card). Será usado tanto no dialog de detalhes quanto no filtro:

```text
useTeamForCurrentUser():
  1. authUser.role === 'user' → principalId = authUser.id
  2. authUser.role in ('time','advogado','comercial') → 
     SELECT user_id FROM users WHERE id = authUser.id → principalId = user_id
  3. SELECT name FROM users WHERE id = principalId (nome do titular)
  4. getTeamMembers(principalId, true) (membros)
  5. Combinar titular + membros, deduplicar, ordenar A-Z
  6. Retornar lista: { id, name, role }[]
```

#### 3. Atualizar `CRMLeadDetailsDialog` 
Usar `useTeamForCurrentUser()` em vez de `useTeamMembersForAgent()`.

#### 4. Adicionar filtro por responsável no CRM (src/pages/crm/CRMPage.tsx)

Ao lado do ToggleGroup de status Julia, adicionar:
- Um `Select` com opções: "Todos" | "Meus cards" | [lista de membros da equipe]
- Estado: `ownerFilter: string` (`'all'` | `'mine'` | nome do responsável)
- Filtro client-side no `filteredCards`: comparar `card.owner_name` com o valor selecionado
- "Meus cards" filtra por `card.owner_name === authUser.name`

### Arquivos alterados
1. **src/pages/crm/hooks/useCRMData.ts** — Criar `useTeamForCurrentUser`, simplificar/remover `useTeamMembersForAgent`
2. **src/pages/crm/CRMPage.tsx** — Adicionar estado `ownerFilter`, Select de responsável, lógica de filtro no `filteredCards`
3. **src/pages/crm/components/CRMLeadDetailsDialog.tsx** — Trocar hook para `useTeamForCurrentUser`

