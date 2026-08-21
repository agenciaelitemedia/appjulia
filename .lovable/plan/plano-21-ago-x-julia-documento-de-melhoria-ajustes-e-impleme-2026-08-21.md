# Plano 21-ago X-Julia — documento de melhoria, ajustes e implementações

Entrega deste passo: criar `docs/Plano-21-ago-x-Julia.md`, um plano técnico revisado com olhar de DevOps, engenharia de sistemas, engenharia de dados, infraestrutura e análise de sistemas — corrigindo o que o documento base (`docs/x-julia-devops-implementation.md`) descreve de forma desatualizada e acrescentando lacunas reais encontradas no código e no banco.

## Diagnóstico verificado (base do documento)

Verificado agora no repositório e no banco:

- **Webhook já é assíncrono.** `uazapi-chat-webhook/index.ts:1888-1918` dispara o `x-julia-engine` dentro de `EdgeRuntime.waitUntil`, sem bloquear o 200. O "As-Is" do documento base (item 1) está desatualizado: o problema real não é timeout do provedor, é ausência de **fila durável** — se o isolate morrer, a mensagem é perdida sem retry, sem DLQ e sem idempotência por `message_id`.
- **`pgmq` não está instalado.** Extensões presentes: `pg_cron`, `pg_net`.
- **Follow-up não roda.** Nenhum job em `cron.job` aponta para `x-julia-followup-runner`, e nenhum código de frontend/edge o invoca. A função existe (142 linhas, laço `for ... await`, `limit(40)`) mas hoje é caminho morto: cadências criadas nunca disparam.
- **Custo é só medidor.** `xj_sessions` tem `prompt_tokens`, `completion_tokens`, `total_tokens`, `cost_usd` (acumulados em `runner.ts:118-136`), e existe `estimateCost` com catálogo (`pricing.ts` + 950 linhas em `xj_model_pricing`). Não existe tabela/consulta de limite diário por tenant nem trava antes da chamada ao LLM. O único freio é `agent.max_turns` (`runner.ts:31`).
- **Endpoints sem autenticação.** Todas as entradas de `supabase/config.toml` estão com `verify_jwt = false`, incluindo funções de painel: `x-julia-admin`, `xj-provider-config`, `xj-zapsign`. Em `xj-provider-config` não há nenhuma checagem de identidade no corpo da função — ela grava e lista chaves de provedor (`xj_client_provider_keys.api_key`, texto puro) para qualquer chamador que conheça a URL.
- **Volume de dados é baixo.** `xj_session_events` = 0 linhas / 128 kB; maior tabela é `xj_model_pricing` (950 linhas). Já existem os índices compostos que o documento pede: `(session_id, created_at DESC)` e `(client_id, created_at DESC)`. Particionar agora é otimização prematura; o que falta é retenção.
- **RLS ligada em todas as `xj_*`**, mas `xj_provider_settings` e `xj_client_provider_keys` têm **0 políticas** (fechadas ao cliente — ok) e as demais têm 1 política cada (a auditar quanto a escopo por tenant).
- **Lacuna de canal.** Apenas `uazapi-chat-webhook` aciona o X-Julia. Nenhum webhook WABA (API Oficial) chama o motor: escritórios em API Oficial não têm X-Julia.

## Estrutura do documento a criar

`docs/Plano-21-ago-x-Julia.md`, em português, com:

1. **Sumário executivo** — estado atual do módulo, os 5 riscos ordenados por severidade × probabilidade, e o que muda em relação ao documento de 07/ago.
2. **Correções ao documento base** — tabela item-por-item do `x-julia-devops-implementation.md` marcando: já implementado, ainda válido, reordenado ou prematuro (com a evidência de código/banco de cada linha).
3. **Frentes de trabalho**, cada uma com contexto, As-Is comprovado, To-Be, mudanças arquiteturais, esquema de dados, critérios de aceite e risco de regressão:
   - **F1 — Confiabilidade da ingestão (Eng. de Sistemas):** fila durável `xj_inbound_queue` (tabela + `FOR UPDATE SKIP LOCKED`, sem depender de `pgmq`), receptor idempotente por `message_id`, worker `x-julia-processor`, retry com backoff, DLQ e visibilidade de reprocessamento no painel.
   - **F2 — Follow-up operacional (DevOps):** criar o job `pg_cron` que hoje não existe, lote paralelo com concorrência limitada (blocos de 8-10, `Promise.allSettled`), lock por linha para evitar duplo disparo entre execuções sobrepostas, `attempt`/`error_message` alimentando repescagem.
   - **F3 — FinOps e circuit breaker (Análise de Sistemas):** tabela de limites por tenant (custo diário, mensagens/hora por lead e por `client_id`), consulta agregada antes da chamada ao LLM, pausa automática da sessão com motivo, mensagem padrão ao lead, evento em `xj_session_events` e alerta no módulo de Notificações e Alertas.
   - **F4 — Hardening (Infraestrutura):** classificar as funções em webhook público × painel autenticado; ativar `verify_jwt` nas de painel (`x-julia-admin`, `xj-provider-config`, `xj-zapsign`) e, enquanto isso, validar identidade/tenant dentro da função; validação de assinatura no webhook do provedor; guardar chaves de provedor fora de coluna em texto puro; auditar as políticas RLS das `xj_*` por `client_id`.
   - **F5 — Ciclo de vida de dados (Eng. de Dados):** retenção de 90 dias em `xj_session_events` via `pg_cron` + agregados mensais para os painéis; particionamento declarado como gatilho por volume (ex.: acima de 5M linhas), não como tarefa imediata; índices já existentes documentados para evitar duplicação.
   - **F6 — Cobertura de canal:** acionar o X-Julia também na ingestão WABA, reaproveitando o mesmo contrato de payload do `uazapi-chat-webhook`.
   - **F7 — Observabilidade:** painel de saúde do X-Julia (fila pendente, idade do item mais antigo, taxa de erro do worker, follow-ups em erro, custo/dia por tenant) e alertas de degradação.
4. **Roadmap em sprints** com dependências e ordem sugerida (F2 e F4 primeiro por serem correções de falha em produção; F1 e F3 em seguida; F5-F7 depois).
5. **Matriz de risco e rollback** por frente, incluindo como cada mudança pode ser revertida sem afetar a Julia clássica.
6. **Checklist de aceite** operacional por frente.

## Detalhes técnicos

O documento cita caminhos e linhas reais (`supabase/functions/x-julia-engine/index.ts`, `_shared/x-julia/runner.ts`, `x-julia-followup-runner/index.ts`, `uazapi-chat-webhook/index.ts:1888`, `supabase/config.toml`) e o estado do banco consultado hoje (contagens, índices, políticas, jobs de cron), para que cada afirmação seja rastreável. Nenhum código de produção é alterado neste passo — apenas o arquivo em `docs/`. As implementações das frentes ficam para planos/aprovações seguintes, na ordem do roadmap.
