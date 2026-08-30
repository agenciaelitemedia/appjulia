/**
 * Domínio: coorte canônica de leads e follow-ups pendentes (P0.3 e P1.8).
 *
 * `julia_leads_listar` é a tool canônica de coorte: paginação por cursor
 * estável, filtros por período com timezone explícito e bloco de cobertura.
 */
import {
  coverage,
  dateOut,
  decodeCursor,
  isoOrNull,
  ok,
  paginate,
  safeDbError,
  tzOf,
  type ToolOutput,
} from "../envelope.ts";
import { MAX_ROWS, num, SCOPE_READ, str, type CopilotoContext, type CopilotoTool } from "../types.ts";

const STR_ARRAY = { type: "array", items: { type: "string" } };

function arr(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  const s = str(value);
  return s ? [s] : [];
}

export const leadTools: CopilotoTool[] = [
  {
    name: "julia_leads_listar",
    version: "1.0.0",
    mode: "read",
    requiredScope: SCOPE_READ,
    description:
      "Coorte canônica de leads/contatos do escritório com paginação por cursor (nunca omite registros silenciosamente). Filtros: criação, última atualização, status do atendimento, responsável, canal, etapa do CRM e timezone. Devolve contato_id, lead_id, nome, canal, status, etapa, responsável, created_at e updated_at, mais cobertura e total.",
    inputSchema: {
      type: "object",
      properties: {
        created_from: { type: "string", description: "ISO 8601. Limite inferior inclusivo da criação." },
        created_to: { type: "string", description: "ISO 8601. Limite superior exclusivo da criação." },
        updated_from: { type: "string", description: "ISO 8601 inclusivo da última movimentação." },
        updated_to: { type: "string", description: "ISO 8601 exclusivo da última movimentação." },
        status: { ...STR_ARRAY, description: "Status do atendimento: pending, open, resolved, closed." },
        responsavel_id: { ...STR_ARRAY, description: "IDs numéricos dos responsáveis (assigned_user_id)." },
        canal: { ...STR_ARRAY, description: "Canais: whatsapp, waba, instagram, webchat." },
        estagio: { ...STR_ARRAY, description: "Nomes de etapa do CRM Builder." },
        timezone: { type: "string", description: "IANA time zone (padrão America/Sao_Paulo)." },
        cursor: { type: "string", description: "next_cursor da página anterior." },
        limit: { type: "number", description: "Máx. 200 (padrão 100)." },
      },
      additionalProperties: false,
    },
    run: async (ctx: CopilotoContext, args): Promise<ToolOutput> => {
      const tz = tzOf(args);
      const limit = num(args.limit, 100, MAX_ROWS);
      const cursor = decodeCursor(args.cursor);
      const createdFrom = isoOrNull(args.created_from, "created_from");
      const createdTo = isoOrNull(args.created_to, "created_to");
      const updatedFrom = isoOrNull(args.updated_from, "updated_from");
      const updatedTo = isoOrNull(args.updated_to, "updated_to");
      const statuses = arr(args.status);
      const owners = arr(args.responsavel_id);
      const canais = arr(args.canal);
      const estagios = arr(args.estagio);
      const warnings: string[] = [];

      // Ordenação estável: (created_at desc, id desc) — cursor keyset.
      let q = ctx.supabase
        .from("chat_conversations")
        .select(
          "id, contact_id, client_id, channel, status, assigned_to, assigned_user_id, queue_id, created_at, updated_at, opened_at, protocol",
          { count: "exact" },
        )
        .eq("client_id", ctx.clientId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(limit + 1);

      if (createdFrom) q = q.gte("created_at", createdFrom);
      if (createdTo) q = q.lt("created_at", createdTo);
      if (updatedFrom) q = q.gte("updated_at", updatedFrom);
      if (updatedTo) q = q.lt("updated_at", updatedTo);
      if (statuses.length) q = q.in("status", statuses);
      if (canais.length) q = q.in("channel", canais);
      if (owners.length) q = q.in("assigned_user_id", owners.map((o) => Number(o)).filter((n) => Number.isFinite(n)));
      if (cursor?.k) q = q.lt("created_at", String(cursor.k));

      const { data, error, count } = await q;
      if (error) throw safeDbError("database", error);

      // deno-lint-ignore no-explicit-any
      const rows = (data || []) as any[];
      const { items, pagination } = paginate(rows, limit, (r) => ({ k: r.created_at, id: r.id }), count ?? null);

      const contactIds = [...new Set(items.map((r) => r.contact_id).filter(Boolean))];
      const [contacts, deals] = await Promise.all([
        contactIds.length
          ? ctx.supabase.from("chat_contacts").select("id, name, phone, channel_type, updated_at").in("id", contactIds)
          : Promise.resolve({ data: [] }),
        contactIds.length
          ? ctx.supabase
              .from("crm_deals")
              .select("id, contact_phone, status, pipeline_id, crm_pipelines(name)")
              .eq("client_id", ctx.clientId)
          : Promise.resolve({ data: [] }),
      ]);
      // deno-lint-ignore no-explicit-any
      const byId = new Map((contacts.data || []).map((c: any) => [c.id, c]));
      // deno-lint-ignore no-explicit-any
      const stageByPhone = new Map<string, string>();
      // deno-lint-ignore no-explicit-any
      for (const d of (deals.data || []) as any[]) {
        const digits = String(d.contact_phone || "").replace(/\D/g, "").slice(-8);
        const stage = d.crm_pipelines?.name;
        if (digits && stage && !stageByPhone.has(digits)) stageByPhone.set(digits, stage);
      }

      let out = items.map((r) => {
        const c = byId.get(r.contact_id);
        const digits = String(c?.phone || "").replace(/\D/g, "").slice(-8);
        return {
          contato_id: r.contact_id,
          lead_id: r.id,
          protocolo: r.protocol ?? null,
          nome: c?.name ?? null,
          telefone: c?.phone ?? null,
          canal: r.channel ?? c?.channel_type ?? null,
          status: r.status ?? null,
          estagio: (digits && stageByPhone.get(digits)) || null,
          responsavel: r.assigned_to ?? null,
          responsavel_id: r.assigned_user_id != null ? String(r.assigned_user_id) : null,
          created_at: dateOut(r.created_at, tz),
          updated_at: dateOut(r.updated_at, tz),
        };
      });

      if (estagios.length) {
        const before = out.length;
        const wanted = estagios.map((s) => s.toLowerCase());
        out = out.filter((r) => r.estagio && wanted.includes(String(r.estagio).toLowerCase()));
        warnings.push(
          `Filtro de etapa aplicado após a paginação (${before} → ${out.length} nesta página). Para coorte exata por etapa, use julia_builder_listar_negocios.`,
        );
      }

      const text = [
        `${out.length} lead(s) nesta página${pagination.total_count != null ? ` de ${pagination.total_count} no filtro` : ""}.`,
        ...out.map(
          (r) =>
            `- ${r.nome || "(sem nome)"} · ${r.telefone || "sem telefone"} · canal ${r.canal || "—"} · status ${r.status || "—"} · etapa ${
              r.estagio || "—"
            } · responsável ${r.responsavel || "sem responsável"} · criado ${r.created_at.legivel}\n  contato_id: ${r.contato_id} · lead_id: ${r.lead_id}`,
        ),
        pagination.has_more ? `\nHá mais páginas. Continue com cursor: ${pagination.next_cursor}` : "\nFim da coorte (has_more=false).",
      ].join("\n");

      return ok(
        { items: out },
        {
          requestId: ctx.requestId!,
          toolName: "julia_leads_listar",
          toolVersion: "1.0.0",
          timezone: tz,
          pagination,
          coverage: coverage({
            complete: !warnings.length,
            from: createdFrom ?? updatedFrom,
            to: createdTo ?? updatedTo,
            warnings,
          }),
          text,
        },
      );
    },
  },
  {
    name: "julia_followups_pendentes",
    version: "1.0.0",
    mode: "read",
    requiredScope: SCOPE_READ,
    description:
      "Fatos sobre atendimentos pendentes de retorno do escritório: lead, contato, responsável, etapa, última interação, prazo, motivo da pendência (sem resposta, adiado vencido, SLA estourado) e sinais objetivos de urgência. NÃO calcula prioridade — isso é papel de quem consome.",
    inputSchema: {
      type: "object",
      properties: {
        horas_sem_resposta: { type: "number", description: "Mínimo de horas desde a última mensagem do cliente (padrão 4)." },
        responsavel_id: { ...STR_ARRAY, description: "Filtrar por responsáveis (assigned_user_id)." },
        incluir_sem_responsavel: { type: "boolean", description: "Incluir conversas sem responsável (padrão true)." },
        timezone: { type: "string" },
        cursor: { type: "string" },
        limit: { type: "number", description: "Máx. 200 (padrão 50)." },
      },
      additionalProperties: false,
    },
    run: async (ctx: CopilotoContext, args): Promise<ToolOutput> => {
      const tz = tzOf(args);
      const limit = num(args.limit, 50, MAX_ROWS);
      const cursor = decodeCursor(args.cursor);
      const horas = num(args.horas_sem_resposta, 4, 24 * 30);
      const limite = new Date(Date.now() - horas * 3600_000).toISOString();
      const owners = arr(args.responsavel_id);

      let q = ctx.supabase
        .from("chat_conversations")
        .select(
          "id, contact_id, status, priority, assigned_to, assigned_user_id, queue_id, protocol, last_customer_message_at, last_message_from_me, first_response_at, opened_at, snoozed_until, snooze_reason",
          { count: "exact" },
        )
        .eq("client_id", ctx.clientId)
        .in("status", ["pending", "open"])
        .not("last_customer_message_at", "is", null)
        .lte("last_customer_message_at", limite)
        .order("last_customer_message_at", { ascending: true })
        .order("id", { ascending: true })
        .limit(limit + 1);

      if (owners.length) q = q.in("assigned_user_id", owners.map((o) => Number(o)).filter((n) => Number.isFinite(n)));
      if (cursor?.k) q = q.gt("last_customer_message_at", String(cursor.k));

      const { data, error, count } = await q;
      if (error) throw safeDbError("database", error);

      // deno-lint-ignore no-explicit-any
      let rows = (data || []) as any[];
      rows = rows.filter((r) => r.last_message_from_me !== true);
      if (args.incluir_sem_responsavel === false) rows = rows.filter((r) => r.assigned_to || r.assigned_user_id);

      const { items, pagination } = paginate(rows, limit, (r) => ({ k: r.last_customer_message_at, id: r.id }), count ?? null);
      const contactIds = [...new Set(items.map((r) => r.contact_id).filter(Boolean))];
      const { data: contacts } = contactIds.length
        ? await ctx.supabase.from("chat_contacts").select("id, name, phone").in("id", contactIds)
        : { data: [] };
      // deno-lint-ignore no-explicit-any
      const byId = new Map((contacts || []).map((c: any) => [c.id, c]));

      const out = items.map((r) => {
        const c = byId.get(r.contact_id);
        const horasEspera = r.last_customer_message_at
          ? Math.round(((Date.now() - new Date(r.last_customer_message_at).getTime()) / 3600_000) * 10) / 10
          : null;
        const motivos: string[] = [];
        if (!r.first_response_at) motivos.push("sem primeira resposta");
        if (r.last_message_from_me !== true) motivos.push("última mensagem é do cliente");
        if (r.snoozed_until && new Date(r.snoozed_until).getTime() < Date.now()) motivos.push("adiamento vencido");
        if (!r.assigned_to && !r.assigned_user_id) motivos.push("sem responsável");
        return {
          lead_id: r.id,
          contato_id: r.contact_id,
          protocolo: r.protocol ?? null,
          nome: c?.name ?? null,
          telefone: c?.phone ?? null,
          status: r.status,
          prioridade: r.priority ?? "normal",
          responsavel: r.assigned_to ?? null,
          responsavel_id: r.assigned_user_id != null ? String(r.assigned_user_id) : null,
          ultima_interacao_cliente: dateOut(r.last_customer_message_at, tz),
          primeira_resposta: dateOut(r.first_response_at, tz),
          adiado_ate: dateOut(r.snoozed_until, tz),
          motivo_pendencia: motivos,
          sinais: { horas_sem_resposta: horasEspera, sem_primeira_resposta: !r.first_response_at, prioridade_marcada: r.priority ?? "normal" },
        };
      });

      const text = [
        `${out.length} atendimento(s) aguardando o escritório há ${horas}h ou mais.`,
        ...out.map(
          (r) =>
            `- ${r.nome || "(sem nome)"} · ${r.telefone || "—"} · ${r.status} · responsável ${r.responsavel || "sem responsável"} · última fala do cliente ${
              r.ultima_interacao_cliente.legivel
            } (${r.sinais.horas_sem_resposta}h) · motivos: ${r.motivo_pendencia.join(", ") || "—"}\n  lead_id: ${r.lead_id} · contato_id: ${r.contato_id}`,
        ),
        pagination.has_more ? `\nHá mais páginas. cursor: ${pagination.next_cursor}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      return ok(
        { items: out, criterio: { horas_sem_resposta: horas } },
        {
          requestId: ctx.requestId!,
          toolName: "julia_followups_pendentes",
          toolVersion: "1.0.0",
          timezone: tz,
          pagination,
          coverage: coverage({ to: limite }),
          text,
        },
      );
    },
  },
];
