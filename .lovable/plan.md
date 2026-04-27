# Migrar configuração de embeds para o Supabase com HMAC

## Objetivo

Mover a configuração técnica dos embeds (URL, secret, sandbox, variáveis) para o Supabase, com geração de tickets assinados HMAC-SHA256 do lado do servidor. O registro do módulo no menu (`modules`) e as permissões continuam no banco externo, então sidebar e access control não mudam.

## 1. Schema Supabase

Tabela `public.module_embeds`:

| coluna | tipo | nota |
|---|---|---|
| `id` | uuid PK | |
| `code` | text unique | bate com `modules.code` no externo |
| `url_template` | text | suporta `{{userId}}`, `{{clientId}}`, `{{codAgent}}`, `{{role}}`, `{{email}}`, `{{name}}`, `{{timestamp}}`, `{{ticket}}`, `{{signature}}` |
| `auth_mode` | text check (`simple`,`signed`) | |
| `hmac_secret` | text nullable | guardado server-side, nunca retornado |
| `hmac_ttl_seconds` | int default 300 | |
| `iframe_sandbox` | text | |
| `iframe_referrer_policy` | text | |
| `open_in_new_tab` | bool | |
| `allowed_origins` | text[] | reservado p/ postMessage |
| `variables` | jsonb default `'{}'` | extras que viram `{{key}}` |
| `is_active` | bool default true | |
| `created_at`/`updated_at` | timestamptz | |

RLS ON. Policies:
- SELECT/INSERT/UPDATE/DELETE só p/ admin (verificado dentro da edge via service role; tabela fica fechada para `anon`/`authenticated` direto).

## 2. Edge function `embed-config`

Actions (POST com `{ action, ... }`):

- `list` — retorna todos os embeds **sem** `hmac_secret`, com `has_secret: boolean`.
- `upsert` — cria/atualiza. Se `hmac_secret` vier no body, grava; senão preserva o existente.
- `delete` — remove pelo id.
- `resolve` — gera URL final pro iframe:
  1. Busca embed por `code` no Supabase.
  2. Chama o banco externo (mesmo padrão do `db-query`) pra pegar `clientId`, `codAgent`, `role`, `email`, `name` do `userId` autenticado.
  3. Verifica permissão do usuário no módulo correspondente.
  4. Substitui variáveis no `url_template`.
  5. Se `auth_mode = 'signed'`:
     - Monta payload `{ userId, clientId, codAgent, role, email, iat, exp, nonce }`.
     - `signature = HMAC_SHA256(hmac_secret, base64url(payload))` via Web Crypto.
     - Disponibiliza `{{ticket}}` (payload base64url) e `{{signature}}` (hex).
  6. Retorna `{ url, open_in_new_tab, iframe_sandbox, iframe_referrer_policy, name }`.

Auth: valida JWT no início (`SUPABASE_JWKS`), exige usuário autenticado em todas as actions; `list/upsert/delete` exigem role admin.

CORS: usa `corsHeaders` do `@supabase/supabase-js/cors`.

## 3. Frontend

- Novo `src/lib/embedConfig.ts` com wrapper `supabase.functions.invoke('embed-config', { body: {...} })`.
- `EmbedManagerPage.tsx`: trocar chamadas `externalDb.listModuleEmbeds / upsert / delete` por `embedConfig.*`. Remover botão "Inicializar sistema" (não precisa mais — tabela já existe via migration).
- `EmbedPage.tsx`: trocar `externalDb.resolveModuleEmbed` por `embedConfig.resolve`.
- `useMenuModules` continua usando o registro em `modules` no externo (sem alteração) — só os embeds com `code` correspondente em `module_embeds` ficam funcionais.
- Limpar de `src/lib/externalDb.ts` e do `db-query` as actions: `init_embed_system`, `list_module_embeds`, `upsert_module_embed`, `delete_module_embed`, `resolve_module_embed`.

## 4. Documentação para sistemas externos

Adicionar seção no dialog "Editar embed" (modo signed) explicando:

```text
ticket    = base64url(JSON{ userId, clientId, codAgent, role, email, iat, exp, nonce })
signature = HMAC_SHA256(secret, ticket)  // hex

Validação no sistema externo:
1. recompute HMAC_SHA256(secret, ticket) e comparar com signature
2. JSON.parse(base64urlDecode(ticket)) e checar exp > now()
3. opcional: cache de nonce por TTL para impedir replay
```

## Arquivos

- `supabase/migrations/<ts>_module_embeds.sql` (novo)
- `supabase/functions/embed-config/index.ts` (novo)
- `supabase/functions/db-query/index.ts` (remover actions de embed)
- `src/lib/embedConfig.ts` (novo)
- `src/lib/externalDb.ts` (remover métodos de embed)
- `src/pages/admin/embeds/EmbedManagerPage.tsx` (refatorar)
- `src/pages/embed/EmbedPage.tsx` (refatorar)

## Notas de segurança

- `hmac_secret` só sai do servidor uma única vez no momento da geração (já é o comportamento atual no UI). A tabela tem RLS bloqueando leitura pelo cliente.
- Edge function valida JWT em toda action.
- `resolve` checa permissão no externo antes de assinar — sem permissão, retorna 403 sem expor URL.
