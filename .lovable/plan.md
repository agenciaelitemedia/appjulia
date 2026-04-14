

## Plano: Adicionar filtro de responsável no Atendimento Humano

### O que será feito
Adicionar um filtro de responsável (owner) na sidebar do Atendimento Humano, idêntico ao que existe no CRM da Julia — com as opções "Todos", "MEUS CARDS" e "Sem Responsável", além da lista de membros da equipe.

### Arquivos a modificar

**1. `src/pages/atendimento-humano/hooks/useInactiveLeads.ts`**
- Adicionar estado `ownerFilter` (valores: `'all'`, `'mine'`, `'unassigned'`, ou nome do responsável)
- Filtrar `filteredLeads` pelo `owner_name` do lead, usando a mesma lógica do CRM:
  - `'mine'` → filtra por `owner_name === authUser.name`
  - `'unassigned'` → filtra por `!owner_name`
  - outro valor → filtra por `owner_name === ownerFilter`
- Expor `ownerFilter` e `setOwnerFilter` no retorno

**2. `src/pages/atendimento-humano/components/InactiveLeadsList.tsx`**
- Adicionar prop `ownerFilter` e `onOwnerFilterChange`
- Adicionar prop `teamMembers` (lista de membros da equipe)
- Renderizar um `Select` com ícone `UserCircle` no header, abaixo do seletor de agente, com as opções:
  - "Todos" (`all`)
  - "MEUS CARDS" (`mine`) — em negrito/uppercase como no CRM
  - "Sem Responsável" (`unassigned`) — em itálico
  - Lista dinâmica de membros da equipe

**3. `src/pages/atendimento-humano/HumanSupportPage.tsx`**
- Importar `useTeamForCurrentUser` do CRM hooks
- Passar `ownerFilter`, `onOwnerFilterChange` e `teamMembers` para `InactiveLeadsList`

### Detalhes técnicos
- Reutiliza o hook `useTeamForCurrentUser` já existente em `src/pages/crm/hooks/useCRMData.ts`
- O campo `owner_name` já existe na interface `InactiveSession`
- Filtragem client-side, sem alterações no backend

