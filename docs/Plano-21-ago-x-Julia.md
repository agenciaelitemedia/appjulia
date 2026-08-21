# Plano 21-ago X-Julia — Melhoria, Ajustes e Implementações

Revisão do documento base `docs/x-julia-devops-implementation.md` (07/ago) com verificação item a item no código e no banco em 21/ago/2026. Elaborado com quatro olhares: **DevOps**, **Engenharia de Sistemas**, **Engenharia de Dados / Infraestrutura** e **Análise de Sistemas**.

Toda afirmação de estado atual abaixo tem evidência rastreável (arquivo:linha ou consulta ao banco).

---

## 1. Sumário executivo

O módulo X-Julia está funcional ponta a ponta (motor, skills, contratos ZapSign, CRM espelhado, precificação por modelo), porém opera hoje em **volume de piloto** (`xj_sessions` = 0 linhas ativas, `xj_deals` = 1, `xj_contracts` = 20, maior tabela é `xj_model_pricing` com 950 linhas). Isso muda a ordem de prioridade proposta no documento de 07/ago: o que ameaça o negócio agora não é performance de banco, e sim **duas falhas funcionais silenciosas** e **duas exposições de segurança**.

Riscos ordenados por severidade × probabilidade:

| # | Risco | Severidade | Probabilidade | Frente |
|---|---|---|---|---|
| R1 | Follow-up nunca dispara: nenhuma job de cron aponta para `x-julia-followup-runner` e nenhum caller existe no código | Alta | **Ocorrendo hoje** | F2 |
| R2 | Funções de painel abertas: `verify_jwt = false` em 100% das entradas de `supabase/config.toml`, e `xj-provider-config` grava/lista chaves de provedor sem checar identidade | Crítica | Média-alta | F4 |
| R3 | Ingestão sem durabilidade: disparo do motor via `EdgeRuntime.waitUntil` sem fila, sem retry, sem DLQ e sem idempotência por `message_id` — morte do isolate = mensagem perdida | Alta | Média | F1 |
| R4 | Custo sem disjuntor: tokens e `cost_usd` são medidos mas não limitam nada; único freio é `agent.max_turns` | Alta | Média | F3 |
| R5 | Canal WABA sem X-Julia: só `uazapi-chat-webhook` chama o motor | Média | Alta (por escritório em API Oficial) | F6 |

O que **não** é prioridade agora: particionamento de `xj_session_events` (0 linhas, índices compostos já existem) e instalação de broker externo (`pgmq` não está instalado e não é necessário — o padrão `FOR UPDATE SKIP LOCKED` já usado em `uazapi_pick_pending_items` resolve).

---

## 2. Correções ao documento base (07/ago)

