# Levar o banco do Lovable para um Supabase próprio (cópia fiel)

Objetivo: reproduzir no seu Supabase tudo que existe hoje aqui — dados, views, materialized views, funções, triggers, políticas, storage, realtime, agendamentos e as Edge Functions — e depois virar o sistema para ele.

## O que existe hoje (medido agora)

| Item | Quantidade |
| --- | --- |
| Tabelas em `public` | 233 |
| Views | 5 |
| Materialized views | 4 |
| Funções | 131 |
| Tabelas com realtime ligado | 44 |
| Agendamentos (cron) | 31 |
| Buckets de arquivos | 6 |
| Edge Functions | 143 |
| Secrets | 23 |

Também já existe no projeto o material de apoio: `docs/Plano-Migracao-Supabase.md`, a tela `/painel-migracao` e a função `migracao-executar`.

## Ponto importante sobre acesso

A senha do banco e a chave de serviço **deste** projeto não são liberadas pela plataforma — nem para mim. Então a cópia não pode ser um `pg_dump` apontado para cá. O caminho é: a plataforma exporta o banco (Cloud → Configurações avançadas → Exportar dados), e o restante (estrutura fina, arquivos, funções, realtime) é reproduzido pelos passos abaixo, com a chave de serviço **do destino** — essa sim você fornece.

## Etapas

### 1. Preparar o destino
- Criar o projeto Supabase, escolher região próxima e aumentar o compute temporariamente durante a carga.
- Habilitar extensões: `pgcrypto`, `uuid-ossp`, `pg_trgm`, `pg_cron`, `pg_net`, `pg_stat_statements`, `supabase_vault`.

### 2. Estrutura (o que garante não perder nada)
Gerar, a partir do banco vivo, um único script de estrutura em blocos, nesta ordem:
1. Tabelas e sequences.
2. Funções e triggers.
3. **Views e materialized views** (as 5 + 4 — hoje o painel não cobre isso; será incluído).
4. Índices, constraints e chaves estrangeiras (aplicados **depois** dos dados).
5. Grants + RLS + políticas.
6. **Realtime**: `ALTER PUBLICATION supabase_realtime ADD TABLE …` para as 44 tabelas + `REPLICA IDENTITY FULL` onde já está assim.
7. **Agendamentos**: recriar os 31 jobs de `cron.job`, trocando as URLs de função para o domínio do destino.

### 3. Dados
- Tabelas de log/efêmeras vão **só com estrutura**: `chat_dropped_messages`, `webhook_logs`, `webhook_queue`, `user_presence_heartbeats*`, `ai_usage_logs`, `chat_legacy_cache`, `uazapi_history_items`.
- Restante com dados; as maiores (ex.: `chat_messages`) via arquivo de exportação, não por HTTP.
- Depois da carga: `setval` em todas as sequences e `REFRESH MATERIALIZED VIEW`.

### 4. Arquivos (Storage)
- Recriar os 6 buckets com a mesma visibilidade e limite (públicos: `avatars`, `chat-media`, `creatives`; privados: `ticket-media`, `wavoip-recordings`, `database_export_03_09_26`).
- Copiar objetos bucket a bucket e, por fim, reescrever no banco as URLs de arquivo que apontam para o domínio antigo.

### 5. Edge Functions
- As 143 funções já estão no repositório, com o `config.toml`. Deploy no destino via CLI (`supabase link` + `supabase functions deploy`), gerando o script pronto no painel.
- Recadastrar as 23 secrets manualmente (os valores não são legíveis por código).

### 6. Virada
- Reapontar os webhooks de terceiros (Meta, UaZapi por fila, Wavoip, api4com, 3C Plus, Vellip, Mercado Pago, Asaas, InfinityPay, ZapSign, n8n) para o novo domínio de funções.
- Trocar as variáveis do app (URL e chave pública) e o Worker do Cloudflare (`mcp.atendejulia.com.br`).
- Rodar delta das tabelas quentes por `created_at/updated_at`, checar contagens origem × destino e fazer teste de fumaça: login, envio de mensagem, CRM, ligação.

### 7. n8n (sua pergunta anterior)
O n8n grava no Postgres **externo legado**, que não faz parte desta migração e continua no lugar — nada muda nos fluxos. Só precisam ser ajustados os fluxos que chamam Edge Functions (`n8n_execute-*`), trocando a URL base.

## Ajustes de código previstos

- `supabase/functions/migracao-executar/index.ts`: incluir no gerador de estrutura os blocos de views, materialized views, publicação de realtime, `REPLICA IDENTITY` e jobs de cron; separar “índices/FKs depois dos dados”; adicionar ação de `setval` das sequences e de reescrita das URLs de storage.
- `src/pages/.../painel-migracao`: novos passos “Views & Realtime”, “Cron”, “Sequences” e “Reescrever URLs”, além do gerador do script de deploy das funções e da lista de secrets.
- `docs/Plano-Migracao-Supabase.md`: atualizar números (233 tabelas, 5 views, 44 tabelas em realtime, 31 crons, 143 funções) e incluir as etapas novas.

## Janela estimada

Fase A sem parada (estrutura + histórico + arquivos + deploy das funções): 2–4 h.
Fase B com parada (delta, índices/FKs, realtime, cron, verificação, virada de URLs): 1 h 15 – 1 h 45.
Rollback: origem intacta; basta reverter as variáveis e os webhooks.
