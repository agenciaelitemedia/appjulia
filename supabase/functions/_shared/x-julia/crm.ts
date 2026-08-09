// ============================================
// X-Julia — CRM próprio (xj_pipelines / xj_deals) com espelhamento opcional
// ============================================
import type { XJAgent, XJSession, XJStage } from "./types.ts";
import { logXJEvent } from "./session.ts";

export const JULIA_BOARD_NAME = "CRM da Julia";
export const JULIA_BOARD_SYSTEM_KEY = "julia";

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
    if (agent.mirror_to_crm_builder) {
      await syncMirroredDeal(supabase, agent, session, existing.id, patch).catch((err) =>
        console.warn("[x-julia/crm] sync do espelho falhou:", String(err)),
      );
    }
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

/**
 * Garante o quadro único "CRM da Julia" no CRM Builder do escritório,
 * com as 9 etapas padrão da Julia protegidas (is_system).
 */
// deno-lint-ignore no-explicit-any
export async function ensureJuliaBoard(supabase: any, clientId: string, codAgent = "") {
  const client = String(clientId);
  let { data: board } = await supabase
    .from("crm_boards")
    .select("id, cod_agent")
    .eq("client_id", client)
    .eq("system_key", JULIA_BOARD_SYSTEM_KEY)
    .maybeSingle();

  if (!board) {
    // Reaproveita um quadro homônimo criado antes desta versão.
    const { data: legacy } = await supabase
      .from("crm_boards")
      .select("id, cod_agent")
      .eq("client_id", client)
      .eq("name", JULIA_BOARD_NAME)
      .maybeSingle();
    if (legacy) {
      await supabase
        .from("crm_boards")
        .update({ is_system: true, system_key: JULIA_BOARD_SYSTEM_KEY, is_archived: false })
        .eq("id", legacy.id);
      board = legacy;
    }
  }

  if (!board) {
    const { data: created, error } = await supabase
      .from("crm_boards")
      .insert({
        client_id: client,
        cod_agent: codAgent ?? "",
        name: JULIA_BOARD_NAME,
        description: "Quadro gerenciado pela Julia (espelho das sessões do X-Julia)",
        icon: "bot",
        color: "#6366f1",
        position: 0,
        is_system: true,
        system_key: JULIA_BOARD_SYSTEM_KEY,
        created_by: "x-julia",
      })
      .select("id, cod_agent")
      .single();
    if (error) throw error;
    board = created;
  }

  // Etapas padrão da Julia (idempotente por stage_key).
  const { data: stages } = await supabase
    .from("crm_pipelines")
    .select("id, stage_key")
    .eq("board_id", board.id);
  const existingKeys = new Set((stages ?? []).map((s: any) => s.stage_key).filter(Boolean));
  const missing = DEFAULT_PIPELINES.filter((p) => !existingKeys.has(p.stage_key));
  if (missing.length > 0) {
    await supabase.from("crm_pipelines").insert(
      missing.map((p) => ({
        board_id: board!.id,
        client_id: client,
        cod_agent: board!.cod_agent ?? "",
        name: p.name,
        color: p.color,
        position: DEFAULT_PIPELINES.findIndex((d) => d.stage_key === p.stage_key),
        is_system: true,
        stage_key: p.stage_key,
      })),
    );
  }
  return board as { id: string; cod_agent: string | null };
}

/** Fase do quadro "CRM da Julia" correspondente à etapa da sessão. */
// deno-lint-ignore no-explicit-any
async function juliaBoardPipeline(supabase: any, boardId: string, stage: XJStage) {
  const { data } = await supabase
    .from("crm_pipelines")
    .select("id, stage_key, position")
    .eq("board_id", boardId)
    .order("position");
  const rows = (data ?? []) as any[];
  return rows.find((r) => r.stage_key === stage)?.id ?? rows[0]?.id ?? null;
}

