/**
 * Domínio: escrita controlada (P2 do backlog).
 *
 * Nenhuma tool genérica de escrita. Toda operação exige:
 *  - escopo OAuth específico (julia:write.crm / julia:write.messages);
 *  - `dry_run` (padrão true) e, para aplicar, `approved_by`;
 *  - `idempotency_key` (retry devolve o mesmo audit_id);
 *  - `expected_version` opcional para controle otimista;
 *  - allowlist de campos e de transições;
 *  - auditoria completa em `cop_write_audit`.
 */
import { assertBoardMcpAccess } from "../board-access.ts";
import { CopilotoError, nowIso, ok, safeDbError, type ToolOutput } from "../envelope.ts";
import { SCOPE_WRITE_CRM, SCOPE_WRITE_MESSAGES, str, type CopilotoContext, type CopilotoTool, type ToolArgs } from "../types.ts";

const COMMON_PROPS = {
  dry_run: { type: "boolean", description: "true (padrão) apenas simula e mostra before/after. false aplica de verdade." },
  idempotency_key: { type: "string", description: "Chave única da operação. Reenvio com a mesma chave não duplica o efeito." },
  reason: { type: "string", description: "Motivo da alteração (registrado na auditoria)." },
  expected_version: { type: "string", description: "updated_at esperado do registro. Divergência devolve CONFLICT." },
  approved_by: { type: "string", description: "Quem aprovou a execução real (obrigatório quando dry_run=false)." },
};

const LEAD_FIELDS = ["title", "description", "value", "priority", "contact_name", "contact_email", "expected_close_date", "due_date"] as const;
const DEAL_STATUS = ["open", "won", "lost"] as const;
const DEAL_PRIORITY = ["low", "medium", "high", "urgent"] as const;
const CONTACT_CHANNELS = ["whatsapp_uazapi", "whatsapp_waba", "instagram", "webchat"] as const;

interface WriteEnv {
  dryRun: boolean;
  key: string;
  reason: string;
  approvedBy: string | null;
  expectedVersion: string | null;
}

function writeEnv(args: ToolArgs): WriteEnv {
  const key = str(args.idempotency_key);
  if (!key) throw new CopilotoError("INVALID_INPUT", "idempotency_key é obrigatório em toda operação de escrita.");
  const dryRun = args.dry_run === false ? false : true;
  const approvedBy = str(args.approved_by) || null;
  if (!dryRun && !approvedBy) {
    throw new CopilotoError("APPROVAL_REQUIRED", "Execução real exige approved_by (aprovação humana identificada).");
  }
  return { dryRun, key, reason: str(args.reason) || "não informado", approvedBy, expectedVersion: str(args.expected_version) || null };
}

/** Idempotência real: se a chave já foi aplicada, devolve o mesmo resultado. */
async function findReplay(ctx: CopilotoContext, action: string, key: string) {
  const { data } = await ctx.supabase
    .from("cop_write_audit")
    .select("id, applied, before_data, after_data, created_at")
    .eq("client_id", ctx.clientId)
    .eq("action", action)
    .eq("idempotency_key", key)
    .eq("applied", true)
    .maybeSingle();
  return data ?? null;
}

async function audit(
  ctx: CopilotoContext,
  row: {
    action: string;
    target_table: string;
    target_id: string | null;
    env: WriteEnv;
    // deno-lint-ignore no-explicit-any
    before: any;
    // deno-lint-ignore no-explicit-any
    after: any;
    applied: boolean;
    result: string;
  },
): Promise<string> {
  const { data, error } = await ctx.supabase
    .from("cop_write_audit")
    .insert({
      client_id: ctx.clientId,
      token_id: ctx.tokenId ?? null,
      actor_email: ctx.userEmail ?? null,
      action: row.action,
      target_table: row.target_table,
      target_id: row.target_id,
      idempotency_key: row.env.key,
      reason: row.env.reason,
      approved_by: row.env.approvedBy ?? null,
      dry_run: row.env.dryRun,
      applied: row.applied,
      before_data: row.before ?? null,
      after_data: row.after ?? null,
      result: row.result,
      request_id: ctx.requestId ?? null,
    })
    .select("id")
    .maybeSingle();
  if (error) {
    // Sem auditoria não se aplica escrita.
    throw safeDbError("database", error);
  }
  return String(data?.id ?? "");
}

function checkVersion(env: WriteEnv, current: unknown) {
  if (!env.expectedVersion) return;
  const cur = current ? new Date(String(current)).toISOString() : "";
  const exp = new Date(env.expectedVersion).toISOString();
  if (cur !== exp) {
    throw new CopilotoError("CONFLICT", "O registro mudou desde a leitura (expected_version divergente). Releia e tente novamente.", {
      details: { expected_version: exp, current_version: cur || null },
    });
  }
}

// deno-lint-ignore no-explicit-any
function result(ctx: CopilotoContext, toolName: string, payload: Record<string, any>, summary: string): ToolOutput {
  return ok(payload, { requestId: ctx.requestId!, toolName, toolVersion: "1.0.0", text: summary });
}

async function loadDeal(ctx: CopilotoContext, dealId: string) {
  const { data, error } = await ctx.supabase
    .from("crm_deals")
    .select("id, title, description, value, priority, status, pipeline_id, board_id, contact_name, contact_phone, contact_email, assigned_to, assigned_user_id, expected_close_date, due_date, updated_at")
    .eq("client_id", ctx.clientId)
    .eq("id", dealId)
    .maybeSingle();
  if (error) throw safeDbError("database", error);
  if (!data) throw new CopilotoError("NOT_FOUND", "Negócio (deal) não encontrado neste escritório.");
  return data;
}

/**
 * Registra o evento na linha do tempo do card (crm_deal_history).
 * Best-effort: nunca quebra nem desfaz a operação já aplicada.
 */
async function logDealHistory(
  ctx: CopilotoContext,
  entry: {
    dealId: string;
    action: "created" | "moved" | "updated" | "note_added" | "won" | "lost" | "archived";
    fromPipelineId?: string | null;
    toPipelineId?: string | null;
    // deno-lint-ignore no-explicit-any
    changes?: Record<string, any>;
    notes?: string;
  },
): Promise<void> {
  try {
    await ctx.supabase.from("crm_deal_history").insert({
      deal_id: entry.dealId,
      action: entry.action,
      from_pipeline_id: entry.fromPipelineId ?? null,
      to_pipeline_id: entry.toPipelineId ?? null,
      changed_by: ctx.userEmail ?? "MCP",
      changes: entry.changes ?? {},
      notes: entry.notes ?? null,
    });
  } catch (_err) {
    console.warn("[copiloto] falha ao registrar crm_deal_history", entry.dealId, entry.action);
  }
}

