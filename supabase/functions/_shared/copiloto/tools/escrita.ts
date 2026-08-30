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
      approved_by: row.env.applied ? row.env.approvedBy : row.env.approvedBy,
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

      const preview = { conversation_id: convId, contato: contact.name, telefone: contact.phone, queue_id: conv.queue_id, texto };

      let applied = false;
      // deno-lint-ignore no-explicit-any
      let sendResult: any = null;
      if (!env.dryRun) {
        const { data, error: sendError } = await ctx.supabase.functions.invoke("chat-send-message", {
          body: {
            clientId: ctx.clientId,
            conversationId: convId,
            contactId: conv.contact_id,
            queueId: conv.queue_id,
            phone: contact.phone,
            text: texto,
            source: "mcp",
            senderName: ctx.userEmail || "MCP",
          },
        });
        if (sendError) {
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
];
