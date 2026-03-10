

## Plano: Edição de agente pelo dono + controle de permissões por `user_agent`

### Resumo

1. Adicionar dois campos na tabela `user_agents`: `can_edit_prompt` (default `false`) e `can_edit_config` (default `true`)
2. Criar página de edição simplificada para o dono do agente (apenas abas Configurações e Prompt, condicionadas às permissões)
3. Adicionar botão "Editar" no `AgentCard` dos agentes próprios
4. Implementar UI para gerenciar essas permissões no fluxo de administração (monitoramento/equipe)

### Alterações

#### 1. Backend — Migração SQL
Adicionar colunas à tabela `user_agents`:
```sql
ALTER TABLE user_agents ADD COLUMN can_edit_prompt BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE user_agents ADD COLUMN can_edit_config BOOLEAN NOT NULL DEFAULT TRUE;
```

#### 2. Backend — `db-query/index.ts`
- No case `get_user_agents`: incluir `ua.can_edit_prompt` e `ua.can_edit_config` no SELECT
- Novo case `update_agent_by_owner`: salvar apenas `settings` e/ou `prompt` no agente (sem alterar cliente/plano/usuário), validando que o `user_id` é dono do agente
- Nos cases de inserção/atualização de `user_agents` (equipe/monitoramento): propagar os novos campos `can_edit_prompt` e `can_edit_config`

#### 3. Frontend — Tipo `UserAgent` (`src/pages/agente/meus-agentes/types.ts`)
Adicionar:
```typescript
can_edit_prompt: boolean;
can_edit_config: boolean;
```

#### 4. Frontend — `AgentCard.tsx`
- Adicionar botão "Editar" (ícone `Pencil`) visível apenas quando `!isMonitored` e (`can_edit_config` ou `can_edit_prompt`)
- Navegar para `/agente/meus-agentes/{agent_id}/editar`

#### 5. Frontend — Nova página `MyAgentEditPage.tsx`
- Rota: `/agente/meus-agentes/:id/editar`
- Carregar dados do agente via `getAgentDetails`
- Carregar permissões do `user_agent` (do hook `useMyAgents` ou nova query)
- Exibir apenas as abas permitidas:
  - Aba "Configurações" se `can_edit_config === true`
  - Aba "Prompt" se `can_edit_prompt === true`
- Reutilizar `ConfigStep` e `PromptStep` existentes
- Salvar via novo endpoint `update_agent_by_owner` (somente campos config/prompt)
- Botão voltar navega para `/agente/meus-agentes`

#### 6. Frontend — `App.tsx`
Adicionar rota:
```tsx
<Route path="/agente/meus-agentes/:id/editar" element={<MyAgentEditPage />} />
```

#### 7. Frontend — UI de administração (Monitoramento/Equipe)
Nos formulários de vinculação de agentes ao usuário, adicionar checkboxes para `can_edit_config` e `can_edit_prompt` por agente vinculado.

### Arquivos afetados

| Arquivo | Tipo |
|---|---|
| Migração SQL (user_agents) | Criar |
| `supabase/functions/db-query/index.ts` | Editar |
| `src/pages/agente/meus-agentes/types.ts` | Editar |
| `src/pages/agente/meus-agentes/components/AgentCard.tsx` | Editar |
| `src/pages/agente/meus-agentes/MyAgentEditPage.tsx` | Criar |
| `src/App.tsx` | Editar |
| `src/pages/admin/monitoramento/components/MonitoramentoEditor.tsx` | Editar |

