

## Plano: Versionar alterações na edição self-service (Meus Agentes)

### Problema
A página `MyAgentEditPage.tsx` (rota `/agente/meus-agentes/:codAgent/editar`) salva alterações via `externalDb.updateAgentByOwner` mas **não registra** na tabela `agent_change_log`.

### Correção

**Arquivo**: `src/pages/agente/meus-agentes/MyAgentEditPage.tsx`

Após o `await externalDb.updateAgentByOwner(...)` com sucesso, chamar `insertAgentChangeLog` com:
- `agent_id`: já disponível em `userAgent.agent_id_from_agents`
- `cod_agent`: já disponível em `codAgent`
- `action`: `'update'`
- `changed_by`: `user.name`
- `changed_by_id`: `user.id`
- `change_summary`: `'Agente atualizado pelo proprietário'`
- `snapshot`: objeto com `config_json` e `system_prompt` conforme editados

Importar `insertAgentChangeLog` de `@/pages/agents/hooks/useAgentChangeLog`.

### Resultado
Toda edição feita pelo proprietário na tela "Meus Agentes" será registrada no log de alterações e aparecerá na coluna "Última Alteração" da listagem administrativa.

