# Plano de Migração — Lovable Cloud → Supabase Externo

> Versão: 2026-09-04  
> Escopo: banco de dados Supabase (schema `public`), Edge Functions, Storage, Secrets e URLs de integração.  
> Objetivo: cópia fiel do ambiente com janela de parada ≤ 2h.

---

## 1. Visão geral

| Dimensão | Valor atual |
| --- | --- |
| Tabelas `public` | 237 |
| Tamanho total | ~11,2 GB |
| Funções | 127 |
| Triggers | 117 |
| Policies | 262 |
| Índices | 677 |
| Materialized views | 4 |
| Enums em `public` | 0 |
| Edge Functions | ~141 |
| Buckets Storage | 6 |
| Secrets | 23 |

Extensões usadas: `plpgsql`, `pg_stat_statements`, `uuid-ossp`, `pgcrypto`, `supabase_vault`, `pg_trgm`, `pg_cron`, `pg_net`.

O projeto **não usa Supabase Auth** (autenticação própria via `db-query` em Postgres externo), portanto não há `auth.users` a migrar.

---

## 2. Decisões importantes

### 2.1 `uazapi_history_items` deve permanecer, mas vazia

- É a fila de trabalho do backfill de histórico da UaZapi, usada por `uazapi-history-dispatcher`, `uazapi-history-processor`, `uazapi-history-resume`, `uazapi-chat-webhook` e `chat-reset`.
- Hoje: 261.002 linhas / 2.290 MB (200.158 `skipped`, 58.362 `ok`, 2.482 `error`).
- Na migração: recriar a tabela **vazia** (economiza ~2,3 GB e ~25 min).
- `uazapi_history_runs` (5 MB) pode ir com dados.

### 2.2 Tabelas de log/efêmeras: só estrutura

- `chat_dropped_messages` (319 MB)
- `webhook_logs`
- `webhook_queue`
- `user_presence_heartbeats*` (partições mensais)
- `ai_usage_logs`
- `chat_legacy_cache`

Isso reduz o volume sem perder dados de negócio.

### 2.3 Dados grandes: cópia direta banco→banco

`chat_messages` (5,4 GB) e as demais tabelas médias devem ser transferidas com `pg_dump -Fc` / `pg_restore` ou `COPY` direto da sua máquina, não via HTTP/Edge Function. Isso é 5 a 10× mais rápido e confiável.

---

## 3. URLs de ENTRADA (webhooks que terceiros chamam)

Base atual: `https://zenizgyrwlonmufxnjqt.supabase.co/functions/v1/<função>`

| Origem | Função | Onde reapontar |
| --- | --- | --- |
| Meta / WhatsApp Cloud API | `meta-webhook` | Meta App → Webhooks (+ verify token) |
| UaZapi (por fila) | `uazapi-chat-webhook?queue_id=<id>&t=<token>` | Painel UaZapi de cada instância |
| Suporte (grupos WhatsApp) | `support-assistant-webhook` | UaZapi da instância de suporte |
| Wavoip / ZAP Call | `wavoip-call-webhook` | Painel Wavoip |
| api4com (SIP) | `api4com-webhook` | Painel api4com |
| 3C Plus | `threecplus-webhook` | Painel 3C Plus |
| Vellip (CDR campanha) | `vellip-webhook` | Painel Vellip |
| Mercado Pago | `mercadopago-webhook` | Painel MP (registro automático via código) |
| Asaas | `asaas-webhook` | Painel Asaas (`asaas-configure-webhook`) |
| InfinityPay | `infinitypay-webhook` | Painel InfinityPay |
| ZapSign | webhook de assinatura | Painel ZapSign |
| n8n (hub) | `n8n_execute-*` | Fluxos n8n |
| Crons internos | `x-julia-tick`, `contract-notifications-cron`, `internal-notification-scheduler`, `uazapi-history-dispatcher*`, `assigned-user-id-backfill-cron` | `pg_cron` do destino |

---

## 4. URLs de SAÍDA (o sistema chama)

| Categoria | Endpoints |
| --- | --- |
| WhatsApp/Meta | `graph.facebook.com` |
| UaZapi | base em `UAZAPI_BASE_URL` (secret) |
| Telefonia | `api.wavoip.com`, `devices.wavoip.com`, `storage.wavoip.com`, `app.3c.fluxoti.com`, `assessoria.3c.fluxoti.com`, api4com |
| IA | `ai.gateway.lovable.dev`, `openrouter.ai`, `generativelanguage.googleapis.com`, `api.openai.com`, `api.anthropic.com`, `api.x.ai`, `api.deepseek.com`, `api.llmapi.ai` |
| Voz | `api.elevenlabs.io`, `developer.voicemaker.in` |
| Contratos | `api.zapsign.com.br`, `app.zapsign.com.br` |
| Pagamentos | `api.mercadopago.com`, `api.asaas.com` / `sandbox.asaas.com`, `api.infinitepay.io` |
| Jurídico/dados | `api-publica.datajud.cnj.jus.br`, `brasilapi.com.br`, `receitaws.com.br`, Advbox, Tramitação Inteligente |
| Vídeo | `api.daily.co` |
| Infra própria | `webhook.atendejulia.com.br`, `mcp.atendejulia.com.br`, `acesso.atendejulia.com.br`, `appjulia.lovable.app` |
| Postgres legado | `EXTERNAL_DB_HOST` (não muda) |

---

## 5. URLs do Supabase que precisam ser trocadas no destino

