

## Plano: Checkboxes de permissões na aba Usuário do EditAgentPage

### Contexto
A query `get_agent_details` já faz JOIN com `user_agents` (linha 844) mas não retorna `can_edit_prompt` e `can_edit_config`. Precisamos incluí-los e expor controles na aba Usuário.

### Alterações

#### 1. Backend — `supabase/functions/db-query/index.ts`
No case `get_agent_details`, adicionar ao SELECT:
```sql
ua.can_edit_prompt,
ua.can_edit_config
```

#### 2. Frontend — `EditClientStep.tsx` (tipo `EditAgentFormData`)
Adicionar campos:
```typescript
can_edit_prompt: boolean;
can_edit_config: boolean;
```

#### 3. Frontend — `EditAgentPage.tsx`
- Incluir `can_edit_prompt` e `can_edit_config` no `AgentDetails` interface e no `methods.reset()`
- No `onSubmit`, chamar `externalDb.updateUserAgentPermissions()` se houver `user_id`

#### 4. Frontend — `EditUserStep.tsx`
Adicionar um card "Permissões de Edição" com dois switches:
- **Editar Configurações** (`can_edit_config`) — controla se o dono pode editar configs
- **Editar Prompt** (`can_edit_prompt`) — controla se o dono pode editar prompt

Cada switch usa `watch`/`setValue` do form context.

#### 5. Frontend — `externalDb.ts`
Garantir que existe o método `updateUserAgentPermissions` (já deve existir da implementação anterior).

### Arquivos afetados

| Arquivo | Alteração |
|---|---|
| `supabase/functions/db-query/index.ts` | Adicionar campos ao SELECT do `get_agent_details` |
| `src/pages/agents/components/edit-steps/EditClientStep.tsx` | Adicionar campos ao tipo |
| `src/pages/agents/EditAgentPage.tsx` | Propagar campos no form e salvar permissões |
| `src/pages/agents/components/edit-steps/EditUserStep.tsx` | Adicionar switches de permissão |

