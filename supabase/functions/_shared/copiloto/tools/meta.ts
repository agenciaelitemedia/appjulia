/**
 * Domínio: metadados do próprio conector — inventário de capacidades e saúde
 * das dependências (P0.1 e P0.2 do backlog).
 */
import { coverage, ok, SCHEMA_VERSION, SERVER_VERSION, type ToolOutput } from "../envelope.ts";
import { legacyRaw } from "../legacy.ts";
import { SCOPE_READ, type CopilotoContext, type CopilotoTool } from "../types.ts";

/** Preenchido pelo registry (evita import circular). */
// deno-lint-ignore no-explicit-any
let catalogRef: (() => any[]) | null = null;
// deno-lint-ignore no-explicit-any
export function registerCatalogSource(fn: () => any[]) {
  catalogRef = fn;
}

type DepStatus = "healthy" | "degraded" | "unavailable";

async function timed(name: string, fn: () => Promise<void>): Promise<{
  name: string;
  status: DepStatus;
  latency_ms: number;
  error_code: string | null;
}> {
  const started = Date.now();
  try {
    await fn();
    const latency = Date.now() - started;
    return { name, status: latency > 2500 ? "degraded" : "healthy", latency_ms: latency, error_code: null };
  } catch (e) {
    return {
      name,
      status: "unavailable",
      latency_ms: Date.now() - started,
      // Código curto e seguro: nunca a mensagem crua do banco.
      error_code: (e as { code?: string })?.code || "CHECK_FAILED",
    };
  }
}

export const metaTools: CopilotoTool[] = [
  {
    name: "mcp_capabilities",
    version: "1.0.0",
    mode: "read",
    requiredScope: SCOPE_READ,
    description:
      "Inventário do conector: versão do servidor, versão do schema, escopos OAuth do token atual e catálogo completo de ferramentas com versão, modo (leitura/escrita), escopo exigido e situação de depreciação. Chame primeiro para saber o que pode ser usado.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    run: (ctx: CopilotoContext): Promise<ToolOutput> => {
      const tools = (catalogRef?.() ?? []).map((t) => ({
        name: t.name,
        version: t.version ?? "1.0.0",
        mode: t.mode ?? "read",
        required_scope: t.requiredScope ?? SCOPE_READ,
        deprecated: Boolean(t.deprecated),
        replaced_by: t.replacedBy ?? null,
        removal_date: t.removalDate ?? null,
        description: t.description,
      }));
      const text = [
        `Conector Julia ${SERVER_VERSION} (schema ${SCHEMA_VERSION})`,
        `Escopos do token: ${(ctx.scopes || []).join(", ") || "—"}`,
        `Ferramentas: ${tools.length} (${tools.filter((t) => t.mode === "write").length} de escrita)`,
        "",
        ...tools.map(
          (t) =>
            `- ${t.name} v${t.version} · ${t.mode} · escopo ${t.required_scope}${
              t.deprecated ? ` · DEPRECADA → ${t.replaced_by || "sem substituta"} (remoção ${t.removal_date || "a definir"})` : ""
            }`,
        ),
      ].join("\n");
      return Promise.resolve(
        ok(
          { server_version: SERVER_VERSION, oauth_scopes: ctx.scopes || [], tools },
          { requestId: ctx.requestId!, toolName: "mcp_capabilities", toolVersion: "1.0.0", text },
        ),
      );
    },
  },
  {
    name: "mcp_health",
    version: "1.0.0",
    mode: "read",
    requiredScope: SCOPE_READ,
    description:
      "Saúde do conector e de cada dependência (banco Supabase, banco legado, presença legada, mensageria, contratos e storage), com status healthy/degraded/unavailable e latência. Uma dependência fora do ar não derruba as ferramentas independentes.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    run: async (ctx: CopilotoContext): Promise<ToolOutput> => {
      const dependencies = await Promise.all([
        timed("database", async () => {
          const { error } = await ctx.supabase
            .from("chat_conversations")
            .select("id", { count: "exact", head: true })
            .eq("client_id", ctx.clientId);
          if (error) throw error;
        }),
        timed("legacy_db", async () => {
          await legacyRaw(ctx, "SELECT 1 AS ok", []);
        }),
        timed("legacy_presence", async () => {
          const { error } = await ctx.supabase
            .from("user_presence_status")
            .select("user_id", { count: "exact", head: true })
            .eq("client_id", Number(ctx.clientId));
          if (error) throw error;
        }),
        timed("messaging", async () => {
          const { error } = await ctx.supabase
            .from("queues")
            .select("id", { count: "exact", head: true })
            .eq("client_id", ctx.clientId);
          if (error) throw error;
        }),
        timed("contracts", async () => {
          const { error } = await ctx.supabase
            .from("contract_notification_configs")
            .select("id", { count: "exact", head: true });
          if (error) throw error;
        }),
        timed("storage", async () => {
          const { error } = await ctx.supabase.storage.from("chat-media").list("", { limit: 1 });
          if (error) throw error;
        }),
      ]);

      const down = dependencies.filter((d) => d.status === "unavailable");
      const degraded = dependencies.filter((d) => d.status === "degraded");
      const status: DepStatus = down.length ? (down.length === dependencies.length ? "unavailable" : "degraded") : degraded.length ? "degraded" : "healthy";

      const text = [
        `Status geral: ${status}`,
        ...dependencies.map((d) => `- ${d.name}: ${d.status} (${d.latency_ms}ms)${d.error_code ? ` · ${d.error_code}` : ""}`),
        down.length ? `\nFerramentas que dependem de ${down.map((d) => d.name).join(", ")} podem responder com cobertura incompleta.` : "",
      ]
        .filter(Boolean)
        .join("\n");

      return ok(
        { status, dependencies },
        {
          requestId: ctx.requestId!,
          toolName: "mcp_health",
          toolVersion: "1.0.0",
          coverage: coverage({ complete: !down.length, warnings: down.map((d) => `Dependência indisponível: ${d.name}`) }),
          text,
        },
      );
    },
  },
];
