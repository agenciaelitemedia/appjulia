# Implementação do Plano 21-ago X-Julia (F1 a F7)

Execução completa das sete frentes descritas em `docs/Plano-21-ago-x-Julia.md`, na ordem de sprints do próprio documento. Nada fora do módulo X-Julia é alterado: motor da Julia clássica, `db-query` e Postgres externo ficam intactos.

---

## S1 — Follow-up volta a funcionar + fechar endpoints (F2 e F4 etapas 1-3)

### F2 — Follow-up operacional
- Nova RPC `xj_pick_due_followups(p_limit)`: seleciona `xj_followups` com `status='pending'` e `run_at <= now()` usando `FOR UPDATE SKIP LOCKED`, marca `processing` + `locked_at` + `worker_id` e devolve as linhas (mesmo padrão de `uazapi_pick_pending_items`).
- Nova RPC `xj_release_stale_followups()`: devolve para `pending` itens em `processing` há mais de 5 minutos.
- Colunas novas em `xj_followups`: `locked_at`, `worker_id`, `retry_count`.
- `x-julia-followup-runner` passa a: chamar a RPC (limite 100), processar em blocos de 8 com `Promise.allSettled`, e em falha incrementar `retry_count` e reagendar `run_at = now() + backoff` (2, 10, 30 min) até 3 tentativas antes de marcar `error` definitivo.
- Agendamento `pg_cron` de 1 minuto para o runner e de 5 minutos para a liberação de locks (aplicado via ferramenta de insert, não como migration versionada, porque contém URL e chave do projeto).

### F4 (etapas 1-3) — Guarda de identidade e segredos
- Novo `supabase/functions/_shared/x-julia/guard.ts`: lê o header de sessão do app (`x-app-user-id` + token de sessão), resolve `user_id → client_id` no servidor e devolve 401 quando ausente/inválido. O `client_id` do corpo passa a ser ignorado.
- Guarda aplicada em `xj-provider-config`, depois `x-julia-admin`, depois `xj-zapsign` — uma por vez, validando a tela correspondente antes de seguir.
- `x-julia-engine` e o futuro processor exigem segredo compartilhado interno (`XJ_INTERNAL_SECRET`) no header; chamadas sem ele retornam 401.
- `xj-provider-config` nunca devolve `api_key` crua: apenas provedor, tipo, máscara e `updated_at`. O valor passa a ser guardado como segredo referenciado por ponteiro, com a coluna mantendo só metadados.
- Frontend do módulo X-Julia passa a enviar o header de sessão em todas as chamadas (ajuste centralizado no helper de invoke do módulo).

---

## S2 — Fila durável de ingestão (F1)

- Nova tabela `xj_inbound_queue` conforme o esquema do documento (`status`, `attempts`, `locked_at`, `worker_id`, `last_error`), com índice único `(queue_id, message_id)` para idempotência, índice `(status, created_at)`, GRANTs para `service_role`, RLS ligada e leitura por `client_id`.
- RPCs `xj_pick_inbound(p_worker_id, p_limit)` e `xj_release_stale_inbound()` no mesmo padrão `SKIP LOCKED`.
- `uazapi-chat-webhook`: o `fetch` para o motor dentro de `waitUntil` passa a ser um `insert` na fila com `onConflict do nothing`; reentrega do provedor deixa de gerar segundo turno.
- Nova função `x-julia-processor`: pega o lote, reaproveita `runXJTurn` e a validação de ativação, marca `done`/`error`, aplica backoff exponencial e marca `dead` (DLQ) após 3 tentativas.
- `pg_cron` de 1 minuto para o processor + liberação de locks.
- Flag por escritório (`xj_provider_settings` ou coluna em `xj_agents`) escolhendo entre disparo direto (atual) e fila, permitindo migrar tenant por tenant.
- `x-julia-engine` continua atendendo os comandos de painel (`ping`, `test_voice`, `advance_stage`, `continue_now`) e o reprocessamento manual de um item.

---

## S3 — Disjuntor de custo + hardening restante (F3 e F4 etapas 4-5)

