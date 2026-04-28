## Objetivo

Em `/admin/prompts` → aba **Casos Jurídicos**, ampliar a busca para também encontrar casos por dados dos clientes que os utilizam, e adicionar um expand em cada card mostrando todos os clientes vinculados àquele caso.

## Mudanças

### 1. Novo hook `useLegalCaseUsage` (`src/pages/admin/prompts/hooks/useLegalCaseUsage.ts`)
Carrega, em uma única query, todos os vínculos de casos com agentes:

```sql
SELECT pc.case_id, ap.cod_agent, ap.agent_name, ap.business_name
FROM generation_agent_prompt_cases pc
JOIN generation_agent_prompts ap ON ap.id = pc.agent_prompt_id
```

Retorna um `Map<case_id, Array<{ cod_agent, agent_name, business_name }>>` para consulta O(1) por caso.

### 2. Atualizar `LegalCasesTab.tsx`

**Busca ampliada:**
- Trocar o placeholder do input para: *"Buscar por nome do caso, cód. agente, nome do cliente ou escritório..."*
- Filtro `filtered` passa a aceitar match em qualquer um destes campos:
  - `case_name`
  - Em qualquer cliente vinculado: `cod_agent`, `agent_name` (cliente), `business_name` (escritório)
- Comparação case-insensitive, com `includes`.

**Expand por caso:**
- Adicionar botão chevron (ChevronDown/ChevronUp) no card, ao lado dos demais ícones.
- Ao expandir, renderizar abaixo do card a lista de clientes que usam o caso, no formato solicitado:

```
# 202603001 - Ana Carolina AS
Ana Carolina Marques sociedade individual de advocacia
```

ou seja:
- Linha 1 (negrito): `# {cod_agent} - {business_name}`
- Linha 2 (texto secundário): `{agent_name}`

- Mostrar contador "(N clientes)" ao lado do nome do caso.
- Estado local: `expandedCaseIds: Set<string>`.
- Se o caso não tem clientes: mostrar "Nenhum cliente usa este caso ainda".

**Comportamento da busca + expand:**
- Quando a busca casa por dados de cliente (e não pelo nome do caso), auto-expandir o card e destacar (highlight leve) os clientes que casaram.

### 3. Sem mudanças de schema
Tudo já existe nas tabelas `generation_legal_cases`, `generation_agent_prompt_cases` e `generation_agent_prompts`.

## Arquivos

- **Criar**: `src/pages/admin/prompts/hooks/useLegalCaseUsage.ts`
- **Editar**: `src/pages/admin/prompts/components/LegalCasesTab.tsx`
