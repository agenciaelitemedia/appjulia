

## Plano: Versionamento de Alterações de Agentes

### Objetivo
Registrar automaticamente cada alteração feita em agentes (criação e edição), armazenando snapshot dos dados, autor e timestamp. Exibir na listagem a data/hora e autor da última atualização.

---

### Etapa 1 — Tabela `agent_change_log` (Supabase)

```sql
CREATE TABLE agent_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id integer NOT NULL,
  cod_agent text NOT NULL,
  action text NOT NULL DEFAULT 'update', -- 'create', 'update', 'status_change'
  changed_by text,               -- nome do usuário
  changed_by_id integer,         -- id do usuário
  change_summary text,           -- resumo das alterações
  snapshot jsonb,                -- dados completos do agente no momento
  changes jsonb,                 -- diff: campos alterados (antes/depois)
  created_at timestamptz DEFAULT now()
);
ALTER TABLE agent_change_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on agent_change_log" ON agent_change_log FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_agent_change_log_agent_id ON agent_change_log(agent_id);
CREATE INDEX idx_agent_change_log_cod_agent ON agent_change_log(cod_agent);
```

### Etapa 2 — Registrar log ao salvar/criar agente

**`useAgentUpdate.ts`**: Após `saveChanges` com sucesso, inserir registro na `agent_change_log` com:
- `action: 'update'`, `changed_by: user.name`, snapshot dos dados enviados
- Receber `user` (nome e id) como parâmetro adicional

**`useAgentSave.ts`**: Após criação do agente, inserir registro com `action: 'create'`

**`EditAgentPage.tsx`**: Passar `useAuth().user` para `saveChanges`, e após sucesso chamar inserção do log

**Toggle de status (AgentsList.tsx)**: Ao alternar status, registrar `action: 'status_change'`

### Etapa 3 — Buscar última alteração na listagem

**`useAgentsList.ts`**: Criar query complementar que busca o último registro de `agent_change_log` por `agent_id` (agrupado), retornando `changed_by` e `created_at`.

Ou alternativamente, criar hook `useAgentsLastChanges` que busca os últimos logs para todos os agentes exibidos, usando uma única query com `DISTINCT ON`.

### Etapa 4 — Exibir na tabela de listagem

**`AgentsList.tsx`**: Adicionar coluna "Última Alteração" entre "Venci." e "Ação", mostrando:
- Data/hora formatada (ex: "15/04 14:30")
- Nome do autor abaixo em texto menor
- Tooltip com data completa

### Etapa 5 — Histórico no detalhe do agente (opcional/bônus)

**`AgentDetailsPage.tsx`**: Adicionar aba/seção "Histórico" listando todas as alterações do agente com timeline visual.

---

### Arquivos criados/alterados

| Arquivo | Ação |
|---|---|
| Migração Supabase | Criar tabela `agent_change_log` |
| `src/pages/agents/hooks/useAgentChangeLog.ts` | Criar — hook de inserção e consulta |
| `src/pages/agents/hooks/useAgentUpdate.ts` | Alterar — registrar log após salvar |
| `src/pages/agents/hooks/useAgentSave.ts` | Alterar — registrar log após criar |
| `src/pages/agents/EditAgentPage.tsx` | Alterar — passar user ao save |
| `src/pages/agents/AgentsList.tsx` | Alterar — coluna "Última Alteração" + log no toggle |
| `src/pages/agents/hooks/useAgentsList.ts` | Alterar — interface com campos de última alteração |