| Item do doc base | Veredito | Evidência |
|---|---|---|
| 1. Webhook processa IA antes do HTTP 200 (risco de timeout/reenvio) | **Desatualizado / já implementado** | `supabase/functions/uazapi-chat-webhook/index.ts:1888-1918` — o `fetch` para `x-julia-engine` roda dentro de `EdgeRuntime.waitUntil(xjPromise)`; o 200 não espera o motor |
| 1. Necessidade de fila | **Ainda válido, reformulado** | O motivo correto é **durabilidade e idempotência**, não latência. Não há tabela de fila, retry, DLQ nem dedup por `message_id`. Fan-out também é sequencial (`for (const ev of xjEvents)`) |
| 1. Usar `pgmq` / Redis | **Substituído** | `pg_extension` contém só `pg_cron` e `pg_net`. Padrão do próprio projeto: tabela + `SKIP LOCKED` (`uazapi_pick_pending_items`, `uazapi_release_stale_locks`) |
| 2. Follow-up sequencial com `limit(40)` | **Correto, mas incompleto** | `x-julia-followup-runner/index.ts:28-33` (limit 40) e `:37` (`for ... await`). O ponto **omitido e mais grave**: `select ... from cron.job` não retorna nenhuma entrada citando `x-julia`; nenhum arquivo em `src/` ou `supabase/functions/` invoca o runner → função nunca executa |
| 3. Custo é apenas medidor | **Correto** | `_shared/x-julia/runner.ts:118-136` acumula `prompt_tokens`, `completion_tokens`, `total_tokens`, `cost_usd` em `xj_sessions`; `pricing.ts` + `xj_model_pricing` (950 linhas) fornecem preço. Nenhuma leitura desses valores antes da chamada ao LLM |
| 3. Único limite existente | **Complemento** | `runner.ts:31` — `if (session.turns > agent.max_turns)` é o único freio, por sessão, não por tenant nem por janela de tempo |
| 4. `verify_jwt` desativado | **Correto e pior que descrito** | Todas as entradas de `supabase/config.toml` estão `verify_jwt = false`. Em `xj-provider-config/index.ts` não há nenhuma verificação de identidade/tenant no corpo; a função lê e grava `xj_client_provider_keys.api_key` (texto puro) e aceita `client_id` do chamador |
| 5. Particionar `xj_session_events` | **Prematuro** | Tabela com 0 linhas / 128 kB. Reclassificado como gatilho por volume |
| 5. Criar índices compostos por `session_id` + data | **Já implementado** | `idx_xj_session_events_session (session_id, created_at DESC)` e `idx_xj_session_events_client (client_id, created_at DESC)` |
| 5. Rotina de limpeza 90 dias | **Ainda válido** | Nenhuma job de retenção para tabelas `xj_*` em `cron.job` |
| — | **Lacuna não mapeada no doc base** | Só `uazapi-chat-webhook` aciona o motor; nenhum webhook WABA chama `x-julia-engine` |
| — | **Lacuna não mapeada no doc base** | RLS está ligada em todas as 23 tabelas `xj_*`; `xj_provider_settings` e `xj_client_provider_keys` têm 0 políticas (fechadas ao cliente, correto), as demais têm exatamente 1 política cada — a auditar quanto ao escopo por `client_id` |
| — | **Lacuna não mapeada no doc base** | Não existe painel/consulta de saúde operacional do módulo (fila, erros do worker, follow-ups em erro, custo por tenant) |

---

## 3. Frentes de trabalho

### F2 — Follow-up operacional (DevOps) — prioridade 1

**As-Is comprovado.** `x-julia-followup-runner` existe (142 linhas), busca `xj_followups` com `status = 'pending'` e `run_at <= now()`, processa em laço sequencial `limit(40)`, cancela órfãos, sintetiza áudio quando o passo é de voz, envia por `xjSend`/`xjSendComposed`, grava `sent`/`error` e agenda o próximo passo. **Nada disso roda**: sem job de cron e sem caller.

**To-Be.** Runner acionado a cada minuto, processando lotes com concorrência limitada, imune a execuções sobrepostas.

**Mudanças.**
1. Criar a job `pg_cron` `x-julia-followup-every-minute` chamando `net.http_post` para `x-julia-followup-runner` (SQL com URL e chave do projeto — aplicar via ferramenta de insert, nunca como migration versionada).
2. Substituir o laço sequencial por processamento em blocos: `chunk(due, 8)` + `Promise.allSettled` por bloco, mantendo o `limit` de busca (elevar para 100 já que o custo por item cai).
3. Lock por linha para impedir duplo envio quando duas execuções se sobrepõem: `status = 'processing'` + `locked_at` numa RPC `xj_pick_due_followups(p_limit)` usando `FOR UPDATE SKIP LOCKED` (espelhando `uazapi_pick_pending_items`), e `xj_release_stale_followups()` para devolver itens travados há mais de 5 minutos.
4. Repescagem: em falha, incrementar `attempt`, gravar `error_message`, e reagendar `run_at = now() + backoff(attempt)` até um teto (ex.: 3 tentativas) antes de marcar `error` definitivo.

**Aceite.** Uma cadência criada no painel dispara sozinha na janela esperada; duas execuções simultâneas do runner não geram mensagem duplicada; falha de um lead não interrompe o lote (visível em `xj_session_events.kind = 'followup'`).

**Risco de regressão.** Baixo e isolado no módulo X-Julia. Rollback = `cron.unschedule` da job.

---

### F4 — Hardening de endpoints e segredos (Infraestrutura) — prioridade 2

**As-Is comprovado.** `verify_jwt = false` em todas as entradas do `config.toml`. `xj-provider-config` não valida quem chama e manipula `xj_client_provider_keys.api_key` em texto puro; `x-julia-admin` executa LLM, gera contrato e sincroniza CRM sem checar identidade; `xj-zapsign` idem.

**To-Be.** Separação explícita entre **webhook público** (validado por assinatura do provedor) e **função de painel** (autenticada).

