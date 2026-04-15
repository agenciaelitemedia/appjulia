

## Plano: Corrigir lista de responsáveis por cod_agent

### Problema
`useTeamForCurrentUser()` retorna o time do **usuário logado**, não do **dono do cod_agent**. Quando admin ou outro usuário visualiza um lead de outro agente, a lista mostra os membros errados.

### Solução
Criar um novo hook `useTeamForAgent(codAgent)` que busca o time com base no `user_id` da tabela `agents`, e usá-lo nos 3 pontos: CRM Details, CRM Filters e Atendimento Humano.

---

### Etapa 1 — Nova action `get_team_for_agent` no db-query

**Arquivo: `supabase/functions/db-query/index.ts`**

Nova action que recebe `codAgent` e retorna o dono + membros do time:
```sql
-- Busca user_id do agents
SELECT user_id FROM agents WHERE cod_agent = $1 LIMIT 1
-- Busca dono
SELECT id, name, 'Titular' as role FROM users WHERE id = <owner_id>
-- Busca membros do time do dono
SELECT id, name, role FROM users WHERE user_id = <owner_id> AND role IN ('time','advogado','comercial')
```

### Etapa 2 — Novo método em `externalDb.ts`

**Arquivo: `src/lib/externalDb.ts`**

Adicionar `getTeamForAgent(codAgent: string)` que invoca a nova action.

### Etapa 3 — Novo hook `useTeamForAgent`

**Arquivo: `src/pages/crm/hooks/useCRMData.ts`**

Novo hook que recebe `codAgent`, chama `externalDb.getTeamForAgent(codAgent)` e retorna a lista ordenada (owner + membros).

### Etapa 4 — Atualizar CRMLeadDetailsDialog

**Arquivo: `src/pages/crm/components/CRMLeadDetailsDialog.tsx`**

Trocar `useTeamForCurrentUser()` por `useTeamForAgent(card?.cod_agent)`.

### Etapa 5 — Atualizar CRMPage (filtro de responsáveis)

**Arquivo: `src/pages/crm/CRMPage.tsx`**

Trocar para usar `useTeamForAgent` com base nos agentes selecionados (ou manter `useTeamForCurrentUser` no filtro geral se múltiplos agentes são exibidos).

### Etapa 6 — Atualizar HumanSupportPage

**Arquivo: `src/pages/atendimento-humano/HumanSupportPage.tsx`**

Trocar `useTeamForCurrentUser()` por `useTeamForAgent(selectedAgent)`.

### Etapa 7 — Deploy do db-query

---

### Arquivos alterados
1. `supabase/functions/db-query/index.ts` — nova action `get_team_for_agent`
2. `src/lib/externalDb.ts` — método `getTeamForAgent`
3. `src/pages/crm/hooks/useCRMData.ts` — novo hook `useTeamForAgent`
4. `src/pages/crm/components/CRMLeadDetailsDialog.tsx` — usar novo hook
5. `src/pages/crm/CRMPage.tsx` — avaliar troca do hook
6. `src/pages/atendimento-humano/HumanSupportPage.tsx` — usar novo hook

