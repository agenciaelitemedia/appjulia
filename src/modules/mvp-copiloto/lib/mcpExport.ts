/**
 * Exportação das métricas e logs estruturados do MCP em CSV/JSON.
 * Somente metadados: nenhum conteúdo de lead é exportado.
 */
import type { McpRecentCall, McpToolStat } from '../hooks/useMcpTelemetry';

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /[",\n;]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  return [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\n');
}

export function slugRange(from: Date, to: Date, extra?: string): string {
  const d = (x: Date) => x.toISOString().slice(0, 10);
  return [`${d(from)}_${d(to)}`, extra].filter(Boolean).join('_').replace(/[^\w.-]/g, '-');
}

const toolRow = (t: McpToolStat) => ({
  tool_name: t.tool_name,
  domain: t.domain ?? '',
  mode: t.mode ?? '',
  calls: t.calls,
  errors: t.errors,
  error_rate: t.error_rate,
  p50_ms: t.p50_ms,
  p95_ms: t.p95_ms,
  p99_ms: t.p99_ms,
  max_ms: t.max_ms,
  top_error: t.top_error ?? '',
  top_dependency: t.top_dependency ?? '',
  last_call_at: t.last_call_at ?? '',
});

const callRow = (c: McpRecentCall) => ({
  request_id: c.request_id,
  created_at: c.created_at,
  tool_name: c.tool_name,
  domain: c.domain ?? '',
  tool_version: c.tool_version ?? '',
  mode: c.mode,
  status: c.status,
  error_code: c.error_code ?? '',
  retryable: c.retryable ?? '',
  dependency: c.dependency ?? '',
  latency_ms: c.latency_ms,
  dry_run: c.dry_run ?? '',
  coverage_complete: c.coverage_complete ?? '',
  coverage_warnings: c.coverage_warnings,
  result_count: c.result_count ?? '',
  arg_keys: (c.arg_keys || []).join('|'),
  arg_summary: c.arg_summary ? JSON.stringify(c.arg_summary) : '',
});

export function exportToolMetrics(tools: McpToolStat[], format: 'csv' | 'json', name: string) {
  const rows = tools.map(toolRow);
  if (format === 'csv') download(`mcp-metricas_${name}.csv`, toCsv(rows), 'text/csv');
  else download(`mcp-metricas_${name}.json`, JSON.stringify(rows, null, 2), 'application/json');
}

export function exportCallLogs(calls: McpRecentCall[], format: 'csv' | 'json', name: string) {
  const rows = calls.map(callRow);
  if (format === 'csv') download(`mcp-chamadas_${name}.csv`, toCsv(rows), 'text/csv');
  else download(`mcp-chamadas_${name}.json`, JSON.stringify(rows, null, 2), 'application/json');
}
