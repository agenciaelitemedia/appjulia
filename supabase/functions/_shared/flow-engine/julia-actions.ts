// ============================================
// Ações de Julia (IA + followup) para os nós de fluxo
// Estado real vive no banco externo (sessions) — acesso via db-query.
// ============================================
import type { FlowRunContext } from "./types.ts";

function digits(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

/** cod_agent da conversa: variável do fluxo → vínculo da fila. */
export async function resolveCodAgent(supabase: any, ctx: FlowRunContext): Promise<string | null> {
  const fromVars = ctx.variables?.cod_agent;
  if (fromVars) return String(fromVars);

  const queueId = ctx.conversation?.queue_id ?? ctx.queue?.id ?? null;
  if (!queueId) return null;

  const { data } = await supabase
    .from("queue_agent_links")
    .select("cod_agent, is_primary")
    .eq("queue_id", queueId)
    .order("is_primary", { ascending: false })
    .limit(1)
    .maybeSingle();

  const cod = data?.cod_agent ? String(data.cod_agent) : null;
  if (cod) ctx.variables.cod_agent = cod;
  return cod;
}

function hubFila(ctx: FlowRunContext): "uazapi" | "waba" {
  return String(ctx.queue?.hub ?? "").toLowerCase() === "waba" ? "waba" : "uazapi";
}

/** Sessão da Julia do lead (id + active). `null` quando não existe. */
export async function fetchJuliaSession(
  supabase: any,
  ctx: FlowRunContext,
): Promise<{ id: number; active: boolean } | null> {
  const phone = digits(ctx.contact?.phone);
  const codAgent = await resolveCodAgent(supabase, ctx);
  if (!phone || !codAgent) return null;

  const { data, error } = await supabase.functions.invoke("db-query", {
    body: { action: "get_session_status", data: { whatsappNumber: phone, codAgent } },
  });
  if (error) {
    console.error("[flow-engine] get_session_status", error);
    return null;
  }
  const row = Array.isArray(data?.data) ? data.data[0] : data?.data;
  if (!row?.id) return null;
  return { id: Number(row.id), active: Boolean(row.active) };
}

/** Garante `ctx.variables.julia_active` para o nó de condição. */
export async function ensureJuliaActive(supabase: any, ctx: FlowRunContext): Promise<void> {
  if (ctx.variables?.julia_active !== undefined) return;
  if (ctx.simulate) {
    ctx.variables.julia_active = "";
    return;
  }
  const session = await fetchJuliaSession(supabase, ctx);
  ctx.variables.julia_active = session ? String(session.active) : "";
}

export async function actionJuliaToggle(
  supabase: any,
  config: Record<string, any>,
  ctx: FlowRunContext,
): Promise<string> {
  const activate = String(config.mode ?? "on") !== "off";
  if (ctx.simulate) return activate ? "Ativaria a Julia (com followup)" : "Desativaria a Julia e pararia o followup";

  const phone = digits(ctx.contact?.phone);
  const codAgent = await resolveCodAgent(supabase, ctx);
  if (!phone) throw new Error("contato sem telefone");
  if (!codAgent) throw new Error("fila sem agente da Julia vinculado");

  const session = await fetchJuliaSession(supabase, ctx);
  if (session) {
    const { error } = await supabase.functions.invoke("db-query", {
      body: { action: "update_session_status", data: { sessionId: session.id, active: activate } },
    });
    if (error) throw new Error(`falha ao atualizar sessão: ${error.message}`);
  }

  if (activate) {
    const { error } = await supabase.functions.invoke("n8n_execute-agent_and_followup-reactive", {
      body: { codAgent, whatsappNumber: phone, hubFila: hubFila(ctx) },
    });
    if (error) console.warn("[flow-engine] reactive falhou", error);
  } else {
    const { error } = await supabase.functions.invoke("n8n_execute-followup-stop", {
      body: { codAgent, sessionId: phone },
    });
    if (error) console.warn("[flow-engine] followup-stop falhou", error);
  }

  ctx.variables.julia_active = String(activate);
  if (!session) return activate ? "Julia reativada (sessão criada pelo followup)" : "Followup interrompido";
  return activate ? "Julia ativada e followup reagendado" : "Julia desativada e followup interrompido";
}

export async function actionFollowupStop(
  supabase: any,
  _config: Record<string, any>,
  ctx: FlowRunContext,
): Promise<string> {
  if (ctx.simulate) return "Pararia o followup do lead";

  const phone = digits(ctx.contact?.phone);
  const codAgent = await resolveCodAgent(supabase, ctx);
  if (!phone) throw new Error("contato sem telefone");
  if (!codAgent) throw new Error("fila sem agente da Julia vinculado");

  const { error } = await supabase.functions.invoke("n8n_execute-followup-stop", {
    body: { codAgent, sessionId: phone },
  });
  if (error) throw new Error(`falha ao parar followup: ${error.message}`);
  return "Followup interrompido (Julia segue ativa)";
}
