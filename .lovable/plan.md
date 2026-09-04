# Migração Lovable Cloud → Supabase Externo: viabilidade, tela de migração e janela de parada

## Resposta direta ao que foi pedido

| Item pedido | Automatizável por uma tela dentro do app? |
| --- | --- |
| Criar as 237 tabelas, 127 funções, 117 triggers, 262 policies, 677 índices, 4 matviews, extensões | **Sim** — SQL gerado por introspecção e executado no destino |
| Criar os 6 buckets + policies de storage | **Sim** |
| Copiar os arquivos dos buckets | **Sim**, em lotes (leva tempo, roda em background) |
| Copiar os ~11,2 GB de dados das tabelas | **Parcialmente** — tabelas pequenas/médias sim; `chat_messages` (5,4 GB) e `uazapi_history_items` (2,3 GB) via tela é lento e frágil. Melhor caminho: cópia direta banco→banco pela sua máquina (`pg_dump \| psql`) |
| Migrar as secrets **com os valores** | **Não** — na Lovable Cloud os valores das secrets não são legíveis por código nem por mim. A tela lista os 23 nomes e você cola cada valor no destino (ou usa `supabase secrets set` com os valores que você tem) |
| Migrar as ~141 Edge Functions | **Não** por dentro do app — deploy exige um Personal Access Token do Supabase e a CLI. A tela gera o script `supabase functions deploy` pronto, você executa no terminal |

Sobre `uazapi_history_items`: a tabela **precisa continuar existindo** (é a fila do backfill de histórico da UaZapi), mas os 261 mil registros já processados (200.158 `skipped`, 58.362 `ok`, 2.482 `error`) são descartáveis — migrar vazia poupa 2,3 GB e ~25 min de janela.

## Tela `/migracao` (o que vou construir)

Rota protegida (admin, mesmo padrão do painel atual), com um passo a passo em etapas e log ao vivo:

```text
1. Destino          URL do projeto destino + service_role key do destino
                    (gravadas como secrets do backend, nunca no bundle)
2. Pré-checagem     testa conexão, versão do Postgres, extensões disponíveis
3. Estrutura        extensões → tabelas → sequences → funções
4. Dados            fila de 237 tabelas, ordem por dependência, lotes de 5k linhas,
                    barra de progresso por tabela, retomável (checkpoint por tabela)
5. Pós-estrutura    constraints/FK → índices → triggers → matviews
6. Segurança        GRANTs + ENABLE RLS + 262 policies
7. Storage          cria buckets e copia arquivos objeto a objeto (retomável)
8. Manual           secrets (nomes + campo para colar valor) e script de deploy
                    das Edge Functions para rodar no terminal
9. Verificação      contagem de linhas origem × destino, tabela por tabela
```

Backend: uma Edge Function `migracao-executar` (service role) com ações
`precheck | schema | data_chunk | postschema | security | storage_chunk | verify`,
gravando estado em `migration_runs` / `migration_steps` para permitir pausar e retomar.
A tela chama a função em loop, mostrando progresso.

## Viabilidade honesta dos 11,2 GB pela tela

A cópia via Edge Function passa por HTTP e tem limite de tempo por chamada.
Em lotes de 5k linhas dá cerca de **1,5 a 3 GB/hora** → 4 a 7 horas só para dados.
O caminho recomendado é híbrido:

- **Estrutura, segurança, storage, verificação e retomada:** pela tela.
- **Dados das 5 tabelas gigantes** (`chat_messages`, `chat_dropped_messages`, `chat_contacts`, `chat_conversations`, `chat_conversation_history`): comando único da sua máquina, direto banco→banco. Isso derruba as horas de cópia para **~40–70 minutos**.

## Plano de janela de parada (downtime)

Estratégia em duas fases, para parar o sistema o mínimo possível.

**Fase A — com o sistema no ar (sem parada, 1 dia antes):**
- Criar estrutura completa no destino (~10 min).
- Copiar dados históricos: `chat_messages` até D-1, `uazapi_history_runs`, logs, tabelas de configuração (~60–90 min).
- Copiar arquivos dos buckets (~30–90 min, depende do volume; roda em paralelo).
- Deploy das 141 Edge Functions no destino e cadastro das 23 secrets (~40 min).

**Fase B — janela de parada real:**

| Passo | Tempo |
| --- | --- |
| Congelar webhooks (UaZapi/Meta/pagamentos) e avisar equipe | 5 min |
| Copiar o delta (últimas 24 h de mensagens/conversas/CRM) | 10–20 min |
| Constraints/FK, índices, triggers, matviews, RLS/policies | 20–35 min |
| Sequences (`setval`) e cron jobs | 5 min |
| Verificação de contagens e smoke test (login, enviar/receber mensagem, CRM, chamada) | 15–20 min |
| Repontar `.env`/domínios e reativar webhooks no destino | 10 min |

**Janela estimada: 1h15 a 1h45.** Sem a Fase A (tudo de uma vez), a janela vira **5 a 8 horas**.
Plano de rollback: manter a origem intacta e apenas reverter as URLs de webhook e o `.env` — reversão em ~10 min enquanto não houver escrita nova no destino.

## Segurança

- A `service_role key` do destino é gravada como secret do backend e usada só dentro da Edge Function; nunca aparece no frontend nem em log.
- A tela não executa SQL arbitrário digitado pelo usuário: só os scripts gerados por introspecção.
- Não é possível exibir/copiar os valores das secrets atuais — só os nomes.
- Rota restrita a administrador e removível depois da migração.

## Detalhes técnicos

- DDL gerado por introspecção do banco vivo (`pg_get_functiondef`, `pg_indexes`, `pg_policies`, `information_schema`) — não por replay das 369 migrations, para refletir o estado real.
- Dados importados **antes** de FKs e índices (ganho grande de velocidade); `session_replication_role` não é necessário nessa ordem.
- Tabelas migradas apenas como estrutura: `uazapi_history_items`, `chat_dropped_messages`, `webhook_logs`, `webhook_queue`, `user_presence_heartbeats*`, `ai_usage_logs`, `chat_legacy_cache`.
- Storage: caminhos preservados; se o project ref mudar, script SQL de reescrita das URLs gravadas (`chat_messages.media_url`, `ticket_*`, `wavoip_call_logs`).
- Schemas gerenciados (`auth`, `storage`, `realtime`, `vault`) não são recriados; só as policies de `storage.objects`. O projeto não usa Supabase Auth, então não há `auth.users` a migrar.
- Novas tabelas de controle: `migration_runs`, `migration_steps` (só service_role).
