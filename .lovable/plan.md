## Objetivo

Em `/admin/monitoramento`, ao vincular um usuário a um `cod_agent` marcando-o como **Proprietário**, atualizar automaticamente o `client_id` do usuário com o `client_id` do agente vinculado.

## Mudanças

Edge function `supabase/functions/db-query/index.ts`:

**1. Action `insert_user_agent`** (linha ~881)
Quando `agentId` for informado (proprietário), além do `UPDATE agents SET user_id`, também executar:
```sql
UPDATE users
   SET client_id = (SELECT client_id FROM agents WHERE id = $1)
 WHERE id = $2
   AND (SELECT client_id FROM agents WHERE id = $1) IS NOT NULL;
```

**2. Action `update_user_agent_ownership`** (linha ~2703)
Quando `agentId` passar de `NULL` para um valor (promoção a proprietário via toggle no diálogo de edição), aplicar o mesmo update de `users.client_id`. Se `agentId` for `NULL` (rebaixamento a monitor), não alterar `client_id`.

## Fora de escopo

- UI do `MonitorAgentDialog` e `useMonitoramentoData` permanecem iguais — a lógica fica server-side para garantir consistência.
- Não mexer em vínculos não-proprietários (`agent_id IS NULL`).
- Não sobrescrever `users.client_id` se o agente não tiver `client_id` definido.