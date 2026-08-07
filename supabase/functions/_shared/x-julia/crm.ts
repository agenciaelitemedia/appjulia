// ============================================
// X-Julia — CRM próprio (xj_pipelines / xj_deals) com espelhamento opcional
// ============================================
import type { XJAgent, XJSession, XJStage } from "./types.ts";

const DEFAULT_PIPELINES: Array<{ name: string; stage_key: XJStage; color: string }> = [
  { name: "Novo lead", stage_key: "recepcao", color: "#64748b" },
  { name: "Triagem", stage_key: "triagem", color: "#0ea5e9" },
  { name: "Qualificação", stage_key: "qualificacao", color: "#6366f1" },
  { name: "Negociação", stage_key: "negociacao", color: "#a855f7" },
  { name: "Contrato enviado", stage_key: "contrato", color: "#f59e0b" },
  { name: "Assinado", stage_key: "assinatura", color: "#22c55e" },
  { name: "Agendado", stage_key: "agendamento", color: "#14b8a6" },
  { name: "Atendimento humano", stage_key: "humano", color: "#f97316" },
  { name: "Encerrado", stage_key: "encerrado", color: "#ef4444" },
];

// deno-lint-ignore no-explicit-any
export async function ensurePipelines(supabase: any, clientId: string, agentId: string) {
  const { data: existing } = await supabase
    .from("xj_pipelines")
    .select("id, stage_key")
    .eq("client_id", String(clientId))
    .eq("agent_id", agentId);
  if ((existing ?? []).length > 0) return existing;

  const rows = DEFAULT_PIPELINES.map((p, i) => ({
    client_id: String(clientId),
    agent_id: agentId,
    name: p.name,
    stage_key: p.stage_key,
    color: p.color,
    position: i,
  }));
  const { data } = await supabase.from("xj_pipelines").insert(rows).select("id, stage_key");
  return data ?? [];
}

// deno-lint-ignore no-explicit-any
async function pipelineForStage(supabase: any, clientId: string, agentId: string, stage: XJStage) {
  const pipelines = await ensurePipelines(supabase, clientId, agentId);
  const found = (pipelines ?? []).find((p: any) => p.stage_key === stage);
  return found?.id ?? (pipelines ?? [])[0]?.id ?? null;
}

/** Cria (ou atualiza) o card do lead no CRM do X-Julia. */
// deno-lint-ignore no-explicit-any
export async function upsertDeal(
  supabase: any,
  agent: XJAgent,
  session: XJSession,
  patch: { title?: string; value?: number | null; description?: string | null; priority?: string } = {},
) {
  const pipelineId = await pipelineForStage(supabase, session.client_id, agent.id, session.stage);

  const { data: existing } = await supabase
    .from("xj_deals")
    .select("id, pipeline_id")
    .eq("session_id", session.id)
    .maybeSingle();

  if (existing) {
    const update: Record<string, unknown> = { updated_by: "x-julia" };
    if (patch.title) update.title = patch.title;
    if (patch.value !== undefined) update.value = patch.value;
    if (patch.description !== undefined) update.description = patch.description;
    if (patch.priority) update.priority = patch.priority;
    if (pipelineId && pipelineId !== existing.pipeline_id) {
      update.pipeline_id = pipelineId;
      update.stage_entered_at = new Date().toISOString();
      await supabase.from("xj_deal_history").insert({
        client_id: session.client_id,
        deal_id: existing.id,
        from_pipeline_id: existing.pipeline_id,
        to_pipeline_id: pipelineId,
        action: "moved",
        actor: "x-julia",
        notes: `Estágio: ${session.stage}`,
      });
    }
    await supabase.from("xj_deals").update(update).eq("id", existing.id);
    return existing.id as string;
  }

  const { data, error } = await supabase
    .from("xj_deals")
    .insert({
      client_id: session.client_id,
      agent_id: agent.id,
      pipeline_id: pipelineId,
      session_id: session.id,
      case_id: session.case_id,
      conversation_id: session.conversation_id,
      contact_id: session.contact_id,
      title: patch.title || session.contact_name || session.phone || "Novo lead",
      contact_name: session.contact_name,
      contact_phone: session.phone,
      description: patch.description ?? null,
      value: patch.value ?? null,
      priority: patch.priority ?? "medium",
      campaign_id: session.campaign_id,
      origin: session.origin,
      created_by: "x-julia",
    })
    .select("id")
    .single();
  if (error) throw error;

  await supabase.from("xj_deal_history").insert({
    client_id: session.client_id,
    deal_id: data.id,
    to_pipeline_id: pipelineId,
    action: "created",
    actor: "x-julia",
  });

  if (agent.mirror_to_crm_builder) {
    await mirrorToCrmBuilder(supabase, agent, session, data.id).catch((err) =>
      console.warn("[x-julia/crm] espelhamento falhou:", String(err)),
    );
  }
  return data.id as string;
}

/** Espelhamento opcional no CRM Builder (crm_deals), sem exigir cod_agent da Julia. */
// deno-lint-ignore no-explicit-any
async function mirrorToCrmBuilder(supabase: any, agent: XJAgent, session: XJSession, xjDealId: string) {
  const { data: board } = await supabase
    .from("crm_boards")
    .select("id, cod_agent")
    .eq("client_id", String(session.client_id))
    .order("created_at")
    .limit(1)
    .maybeSingle();
  if (!board) return;

  const { data: pipeline } = await supabase
    .from("crm_pipelines")
    .select("id")
    .eq("board_id", board.id)
    .order("position")
    .limit(1)
    .maybeSingle();

  const { data: mirrored } = await supabase
    .from("crm_deals")
    .insert({
      client_id: String(session.client_id),
      cod_agent: board.cod_agent ?? "",
      board_id: board.id,
      pipeline_id: pipeline?.id ?? null,
      title: session.contact_name || session.phone || "Lead X-Julia",
      contact_name: session.contact_name,
      contact_phone: session.phone,
      created_by: "x-julia",
      custom_fields: {
        links: { chat: { conversation_id: session.conversation_id, contact_id: session.contact_id } },
        x_julia: { session_id: session.id, deal_id: xjDealId },
      },
    })
    .select("id")
    .maybeSingle();

  if (mirrored?.id) {
    await supabase.from("xj_deals").update({ mirrored_deal_id: mirrored.id }).eq("id", xjDealId);
  }
}