1. `https://zenizgyrwlonmufxnjqt.supabase.co` → REST/Realtime/Functions.
2. `…/functions/v1/*` → todos os webhooks da seção 3.
3. `…/storage/v1/object/public/<bucket>/…` → URLs gravadas em `chat_messages.media_url`, avatares, mídias de ticket, gravações Wavoip, criativos.
4. `…/functions/v1/image-proxy`, `uazapi-proxy` → usados pelo frontend.
5. `mcp.atendejulia.com.br` (Cloudflare Worker) → aponta para `copiloto-mcp`/`copiloto-oauth`; atualizar `wrangler.toml`.

---

## 6. Tela `/migracao`

Rota protegida para administrador, com passo a passo e log ao vivo:

```text
1. Destino        URL + service_role key do destino (secret do backend)
2. Pré-checagem   conexão, versão do Postgres, extensões disponíveis
3. Estrutura      extensões → tabelas → sequences → funções
4. Dados          fila das 237 tabelas em paralelo (8 workers), lotes de 5k,
                  progresso por tabela, checkpoint retomável
5. Pós-estrutura  constraints/FK → índices → triggers → matviews
6. Segurança      GRANTs + ENABLE RLS + 262 policies
7. Storage        cria os 6 buckets e copia arquivos (8 workers, retomável)
8. Manual         nomes das 23 secrets + script de deploy das ~141 functions
9. Verificação    contagem de linhas origem × destino
10. Cutover       checklist das URLs de webhook
```

Backend: Edge Function `migracao-executar` (service role) com ações
`precheck | schema | data_chunk | postschema | security | storage_chunk | verify`,
estado em `migration_runs` / `migration_steps`.

---

## 7. Estratégias para janela ≤ 2h mantendo cópia fiel

1. **Pré-cópia (Fase A, sistema no ar):** estrutura + 95% dos dados históricos + arquivos + functions + secrets copiados antes, sem parada.
2. **Cópia direta banco→banco** para as 5 maiores tabelas (`pg_dump | pg_restore`).
3. **`uazapi_history_items` vazia** (−2,3 GB, −25 min).
4. **Tabelas de log só como estrutura** (−450 MB).
5. **Índices e FKs só depois dos dados** com `maintenance_work_mem` alto e `max_parallel_maintenance_workers`.
6. **Paralelismo** — `pg_dump -j` / `pg_restore -j 4..8` e 8 workers na tela.
7. **Delta por timestamp** na janela: só linhas com `created_at/updated_at > T0` das tabelas quentes.
8. **Compute do destino temporariamente maior** durante a carga.
9. **Matviews** criadas e `REFRESH` depois do cutover.
10. **Storage por último e incremental:** só objetos novos na janela.

---

## 8. Janela de parada — cronograma alvo

### Fase A — sem parada (1 dia antes)

- Estrutura completa no destino: ~10 min.
- Dados históricos (exceto delta): 60–90 min.
- Arquivos dos buckets: 30–90 min.
- Deploy das ~141 Edge Functions + cadastro das 23 secrets: ~40 min.

### Fase B — parada

| Passo | Tempo |
| --- | --- |
| Congelar webhooks e avisar equipe | 5 min |
| Delta das tabelas quentes | 10–20 min |
| FKs, índices, triggers, sequences (`setval`) | 20–35 min |
| RLS/policies + cron jobs | 10 min |
| Verificação (contagens + smoke test: login, mensagem, CRM, chamada) | 15–20 min |
| Reescrita de URLs de storage + `.env`/domínios + reativar webhooks | 15 min |
| **Total** | **1h15 – 1h45** |

Rollback: origem intacta; reverter `.env` e URLs de webhook (~10 min), válido enquanto não houver escrita nova no destino.

---

## 9. O que NÃO é automatizável pela tela

| Item | Por quê | Solução |
| --- | --- | --- |
| Valores das 23 secrets | Não legíveis por código na Lovable Cloud | A tela lista os nomes; você cola os valores no destino via `supabase secrets set` |
| Deploy das ~141 Edge Functions | Exige Personal Access Token + Supabase CLI | A tela gera o script `supabase functions deploy` pronto |

---

## 10. Segurança

- `service_role` do destino fica em secret do backend, usada só dentro da Edge Function; nunca no frontend nem em log.
- A tela não executa SQL digitado pelo usuário — só scripts gerados por introspecção.
- Valores das secrets atuais não são exibidos; só os nomes.
- Rota restrita a administrador e removível após a migração.

---

## 11. Detalhes técnicos

- DDL gerado por introspecção do banco vivo (`pg_get_functiondef`, `pg_indexes`, `pg_policies`, `information_schema`), refletindo o estado real — não replay das 369 migrations.
- Extensões no destino: `plpgsql`, `pg_stat_statements`, `uuid-ossp`, `pgcrypto`, `supabase_vault`, `pg_trgm`, `pg_cron`, `pg_net`.
- Buckets recriados com mesma visibilidade/limite:
  - Públicos: `avatars`, `chat-media`, `creatives` (limite 50 MB).
  - Privados: `ticket-media`, `wavoip-recordings`, `database_export_03_09_26`.
- Schemas gerenciados (`auth`, `storage`, `realtime`, `vault`) não são recriados; apenas policies de `storage.objects`.
- Novas tabelas de controle: `migration_runs`, `migration_steps`.

---

## 12. Próximos passos

1. Validar acesso ao projeto Supabase destino (URL + service_role key).
2. Confirmar se o destino já tem as extensões `pg_trgm`, `pg_cron`, `pg_net` habilitadas.
3. Decidir se `chat_messages` vai completa (5,4 GB) ou recortada por data.
4. Criar a Edge Function `migracao-executar` e a tela `/migracao`.
5. Testar a Fase A em um ambiente de staging antes do cutover real.
