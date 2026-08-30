# Observabilidade do MCP: métricas, logs estruturados e dashboard

Hoje o dispatcher do conector MCP já gera `request_id`, mede latência e devolve erros tipados no envelope, mas **nada disso é persistido** — só existe auditoria de escrita (`cop_write_audit`). Não há como acompanhar latência, taxa de erro ou volume por tool.

O objetivo é registrar cada chamada de tool e apresentar isso num painel dentro de `/mvp-copiloto`.

## O que será feito

### 1. Telemetria persistida (nova tabela)

Tabela `cop_tool_calls` (uma linha por `tools/call`), com:

- `request_id`, `tool_name`, `domain`, `tool_version`, `mode` (read/write)
- `client_id` (do token, nunca do modelo), `token_id`
- `status` (`ok` / `error`), `error_code` (tipado: `INVALID_INPUT`, `RATE_LIMITED`, ...), `retryable`, `dependency`
- `latency_ms`, `dry_run`, `coverage_complete`, `coverage_warnings` (contagem), `result_count`
- `created_at`

Sem conteúdo de lead, sem argumentos crus, sem token: apenas metadados e a lista de chaves de argumentos recebidas. RLS habilitada, `GRANT` para `service_role` (gravação pelas Edge Functions) e leitura autenticada filtrada por `client_id` para o painel.

Índices por `(client_id, created_at desc)` e `(tool_name, created_at desc)`.

### 2. Logging no dispatcher

Em `_shared/copiloto/tools/index.ts`:

- Ao final de cada `dispatchCopilotoTool` (sucesso ou erro), gravar a linha de telemetria em modo *fire-and-forget* (falha de log nunca derruba a tool).
- Emitir também um log estruturado em linha única (JSON) no stdout da função — assim os logs de Edge Function ficam pesquisáveis por `request_id`, `tool_name` e `error_code`.
- Extrair `coverage`/`pagination` do envelope para preencher cobertura e contagem.

### 3. Tools de observabilidade no próprio MCP

- `mcp_metrics`: volume, latência (p50/p95/máx), taxa de erro e top erros por tool, com janela configurável (`1h`, `24h`, `7d`) — escopo de leitura, isolado por `client_id`.
- `mcp_health` (já existente) passa a incluir taxa de erro e latência recentes vindas da nova tabela.

### 4. Dashboard em `/mvp-copiloto`

Nova aba **Observabilidade**, com componentes próprios do módulo:

- Cartões de resumo: chamadas na janela, taxa de erro, latência p50/p95, chamadas de escrita.
- Gráfico de volume por hora/dia (empilhado: ok vs erro).
- Tabela por tool: chamadas, % de erro, p50, p95, última chamada — ordenável.
- Distribuição de erros por código tipado.
- Lista das últimas chamadas com `request_id` copiável, tool, status, latência e cobertura (para rastrear um caso pontual).
- Seletor de janela (1h / 24h / 7d) e auto-refresh.

Reuso do padrão visual e dos componentes já usados no módulo (cards shadcn + recharts), sem alterar o comportamento das tools existentes.

## Detalhes técnicos

- Migration nova, sem alterar `cop_write_audit`.
- Agregações feitas por uma função SQL `security definer` de leitura (`cop_tool_call_stats(p_client_id, p_from, p_to)`) para evitar puxar linhas cruas ao painel; a lista de últimas chamadas usa consulta direta limitada.
- Retenção: limpeza de registros com mais de 30 dias por função de manutenção (chamada junto das rotinas de cleanup existentes).
- Escrita da telemetria usa a chave de serviço já disponível no contexto do MCP; nenhuma nova secret.
- `docs/MCP_julia.md` atualizado com a seção de observabilidade e as novas tools.