/** Variantes BR do telefone (12 e 13 dígitos, com e sem o nono dígito). */
function brVariants(raw: string): string[] {
  let d = String(raw ?? "").replace(/@.*/, "").replace(/\D/g, "");
  if (!d) return [];
  if (d.startsWith("055")) d = d.slice(1);
  if (!d.startsWith("55") && (d.length === 10 || d.length === 11)) d = `55${d}`;
  const out = new Set<string>([d]);
  if (d.startsWith("55")) {
    const ddd = d.slice(2, 4);
    if (d.length === 13 && d[4] === "9") out.add(`55${ddd}${d.slice(5)}`);
    else if (d.length === 12 && /[6-9]/.test(d[4] ?? "")) out.add(`55${ddd}9${d.slice(4)}`);
  }
  return [...out];
}

/** Normaliza texto para comparação (sem acento, minúsculo, sem espaços extras). */
function norm(text: string): string {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export const escritaTools: CopilotoTool[] = [
  {
    name: "julia_lead_atualizar",
    version: "1.0.0",
    mode: "write",
    requiredScope: SCOPE_WRITE_CRM,
    description:
      "Atualiza campos permitidos de um negócio do CRM Builder (título, descrição, valor, prioridade, contato, datas previstas). Simula por padrão (dry_run). Campos fora da allowlist são recusados.",
    inputSchema: {
      type: "object",
      properties: {
        deal_id: { type: "string", description: "UUID do negócio (de julia_builder_listar_negocios)." },
        campos: {
          type: "object",
          description: `Somente estes campos: ${LEAD_FIELDS.join(", ")}.`,
          additionalProperties: true,
        },
        ...COMMON_PROPS,
      },
      required: ["deal_id", "campos", "idempotency_key"],
      additionalProperties: false,
    },
    run: async (ctx, args): Promise<ToolOutput> => {
      const env = writeEnv(args);
      const dealId = str(args.deal_id);
      const replay = await findReplay(ctx, "lead_atualizar", env.key);
      if (replay) {
        return result(
          ctx,
          "julia_lead_atualizar",
          { applied: true, dry_run: false, before: replay.before_data, after: replay.after_data, audit_id: replay.id, replay: true },
          `Operação já aplicada anteriormente com esta idempotency_key (audit_id ${replay.id}). Nada foi repetido.`,
        );
      }

      const before = await loadDeal(ctx, dealId);
      if (before.board_id) await assertBoardMcpAccess(ctx, String(before.board_id), "edit");
      checkVersion(env, before.updated_at);

      const raw = (args.campos || {}) as Record<string, unknown>;
      const invalidFields = Object.keys(raw).filter((k) => !LEAD_FIELDS.includes(k as typeof LEAD_FIELDS[number]));
      if (invalidFields.length) {
        throw new CopilotoError("INVALID_INPUT", `Campos não permitidos: ${invalidFields.join(", ")}.`, {
          details: { allowlist: LEAD_FIELDS },
        });
      }
      if (!Object.keys(raw).length) throw new CopilotoError("INVALID_INPUT", "Informe ao menos um campo permitido em `campos`.");

      const after = { ...before, ...raw, updated_at: nowIso() };
      let applied = false;
      if (!env.dryRun) {
        const { error } = await ctx.supabase
          .from("crm_deals")
          .update({ ...raw, updated_at: nowIso(), updated_by: ctx.userEmail ?? "mcp" })
          .eq("client_id", ctx.clientId)
          .eq("id", dealId);
        if (error) throw safeDbError("database", error);
        applied = true;
      }

      const auditId = await audit(ctx, {
        action: "lead_atualizar",
        target_table: "crm_deals",
        target_id: dealId,
        env,
        before,
        after,
        applied,
        result: applied ? "applied" : "dry_run",
      });

      if (applied) {
        // deno-lint-ignore no-explicit-any
        const changes: Record<string, any> = {};
        for (const k of Object.keys(raw)) {
          changes[k] = { from: (before as Record<string, unknown>)[k] ?? null, to: raw[k] ?? null };
        }
        await logDealHistory(ctx, {
          dealId: dealId,
          action: "updated",
          toPipelineId: before.pipeline_id ?? null,
          changes,
          notes: `Alterado via conector MCP (${Object.keys(raw).join(", ")}) · motivo: ${env.reason} · audit ${auditId}`,
        });
      }



      return result(
        ctx,
        "julia_lead_atualizar",
        { applied, dry_run: env.dryRun, before, after, audit_id: auditId },
        `${applied ? "Aplicado" : "Simulação (dry_run)"}: ${Object.keys(raw).join(", ")} no negócio ${dealId}. audit_id ${auditId}.`,
      );
    },
  },
  {
    name: "julia_lead_atribuir_responsavel",
    version: "1.0.0",
    mode: "write",
    requiredScope: SCOPE_WRITE_CRM,
    description:
      "Define o responsável de um negócio do CRM Builder e/ou do atendimento vinculado. Simula por padrão. Exige nome do responsável (e, opcionalmente, o ID numérico).",
    inputSchema: {
      type: "object",
      properties: {
        deal_id: { type: "string", description: "UUID do negócio." },
        conversation_id: { type: "string", description: "UUID do atendimento (opcional, para atribuir também no chat)." },
        responsavel: { type: "string", description: "Nome do responsável." },
        responsavel_id: { type: "string", description: "ID numérico do responsável (assigned_user_id)." },
        ...COMMON_PROPS,
      },
      required: ["responsavel", "idempotency_key"],
      additionalProperties: false,
    },
    run: async (ctx, args): Promise<ToolOutput> => {
      const env = writeEnv(args);
      const dealId = str(args.deal_id);
      const convId = str(args.conversation_id);
      const nome = str(args.responsavel);
      const userId = str(args.responsavel_id);
      if (!dealId && !convId) throw new CopilotoError("INVALID_INPUT", "Informe deal_id e/ou conversation_id.");

      const replay = await findReplay(ctx, "lead_atribuir_responsavel", env.key);
      if (replay) {
        return result(
          ctx,
          "julia_lead_atribuir_responsavel",
          { applied: true, dry_run: false, before: replay.before_data, after: replay.after_data, audit_id: replay.id, replay: true },
          `Atribuição já aplicada com esta idempotency_key (audit_id ${replay.id}).`,
        );
      }

      // deno-lint-ignore no-explicit-any
      const before: Record<string, any> = {};
      if (dealId) before.deal = await loadDeal(ctx, dealId);
      if (convId) {
        const { data, error } = await ctx.supabase
          .from("chat_conversations")
          .select("id, assigned_to, assigned_user_id, status, updated_at")
          .eq("client_id", ctx.clientId)
          .eq("id", convId)
          .maybeSingle();
        if (error) throw safeDbError("database", error);
        if (!data) throw new CopilotoError("NOT_FOUND", "Atendimento não encontrado neste escritório.");
        before.conversation = data;
      }
      checkVersion(env, before.deal?.updated_at ?? before.conversation?.updated_at);

      const after = JSON.parse(JSON.stringify(before));
      if (after.deal) {
        after.deal.assigned_to = nome;
        if (userId) after.deal.assigned_user_id = Number(userId);
      }
      if (after.conversation) {
        after.conversation.assigned_to = nome;
        if (userId) after.conversation.assigned_user_id = Number(userId);
      }

      let applied = false;
      if (!env.dryRun) {
        if (dealId) {
          const { error } = await ctx.supabase
            .from("crm_deals")
            .update({ assigned_to: nome, ...(userId ? { assigned_user_id: Number(userId) } : {}), updated_at: nowIso() })
            .eq("client_id", ctx.clientId)
            .eq("id", dealId);
          if (error) throw safeDbError("database", error);
        }
        if (convId) {
          const { error } = await ctx.supabase
            .from("chat_conversations")
            .update({ assigned_to: nome, ...(userId ? { assigned_user_id: Number(userId) } : {}), assigned_at: nowIso(), updated_at: nowIso() })
            .eq("client_id", ctx.clientId)
            .eq("id", convId);
          if (error) throw safeDbError("database", error);
        }
        applied = true;
      }

      const auditId = await audit(ctx, {
        action: "lead_atribuir_responsavel",
        target_table: dealId ? "crm_deals" : "chat_conversations",
        target_id: dealId || convId,
        env,
        before,
        after,
        applied,
        result: applied ? "applied" : "dry_run",
      });

      if (applied && dealId) {
        await logDealHistory(ctx, {
          dealId,
          action: "updated",
          toPipelineId: before.deal?.pipeline_id ?? null,
          changes: {
            assigned_to: { from: before.deal?.assigned_to ?? null, to: nome },
            ...(userId ? { assigned_user_id: { from: before.deal?.assigned_user_id ?? null, to: Number(userId) } } : {}),
          },
          notes: `Responsável definido via conector MCP: ${nome} · motivo: ${env.reason} · audit ${auditId}`,
        });
      }



      return result(
        ctx,
        "julia_lead_atribuir_responsavel",
        { applied, dry_run: env.dryRun, before, after, audit_id: auditId },
        `${applied ? "Aplicado" : "Simulação (dry_run)"}: responsável ${nome}${dealId ? ` no negócio ${dealId}` : ""}${convId ? ` e no atendimento ${convId}` : ""}. audit_id ${auditId}.`,
      );
    },
  },
  {
    name: "julia_lead_alterar_estagio",
    version: "1.0.0",
    mode: "write",
    requiredScope: SCOPE_WRITE_CRM,
    description:
      "Move um negócio do CRM Builder para outra etapa do mesmo quadro (e, opcionalmente, muda o status entre open/won/lost). Recusa etapa de outro quadro ou de outro escritório. Simula por padrão.",
    inputSchema: {
      type: "object",
      properties: {
        deal_id: { type: "string", description: "UUID do negócio." },
        pipeline_id: { type: "string", description: "UUID da etapa destino (do mesmo quadro)." },
        status: { type: "string", enum: [...DEAL_STATUS], description: "Novo status (open, won, lost)." },
        ...COMMON_PROPS,
      },
      required: ["deal_id", "idempotency_key"],
      additionalProperties: false,
    },
    run: async (ctx, args): Promise<ToolOutput> => {
      const env = writeEnv(args);
      const dealId = str(args.deal_id);
      const pipelineId = str(args.pipeline_id);
      const status = str(args.status);
      if (!pipelineId && !status) throw new CopilotoError("INVALID_INPUT", "Informe pipeline_id e/ou status.");
      if (status && !DEAL_STATUS.includes(status as typeof DEAL_STATUS[number])) {
        throw new CopilotoError("INVALID_INPUT", `Status inválido. Use: ${DEAL_STATUS.join(", ")}.`);
      }

      const replay = await findReplay(ctx, "lead_alterar_estagio", env.key);
      if (replay) {
        return result(
          ctx,
          "julia_lead_alterar_estagio",
          { applied: true, dry_run: false, before: replay.before_data, after: replay.after_data, audit_id: replay.id, replay: true },
          `Movimentação já aplicada com esta idempotency_key (audit_id ${replay.id}).`,
        );
      }

      const before = await loadDeal(ctx, dealId);
      if (before.board_id) await assertBoardMcpAccess(ctx, String(before.board_id), "move");
      checkVersion(env, before.updated_at);

      // deno-lint-ignore no-explicit-any
      let pipeline: any = null;
      if (pipelineId) {
        const { data, error } = await ctx.supabase
          .from("crm_pipelines")
          .select("id, name, board_id")
          .eq("id", pipelineId)
          .maybeSingle();
        if (error) throw safeDbError("database", error);
        if (!data) throw new CopilotoError("NOT_FOUND", "Etapa destino não encontrada.");
        if (String(data.board_id) !== String(before.board_id)) {
          throw new CopilotoError("INVALID_INPUT", "Transição inválida: a etapa destino pertence a outro quadro.");
        }
        pipeline = data;
      }

      const patch = {
        ...(pipelineId ? { pipeline_id: pipelineId, stage_entered_at: nowIso() } : {}),
        ...(status ? { status } : {}),
        updated_at: nowIso(),
      };
      const after = { ...before, ...patch, etapa_destino: pipeline?.name ?? null };

      let applied = false;
      if (!env.dryRun) {
        const { error } = await ctx.supabase.from("crm_deals").update(patch).eq("client_id", ctx.clientId).eq("id", dealId);
        if (error) throw safeDbError("database", error);
        applied = true;
      }

      const auditId = await audit(ctx, {
        action: "lead_alterar_estagio",
        target_table: "crm_deals",
        target_id: dealId,
        env,
        before,
        after,
        applied,
        result: applied ? "applied" : "dry_run",
      });

      if (applied) {
        if (pipelineId) {
          await logDealHistory(ctx, {
            dealId,
            action: "moved",
            fromPipelineId: before.pipeline_id ?? null,
            toPipelineId: pipelineId,
            changes: { pipeline_id: { from: before.pipeline_id ?? null, to: pipelineId } },
            notes: `Movido via conector MCP para "${pipeline?.name ?? pipelineId}" · motivo: ${env.reason} · audit ${auditId}`,
          });
        }
        if (status && status !== before.status) {
          await logDealHistory(ctx, {
            dealId,
            action: status === "won" ? "won" : status === "lost" ? "lost" : "updated",
            toPipelineId: pipelineId || before.pipeline_id || null,
            changes: { status: { from: before.status ?? null, to: status } },
            notes: `Status alterado via conector MCP: ${before.status ?? "—"} → ${status} · motivo: ${env.reason} · audit ${auditId}`,
          });
        }
      }



      return result(
        ctx,
        "julia_lead_alterar_estagio",
        { applied, dry_run: env.dryRun, before, after, audit_id: auditId },
        `${applied ? "Aplicado" : "Simulação (dry_run)"}: negócio ${dealId} → etapa ${pipeline?.name || "(sem mudança)"}${status ? ` · status ${status}` : ""}. audit_id ${auditId}.`,
      );
    },
  },
  {
    name: "julia_followup_registrar",
    version: "1.0.0",
    mode: "write",
    requiredScope: SCOPE_WRITE_CRM,
    description:
      "Registra uma tarefa de follow-up para a equipe (título, descrição, prazo, responsável), sem enviar nada ao cliente. Simula por padrão.",
    inputSchema: {
      type: "object",
      properties: {
        titulo: { type: "string", description: "Título da tarefa de follow-up." },
        descricao: { type: "string", description: "Próximo passo combinado." },
        prazo: { type: "string", description: "Data/hora limite em ISO 8601." },
        responsavel: { type: "string", description: "Nome do responsável." },
        responsavel_id: { type: "string", description: "ID numérico do responsável." },
        deal_id: { type: "string", description: "UUID do negócio relacionado (opcional)." },
        ...COMMON_PROPS,
      },
      required: ["titulo", "idempotency_key"],
      additionalProperties: false,
    },
    run: async (ctx, args): Promise<ToolOutput> => {
      const env = writeEnv(args);
      const replay = await findReplay(ctx, "followup_registrar", env.key);
      if (replay) {
        return result(
          ctx,
          "julia_followup_registrar",
          { applied: true, dry_run: false, before: null, after: replay.after_data, audit_id: replay.id, replay: true },
          `Follow-up já registrado com esta idempotency_key (audit_id ${replay.id}).`,
        );
      }

      const dealId = str(args.deal_id);
      if (dealId) await loadDeal(ctx, dealId);

      const row = {
        client_id: ctx.clientId,
        title: str(args.titulo),
        description: str(args.descricao) || null,
        due_date: args.prazo ? new Date(String(args.prazo)).toISOString() : null,
        assigned_name: str(args.responsavel) || null,
        assigned_user_id: str(args.responsavel_id) ? Number(str(args.responsavel_id)) : null,
        deal_id: dealId || null,
        status: "pending",
        created_by: ctx.userEmail ?? "mcp",
      };

      let applied = false;
      // deno-lint-ignore no-explicit-any
      let created: any = null;
      if (!env.dryRun) {
        const { data, error } = await ctx.supabase.from("tasks").insert(row).select("*").maybeSingle();
        if (error) throw safeDbError("database", error);
        created = data;
        applied = true;
      }

      const auditId = await audit(ctx, {
        action: "followup_registrar",
        target_table: "tasks",
        target_id: created?.id ?? null,
        env,
        before: null,
        after: created ?? row,
        applied,
        result: applied ? "applied" : "dry_run",
      });

      return result(
        ctx,
        "julia_followup_registrar",
        { applied, dry_run: env.dryRun, before: null, after: created ?? row, audit_id: auditId },
        `${applied ? "Tarefa criada" : "Simulação (dry_run)"}: "${row.title}"${row.due_date ? ` · prazo ${row.due_date}` : ""}. audit_id ${auditId}.`,
      );
    },
  },
  {
    name: "julia_mensagem_enviar",
    version: "1.0.0",
    mode: "write",
    requiredScope: SCOPE_WRITE_MESSAGES,
    description:
      "Envia uma mensagem de texto ao lead pela fila do escritório (escopo julia:write.messages). Simula por padrão; a execução real exige approved_by. Não gera, assina nem envia contrato.",
    inputSchema: {
      type: "object",
      properties: {
        conversation_id: { type: "string", description: "UUID do atendimento destino." },
        texto: { type: "string", description: "Conteúdo da mensagem (máx. 3000 caracteres)." },
        ...COMMON_PROPS,
      },
      required: ["conversation_id", "texto", "idempotency_key"],
      additionalProperties: false,
    },
    run: async (ctx, args): Promise<ToolOutput> => {
      const env = writeEnv(args);
      const convId = str(args.conversation_id);
      const texto = str(args.texto);
      if (!texto) throw new CopilotoError("INVALID_INPUT", "Informe o texto da mensagem.");
      if (texto.length > 3000) throw new CopilotoError("INVALID_INPUT", "Texto acima de 3000 caracteres.");

      const replay = await findReplay(ctx, "mensagem_enviar", env.key);
      if (replay) {
        return result(
          ctx,
          "julia_mensagem_enviar",
          { applied: true, dry_run: false, before: null, after: replay.after_data, audit_id: replay.id, replay: true },
          `Mensagem já enviada com esta idempotency_key (audit_id ${replay.id}). Nada foi reenviado.`,
        );
      }

      const { data: conv, error } = await ctx.supabase
        .from("chat_conversations")
        .select("id, contact_id, queue_id, status, channel, updated_at")
        .eq("client_id", ctx.clientId)
        .eq("id", convId)
        .maybeSingle();
      if (error) throw safeDbError("database", error);
      if (!conv) throw new CopilotoError("NOT_FOUND", "Atendimento não encontrado neste escritório.");
      if (!conv.queue_id) throw new CopilotoError("INVALID_INPUT", "Atendimento sem fila vinculada: não há canal de envio.");
      checkVersion(env, conv.updated_at);

      const { data: contact } = await ctx.supabase
        .from("chat_contacts")
        .select("id, name, phone")
        .eq("client_id", ctx.clientId)
        .eq("id", conv.contact_id)
        .maybeSingle();
      if (!contact?.phone) throw new CopilotoError("INVALID_INPUT", "Contato sem telefone para envio.");

      // Fila do escritório: define o canal real de envio (WABA oficial ou UaZapi).
      const { data: queue } = await ctx.supabase
        .from("queues")
        .select("id, name, channel_type, evo_url, evo_apikey, waba_token, waba_number_id")
        .eq("client_id", ctx.clientId)
        .eq("id", conv.queue_id)
        .maybeSingle();
      if (!queue) throw new CopilotoError("NOT_FOUND", "Fila do atendimento não pertence a este escritório.");
      const isWaba = String(queue.channel_type || "").toLowerCase().includes("waba") || (!queue.evo_url && !!queue.waba_token);
      if (isWaba ? !queue.waba_token : !(queue.evo_url && queue.evo_apikey)) {
        throw new CopilotoError("INVALID_INPUT", "A fila do atendimento não possui credenciais de envio configuradas.");
      }

      const preview = {
        conversation_id: convId,
        contato: contact.name,
        telefone: contact.phone,
        queue_id: conv.queue_id,
        fila: queue.name,
        canal: isWaba ? "waba" : "uazapi",
        texto,
      };

      let applied = false;
      // deno-lint-ignore no-explicit-any
      let sendResult: any = null;
      if (!env.dryRun) {
        const invocation = isWaba
          ? ctx.supabase.functions.invoke("waba-send", {
              body: {
                action: "send_text",
                queue_id: conv.queue_id,
                to: String(contact.phone).replace(/\D/g, ""),
                text: texto,
                sender_name: ctx.userEmail || "MCP",
                source: "mcp",
              },
            })
          : ctx.supabase.functions.invoke("uazapi-proxy", {
              body: {
                method: "POST",
                endpoint: "/send/text",
                token: queue.evo_apikey,
                baseUrl: queue.evo_url,
                body: { number: String(contact.phone).replace(/\D/g, ""), text: texto },
              },
            });
        const { data, error: sendError } = await invocation;
        if (sendError || data?.error) {
          throw new CopilotoError("DEPENDENCY_UNAVAILABLE", "Falha ao enviar a mensagem pelo canal do escritório.", {
            retryable: true,
            dependency: "messaging",
          });
        }
        sendResult = data ?? { ok: true };
        applied = true;
      }


      const auditId = await audit(ctx, {
        action: "mensagem_enviar",
        target_table: "chat_conversations",
        target_id: convId,
        env,
        before: { ultima_atualizacao: conv.updated_at },
        after: { ...preview, envio: sendResult },
        applied,
        result: applied ? "applied" : "dry_run",
      });

      return result(
        ctx,
        "julia_mensagem_enviar",
        { applied, dry_run: env.dryRun, before: null, after: { ...preview, envio: sendResult }, audit_id: auditId },
        `${applied ? "Mensagem enviada" : "Simulação (dry_run) do envio"} para ${contact.name || contact.phone}: "${texto.slice(0, 120)}". audit_id ${auditId}.`,
      );
    },
  },
  {
    name: "julia_card_criar",
    version: "1.0.0",
    mode: "write",
    requiredScope: SCOPE_WRITE_CRM,
    description:
      "Cria um card (negócio) em um quadro do CRM Builder do escritório, na etapa indicada. Recusa quadro/etapa de outro escritório e etapa de outro quadro. Simula por padrão; execução real exige approved_by.",
    inputSchema: {
      type: "object",
      properties: {
        board_id: { type: "string", description: "UUID do quadro." },
        pipeline_id: { type: "string", description: "UUID da etapa destino (do mesmo quadro)." },
        title: { type: "string", description: "Título do card." },
        contato_id: { type: "string", description: "ID do contato da Julia a vincular (opcional)." },
        telefone: { type: "string", description: "Telefone do contato (opcional, usado se não houver contato_id)." },
        contact_name: { type: "string", description: "Nome do contato." },
        contact_email: { type: "string", description: "E-mail do contato." },
        description: { type: "string", description: "Descrição/resumo do caso." },
        value: { type: "number", description: "Valor estimado." },
        priority: { type: "string", enum: [...DEAL_PRIORITY], description: "Prioridade do card." },
        assigned_to: { type: "string", description: "Nome do responsável." },
        ...COMMON_PROPS,
      },
      required: ["board_id", "pipeline_id", "title", "idempotency_key"],
      additionalProperties: false,
    },
    run: async (ctx, args): Promise<ToolOutput> => {
      const env = writeEnv(args);
      const boardId = str(args.board_id);
      const pipelineId = str(args.pipeline_id);
      const title = str(args.title);
      if (!title) throw new CopilotoError("INVALID_INPUT", "Informe o título do card.");
      const priority = str(args.priority);
      if (priority && !DEAL_PRIORITY.includes(priority as typeof DEAL_PRIORITY[number])) {
        throw new CopilotoError("INVALID_INPUT", `Prioridade inválida. Use: ${DEAL_PRIORITY.join(", ")}.`);
      }

      const replay = await findReplay(ctx, "card_criar", env.key);
      if (replay) {
        return result(
          ctx,
          "julia_card_criar",
          { applied: true, dry_run: false, before: null, after: replay.after_data, audit_id: replay.id, replay: true },
          `Card já criado com esta idempotency_key (audit_id ${replay.id}). Nada foi duplicado.`,
        );
      }

      const { data: board, error: boardError } = await ctx.supabase
        .from("crm_boards")
        .select("id, name, cod_agent, is_archived")
        .eq("client_id", ctx.clientId)
        .eq("id", boardId)
        .maybeSingle();
      if (boardError) throw safeDbError("database", boardError);
      if (!board) throw new CopilotoError("NOT_FOUND", "Quadro não encontrado neste escritório.");
      if (board.is_archived) throw new CopilotoError("INVALID_INPUT", "Quadro arquivado: não aceita novos cards.");
      await assertBoardMcpAccess(ctx, String(board.id), "create");

      const { data: pipeline, error: pipeError } = await ctx.supabase
        .from("crm_pipelines")
        .select("id, name, board_id, is_active")
        .eq("id", pipelineId)
        .maybeSingle();
      if (pipeError) throw safeDbError("database", pipeError);
      if (!pipeline) throw new CopilotoError("NOT_FOUND", "Etapa destino não encontrada.");
      if (String(pipeline.board_id) !== String(board.id)) {
        throw new CopilotoError("INVALID_INPUT", "A etapa informada pertence a outro quadro.");
      }
      if (pipeline.is_active === false) throw new CopilotoError("INVALID_INPUT", "Etapa inativa: escolha outra etapa.");

      // Contato: aceita ID (validado no escritório) ou telefone informado.
      let contactPhone = str(args.telefone).replace(/\D/g, "");
      let contactName = str(args.contact_name);
      const contatoId = str(args.contato_id);
      if (contatoId) {
        const { data: contact, error: contactError } = await ctx.supabase
          .from("chat_contacts")
          .select("id, name, phone, lead_email")
          .eq("client_id", ctx.clientId)
          .eq("id", contatoId)
          .maybeSingle();
        if (contactError) throw safeDbError("database", contactError);
        if (!contact) throw new CopilotoError("NOT_FOUND", "Contato não encontrado neste escritório.");
        contactPhone = String(contact.phone || "").replace(/\D/g, "") || contactPhone;
        contactName = contactName || String(contact.name || "");
      }

      // Nova posição: fim da coluna da etapa.
      const { data: last } = await ctx.supabase
        .from("crm_deals")
        .select("position")
        .eq("client_id", ctx.clientId)
        .eq("pipeline_id", pipelineId)
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle();

      const row = {
        board_id: board.id,
        pipeline_id: pipeline.id,
        client_id: ctx.clientId,
        cod_agent: board.cod_agent,
        title,
        description: str(args.description) || null,
        value: Number.isFinite(Number(args.value)) ? Number(args.value) : null,
        priority: priority || "medium",
        status: "open",
        position: Number(last?.position ?? -1) + 1,
        contact_name: contactName || null,
        contact_phone: contactPhone || null,
        contact_email: str(args.contact_email) || null,
        assigned_to: str(args.assigned_to) || null,
        stage_entered_at: nowIso(),
        created_by: ctx.userEmail ?? "mcp",
      };

      let applied = false;
      // deno-lint-ignore no-explicit-any
      let created: any = null;
      if (!env.dryRun) {
        const { data, error } = await ctx.supabase.from("crm_deals").insert(row).select("*").maybeSingle();
        if (error) throw safeDbError("database", error);
        created = data;
        applied = true;
        if (created?.id) {
          await ctx.supabase.from("crm_deal_history").insert({
            deal_id: created.id,
            action: "created",
            to_pipeline_id: pipeline.id,
            changed_by: ctx.userEmail ?? "mcp",
            notes: `Card criado via conector MCP · ${env.reason}`,
          });
        }
      }

      const auditId = await audit(ctx, {
        action: "card_criar",
        target_table: "crm_deals",
        target_id: created?.id ?? null,
        env,
        before: null,
        after: created ?? row,
        applied,
        result: applied ? "applied" : "dry_run",
      });

      return result(
        ctx,
        "julia_card_criar",
        { applied, dry_run: env.dryRun, before: null, after: created ?? row, audit_id: auditId },
        `${applied ? "Card criado" : "Simulação (dry_run)"}: "${title}" no quadro ${board.name}, etapa ${pipeline.name}. audit_id ${auditId}.`,
      );
    },
  },
  {
    name: "julia_contato_criar",
    version: "1.0.0",
    mode: "write",
    requiredScope: SCOPE_WRITE_CRM,
    description:
      "Cria um contato/lead no escritório. Antes de criar, verifica duplicidade pelos últimos 8 dígitos do telefone: se já existir, devolve o contato encontrado (DUPLICATE) sem criar outro. Simula por padrão.",
    inputSchema: {
      type: "object",
      properties: {
        telefone: { type: "string", description: "Telefone do contato (com DDI/DDD, apenas dígitos são considerados)." },
        nome: { type: "string", description: "Nome do contato." },
        email: { type: "string", description: "E-mail do lead." },
        canal: { type: "string", enum: [...CONTACT_CHANNELS], description: "Canal de origem (padrão whatsapp_uazapi)." },
        observacao: { type: "string", description: "Nome completo/registro complementar do lead." },
        ...COMMON_PROPS,
      },
      required: ["telefone", "idempotency_key"],
      additionalProperties: false,
    },
    run: async (ctx, args): Promise<ToolOutput> => {
      const env = writeEnv(args);
      const digits = str(args.telefone).replace(/\D/g, "");
      if (digits.length < 10) throw new CopilotoError("INVALID_INPUT", "Telefone inválido: informe DDD e número (mín. 10 dígitos).");
      const canal = str(args.canal) || "whatsapp_uazapi";
      if (!CONTACT_CHANNELS.includes(canal as typeof CONTACT_CHANNELS[number])) {
        throw new CopilotoError("INVALID_INPUT", `Canal inválido. Use: ${CONTACT_CHANNELS.join(", ")}.`);
      }
      const nome = str(args.nome);

      const replay = await findReplay(ctx, "contato_criar", env.key);
      if (replay) {
        return result(
          ctx,
          "julia_contato_criar",
          { applied: true, dry_run: false, before: null, after: replay.after_data, audit_id: replay.id, replay: true },
          `Contato já criado com esta idempotency_key (audit_id ${replay.id}). Nada foi duplicado.`,
        );
      }

      // Antiduplicidade: imune a DDI e ao 9º dígito.
      const { data: dupes, error: dupError } = await ctx.supabase
        .from("chat_contacts")
        .select("id, name, phone, lead_email, channel_type, created_at")
        .eq("client_id", ctx.clientId)
        .eq("is_group", false)
        .ilike("phone", `%${digits.slice(-8)}%`)
        .limit(5);
      if (dupError) throw safeDbError("database", dupError);
      if (dupes?.length) {
        return result(
          ctx,
          "julia_contato_criar",
          { applied: false, dry_run: env.dryRun, duplicate: true, contatos: dupes },
          `Já existe contato com este telefone: ${dupes
            // deno-lint-ignore no-explicit-any
            .map((c: any) => `${c.name || "(sem nome)"} · ${c.phone} · contato_id ${c.id}`)
            .join(" | ")}. Nada foi criado — use julia_contato_atualizar se precisar corrigir os dados.`,
        );
      }

      const row = {
        client_id: ctx.clientId,
        phone: digits,
        name: nome || digits,
        channel_type: canal,
        is_group: false,
        lead_email: str(args.email) || null,
        lead_full_name: str(args.observacao) || (nome || null),
        profile_source: "mcp",
      };

      let applied = false;
      // deno-lint-ignore no-explicit-any
      let created: any = null;
      if (!env.dryRun) {
        const { data, error } = await ctx.supabase.from("chat_contacts").insert(row).select("*").maybeSingle();
        if (error) throw safeDbError("database", error);
        created = data;
        applied = true;
      }

      const auditId = await audit(ctx, {
        action: "contato_criar",
        target_table: "chat_contacts",
        target_id: created?.id ?? null,
        env,
        before: null,
        after: created ?? row,
        applied,
        result: applied ? "applied" : "dry_run",
      });

      return result(
        ctx,
        "julia_contato_criar",
        { applied, dry_run: env.dryRun, before: null, after: created ?? row, audit_id: auditId },
        `${applied ? "Contato criado" : "Simulação (dry_run)"}: ${row.name} · ${row.phone}${
          created?.id ? ` · contato_id ${created.id}` : ""
        }. audit_id ${auditId}.`,
      );
    },
  },
  {
    name: "julia_contato_atualizar",
    version: "1.0.0",
    mode: "write",
    requiredScope: SCOPE_WRITE_CRM,
    description:
      "Atualiza dados cadastrais de um contato do escritório (nome, e-mail, nome completo, documento). Não altera telefone-chave, escritório, canal nem contadores de atendimento. Simula por padrão.",
    inputSchema: {
      type: "object",
      properties: {
        contato_id: { type: "string", description: "ID do contato na Julia." },
        nome: { type: "string", description: "Nome de exibição." },
        email: { type: "string", description: "E-mail do lead." },
        nome_completo: { type: "string", description: "Nome completo informado pelo lead." },
        documento: { type: "string", description: "CPF/CNPJ do lead." },
        ...COMMON_PROPS,
      },
      required: ["contato_id", "idempotency_key"],
      additionalProperties: false,
    },
    run: async (ctx, args): Promise<ToolOutput> => {
      const env = writeEnv(args);
      const contatoId = str(args.contato_id);

      const replay = await findReplay(ctx, "contato_atualizar", env.key);
      if (replay) {
        return result(
          ctx,
          "julia_contato_atualizar",
          { applied: true, dry_run: false, before: replay.before_data, after: replay.after_data, audit_id: replay.id, replay: true },
          `Atualização já aplicada com esta idempotency_key (audit_id ${replay.id}).`,
        );
      }

      const { data: before, error } = await ctx.supabase
        .from("chat_contacts")
        .select("id, name, phone, lead_email, lead_full_name, lead_personalid, channel_type, updated_at")
        .eq("client_id", ctx.clientId)
        .eq("id", contatoId)
        .maybeSingle();
      if (error) throw safeDbError("database", error);
      if (!before) throw new CopilotoError("NOT_FOUND", "Contato não encontrado neste escritório.");
      checkVersion(env, before.updated_at);

      // deno-lint-ignore no-explicit-any
      const patch: Record<string, any> = {};
      if (str(args.nome)) patch.name = str(args.nome);
      if (str(args.email)) patch.lead_email = str(args.email);
      if (str(args.nome_completo)) patch.lead_full_name = str(args.nome_completo);
      if (str(args.documento)) patch.lead_personalid = str(args.documento).replace(/\D/g, "");
      if (Object.keys(patch).length === 0) {
        throw new CopilotoError("INVALID_INPUT", "Informe pelo menos um campo permitido: nome, email, nome_completo ou documento.");
      }
      patch.updated_at = nowIso();
      const after = { ...before, ...patch };

      let applied = false;
      if (!env.dryRun) {
        const { error: updateError } = await ctx.supabase
          .from("chat_contacts")
          .update(patch)
          .eq("client_id", ctx.clientId)
          .eq("id", contatoId);
        if (updateError) throw safeDbError("database", updateError);
        applied = true;
      }

      const auditId = await audit(ctx, {
        action: "contato_atualizar",
        target_table: "chat_contacts",
        target_id: contatoId,
        env,
        before,
        after,
        applied,
        result: applied ? "applied" : "dry_run",
      });

      return result(
        ctx,
        "julia_contato_atualizar",
        { applied, dry_run: env.dryRun, before, after, audit_id: auditId },
        `${applied ? "Contato atualizado" : "Simulação (dry_run)"}: ${Object.keys(patch)
          .filter((k) => k !== "updated_at")
          .join(", ")} em ${before.name || before.phone}. audit_id ${auditId}.`,
      );
    },
  },
  {
    name: "julia_card_mover_por_telefone",
    version: "1.0.0",
    mode: "write",
    requiredScope: SCOPE_WRITE_CRM,
    description:
      "Move o card de um lead para outra etapa usando apenas o telefone, a etapa (ID ou nome) e o código do painel (board_id). Localiza o card pelo telefone do card ou pelo contato do chat, aceitando celular BR com 12 e 13 dígitos. Aplica direto (dry_run=false por padrão) e só age no escritório do token.",
    inputSchema: {
      type: "object",
      properties: {
        telefone: { type: "string", description: "Telefone do lead em qualquer formato (+55, parênteses, traços)." },
        etapa: { type: "string", description: "UUID da etapa destino OU o nome dela (ex.: 'Atendimento humano')." },
        board_id: { type: "string", description: "Código (UUID) do painel do CRM Builder." },
        status: { type: "string", enum: [...DEAL_STATUS], description: "Novo status opcional (open, won, lost)." },
        motivo: { type: "string", description: "Motivo registrado no histórico do card." },
        dry_run: { type: "boolean", description: "false (padrão) aplica de verdade; true apenas simula." },
        idempotency_key: { type: "string", description: "Opcional. Gerada automaticamente quando não informada." },
      },
      required: ["telefone", "etapa", "board_id"],
      additionalProperties: false,
    },
    run: async (ctx, args): Promise<ToolOutput> => {
      const telefoneRaw = str(args.telefone);
      const etapaArg = str(args.etapa);
      const boardId = str(args.board_id);
      const status = str(args.status);
      if (!telefoneRaw) throw new CopilotoError("INVALID_INPUT", "telefone é obrigatório.");
      if (!etapaArg) throw new CopilotoError("INVALID_INPUT", "etapa é obrigatória (UUID ou nome).");
      if (!boardId) throw new CopilotoError("INVALID_INPUT", "board_id (código do painel) é obrigatório.");
      if (status && !DEAL_STATUS.includes(status as typeof DEAL_STATUS[number])) {
        throw new CopilotoError("INVALID_INPUT", `Status inválido. Use: ${DEAL_STATUS.join(", ")}.`);
      }

      const variants = brVariants(telefoneRaw);
      if (!variants.length) throw new CopilotoError("INVALID_INPUT", "Telefone inválido.");

      const env = writeEnv({
        ...args,
        dry_run: args.dry_run === true,
        approved_by: str(args.approved_by) || "mcp:julia_card_mover_por_telefone",
        reason: str(args.motivo) || str(args.reason) || "movimentação via telefone (MCP)",
        idempotency_key:
          str(args.idempotency_key) ||
          `movpel:${ctx.clientId}:${boardId}:${variants[0]}:${etapaArg}:${status || "-"}:${new Date().toISOString().slice(0, 10)}`,
      });

      const replay = await findReplay(ctx, "card_mover_por_telefone", env.key);
      if (replay) {
        return result(
          ctx,
          "julia_card_mover_por_telefone",
          { applied: true, dry_run: false, before: replay.before_data, after: replay.after_data, audit_id: replay.id, replay: true },
          `Movimentação já aplicada com esta idempotency_key (audit_id ${replay.id}). Nada foi repetido.`,
        );
      }

      // Permissão do painel (padrão fechado) — também valida que o painel é do escritório.
      await assertBoardMcpAccess(ctx, boardId, "move");

      // 1) Resolve cards por telefone (card + contato do chat + vínculos), só o que aparece no CRM.
      const lookup = await resolveDealsByPhone(ctx.supabase, ctx.clientId, boardId, telefoneRaw);
      const contact = lookup.contact;
      const found = lookup.visiveis;

      if (!found.length) {
        throw new CopilotoError(
          "NOT_FOUND",
          lookup.historico.length
            ? `Este telefone só tem card arquivado neste painel (${lookup.historico.length} no histórico), nada visível no CRM.`
            : contact
            ? `Contato encontrado (${contact.name || contact.phone}), mas ele não tem card visível neste painel.`
            : "Nenhum contato/card encontrado para este telefone neste escritório.",
          {
            details: {
              telefone_variantes: lookup.variants,
              board_id: boardId,
              contato_id: contact?.id ?? null,
              cards_arquivados: lookup.historico.length,
            },
          },
        );
      }

      // deno-lint-ignore no-explicit-any
      const before: any = found[0];


      // 3) Resolve a etapa destino (UUID ou nome).
      const { data: stages, error: stagesErr } = await ctx.supabase
        .from("crm_pipelines")
        .select("id, name, board_id, is_active, position")
        .eq("board_id", boardId)
        .order("position", { ascending: true });
      if (stagesErr) throw safeDbError("database", stagesErr);
      // deno-lint-ignore no-explicit-any
      const list: any[] = stages || [];
      const byId = list.find((s) => String(s.id) === etapaArg);
      const target =
        byId ||
        list.find((s) => s.is_active !== false && norm(String(s.name)) === norm(etapaArg)) ||
        list.find((s) => s.is_active !== false && norm(String(s.name)).includes(norm(etapaArg)));
      if (!target) {
        throw new CopilotoError("NOT_FOUND", "Etapa não encontrada neste painel.", {
          details: { etapas_disponiveis: list.filter((s) => s.is_active !== false).map((s) => s.name) },
        });
      }

      const sameStage = String(before.pipeline_id ?? "") === String(target.id);
      const sameStatus = !status || String(before.status ?? "") === status;
      if (sameStage && sameStatus) {
        return result(
          ctx,
          "julia_card_mover_por_telefone",
          { applied: false, dry_run: env.dryRun, already_there: true, deal_id: before.id, etapa: target.name, contato_id: contact?.id ?? null },
          `O card "${before.title}" já está na etapa "${target.name}". Nada foi alterado.`,
        );
      }

      const patch = {
        ...(sameStage ? {} : { pipeline_id: target.id, stage_entered_at: nowIso() }),
        ...(status ? { status } : {}),
        updated_at: nowIso(),
      };
      const after = { ...before, ...patch, etapa_destino: target.name };

      let applied = false;
      if (!env.dryRun) {
        const { error } = await ctx.supabase
          .from("crm_deals")
          .update(patch)
          .eq("client_id", ctx.clientId)
          .eq("id", before.id);
        if (error) throw safeDbError("database", error);
        applied = true;
      }

      const auditId = await audit(ctx, {
        action: "card_mover_por_telefone",
        target_table: "crm_deals",
        target_id: String(before.id),
        env,
        before,
        after,
        applied,
        result: applied ? "applied" : "dry_run",
      });

      if (applied) {
        if (!sameStage) {
          await logDealHistory(ctx, {
            dealId: String(before.id),
            action: "moved",
            fromPipelineId: before.pipeline_id ?? null,
            toPipelineId: String(target.id),
            changes: { pipeline_id: { from: before.pipeline_id ?? null, to: String(target.id) }, telefone: variants[0] },
            notes: `Movido via conector MCP (telefone ${variants[0]}) para "${target.name}" · motivo: ${env.reason} · audit ${auditId}`,
          });
        }
        if (status && status !== before.status) {
          await logDealHistory(ctx, {
            dealId: String(before.id),
            action: status === "won" ? "won" : status === "lost" ? "lost" : "updated",
            toPipelineId: String(target.id),
            changes: { status: { from: before.status ?? null, to: status } },
            notes: `Status alterado via conector MCP: ${before.status ?? "—"} → ${status} · audit ${auditId}`,
          });
        }
      }

      return result(
        ctx,
        "julia_card_mover_por_telefone",
        {
          applied,
          dry_run: env.dryRun,
          deal_id: before.id,
          contato_id: contact?.id ?? null,
          cards_encontrados: found.length,
          before,
          after,
          audit_id: auditId,
        },
        `${applied ? "Aplicado" : "Simulação (dry_run)"}: card "${before.title}" (${before.contact_phone || variants[0]}) → etapa "${target.name}"${
          status ? ` · status ${status}` : ""
        }${found.length > 1 ? ` · atenção: ${found.length} cards abertos encontrados, movi o mais recente` : ""}. audit_id ${auditId}.`,
      );
    },
  },
];
