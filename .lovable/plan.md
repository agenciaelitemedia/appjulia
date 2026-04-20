

## Diagnóstico real: UaZapi não está chegando no n8n

Você está dizendo que **só** o `app=waba` (status update) chegou no n8n — a mensagem real que entrou pela UaZapi não disparou nada lá. Isso muda o diagnóstico:

1. O `uazapi-chat-webhook` pode não estar sendo chamado pela UaZapi (webhook não configurado ou apontando errado).
2. O webhook está sendo chamado mas a mensagem é descartada antes do fan-out (sem fila, sem agentes vinculados, deduplicação, evento ignorado).
3. O fan-out até roda mas falha o POST no n8n (timeout, 4xx/5xx).

## Investigação (read-only)

### Logs Edge Functions
- `supabase--edge_function_logs` em `uazapi-chat-webhook` últimos 30 min — verificar:
  - Se há `event received` (UaZapi está chamando)
  - Se há `[fan-out] queue=...` ou `targets=0` (descartado por falta de vínculo)
  - Se há `[fan-out] response status=...` (tentou mandar e o resultado)

### SQL
```sql
-- Fila UaZapi e webhook configurado
SELECT id, name, channel_type, evo_url, evo_instance, is_active
FROM queues WHERE channel_type = 'uazapi' AND is_deleted = false;

-- Vínculos da fila com agentes
SELECT qal.queue_id, qal.cod_agent, qal.is_primary, q.name
FROM queue_agent_links qal
JOIN queues q ON q.id = qal.queue_id
WHERE q.channel_type = 'uazapi';
```

### Verificar webhook na UaZapi (via instance manager)
- Conferir se `instance_name` está com URL apontando para `…/uazapi-chat-webhook?queue_id=<id>` e `enabled=true`.

## Possíveis causas e correção

| Causa | Como corrigir |
|---|---|
| Webhook UaZapi nunca foi configurado depois do reset das tabelas | Reconfigurar via `uazapi-instance-manager` action `reconfigure_webhook` (já existe) |
| Fila UaZapi sem `queue_agent_links` → `targets=0` no fan-out | Linkar agente à fila no módulo de Agentes |
| URL do webhook na UaZapi sem `?queue_id=` | Reconfigurar webhook (resolve) |
| `N8N_HUB_SEND_URL` retorna não-200 → log mostra `response status=4xx/5xx` | Conferir flow no n8n / URL do secret |

## Plano de ação

1. Ler logs do `uazapi-chat-webhook` e logs SQL acima para identificar exatamente em qual ponto a mensagem UaZapi morre.
2. Com base no resultado:
   - Se webhook não está configurado → rodar action `reconfigure_webhook` da fila UaZapi.
   - Se `targets=0` → criar/garantir vínculo `queue_agent_links` para a fila.
   - Se POST n8n falha → revisar URL/flow.
3. Reenviar uma mensagem teste e validar nos logs do `uazapi-chat-webhook` o `[fan-out] response status=200` com `?app=uazapi`.

### Arquivos potencialmente editados (depende do diagnóstico)
- Nenhum, na maioria dos casos. Se o webhook estiver sem `queue_id` por causa de uma fila criada antes do parâmetro existir, edito `supabase/functions/uazapi-instance-manager/index.ts` para forçar `queue_id` válido na reconfiguração — mas só se o log indicar isso.

### O que NÃO vou fazer
- Não vou tocar no `meta-webhook` agora — deixamos para depois que UaZapi voltar a entregar.
- Não vou alterar o n8n.

Aprova que eu rode a investigação (logs + SQL) e te trago o ponto exato da falha?

