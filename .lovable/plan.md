

## Plano: Corrigir versionamento de alterações na edição de agentes

### Diagnóstico
A tabela `agent_change_log` tem registros apenas para o agente 310. Ao salvar alterações no agente 307, o log não foi criado. O código atual em `useAgentUpdate.ts` chama `insertAgentChangeLog` após os updates, mas erros são silenciados (`console.error` sem throw).

### Correções

**1. `useAgentUpdate.ts`** — Tornar o log mais resiliente
- Mover o `insertAgentChangeLog` para FORA do try/catch principal, garantindo que seja chamado mesmo se houver erro parcial
- Adicionar log de erro visível (toast warning) se o log falhar, mas sem bloquear o save
- Separar o snapshot em `config_json` e `system_prompt` explicitamente

**2. `useAgentChangeLog.ts`** — Melhorar feedback de erros
- Retornar o resultado do insert para que o chamador saiba se falhou
- Adicionar log mais detalhado do erro

**3. `EditAgentPage.tsx`** — Garantir invalidação do cache
- Invalidar também `['agents-list']` além de `['agents-last-changes']` para forçar refresh total
- Mover a invalidação para dentro do `onSubmit` antes da navegação

**4. `AgentsList.tsx`** — Já funcional
- A coluna "Última Alteração" já existe e exibe dados corretamente quando há registros

### Resultado
Todo save na edição admin (`/admin/agentes/:id/editar`) criará um registro confiável no `agent_change_log` com config, prompt, autor e timestamp, visível na listagem.

