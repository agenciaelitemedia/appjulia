---
name: n8n Execute Group
description: Grupo de Edge Functions migradas do n8n; convenções e catálogo das funções
type: feature
---

Funções migradas do n8n para Edge Functions do projeto. Cada função vive em
`supabase/functions/n8n_execute-<nome>/` (pasta direta, exigência do Supabase CLI).
Doc mestre: `supabase/functions/n8n_execute/README.md`.

## Convenções

- Nome: `n8n_execute-<nome-kebab>`.
- Entrada: `POST` JSON.
- Resposta padrão: `{ data, error }` (mesmo envelope do `db-query`).
- Acesso ao Postgres externo **exclusivamente** via `db-query` (action dedicada
  por função) — nunca conexão direta. Ver `mem://technical/edge-functions/external-db-connection-logic`.
- Normalização BR de telefones: `supabase/functions/_shared/phone-normalize.ts`
  (`brPhoneVariants` para variantes 13/12 díg; `toBrCanonicalByDDD` para o
  formato "real" conforme regra do DDD — DDD < 30 → 13 díg, DDD ≥ 30 → 12 díg).
- `codAgent`, `session_id` como `bigint` no SQL (`mem://technical/database/bigint-casting`).
- Operações multi-tabela: envolver em `sql.begin` para atomicidade.

## Funções

- [Followup Stop](mem://features/n8n-execute/followup-stop) — para follow-ups ativos e limpa o pré-followup.
- [Agent & Followup Reactive](mem://features/n8n-execute/agent-and-followup-reactive) — reativa a sessão da Julia e reagenda o pré-followup.