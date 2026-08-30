# Observabilidade do MCP — alertas, drill-down, percentis e exportação

Evolução do painel de Observabilidade em `/mvp-copiloto`, sobre a telemetria já existente (`cop_tool_calls`, `cop_tool_call_stats`, `cop_tool_call_recent`, `mcp_metrics`, `mcp_health`).

## 1. Alertas por tool (limites no banco)

- Nova tabela `cop_alert_thresholds` por escritório e por tool (com uma linha "padrão" aplicável a todas): limite de p95 em ms, limite de taxa de erro em %, volume mínimo para avaliar (evita alarme com 2 chamadas), ativo/inativo.
- Avaliação no painel: cada tool recebe estado **OK / Atenção / Crítico** comparando p95 e taxa de erro do período selecionado com o limite (Atenção a partir de 80% do limite).
- Faixa de alertas no topo do painel listando as tools que estouraram, com o número medido e o limite.
- Edição dos limites em um diálogo dentro do painel (somente owner/admin do escritório edita; a equipe visualiza).

## 2. Drill-down por request_id

- Clique em qualquer linha das últimas chamadas (ou busca por `request_id`) abre um painel lateral com: tool, domínio, versão, modo, status, erro tipado + retryável + dependência, latência, dry-run, cobertura (completa/incompleta e nº de avisos), contagem de resultados, horário em Brasília.
- **Resumo redigido do payload**: a telemetria passa a gravar, além de `arg_keys`, um resumo curto e sanitizado dos argumentos (IDs, limites, cursores, intervalos de data, flags) com valores longos truncados e campos de conteúdo/texto livre substituídos por `[omitido]`. Nunca grava mensagens de lead, mídia, token ou credenciais.
- Botões para copiar o `request_id` e o JSON do resumo.

## 3. Percentis p50/p95/p99 e volume por tool

- As funções de agregação passam a devolver p99 (totais, por tool e na timeline).
- Cartões de resumo com p50/p95/p99 e máximo; tabela por tool com volume, erros, p50/p95/p99 e última chamada, ordenável.
- Filtros: período (1h, 24h, 7d, 30d e intervalo personalizado por datas), tool, domínio, modo (leitura/escrita) e status.

## 4. Exportação CSV/JSON

- Botão de exportar respeitando exatamente os filtros ativos, em dois níveis: **métricas agregadas** (por tool) e **logs estruturados** (chamadas individuais, com metadados e resumo redigido).
- Geração no navegador a partir dos dados já carregados, com nome de arquivo contendo período e filtro. Nenhum conteúdo de lead é exportado.

## 5. Aba de correlação (Saúde × latência × erros)

- Nova aba "Saúde e tendências" com:
  - status de cada dependência vindo do `mcp_health` (banco, banco legado, presença, mensageria, contratos, storage);
  - tabela por tool cruzando status de alerta, p95, taxa de erro, erro tipado mais frequente e dependência mais afetada;
  - gráfico de tendência diária (volume, taxa de erro e p95) nos últimos 30 dias, com marcação dos dias que estouraram limite;
  - destaque quando o erro predominante de uma tool é de dependência externa, separando "problema nosso" de "problema do provedor".

## Detalhes técnicos

- Migration: `cop_alert_thresholds` (client_id, tool_name nulo = padrão, p95_limit_ms, error_rate_limit, min_volume, enabled, timestamps) com GRANTs e RLS; coluna `arg_summary jsonb` em `cop_tool_calls`; atualização de `cop_tool_call_stats` (p99 + filtros opcionais de tool/domínio/modo/status + timeline diária) e de `cop_tool_call_recent` (filtros + `arg_summary`); nova função para buscar uma chamada por `request_id` isolada por `client_id`.
- Backend: sanitizador de argumentos em `supabase/functions/_shared/copiloto/tools/index.ts` (allowlist de chaves seguras, truncamento, redação de texto livre); `mcp_metrics` em `tools/meta.ts` passa a expor p99 e estado de alerta.
- Frontend: `useMcpTelemetry.ts` ganha filtros, p99, hook de thresholds e hook de detalhe por `request_id`; `McpObservabilityCard.tsx` dividido em componentes (faixa de alertas, filtros, tabela por tool, drill-down, exportação) e nova aba de saúde/tendências. Componentes shadcn e Recharts já disponíveis.
- Documentação atualizada em `docs/MCP_julia.md` (limites, campos exportados, política de redação).
- Retenção de 30 dias mantida; nenhuma alteração nas tools de leitura do MCP.
