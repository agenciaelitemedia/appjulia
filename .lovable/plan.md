

# Taxa de Retorno: WhatsApp únicos pela última entrada

## Alteração

### `src/pages/crm/hooks/useFollowupReturnRate.ts`

Na CTE `current_state`, trocar `DISTINCT ON (cod_agent, session_id)` por `DISTINCT ON (session_id)` e ajustar o `ORDER BY` para `session_id, send_date DESC`. Isso garante que cada número de WhatsApp é contado apenas uma vez, considerando somente sua entrada mais recente no followup.

Na CTE `leads_with_response`, também usar `DISTINCT` por `session_id` para manter consistência.