**Mudanças.**
1. Classificar as funções `x-julia*`/`xj-*`: `x-julia-engine` é chamada interna server-to-server (aceitar somente com chave de serviço ou segredo compartilhado no header); `x-julia-admin`, `xj-provider-config`, `xj-zapsign` são de painel.
2. Como a autenticação do produto é própria (bcrypt, sem Supabase Auth), ativar `verify_jwt` nas funções de painel **não** basta — implementar guarda dentro de cada função: exigir header de sessão do app, resolver `user_id → client_id` e recusar qualquer `client_id` divergente do resolvido no servidor (fim do `client_id` vindo do corpo).
3. `xj-provider-config`: nunca devolver chave completa (hoje já existe `mask`, garantir que nenhuma rota retorne a chave crua); mover o valor para segredo/`vault` referenciado por ponteiro, deixando na tabela apenas metadados (provedor, tipo, máscara, `updated_at`).
4. Webhook do provedor: validar assinatura/hash do cabeçalho antes de qualquer processamento e registrar tentativas rejeitadas.
5. Auditar as 21 políticas RLS `xj_*` uma a uma, confirmando escopo por `client_id` e presença dos `GRANT` correspondentes.

**Aceite.** Chamada anônima a `xj-provider-config` e `x-julia-admin` retorna 401; nenhuma resposta contém chave em texto claro; POST forjado no webhook é rejeitado e logado.

**Risco de regressão.** Médio — telas do módulo X-Julia deixam de funcionar se o header de sessão não for enviado. Mitigação: aplicar guarda função por função, começando por `xj-provider-config`, com validação da tela correspondente antes de seguir.

---

### F1 — Confiabilidade da ingestão (Engenharia de Sistemas) — prioridade 3

**As-Is comprovado.** `uazapi-chat-webhook` responde 200 imediatamente e dispara o motor em `waitUntil`, em laço sequencial sobre `xjEvents`. Se o isolate for reciclado, ou se o `fetch` falhar, o único registro é um `console.warn` — a mensagem do lead se perde. Reentrega do provedor gera turno duplicado (não há dedup por `message_id`).

**To-Be.** Fila durável no Postgres, receptor idempotente, worker com retry e DLQ.

**Mudanças (esquema).**
```
xj_inbound_queue(
  id uuid pk, client_id text, queue_id uuid, conversation_id uuid, contact_id uuid,
  message_id text, payload jsonb,
  status text default 'pending',        -- pending | processing | done | error | dead
  attempts int default 0, locked_at timestamptz, worker_id smallint,
  last_error text, created_at, updated_at
)
unique index on (queue_id, message_id) where message_id is not null   -- idempotência
index on (status, created_at)
```
Mais `GRANT` para `service_role`, RLS habilitada e política de leitura restrita ao `client_id` (painel de saúde).

**Mudanças (código).**
1. `uazapi-chat-webhook`: substituir o `fetch` por `insert` na fila (`onConflict` ignora reentrega), mantendo o `waitUntil` apenas para o insert — barato e rápido.
2. Nova função `x-julia-processor`: `xj_pick_inbound(p_worker_id, p_limit)` com `SKIP LOCKED`, executa a lógica hoje em `x-julia-engine` (reaproveitando `runXJTurn` e a validação de ativação), marca `done`/`error`, backoff exponencial, e `dead` após N tentativas (DLQ consultável).
3. `x-julia-engine` continua existindo para os comandos de painel (`ping`, `test_voice`, `advance_stage`, `continue_now`) e para reprocessamento manual de um item da fila.
4. Job `pg_cron` de 1 minuto para o processor + liberação de locks obsoletos.

**Aceite.** Mensagem reentregue pelo provedor não gera segundo turno; item que falha 3 vezes vira `dead` e aparece no painel de saúde; matar o worker no meio do lote não perde mensagem (volta a `pending` após o timeout do lock).

**Risco de regressão.** Médio-alto (caminho crítico de atendimento). Mitigação: flag por `client_id` para escolher entre disparo direto (atual) e fila, migrando escritório por escritório.

---

### F3 — FinOps e circuit breaker (Análise de Sistemas) — prioridade 4

**As-Is comprovado.** Medição completa e por turno em `xj_sessions` (`runner.ts:118-136`) com preço vindo de `pricing.ts` / `xj_model_pricing`. Zero consumo desses dados como trava.

**To-Be.** Medidor vira disjuntor, com limites configuráveis por tenant e reação previsível.

