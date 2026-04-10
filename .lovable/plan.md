

# Mover Totalizadores + Select de Fase + Campo Responsável no CRM

## Resumo

Três mudanças no CRM da Julia:
1. Mover cards de totais para acima dos filtros
2. Adicionar select de fase no dialog de detalhes (somente quando Julia inativa)
3. Adicionar campo "Responsável" nos cards e no dialog de detalhes com possibilidade de alteração quando Julia inativa

## Mudanças

### 1. Mover CRMTotalizers (CRMPage.tsx)

Reordenar JSX: `<CRMTotalizers>` antes de `<UnifiedFilters>`.

### 2. Campo "Responsável" no CRMLeadCard

Acima das linhas "Atualizado" e "Criado", adicionar uma linha **Responsável**:
- Se Julia ativa: exibe `🤖 Julia IA` (verde)
- Se Julia inativa: exibe o nome do responsável atual (se houver) ou `Sem responsável` em texto cinza

O responsável será armazenado no campo `owner_name` do card (já existe no tipo `CRMCard`). Quando Julia está ativa, sobrescreve visualmente para "Julia IA" independente do valor salvo.

### 3. Alterar Responsável no Dialog de Detalhes (CRMLeadDetailsDialog)

Na seção "Fase Atual", quando Julia **inativa**:
- A fase vira um `<Select>` editável com todas as stages
- Ao alterar, chama `useMoveCard`

Abaixo da fase, nova seção **Responsável**:
- Quando Julia **ativa**: Badge estático `🤖 Julia IA`
- Quando Julia **inativa**: botão "Alterar Responsável" que abre um **Dialog/Popover** com lista de membros:
  - Primeiro item: `🤖 Julia IA` (destaque especial, com ícone Bot)
  - Demais: membros da equipe do `cod_agent` em questão (buscados via `externalDb.getTeamMembers`)
  - Ao selecionar, atualiza o campo `owner_name` no card via `externalDb.update` na tabela `crm_atendimento_cards`
  - Toast de confirmação

### 4. Hook para buscar membros da equipe

Criar `useTeamMembersForAgent(codAgent)` que busca os membros via edge function `db-query` com a action existente `get_team_members`, filtrando pelo user vinculado ao `cod_agent`.

## Arquivos Alterados

| Arquivo | Mudança |
|---|---|
| `src/pages/crm/CRMPage.tsx` | Mover `<CRMTotalizers>` acima de `<UnifiedFilters>` |
| `src/pages/crm/components/CRMLeadCard.tsx` | Adicionar linha "Responsável" acima de "Criado" com lógica Julia ativa/inativa |
| `src/pages/crm/components/CRMLeadDetailsDialog.tsx` | Importar `useAgentSessionStatus`; Select de fase condicional; seção Responsável com dialog de seleção de membros |
| `src/pages/crm/hooks/useCRMData.ts` | Adicionar hook `useTeamMembersForAgent` e mutation `useUpdateCardOwner` |

## Detalhes Técnicos

**Fluxo de alteração de responsável:**
```text
1. Usuário clica "Alterar Responsável" (só visível se Julia inativa)
2. Abre popover/dialog com lista:
   [🤖 Julia IA]        ← primeiro, destaque
   [👤 João Silva]      ← membro da equipe
   [👤 Maria Souza]     ← membro da equipe
3. Ao selecionar, PUT no crm_atendimento_cards.owner_name
4. Toast "Responsável alterado para X"
5. Invalida cache ['crm-cards']
```

**No card (CRMLeadCard):** a linha "Responsável" fica entre o bloco de badges de ação e o bloco de datas, com ícone Bot (verde) ou User (cinza) conforme status.

