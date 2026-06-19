## Objetivo

Sempre que um **atendente humano** enviar uma mensagem para um contato cuja **Julia está ativa**, desativar automaticamente a sessão Julia desse contato (mesmo comportamento do botão "assumir humano").

## Regra

Para cada mensagem inserida em `chat_messages` com `from_me=true` **e** `internal_note != true`:

1. Resolver o `cod_agent` da fila da conversa (via `queue_agent_links.cod_agent`).
2. Resolver o `whatsappNumber` do contato (telefone normalizado).
3. Buscar a sessão Julia ativa (`db-query` action `get_session_status`).
4. Se `active=true`, chamar `update_session_status` com `active=false`.
5. Logar resultado para auditoria.

Sem `cod_agent` na fila (fila sem IA) ou sem sessão existente → no-op silencioso.

## Onde aplicar (3 pontos de entrada de mensagens humanas)

1. **`supabase/functions/uazapi-chat-webhook/index.ts`** — após o `insert` em `chat_messages` (linha ~1719), quando `fromMe===true && !internal_note`. Cobre:
   - Atendente enviando pelo WhatsApp Web/App diretamente
   - Eco da nossa UI de chat (que também volta como fromMe)
2. **`supabase/functions/waba-send/index.ts`** — após o envio bem-sucedido via Meta Graph (WABA não ecoa fromMe pelo webhook do mesmo jeito).
3. **`supabase/functions/meta-webhook/index.ts`** — eventos com `from_me=true` de outras integrações Meta.

Para evitar duplicação, extrair um helper compartilhado:

`supabase/functions/_shared/disableJuliaOnHumanSend.ts`
```ts
export async function disableJuliaOnHumanSend(params: {
  clientId: string;
  queueId: string;
  contactPhone: string;
}): Promise<void>
```
O helper chama `db-query` internamente (mantém o padrão da memória de não conectar TLS direto). Fire-and-forget via `EdgeRuntime.waitUntil` para não atrasar a resposta do webhook.

## Detalhes técnicos

- Reuso das actions já existentes em `db-query`:
  - `get_session_status` (linha 2225 do `db-query/index.ts`) — recebe `whatsappNumber` + `codAgent`, retorna `{id, active}`.
  - `update_session_status` (linha 2243) — recebe `sessionId` + `active`.
- Normalização do telefone com variantes BR (com/sem 9º dígito) já está dentro do `get_session_status`.
- Notas internas (`internal_note=true`) **não** disparam a desativação.
- Mensagens automáticas de bot/campanha que gravam `from_me=true` devem ser ignoradas — adicionar guarda via `metadata.source in ('bot','campaign','autoreply')` quando presente.
- Invalidação do cache no frontend (`useAgentSessionStatus`) já acontece via realtime do `chat_messages`; não precisa mudança no client.

## Critério de validação

1. Conversa com Julia ativa → atendente envia "oi" pelo chat UI → em <2s o badge muda de Bot verde para Bot vermelho ("Julia inativa, humano assumiu").
2. Mesma conversa → nota interna não desativa.
3. Mensagem automática da Julia (`from_me=true` mas gerada pela IA) não desativa a si mesma — validar pelo `metadata.source`.
4. Fila sem agente IA → sem erros nos logs.
