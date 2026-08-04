// ============================================
// Ações de CRM (Builder) para os nós de fluxo
// ============================================
import { interpolate } from "./context.ts";
import type { FlowRunContext } from "./types.ts";

function digits(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

async function firstPipeline(supabase: any, boardId: string): Promise<string | null> {
  const { data } = await supabase
    .from("crm_pipelines")
    .select("id")
    .eq("board_id", boardId)
    .eq("is_active", true)
    .order("position")
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

/** Card do lead no quadro: vínculo salvo → telefone do contato. */
async function findDeal(
  supabase: any,
  ctx: FlowRunContext,
  boardId: string | null,
): Promise<Record<string, any> | null> {
  if (ctx.conversation?.id) {
    const { data: link } = await supabase
      .from("chat_crm_links")
      .select("external_id")
      .eq("conversation_id", ctx.conversation.id)
      .eq("external_system", "crm_builder")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (link?.external_id) {
      const { data } = await supabase
        .from("crm_deals")
        .select("*")
        .eq("id", link.external_id)
        .maybeSingle();
      if (data) return data;
    }
  }

  const phone = digits(ctx.contact?.phone);
  if (!phone) return null;
  const tail = phone.slice(-8);

  let query = supabase
    .from("crm_deals")
    .select("*")
    .eq("client_id", ctx.clientId)
    .ilike("contact_phone", `%${tail}%`)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (boardId) query = query.eq("board_id", boardId);

  const { data } = await query.maybeSingle();
  return data ?? null;
}

async function linkConversation(supabase: any, ctx: FlowRunContext, dealId: string) {
  if (!ctx.conversation?.id) return;
  await supabase.from("chat_crm_links").insert({
    client_id: ctx.clientId,
    conversation_id: ctx.conversation.id,
    contact_id: ctx.contact?.id ?? null,
    external_system: "crm_builder",
    external_id: dealId,
    sync_direction: "outbound",
    last_synced_at: new Date().toISOString(),
  });
}

export async function actionCrmCreateCard(
  supabase: any,
  config: Record<string, any>,
  ctx: FlowRunContext,
): Promise<string> {
  const boardId = String(config.board_id ?? "");
  if (!boardId) throw new Error("quadro do CRM não configurado");

  const title = interpolate(String(config.title ?? ""), ctx).trim() ||
    ctx.contact?.name || ctx.contact?.push_name || "Novo card";

  if (ctx.simulate) return `Criaria o card "${title}"`;

  if (config.skip_if_exists !== false) {
    const existing = await findDeal(supabase, ctx, boardId);
    if (existing) return `Card já existia neste quadro (${existing.title})`;
  }

  const pipelineId = String(config.pipeline_id ?? "") || (await firstPipeline(supabase, boardId));
  if (!pipelineId) throw new Error("quadro sem fases cadastradas");

  const { data, error } = await supabase
    .from("crm_deals")
    .insert({
      client_id: ctx.clientId,
      board_id: boardId,
      pipeline_id: pipelineId,
      title,
      description: interpolate(String(config.description ?? ""), ctx) || null,
      contact_name: ctx.contact?.name ?? ctx.contact?.push_name ?? null,
      contact_phone: ctx.contact?.phone ?? null,
      value: config.value ? Number(config.value) : null,
      priority: String(config.priority ?? "medium"),
      status: "open",
      position: 0,
      assigned_to: String(config.assigned_to ?? "") || null,
      created_by: "Automação",
      stage_entered_at: new Date().toISOString(),
    })
    .select("id, title")
    .maybeSingle();

  if (error) throw new Error(`falha ao criar card: ${error.message}`);
  if (data?.id && config.link_conversation !== false) await linkConversation(supabase, ctx, data.id);
  return `Card "${data?.title ?? title}" criado no CRM`;
}

export async function actionCrmMoveCard(
  supabase: any,
  config: Record<string, any>,
  ctx: FlowRunContext,
): Promise<string> {
  const pipelineId = String(config.pipeline_id ?? "");
  if (!pipelineId) throw new Error("fase de destino não configurada");
  if (ctx.simulate) return "Moveria o card do lead para a fase escolhida";

  const boardId = String(config.board_id ?? "") || null;
  const deal = await findDeal(supabase, ctx, boardId);
  if (!deal) throw new Error("card do lead não encontrado no CRM");

  const { error } = await supabase
    .from("crm_deals")
    .update({
      pipeline_id: pipelineId,
      board_id: boardId ?? deal.board_id,
      stage_entered_at: new Date().toISOString(),
      updated_by: "Automação",
    })
    .eq("id", deal.id);
  if (error) throw new Error(`falha ao mover card: ${error.message}`);

  const { data: stage } = await supabase
    .from("crm_pipelines")
    .select("name")
    .eq("id", pipelineId)
    .maybeSingle();
  return `Card movido para "${stage?.name ?? "nova fase"}"`;
}

export async function actionCrmUpdateCard(
  supabase: any,
  config: Record<string, any>,
  ctx: FlowRunContext,
): Promise<string> {
  if (ctx.simulate) return "Atualizaria os campos do card do lead";

  const boardId = String(config.board_id ?? "") || null;
  const deal = await findDeal(supabase, ctx, boardId);
  if (!deal) throw new Error("card do lead não encontrado no CRM");

  const update: Record<string, unknown> = { updated_by: "Automação" };
  if (String(config.priority ?? "")) update.priority = config.priority;
  if (String(config.status ?? "")) update.status = config.status;
  if (String(config.assigned_to ?? "")) update.assigned_to = String(config.assigned_to);
  if (config.value !== undefined && config.value !== "" && config.value !== null) {
    update.value = Number(config.value);
  }
  const title = interpolate(String(config.title ?? ""), ctx).trim();
  if (title) update.title = title;
  const description = interpolate(String(config.description ?? ""), ctx).trim();
  if (description) update.description = description;

  if (Object.keys(update).length === 1) throw new Error("nenhum campo para atualizar");

  const { error } = await supabase.from("crm_deals").update(update).eq("id", deal.id);
  if (error) throw new Error(`falha ao atualizar card: ${error.message}`);
  return `Card "${deal.title}" atualizado`;
}

export async function actionCrmLinkConversation(
  supabase: any,
  config: Record<string, any>,
  ctx: FlowRunContext,
): Promise<string> {
  if (ctx.simulate) return "Vincularia a conversa ao card do lead";
  if (!ctx.conversation?.id) throw new Error("sem conversa para vincular");

  const deal = await findDeal(supabase, ctx, String(config.board_id ?? "") || null);
  if (!deal) throw new Error("card do lead não encontrado no CRM");

  const { data: existing } = await supabase
    .from("chat_crm_links")
    .select("id")
    .eq("conversation_id", ctx.conversation.id)
    .eq("external_system", "crm_builder")
    .eq("external_id", deal.id)
    .maybeSingle();
  if (existing) return "Conversa já estava vinculada ao card";

  await linkConversation(supabase, ctx, deal.id);
  return `Conversa vinculada ao card "${deal.title}"`;
}
