## Adicionar toggle "Proprietário" no MonitorAgentDialog

### Alterações

#### 1. `src/pages/agents/components/MonitorAgentDialog.tsx`

- Adicionar estado `isOwner` (boolean, default `false`)
- Na etapa de confirmação (step 3), adicionar um `Switch` com label "Proprietário"
- No `handleSubmit`, passar `selectedAgent.id` como `agentId` quando `isOwner === true`, ou `null` quando `false`
- Resetar `isOwner` ao fechar o dialog

#### 2. `supabase/functions/db-query/index.ts` (case `insert_user_agent`)

-  verificação de duplicidade permanece igual

### Arquivos modificados

- `src/pages/agents/components/MonitorAgentDialog.tsx` — switch + lógica condicional do agentId
- `supabase/functions/db-query/index.ts` — duplicidade para proprietário