/** Espelhamento no CRM Builder (crm_deals), sempre no quadro "CRM da Julia". */
// deno-lint-ignore no-explicit-any
async function mirrorToCrmBuilder(supabase: any, agent: XJAgent, session: XJSession, xjDealId: string) {
  const board = await ensureJuliaBoard(supabase, session.client_id);
  const pipelineId = await juliaBoardPipeline(supabase, board.id, session.stage);

  const { data: mirrored, error } = await supabase
    .from("crm_deals")
    .insert({
      client_id: String(session.client_id),
      cod_agent: board.cod_agent ?? "",
      board_id: board.id,
      pipeline_id: pipelineId,
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

  if (error) {
    await logXJEvent(supabase, session, { kind: "crm_mirror", status: "error", detail: error.message });
    throw error;
  }

  if (mirrored?.id) {
    await supabase.from("xj_deals").update({ mirrored_deal_id: mirrored.id }).eq("id", xjDealId);
    await logXJEvent(supabase, session, {
      kind: "crm_mirror",
      status: "created",
      detail: `Card criado no quadro ${JULIA_BOARD_NAME}`,
      payload: { board_id: board.id, deal_id: mirrored.id },
    });
  }
}

/** Mantém o card espelhado em sincronia (dados + fase). */
// deno-lint-ignore no-explicit-any
async function syncMirroredDeal(
  supabase: any,
  agent: XJAgent,
  session: XJSession,
  xjDealId: string,
  patch: { title?: string; value?: number | null; description?: string | null; priority?: string },
) {
  const { data: xjDeal } = await supabase
    .from("xj_deals")
    .select("mirrored_deal_id")
    .eq("id", xjDealId)
    .maybeSingle();

  // Sem espelho ainda (toggle ligado depois da criação): cria agora.
  if (!xjDeal?.mirrored_deal_id) {
    await mirrorToCrmBuilder(supabase, agent, session, xjDealId);
    return;
  }

  const { data: mirrored } = await supabase
    .from("crm_deals")
    .select("id, board_id, pipeline_id")
    .eq("id", xjDeal.mirrored_deal_id)
    .maybeSingle();
  if (!mirrored) return;

  const update: Record<string, unknown> = { updated_by: "x-julia" };
  if (patch.title) update.title = patch.title;
  if (patch.value !== undefined && patch.value !== null) update.value = patch.value;
  if (patch.description !== undefined && patch.description !== null) update.description = patch.description;
  if (patch.priority) update.priority = patch.priority;
  if (session.contact_name) update.contact_name = session.contact_name;
  if (session.phone) update.contact_phone = session.phone;

  const targetPipeline = await juliaBoardPipeline(supabase, mirrored.board_id, session.stage);
  const moved = !!targetPipeline && targetPipeline !== mirrored.pipeline_id;
  if (moved) {
    update.pipeline_id = targetPipeline;
    update.stage_entered_at = new Date().toISOString();
  }

  const { error } = await supabase.from("crm_deals").update(update).eq("id", mirrored.id);
  if (error) {
    await logXJEvent(supabase, session, { kind: "crm_mirror", status: "error", detail: error.message });
    return;
  }

  if (moved) {
    await supabase
      .from("crm_deal_history")
      .insert({
        deal_id: mirrored.id,
        action: "moved",
        from_pipeline_id: mirrored.pipeline_id,
        to_pipeline_id: targetPipeline,
        changed_by: "x-julia",
        notes: `Etapa da Julia: ${session.stage}`,
      })
      .then(undefined, (err: unknown) => console.warn("[x-julia/crm] histórico do espelho falhou:", String(err)));
  }

  await logXJEvent(supabase, session, {
    kind: "crm_mirror",
    status: moved ? "moved" : "updated",
    detail: moved ? `Card movido para a etapa ${session.stage}` : "Card espelhado atualizado",
    payload: { deal_id: mirrored.id },
  });
}