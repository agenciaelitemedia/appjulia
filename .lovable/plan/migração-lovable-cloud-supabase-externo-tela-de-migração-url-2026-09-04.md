# Migração Lovable Cloud → Supabase Externo: tela de migração, URLs e janela ≤ 2h

## Resposta direta

**Sim, dá para fechar tudo em até 2h de parada** — mas só com a estratégia de *pré-cópia + delta* (Fase A no ar, Fase B curta) e com a cópia dos dados grandes feita **direto banco→banco** (`pg_dump | psql` pela sua máquina), não por HTTP. Se tudo for feito de uma vez, dentro da janela, são 5 a 8 horas. O resultado é **cópia fiel**: mesmo DDL, mesmos dados, mesmas policies, índices, triggers, sequences e arquivos.

Duas coisas **não** são automatizáveis por dentro do app: os **valores das secrets** (não são legíveis por código na Lovable Cloud — a tela lista os 23 nomes e você cola os valores no destino) e o **deploy das ~141 Edge Functions** (exige Personal Access Token + Supabase CLI; a tela gera o script pronto).

## URLs de ENTRADA de dados (webhooks que terceiros chamam)

Base atual: `https://zenizgyrwlonmufxnjqt.supabase.co/functions/v1/<função>`

| Origem | Função (endpoint) | Onde reapontar |
| --- | --- | --- |
| Meta / WhatsApp Cloud API | `meta-webhook` | Meta App → Webhooks (+ verify token) |
| UaZapi (por fila) | `uazapi-chat-webhook?queue_id=<id>&t=<token>` | Painel UaZapi de cada instância |
| Suporte (grupos WhatsApp) | `support-assistant-webhook` | UaZapi da instância de suporte |
| Wavoip / ZAP Call | `wavoip-call-webhook` | Painel Wavoip |
| api4com (SIP) | `api4com-webhook` | Painel api4com |
| 3C Plus | `threecplus-webhook` | Painel 3C Plus |
| Vellip (CDR de campanha) | `vellip-webhook` | Painel Vellip |
| Mercado Pago | `mercadopago-webhook` | Painel MP (registro automático via código) |
| Asaas | `asaas-webhook` (registro por `asaas-configure-webhook`) | Painel Asaas |
| InfinityPay | `infinitypay-webhook` | Painel InfinityPay |
| ZapSign | webhook de assinatura | Painel ZapSign |
| n8n (hub) | `n8n_execute-*` | Fluxos n8n |
| Crons internos | `x-julia-tick`, `contract-notifications-cron`, `internal-notification-scheduler`, `uazapi-history-dispatcher*`, `assigned-user-id-backfill-cron` | pg_cron do destino |

## URLs de SAÍDA (o sistema chama)

- **WhatsApp/Meta:** `graph.facebook.com`
- **UaZapi:** base em secret `UAZAPI_BASE_URL`
- **Telefonia:** `api.wavoip.com`, `devices.wavoip.com`, `storage.wavoip.com`, `app.3c.fluxoti.com`, `assessoria.3c.fluxoti.com`, api4com
- **IA:** `ai.gateway.lovable.dev`, `openrouter.ai`, `generativelanguage.googleapis.com`, `api.openai.com`, `api.anthropic.com`, `api.x.ai`, `api.deepseek.com`, `api.llmapi.ai`
- **Voz:** `api.elevenlabs.io`, `developer.voicemaker.in`
- **Contratos:** `api.zapsign.com.br`, `app.zapsign.com.br`
- **Pagamentos:** `api.mercadopago.com`, `api.asaas.com` / `sandbox.asaas.com`, `api.infinitepay.io`
- **Jurídico/dados:** `api-publica.datajud.cnj.jus.br`, `brasilapi.com.br`, `receitaws.com.br`, Advbox, Tramitação Inteligente
- **Vídeo:** `api.daily.co`
- **Infra própria:** `webhook.atendejulia.com.br`, `mcp.atendejulia.com.br`, `acesso.atendejulia.com.br`, `appjulia.lovable.app`
- **Postgres legado externo:** host em `EXTERNAL_DB_HOST` (não muda na migração)

## URLs do Supabase usadas como externas (precisam ser trocadas)