**Mudanças (esquema).**
```
xj_usage_limits(client_id text pk, daily_cost_usd numeric, monthly_cost_usd numeric,
  msgs_per_hour_per_lead int, msgs_per_hour_per_client int,
  on_breach text default 'pause',  -- pause | notify_only
  breach_message text, is_active bool, updated_at)

xj_usage_counters(client_id text, day_brt date, cost_usd numeric, turns int,
  primary key (client_id, day_brt))
```
Contador incrementado no mesmo ponto onde hoje se acumula o custo da sessão.

**Mudanças (código).**
1. Guarda em `runner.ts`, **antes** da chamada ao LLM: consultar limites e contadores; excedido → não chamar provedor.
2. Rate limit por lead e por tenant usando `xj_session_events`/`xj_sessions` na janela de 1 hora (índices já suportam a consulta por `client_id, created_at DESC`).
3. Ao romper: `xj_sessions.is_active = false`, `paused_reason = 'limite de custo diário atingido'`, mensagem padrão configurável ao lead (uma vez por sessão, no padrão do aviso de fora de horário), evento `kind = 'circuit_breaker'` e alerta no módulo Notificações e Alertas.
4. Tela de limites no painel X-Julia (custo do dia × teto, sessões pausadas por limite).

**Aceite.** Com teto artificial baixo, o turno seguinte não chama o provedor, a sessão pausa com motivo legível, o lead recebe a mensagem padrão uma única vez e o alerta chega ao administrador.

**Risco de regressão.** Médio — configuração errada pausa atendimento legítimo. Mitigação: `on_breach = 'notify_only'` como padrão inicial por tenant, migrando para `pause` após observação.

---

### F5 — Ciclo de vida de dados (Engenharia de Dados) — prioridade 5

**As-Is comprovado.** `xj_session_events` com 0 linhas e os dois índices compostos que o doc base pedia. Nenhuma rotina de retenção.

**Mudanças.**
1. Retenção: job `pg_cron` diária apagando eventos com mais de 90 dias, preservando os de tipo estrutural (`session_started`, `handoff`, `contract`, `circuit_breaker`).
2. Agregado diário `xj_analytics_daily` (por `client_id` e dia BRT: sessões, turnos, custo, handoffs, contratos) alimentando os painéis, para que a tela não varra a tabela de eventos.
3. Particionamento **por gatilho**, não agora: quando `xj_session_events` passar de ~5M linhas, converter para partições mensais no mesmo padrão já usado em `user_presence_heartbeats_YYYYMM` (função de criação antecipada de partições já existe no banco e serve de referência).
4. Documentar os índices existentes para evitar criação duplicada em migrations futuras.

**Aceite.** Tabela de eventos com crescimento limitado; telas de análise lendo agregado; nenhuma migration criando índice já existente.

---

### F6 — Cobertura de canal (Engenharia de Sistemas) — prioridade 6

**As-Is comprovado.** Somente `uazapi-chat-webhook` contém o disparo do motor. Escritórios em WABA (API Oficial) não têm X-Julia, embora `XJQueueCreds` já carregue `waba_token`/`waba_number_id` e o envio multi-provedor exista em `_shared/x-julia/messaging.ts`.

**Mudanças.** Na ingestão WABA, montar o mesmo payload de `xjEvents` (fila vinculada, `conversation_id`, `contact_id`, `message_id`, texto/tipo/mídia, dados de campanha) e enfileirar (após F1) ou chamar o motor (antes de F1). Reaproveitar a transcrição de áudio já ciente de canal.

**Aceite.** Lead que escreve numa fila WABA vinculada a um agente X-Julia recebe resposta pelo mesmo fluxo do UaZapi, inclusive áudio e documentos.

---

### F7 — Observabilidade e saúde (DevOps) — prioridade 7

**Mudanças.** Painel "Saúde do X-Julia" no módulo admin, com: itens `pending` na fila e idade do mais antigo, taxa de erro do processor na última hora, itens `dead` (DLQ) com ação de reprocessar, follow-ups em `error`, custo por tenant no dia versus teto, últimas execuções das jobs de cron. Alertas de degradação reusando o módulo Notificações e Alertas (fila parada > 5 min, DLQ > 0, teto de custo em 80%).

**Aceite.** Falha silenciosa deixa de ser silenciosa: cada um dos riscos R1-R4 tem indicador visível e alerta.

---

## 4. Roadmap por sprint

