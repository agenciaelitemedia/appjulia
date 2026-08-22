# Auditoria de acesso das tabelas `xj_*` (F4 etapa 5) — 22-ago-2026

## Contexto que limita o escopo

O produto tem autenticação própria (bcrypt no `db-query`, sem Supabase Auth). O
frontend fala com o Postgres do Supabase usando a **chave anon**, então em tempo
de execução o papel é sempre `anon` — `auth.uid()` é nulo. Escopo por
`client_id` em política RLS **não é aplicável** hoje; o isolamento continua na
aplicação (`resolveEffectiveClientId` + filtros por `client_id` nas queries).

Consequência: qualquer política que remova o acesso de `anon` derruba o painel.
Por isso a auditoria separou o que dá para fechar agora do que exige mover
leitura/escrita para Edge Function.

## Situação encontrada (27 políticas)

- 21 tabelas com uma única política `FOR ALL TO public USING (true) WITH CHECK (true)`.
- `xj_inbound_queue`: já restrita a `service_role` (criada na S2).
- `xj_usage_limits` / `xj_usage_counters`: políticas duplicadas (`public` + `authenticated`).
- `xj_client_provider_keys` e `xj_provider_settings`: RLS ligada **sem política**
  (bloqueadas na prática), mas com `GRANT ALL` para `anon`.
- Todas as tabelas com `GRANT ALL` (inclui `TRUNCATE`, `TRIGGER`, `REFERENCES`)
  para `anon` e `authenticated`.

## Correções aplicadas nesta migration

| Tabela | Ação |
|---|---|
| `xj_client_provider_keys`, `xj_provider_settings` | `REVOKE ALL` de `anon`/`authenticated`; só `service_role` |
| `xj_inbound_queue` | grants alinhados à política: só `service_role` |
| `xj_usage_limits`, `xj_usage_counters` | políticas duplicadas removidas; acesso só `service_role` (painel lê via `x-julia-admin`) |
| demais `xj_*` | `REVOKE TRUNCATE, TRIGGER, REFERENCES` de `anon`/`authenticated`; `GRANT ALL` para `service_role` |

Nenhuma leitura/escrita usada pelo painel foi removida — `SELECT/INSERT/UPDATE/DELETE`
seguem disponíveis nas tabelas que o frontend acessa direto.

## Risco residual (aceito, com caminho de saída)

`anon` ainda lê e escreve nas 21 tabelas de negócio (`xj_sessions`,
`xj_deals`, `xj_contracts`, …), o que inclui dados pessoais de leads. Fechar isso
exige, por tabela:

1. mover as leituras do frontend para uma Edge Function com `requireAppIdentity`
   (a guarda já existe em `_shared/x-julia/guard.ts` e já resolve `client_id` no
   servidor);
2. mover as escritas para a mesma função, validando `client_id` e permissão de
   módulo;
3. só então `REVOKE ALL ... FROM anon` e trocar a política por `TO service_role`.

Ordem sugerida por sensibilidade: `xj_contracts` → `xj_sessions` /
`xj_session_events` → `xj_deals` / `xj_deal_history` → `xj_appointments` →
restantes de configuração (`xj_agents`, cadências, gatilhos).

## Webhooks (F4 etapa 4)

- `uazapi-chat-webhook`: token por fila (`queues.webhook_token`), aceito em `?t=`
  ou `x-webhook-token`. Fila sem token continua aberta (compatibilidade); com
  token, chamada sem/errado token responde 401.
- `meta-webhook`: valida `x-hub-signature-256` (HMAC-SHA256 com `META_APP_SECRET`),
  comparação em tempo constante. Bloqueio somente com
  `META_WEBHOOK_ENFORCE_SIGNATURE=true`; sem a flag, a falha é registrada e o
  processamento segue.
- Toda recusa (e o modo "apenas registro") é gravada em `public.webhook_rejections`
  com origem, motivo, fila, IP e caminho.

### Como ligar o bloqueio

1. Definir `queues.webhook_token` da fila e atualizar a URL do webhook no
   provedor para `...?queue_id=<id>&t=<token>`.
2. Depois de confirmar que `webhook_rejections` não registra `assinatura_invalida`
   para a Meta, criar o segredo `META_WEBHOOK_ENFORCE_SIGNATURE=true`.
