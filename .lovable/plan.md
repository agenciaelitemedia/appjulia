

# Alias (nome) para agentes

## Resumo

Criar uma tabela Supabase `agent_aliases` para armazenar um apelido editável por `cod_agent`. O valor padrão será o nome da instância sem o prefixo `[JulIAv2]`. Esse alias será exibido no card de "Meus Agentes", no `AgentSearchSelect` (como subtítulo), e no badge do `CRMLeadCard`.

## 1. Migração: tabela `agent_aliases`

```sql
CREATE TABLE agent_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cod_agent text NOT NULL UNIQUE,
  alias text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE agent_aliases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on agent_aliases" ON agent_aliases FOR ALL USING (true) WITH CHECK (true);
```

## 2. Hook `useAgentAliases`

Criar `src/hooks/useAgentAliases.ts`:
- Query: busca todos os aliases da tabela `agent_aliases`
- Mutation `upsertAlias(codAgent, alias)`: faz upsert no Supabase
- Função utilitária `getDefaultAlias(businessName)`: remove prefixo `[JulIAv2]` ou `[Juliav2]` (case-insensitive) do nome, retornando o restante como alias padrão
- Função `getAlias(codAgent)`: retorna alias salvo ou gera default a partir do business_name

## 3. Card "Meus Agentes" — edição do alias

Em `AgentCard.tsx`:
- Exibir o alias abaixo do nome do agente (ou no lugar do nome se preferido)
- Adicionar ícone de edição (lápis inline) ao lado do alias
- Ao clicar, abre input inline para editar e salvar o alias via `upsertAlias`
- Ao criar pela primeira vez, gera o default automaticamente a partir do `business_name`

## 4. `AgentSearchSelect` — alias como subtítulo

Em `AgentSearchSelect.tsx`:
- Adicionar campo `alias?: string` ao `AgentOption`
- No título do item: `[cod_agent] - owner_name` (sem alteração)
- Abaixo, novo subtítulo com o alias (quando existir)
- Abaixo do subtítulo, o `owner_business_name` (escritório)
- Busca também filtra pelo alias

## 5. `CRMLeadCard` — alias no badge

Em `CRMLeadCard.tsx`:
- Buscar aliases via hook/contexto
- No badge do cod_agent, exibir o alias em vez do `truncatedBusinessName` quando disponível
- Tooltip mantém informação completa

## 6. Providers de alias

Onde `AgentSearchSelect` é usado (FollowupPage, ContractNotificationsPage, CRM pages):
- Atualizar a query `get_crm_agents_for_user` no `db-query` para incluir lookup ao `agent_aliases` do Supabase — ou, mais simples, fazer join client-side no hook `useJuliaAgents` com os aliases carregados do Supabase

Abordagem client-side: o hook `useAgentAliases` retorna um Map `codAgent → alias`. Cada componente que precisa do alias faz lookup nesse Map.

## Arquivos criados/alterados

| Arquivo | Ação |
|---|---|
| Migração SQL | Criar tabela `agent_aliases` |
| `src/hooks/useAgentAliases.ts` | Novo hook para CRUD de aliases |
| `src/pages/agente/meus-agentes/components/AgentCard.tsx` | Exibir e editar alias |
| `src/components/AgentSearchSelect.tsx` | Exibir alias como subtítulo |
| `src/pages/crm/components/CRMLeadCard.tsx` | Usar alias no badge |

