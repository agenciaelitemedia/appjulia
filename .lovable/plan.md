# Kit de Migração do Banco → Supabase Externo

Objetivo: gerar um pacote completo (SQL + dados + instruções) para recriar este banco em outro projeto Supabase.

## Sobre a tabela `uazapi_history_items` (resposta direta)

Ela **deve permanecer** — é a fila de trabalho do backfill de histórico da UaZapi, usada por `uazapi-history-dispatcher/processor/resume`, `uazapi-chat-webhook`, `chat-reset` e pelo painel de execuções em Configurações. Só a **estrutura** é necessária; o conteúdo é descartável:

- 261.002 linhas / 2.290 MB (só payloads já processados: 200.158 `skipped`, 58.362 `ok`, 2.482 `error`).
- Na migração: recriar a tabela vazia (economiza ~2,3 GB) e, no banco atual, opcionalmente adicionar limpeza periódica de itens processados com mais de 30 dias.
- `uazapi_history_runs` (5 MB) é pequena e pode ir com dados.

## Estado atual levantado

- 237 tabelas no schema `public`, ~11,2 GB no total; 127 funções, 117 triggers, 262 policies, 677 índices, 4 materialized views, 0 enums em `public`.
- Extensões: `plpgsql`, `pg_stat_statements`, `uuid-ossp`, `pgcrypto`, `supabase_vault`, `pg_trgm`, `pg_cron`, `pg_net`.
- Buckets: `avatars` (público), `chat-media` (público), `creatives` (público, 50 MB), `ticket-media` (privado), `wavoip-recordings` (privado), `database_export_03_09_26` (privado).
- Maiores tabelas: `chat_messages` 5,4 GB · `uazapi_history_items` 2,3 GB · `chat_dropped_messages` 319 MB · `chat_contacts` 164 MB · `chat_conversations` 81 MB.

## O que será gerado (em `/mnt/documents/migracao-supabase/`)

Scripts numerados, na ordem exata de execução:

```text
00_LEIA-ME.md              passo a passo da migração
01_extensions.sql          create extension if not exists (...)
02_schema_tables.sql       CREATE TABLE de todas as 237 tabelas (tipos, defaults, NOT NULL)
03_sequences.sql           sequences e valores atuais (setval)
04_functions.sql           127 funções (pg_get_functiondef, ordem de dependência)
05_constraints_fk.sql      PK, UNIQUE, CHECK e FOREIGN KEYs (depois dos dados)
06_indexes.sql             677 índices (inclui GIN/pg_trgm)
07_triggers.sql            117 triggers
08_matviews.sql            4 materialized views + refresh
09_grants_rls.sql          GRANTs por tabela + ENABLE RLS + 262 policies
10_storage_buckets.sql     criação dos 6 buckets + policies de storage.objects
11_cron_jobs.sql           agendamentos pg_cron (extraídos do repositório de migrations)
12_import_dados.sql        COPY ... FROM de todos os CSVs, na ordem correta
```

Todo o DDL é gerado por introspecção do banco vivo (não por replay das 369 migrations), garantindo que o resultado é o estado real de hoje.

## Dados

Exportação em CSV por tabela para `/mnt/documents/migracao-supabase/dados/` via `COPY (...) TO STDOUT WITH CSV HEADER`, tabelas grandes fatiadas em partes de ~200 MB (`chat_messages` em lotes por data).

Recorte proposto (ajustável):

| Tabela | Estratégia |
| --- | --- |
| `uazapi_history_items` | só estrutura (vazia) |
| `chat_dropped_messages`, `webhook_logs`, `webhook_queue`, `user_presence_heartbeats*`, `ai_usage_logs`, `chat_legacy_cache` | só estrutura (logs/efêmeros) |
| `chat_messages` | dados completos (5,4 GB) — pode ser reduzido a N meses se preferir |
| Demais 220+ tabelas | dados completos |

Com esse recorte o volume cai de ~11,2 GB para ~8,5 GB (ou ~2 GB se `chat_messages` for limitada a 6 meses).

## Ordem de execução no destino

1. `01` extensões → `02` tabelas → `03` sequences → `04` funções.
2. Importar CSVs (`12_import_dados.sql`) **antes** das FKs e índices — muito mais rápido.
3. `05` constraints/FK → `06` índices → `07` triggers → `08` matviews.
4. `09` grants/RLS/policies → `10` buckets → `11` cron.
5. Rodar script de verificação: contagem de linhas por tabela comparando origem × destino.

## Arquivos e imagens (Storage)

O `00_LEIA-ME.md` incluirá:
- Recriação dos 6 buckets com visibilidade e limites idênticos, e as policies de `storage.objects`.
- Script Node/Bash que lista objetos de cada bucket na origem (API Storage com service role) e faz download → upload no destino preservando o caminho (importante: URLs gravadas em `chat_messages.media_url`, `ticket_*`, `wavoip_call_logs` etc. usam esse caminho).
- Script SQL opcional de reescrita de URLs se o `project ref` do destino mudar.

## Boas práticas incluídas no LEIA-ME

- Executar em janela de baixo movimento; congelar webhooks (UaZapi/Meta) durante o corte.
- Rodar cada script no SQL Editor do destino, um por vez, conferindo erros.
- Migrar secrets e as ~141 Edge Functions depois do banco; reapontar `VITE_SUPABASE_*` e as URLs de webhook por último.
- Validação final: contagem de linhas, teste de login, envio/recebimento de mensagem, CRM e chamadas.

## Detalhes técnicos

- Geração via scripts Python/psql de introspecção (`pg_get_functiondef`, `pg_indexes`, `pg_policies`, `information_schema`); `pg_dump` não é usado.
- Grants explícitos por tabela (`anon`/`authenticated`/`service_role`) conforme o que existe hoje, para não quebrar PostgREST no destino.
- Objetos dos schemas gerenciados (`auth`, `storage`, `realtime`, `vault`) não são recriados — apenas policies de `storage.objects`.
- Este projeto não usa Supabase Auth (auth própria em Postgres externo), então não há usuários de `auth.users` a migrar.