### F3 — FinOps
- Novas tabelas `xj_usage_limits` (por `client_id`: custo diário/mensal, msgs/hora por lead e por escritório, `on_breach` com padrão `notify_only`, `breach_message`) e `xj_usage_counters` (`client_id`, `day_brt`, `cost_usd`, `turns`).
- Contadores incrementados no mesmo ponto de `runner.ts` que já acumula custo da sessão.
- Guarda em `runner.ts` **antes** da chamada ao LLM: limites e contadores consultados; excedido → provedor não é chamado.
- Rate limit por lead e por escritório na janela de 1 hora usando os índices já existentes.
- Ao romper com `on_breach='pause'`: sessão pausada com `paused_reason` legível, mensagem padrão enviada uma única vez ao lead, evento `kind='circuit_breaker'` e alerta no módulo Notificações e Alertas.
- Tela de limites no painel X-Julia: custo do dia × teto e sessões pausadas por limite.

### F4 (etapas 4-5)
- Validação de assinatura/hash do provedor no webhook antes de qualquer processamento, com registro das tentativas rejeitadas.
- Auditoria das 21 políticas RLS `xj_*` uma a uma, corrigindo escopo por `client_id` e completando `GRANT` faltantes.

---

## S4 — Canal WABA + ciclo de vida de dados (F6 e F5)

### F6 — WABA
- Na ingestão WABA (`meta-webhook` / ponte de persistência), montar o mesmo payload de `xjEvents` (fila vinculada, `conversation_id`, `contact_id`, `message_id`, texto/tipo/mídia, campanha) e enfileirar em `xj_inbound_queue`.
- Reaproveitar a transcrição de áudio já ciente de canal; envio de resposta já é multi-provedor em `_shared/x-julia/messaging.ts`.
- Ativação por fila, para liberar escritório por escritório.

### F5 — Dados
- Job `pg_cron` diária de retenção: apaga eventos de `xj_session_events` com mais de 90 dias, preservando `session_started`, `handoff`, `contract` e `circuit_breaker`.
- Nova tabela `xj_analytics_daily` (por `client_id` e dia BRT: sessões, turnos, custo, handoffs, contratos) alimentada por job diária; painéis passam a ler o agregado.
- Particionamento fica declarado como gatilho por volume (~5M linhas), no padrão `user_presence_heartbeats_YYYYMM`; nada implementado agora.
- Índices existentes documentados no próprio doc do plano para evitar duplicação em migrations futuras.

---

## S5 — Saúde e observabilidade (F7)

- Nova página "Saúde do X-Julia" no painel admin do módulo: itens `pending` e idade do mais antigo, taxa de erro do processor na última hora, itens `dead` com ação de reprocessar, follow-ups em `error` com repescagem, custo por escritório no dia versus teto, últimas execuções das jobs de cron.
- Alertas reusando o módulo Notificações e Alertas: fila parada > 5 min, DLQ > 0, custo em 80% do teto, follow-up em erro.

---

## Detalhes técnicos

- Toda tabela nova em `public` segue a ordem obrigatória: `CREATE TABLE` → `GRANT` (`service_role` sempre; `authenticated` quando o painel lê) → `ENABLE ROW LEVEL SECURITY` → políticas por `client_id`.
- Jobs de cron são aplicados com a ferramenta de insert (contêm URL e chave do projeto), nunca como migration versionada.
- Workers seguem as regras de job em background: lote fixo por execução, lock por linha em banco, marcação idempotente de progresso, disjuntor em `402`/`403` do gateway de IA e guarda de estado pausado em cada ponto de entrada.
- Nenhuma frente altera `_shared` do motor clássico, `db-query` ou o Postgres externo.
- Ao final de cada sprint, o checklist de aceite correspondente da seção 6 do documento é verificado antes de seguir.

## Ordem de entrega e rollback

S1 → S2 → S3 → S4 → S5, com validação em produção entre sprints. Rollback por frente: `cron.unschedule` da job (F2/F1/F5), reversão da guarda de uma função isolada (F4), `on_breach='notify_only'` (F3), flag de tenant de volta ao disparo direto (F1), desativação por fila (F6).
