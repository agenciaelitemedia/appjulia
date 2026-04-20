

## Diagnóstico
Agente 202601003 vinculado à fila UaZapi mas não está respondendo. Preciso investigar:

1. Se o link existe em `queue_agent_links`
2. Se o webhook UaZapi está chegando em `uazapi-chat-webhook`
3. Se o fan-out para o n8n do agente está sendo executado

Pelos logs vistos:
- `uazapi-chat-webhook` recebeu evento na fila "Agente Principal" e processou (`processed=1`)
- Porém **não há log de forward para n8n** com `?app=uazapi&c=202601003`

Preciso verificar o código do `uazapi-chat-webhook` para confirmar:
- Se a lógica de fan-out (que adicionei) está ativa
- Se está buscando `webhook_n8n` no agente corretamente
- Se está logando os forwards

## Hipóteses prováveis
1. **Fan-out só dispara em `messages.upsert` mas o evento veio como `messages`** — filtro de evento errado.
2. **Coluna do webhook n8n no `agents`** pode ter nome diferente (ex: `webhook_n8n` vs `n8n_webhook` vs `webhook`).
3. **Agente 202601003 não tem `webhook_n8n` preenchido** no banco externo.
4. **Fan-out só executa quando NÃO há `cod_agent` primário direto** — pode estar pulando porque a fila já tem agente "antigo" associado.

## Plano de investigação e correção

### Etapa 1 — Inspeção (read-only, agora)
- Ler `supabase/functions/uazapi-chat-webhook/index.ts` para ver a lógica atual de fan-out.
- Consultar via `db-query`/external DB:
  - `agents.webhook_n8n` (ou nome equivalente) para `cod_agent=202601003`.
- Consultar Supabase: `queue_agent_links` para `cod_agent=202601003` (qual queue, primary?).
- Buscar logs recentes do `uazapi-chat-webhook` filtrando por "202601003" / "forward" / "n8n".

### Etapa 2 — Correções esperadas
Com base no diagnóstico:

**A) Garantir fan-out independente do tipo de evento**
- O forward para n8n deve ocorrer para todo evento `messages` (não só upsert), espelhando o `meta-webhook`.
- Iterar `queue_agent_links` da fila resolvida e fazer POST para cada `agents.webhook_n8n` com querystring `?app=uazapi&c=<cod_agent>`.

**B) Padronizar nome da coluna**
- Confirmar nome real (`webhook_n8n`) e ajustar leitura caso necessário.

**C) Adicionar logs de observabilidade**
- Log: `[fan-out] queue=<id> targets=<n>`
- Log por target: `[fan-out] POST <url-mascarada> agent=<cod>`
- Log de erro de forward (sem quebrar o processamento principal).

**D) Não duplicar com fluxo legado**
- Se o agente da fila já é o mesmo `cod_agent` resolvido pelo caminho legado, evitar enviar 2x.

### Etapa 3 — Validação
- Enviar mensagem de teste no WhatsApp da fila UaZapi vinculada ao 202601003.
- Conferir nos logs do `uazapi-chat-webhook` os logs `[fan-out]`.
- Confirmar recebimento no n8n do agente 202601003.

## Arquivos previstos
- `supabase/functions/uazapi-chat-webhook/index.ts` — ajustar/garantir fan-out + logs.
- (Eventual) `supabase/functions/_shared/forward-to-agent-n8n.ts` — extrair helper se ainda não existir.

## Saída final
- Mensagem de teste responde via Julia (n8n) para o agente 202601003 conectado via fila UaZapi.

