

# Criar Edge Function `3cplus-proxy`

## O que será feito

Criar o arquivo `supabase/functions/3cplus-proxy/index.ts` com o código fornecido e adicionar a configuração `verify_jwt = false` no `supabase/config.toml`.

## Arquivos

| Arquivo | Ação |
|---|---|
| `supabase/functions/3cplus-proxy/index.ts` | Criar com o código completo fornecido |
| `supabase/config.toml` | Adicionar bloco `[functions.3cplus-proxy]` com `verify_jwt = false` |

## Funcionalidades cobertas

- `get_sip_credentials` — login SIP via webphone 3C+
- `dial` — click-to-call
- `hangup` — desligar chamada
- `list_extensions` / `create_extension` / `delete_extension` / `sync_extensions` — CRUD de agentes
- `setup_webhook` — registrar webhook no 3C+
- `get_account` — info da conta
- `sync_call_history` — sincronização incremental de CDR

