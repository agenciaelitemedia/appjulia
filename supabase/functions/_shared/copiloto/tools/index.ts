/**
 * Registry de tools do conector MCP da Julia — somente leitura.
 *
 * Regra inviolável: `clientId` vem do token OAuth (cop_oauth_tokens).
 * Nenhuma tool aceita client_id, SQL ou nome de tabela como argumento.
 */
import type { CopilotoContext, CopilotoTool, ToolArgs } from "../types.ts";
import { analiseTools } from "./analise.ts";
import { chatTools } from "./chat.ts";
import { contatoTools } from "./contatos.ts";
import { contratoTools } from "./contratos.ts";
import { crmTools } from "./crm.ts";
import { operacaoTools } from "./operacao.ts";

export const TOOL_DOMAINS: { domain: string; label: string; tools: CopilotoTool[] }[] = [
  { domain: "contatos", label: "Contatos e leads", tools: contatoTools },
  { domain: "chat", label: "Atendimento e mensagens", tools: chatTools },
  { domain: "crm", label: "CRM de Leads e CRM Builder", tools: crmTools },
  { domain: "contratos", label: "Contratos ZapSign", tools: contratoTools },
  { domain: "operacao", label: "Filas, equipe, campanhas, telefonia e tickets", tools: operacaoTools },
  { domain: "analise", label: "Análises jurídicas e de atendimento", tools: analiseTools },
];

export const ALL_TOOLS: CopilotoTool[] = TOOL_DOMAINS.flatMap((d) => d.tools);

const BY_NAME = new Map(ALL_TOOLS.map((t) => [t.name, t]));

/** Definições no formato do protocolo MCP (sem o `run`). */
export function getToolDefinitions() {
  return ALL_TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  }));
}

/** Catálogo legível, agrupado por domínio (usado em resources e na UI). */
export function getToolCatalogMarkdown(): string {
  return TOOL_DOMAINS.map(
    (d) =>
      `## ${d.label}\n${d.tools.map((t) => `- **${t.name}** — ${t.description}`).join("\n")}`,
  ).join("\n\n");
}

export async function runCopilotoTool(ctx: CopilotoContext, name: string, args: ToolArgs): Promise<string> {
  const tool = BY_NAME.get(name);
  if (!tool) throw new Error(`Ferramenta desconhecida: ${name}. Use tools/list para ver o catálogo.`);
  return await tool.run(ctx, args || {});
}