1. `https://zenizgyrwlonmufxnjqt.supabase.co` → REST/Realtime/Functions (`.env`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PROJECT_ID`, `VITE_SUPABASE_PUBLISHABLE_KEY`).
2. `…/functions/v1/*` → todos os webhooks da tabela acima.
3. `…/storage/v1/object/public/<bucket>/…` → **URLs gravadas em dados**: `chat_messages` (mídia), avatares, mídias de ticket, gravações Wavoip, criativos de disparo. Exige script de reescrita das URLs no destino.
4. `…/functions/v1/image-proxy`, `uazapi-proxy` → usados pelo frontend.
5. `mcp.atendejulia.com.br` (Cloudflare Worker) aponta para `copiloto-mcp`/`copiloto-oauth` → atualizar `wrangler.toml`.

## Tela `/migracao`

Rota protegida (admin), passo a passo com log ao vivo e retomada:

```text
1. Destino        URL + service_role key do destino (guardadas como secret do backend)
2. Pré-checagem   conexão, versão do Postgres, extensões disponíveis
3. Estrutura      extensões → tabelas → sequences → funções
4. Dados          fila das 237 tabelas em paralelo (8 workers), lotes de 5k linhas,
                  progresso por tabela, checkpoint retomável
5. Pós-estrutura  constraints/FK → índices (CONCURRENTLY off) → triggers → matviews
6. Segurança      GRANTs + ENABLE RLS + 262 policies
7. Storage        cria os 6 buckets e copia arquivos (8 workers, retomável)
8. Manual         nomes das 23 secrets + script de deploy das 141 functions
9. Verificação    contagem de linhas e checksum por tabela: origem × destino
10. Cutover       checklist das URLs de webhook acima, marcando uma a uma
```

Backend: Edge Function `migracao-executar` (service role) com ações
`precheck | schema | data_chunk | postschema | security | storage_chunk | verify`,
estado em `migration_runs` / `migration_steps` (só `service_role`).

## Estratégias para caber em ≤ 2h (mantendo cópia fiel)

1. **Pré-cópia (Fase A, sistema no ar):** estrutura + 95% dos dados históricos + arquivos + functions + secrets copiados antes, sem parada.
2. **Cópia direta banco→banco** para as 5 maiores tabelas: `pg_dump -Fc -t chat_messages … | pg_restore` — ~5–10× mais rápido que HTTP.
3. **`uazapi_history_items` vazia** (a tabela fica, os 261k registros já processados não): −2,3 GB, −25 min.
4. **Tabelas de log só como estrutura:** `chat_dropped_messages` (319 MB), `webhook_logs`, `webhook_queue`, `user_presence_heartbeats*`, `ai_usage_logs`, `chat_legacy_cache`: −450 MB.
5. **Índices e FKs só depois dos dados** (`maintenance_work_mem` alto, `max_parallel_maintenance_workers`): reduz a criação dos 677 índices de ~50 para ~20 min.
6. **Paralelismo:** `pg_dump -j` / `pg_restore -j 4..8` e 8 workers na tela.
7. **Delta por timestamp** na janela: só linhas com `created_at/updated_at > T0` das tabelas quentes (chat, CRM, tickets, presença).
8. **Compute do destino temporariamente maior** (mais CPU/IO) durante a carga, reduzido depois.
9. **Matviews:** criar e dar `REFRESH` depois do cutover (fora da janela).
10. **Storage por último e incremental:** só objetos novos na janela.

## Janela de parada — cronograma alvo

**Fase A (sem parada, 1 dia antes):** estrutura 10 min · dados históricos 60–90 min · arquivos 30–90 min · deploy das functions + secrets 40 min.

| Fase B (parada) | Tempo |
| --- | --- |
| Congelar webhooks e avisar equipe | 5 min |
| Delta das tabelas quentes | 10–20 min |
| FKs, índices, triggers, sequences (`setval`) | 20–35 min |
| RLS/policies + cron jobs | 10 min |
| Verificação de contagens + smoke test (login, mensagem, CRM, chamada) | 15–20 min |
| Reescrita das URLs de storage + `.env`/domínios + reativar webhooks | 15 min |
| **Total** | **1h15 – 1h45** |

Rollback: origem intacta; basta reverter `.env` e as URLs de webhook (~10 min), válido enquanto não houver escrita nova no destino.

## Segurança

- `service_role` do destino fica em secret do backend, usada só dentro da Edge Function; nunca no frontend nem em log.
- A tela não executa SQL digitado pelo usuário — só os scripts gerados por introspecção.
- Valores das secrets atuais não são exibidos (não são acessíveis); só os nomes.
- Rota restrita a administrador e removível após a migração.

## Detalhes técnicos

- DDL por introspecção do banco vivo (`pg_get_functiondef`, `pg_indexes`, `pg_policies`, `information_schema`) — reflete o estado real, não o replay das 369 migrations.
- Extensões no destino: `plpgsql`, `pg_stat_statements`, `uuid-ossp`, `pgcrypto`, `supabase_vault`, `pg_trgm`, `pg_cron`, `pg_net`.
- Buckets recriados com a mesma visibilidade/limite: `avatars`, `chat-media`, `creatives` (50 MB) públicos; `ticket-media`, `wavoip-recordings`, `database_export_03_09_26` privados. Caminhos preservados.
- Schemas gerenciados (`auth`, `storage`, `realtime`, `vault`) não são recriados; só policies de `storage.objects`. O projeto não usa Supabase Auth, logo não há `auth.users` a migrar.
- Novas tabelas de controle: `migration_runs`, `migration_steps`.
