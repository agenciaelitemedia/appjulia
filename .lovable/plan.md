

# Deploy Edge Functions 3cplus-proxy e 3cplus-webhook

## O que será feito

Deploy das duas edge functions já existentes no projeto:

1. **3cplus-proxy** (`supabase/functions/3cplus-proxy/index.ts`) — 574 linhas, proxy para API 3C+ (dial, hangup, sync, etc.)
2. **3cplus-webhook** (`supabase/functions/3cplus-webhook/index.ts`) — 126 linhas, receptor de webhooks de chamadas 3C+

## Execução

Ambas já estão configuradas em `supabase/config.toml` com `verify_jwt = false`. Basta executar o deploy usando a ferramenta de deploy de edge functions para cada uma.

Nenhuma alteração de código é necessária — apenas deploy.

