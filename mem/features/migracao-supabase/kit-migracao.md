---
name: Kit de Migração Lovable Cloud → Supabase Externo
description: Plano, scripts, tela e função para migrar todo o banco, Edge Functions, Storage, Secrets e URLs de integração para um novo Supabase com janela ≤ 2h.
type: reference
---

# Kit de Migração Lovable Cloud → Supabase Externo

Documento principal: `docs/Plano-Migracao-Supabase.md`.

Tela de execução: `/migracao` (admin, rota protegida).
Edge Function: `migracao-executar`.
Tabelas de controle: `migration_runs`, `migration_steps`.

## Pontos-chave

- Banco: 237 tabelas, ~11,2 GB, 127 funções, 117 triggers, 262 policies, 677 índices, 4 matviews.
- Extensões: `plpgsql`, `pg_stat_statements`, `uuid-ossp`, `pgcrypto`, `supabase_vault`, `pg_trgm`, `pg_cron`, `pg_net`.
- `uazapi_history_items` deve permanecer no schema, mas vazia na migração (261.002 linhas descartáveis).
- Tabelas de log só com estrutura: `chat_dropped_messages`, `webhook_logs`, `webhook_queue`, `user_presence_heartbeats*`, `ai_usage_logs`, `chat_legacy_cache`.
- Dados grandes: `pg_dump -Fc | pg_restore` da sua máquina, não via HTTP.
- 23 secrets e ~141 Edge Functions precisam ser recriados manualmente no destino (não legíveis/instaláveis por código).
- Janela alvo: 1h15–1h45 com pré-cópia (Fase A) + cutover curto (Fase B).
- URLs de entrada (webhooks) e URLs de saída estão catalogadas em `docs/Plano-Migracao-Supabase.md`.
- O projeto não usa Supabase Auth; não há `auth.users` a migrar.