| Sprint | Frentes | Objetivo | Dependências |
|---|---|---|---|
| S1 | **F2** + **F4** (etapas 1-3) | Parar de perder follow-up e fechar as funções de painel/segredos | Nenhuma |
| S2 | **F1** | Durabilidade e idempotência da ingestão, com flag por tenant | Padrão `SKIP LOCKED` de F2 reutilizado |
| S3 | **F3** + **F4** (etapas 4-5) | Disjuntor de custo, assinatura de webhook, auditoria RLS | F1 (contador no worker) |
| S4 | **F6** + **F5** | Cobertura WABA e retenção/agregados | F1 (fila como ponto único de entrada) |
| S5 | **F7** | Painel de saúde e alertas | F1-F3 |

---

## 5. Matriz de risco e rollback

| Frente | Impacto se der errado | Rollback |
|---|---|---|
| F2 | Envio duplicado de follow-up | `cron.unschedule('x-julia-followup-every-minute')`; lock por linha impede duplicidade mesmo antes disso |
| F4 | Telas do X-Julia retornam 401 | Guarda aplicada função por função; reverter a guarda de uma função isolada não afeta as outras |
| F1 | Mensagens presas na fila sem processamento | Flag por `client_id` volta o tenant ao disparo direto atual; itens da fila reprocessáveis pelo painel |
| F3 | Sessões pausadas indevidamente | `on_breach = 'notify_only'` ou `is_active = false` na linha de limite |
| F5 | Perda de log histórico | Retenção preserva eventos estruturais; janela de 90 dias configurável |
| F6 | Resposta duplicada em fila WABA | Dedup por `(queue_id, message_id)` da F1 cobre; até lá, ativar por fila |

Nenhuma das frentes toca o motor da Julia clássica, o `db-query` ou o Postgres externo — o módulo X-Julia é independente por construção (`_shared/x-julia/*` não importa nada do motor clássico).

---

## 6. Checklist de aceite operacional

- [ ] `select jobname from cron.job` lista a job do follow-up e a do processor.
- [ ] Cadência de follow-up disparada automaticamente, registrada em `xj_session_events`.
- [ ] Duas execuções simultâneas do runner: zero mensagens duplicadas.
- [ ] `curl` anônimo em `xj-provider-config` e `x-julia-admin` → 401.
- [ ] Nenhuma resposta de API devolve `api_key` em texto claro.
- [ ] Reentrega do mesmo `message_id` pelo provedor não gera segundo turno.
- [ ] Item com 3 falhas aparece como `dead` e é reprocessável no painel.
- [ ] Teto de custo diário bloqueia a chamada ao provedor e pausa a sessão com motivo.
- [ ] Fila WABA vinculada responde pelo X-Julia.
- [ ] Job de retenção reduz `xj_session_events` conforme a janela configurada.
- [ ] Painel de saúde exibe fila, DLQ, erros de follow-up e custo por tenant.

---

## Anexo — evidências coletadas em 21/ago/2026

- Extensões: `pg_cron`, `pg_net` (sem `pgmq`).
- Jobs de cron citando X-Julia: **nenhuma**.
- Índices em `xj_session_events`: `xj_session_events_pkey`, `idx_xj_session_events_session (session_id, created_at DESC)`, `idx_xj_session_events_client (client_id, created_at DESC)`.
- Índices em `xj_followups`: `xj_followups_pkey`, `idx_xj_followups_due (status, run_at)`, `idx_xj_followups_session (session_id, status)`.
- RLS: habilitada nas 23 tabelas `xj_*`; `xj_provider_settings` e `xj_client_provider_keys` com 0 políticas; demais com 1 política cada; `xj_model_pricing` com 2.
- Volumes: `xj_model_pricing` 950, `xj_contracts` 20, `xj_deal_history` 16, `xj_pipelines` 9, `xj_agents` 3, `xj_sessions` 0, `xj_session_events` 0.
- Colunas de consumo em `xj_sessions`: `prompt_tokens`, `completion_tokens`, `total_tokens`, `cost_usd`.
- Arquivos de referência: `supabase/functions/x-julia-engine/index.ts` (439 linhas), `supabase/functions/x-julia-followup-runner/index.ts` (142), `supabase/functions/_shared/x-julia/runner.ts` (337), `pricing.ts` (117), `supabase/functions/uazapi-chat-webhook/index.ts:1888-1918`, `supabase/config.toml`.
