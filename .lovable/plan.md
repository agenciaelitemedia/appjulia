

# Webhook Endpoint para Receber Mensagens WABA

## Problema atual

A edge function `meta-webhook` existente é apenas para testes -- usa armazenamento in-memory e não encaminha mensagens para o N8N (que processa a lógica do agente).

## Solução

Reescrever `meta-webhook` para ser o webhook de produção: ao receber mensagens da Meta, identificar o agente pelo `phone_number_id`, buscar o `cod_agent` no banco externo, e encaminhar para o N8N via `N8N_HUB_SEND_URL`.

## Fluxo

```text
Meta Cloud API → POST /meta-webhook
  1. Verificação GET (hub.verify_token) ✓ já existe
  2. POST com mensagem:
     a. Extrair phone_number_id do payload (metadata.phone_number_id)
     b. Buscar agente no DB externo: SELECT cod_agent, waba_token FROM agents WHERE waba_number_id = $1
     c. Encaminhar para N8N_HUB_SEND_URL com payload normalizado
     d. Retornar 200 OK (Meta exige resposta rápida)
```

## Arquivo alterado

| Arquivo | Ação |
|---|---|
| `supabase/functions/meta-webhook/index.ts` | Reescrever: adicionar conexão DB externo, lookup do agente por `waba_number_id`, forward para N8N. Manter verificação GET e logs de teste. |
| `supabase/config.toml` | Adicionar `[functions.meta-webhook]` com `verify_jwt = false` (webhook público da Meta) |

## Detalhes técnicos

- Usa mesmo padrão de conexão PostgreSQL do `waba-admin` (com normalização SSL CA cert)
- Payload encaminhado ao N8N inclui: `cod_agent`, `from` (número remetente), `message` (texto/tipo), `timestamp`, `raw_payload`
- Verify token vem de env var `META_WEBHOOK_VERIFY_TOKEN` (fallback para o hardcoded atual)
- Sempre retorna 200 para a Meta (mesmo em erro interno) para evitar retry loops
- Mantém logs in-memory para debug via `get_logs`

