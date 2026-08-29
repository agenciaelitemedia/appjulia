/**
 * Domínio: CRM de Leads clássico (Postgres legado) + CRM Builder (Supabase).
 * Legado sempre escopado pelos cod_agent do escritório do token.
 */
import { agentCodes, legacyRaw } from "../legacy.ts";
import { fmtDate, MAX_ROWS, num, str, type CopilotoTool } from "../types.ts";

export const crmTools: CopilotoTool[] = [
  {
    name: "julia_crm_listar_etapas",
    description:
      "Etapas (funil) do CRM de Leads clássico do escritório, na ordem do funil, com id, nome, cor e quantos leads estão em cada uma.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    run: async (ctx) => {
      const codes = await agentCodes(ctx);
      if (!codes.length) return "Este escritório não possui agentes vinculados ao CRM clássico.";
      const rows = await legacyRaw(
        ctx,
        `SELECT s.id, s.name, s.color, s.position,
                (SELECT count(*) FROM crm_atendimento_cards c
                  WHERE c.stage_id = s.id AND c.cod_agent = ANY($1::varchar[])) AS total
           FROM crm_atendimento_stages s
          WHERE s.is_active = true
          ORDER BY s.position`,
        [codes],
      );
      if (!rows.length) return "Nenhuma etapa ativa encontrada.";
      // deno-lint-ignore no-explicit-any
      return rows.map((s: any) => `- ${s.position}. ${s.name} — ${s.total} leads (stage_id: ${s.id})`).join("\n");
    },
  },
  {
    name: "julia_crm_listar_leads",
    description:
      "Leads do CRM clássico com filtros por etapa, responsável, busca (nome/telefone) e período de entrada na etapa. Retorna card_id, etapa, dias parado e responsável.",
    inputSchema: {
      type: "object",
      properties: {
        stage_id: { type: "number", description: "Filtrar por etapa (de julia_crm_listar_etapas)." },
        busca: { type: "string", description: "Nome ou telefone." },
        dias_parado_min: { type: "number", description: "Somente leads parados há N dias ou mais." },
        limite: { type: "number", description: "Máx. 200 (padrão 30)." },
      },
      additionalProperties: false,
    },
    run: async (ctx, args) => {
      const codes = await agentCodes(ctx);
      if (!codes.length) return "Este escritório não possui agentes vinculados ao CRM clássico.";
      const rows = await legacyRaw(
        ctx,
        `SELECT c.id, c.contact_name, c.whatsapp_number, c.business_name, c.owner_name,
                c.stage_entered_at, c.created_at, c.notes,
                s.name AS stage_name,
                EXTRACT(DAY FROM (now() - c.stage_entered_at))::int AS dias_parado
           FROM crm_atendimento_cards c
           LEFT JOIN crm_atendimento_stages s ON s.id = c.stage_id
          WHERE c.cod_agent = ANY($1::varchar[])
            AND ($2::int IS NULL OR c.stage_id = $2::int)
            AND ($3::text IS NULL OR c.contact_name ILIKE '%' || $3 || '%' OR c.whatsapp_number ILIKE '%' || $3 || '%')
            AND ($4::int IS NULL OR EXTRACT(DAY FROM (now() - c.stage_entered_at)) >= $4::int)
          ORDER BY c.stage_entered_at DESC
          LIMIT $5::int`,
        [codes, args.stage_id ?? null, str(args.busca) || null, args.dias_parado_min ?? null, num(args.limite, 30, MAX_ROWS)],
      );
      if (!rows.length) return "Nenhum lead encontrado com esses filtros.";
      // deno-lint-ignore no-explicit-any
      return rows
        .map(
          (c: any) =>
            `- ${c.contact_name || "(sem nome)"} · ${c.whatsapp_number || "sem telefone"} · etapa ${
              c.stage_name || "—"
            } há ${c.dias_parado ?? "?"} dias · responsável ${c.owner_name || "—"}${c.notes ? `\n  notas: ${c.notes}` : ""}\n  card_id: ${c.id}`,
        )
        .join("\n");
    },
  },
  {
    name: "julia_crm_historico_lead",
    description:
      "Movimentações de um lead no CRM clássico: de qual etapa para qual, quem moveu, quando e a observação registrada.",
    inputSchema: {
      type: "object",
      properties: { card_id: { type: "number", description: "ID do card (de julia_crm_listar_leads)." } },
      required: ["card_id"],
      additionalProperties: false,
    },
    run: async (ctx, args) => {
      const codes = await agentCodes(ctx);
      const rows = await legacyRaw(
        ctx,
        `SELECT h.changed_at, h.changed_by, h.notes,
                fs.name AS from_stage, ts.name AS to_stage
           FROM crm_atendimento_history h
           JOIN crm_atendimento_cards c ON c.id = h.card_id
           LEFT JOIN crm_atendimento_stages fs ON fs.id = h.from_stage_id
           LEFT JOIN crm_atendimento_stages ts ON ts.id = h.to_stage_id
          WHERE h.card_id = $1::bigint AND c.cod_agent = ANY($2::varchar[])
          ORDER BY h.changed_at ASC LIMIT 200`,
        [args.card_id, codes],
      );
      if (!rows.length) return "Sem histórico para este card (ou card fora do escritório).";
      // deno-lint-ignore no-explicit-any
      return rows
        .map(
          (h: any) =>
            `- [${fmtDate(h.changed_at)}] ${h.from_stage || "—"} → ${h.to_stage || "—"} por ${h.changed_by || "sistema"}${
              h.notes ? ` · ${h.notes}` : ""
            }`,
        )
        .join("\n");
    },
  },
  {
    name: "julia_crm_metricas_funil",
    description:
      "Métricas do funil clássico no período: leads por etapa, percentual sobre o total e tempo médio de permanência em cada etapa.",
    inputSchema: {
      type: "object",
      properties: {
        dias: { type: "number", description: "Janela em dias (padrão 30)." },
      },
      additionalProperties: false,
    },
    run: async (ctx, args) => {
      const codes = await agentCodes(ctx);
      if (!codes.length) return "Este escritório não possui agentes vinculados ao CRM clássico.";
      const dias = num(args.dias, 30, 365);
      const rows = await legacyRaw(
        ctx,
        `SELECT s.name, s.position,
                count(c.id) AS total,
                round(avg(EXTRACT(EPOCH FROM (now() - c.stage_entered_at)) / 86400)::numeric, 1) AS media_dias
           FROM crm_atendimento_stages s
           LEFT JOIN crm_atendimento_cards c
             ON c.stage_id = s.id AND c.cod_agent = ANY($1::varchar[])
            AND c.stage_entered_at >= now() - ($2::int || ' days')::interval
          WHERE s.is_active = true
          GROUP BY s.name, s.position
          ORDER BY s.position`,
        [codes, dias],
      );
      // deno-lint-ignore no-explicit-any
      const total = rows.reduce((acc: number, r: any) => acc + Number(r.total || 0), 0);
      if (!total) return `Nenhum lead nos últimos ${dias} dias.`;
      return [
        `Funil dos últimos ${dias} dias — total ${total} leads`,
        // deno-lint-ignore no-explicit-any
        ...rows.map((r: any) => {
          const pct = total ? ((Number(r.total) / total) * 100).toFixed(1) : "0.0";
          return `- ${r.name}: ${r.total} (${pct}%) · permanência média ${r.media_dias ?? 0} dias`;
        }),
      ].join("\n");
    },
  },
  {
    name: "julia_crm_notas_internas",
    description: "Notas internas registradas pela equipe para um lead do CRM clássico, identificadas pelo telefone.",
    inputSchema: {
      type: "object",
      properties: { telefone: { type: "string", description: "Telefone do lead (dígitos)." } },
      required: ["telefone"],
      additionalProperties: false,
    },
    run: async (ctx, args) => {
      const codes = await agentCodes(ctx);
      const digits = str(args.telefone).replace(/\D/g, "");
      if (!digits) return "Informe um telefone válido.";
      const { data, error } = await ctx.supabase
        .from("crm_internal_notes")
        .select("note_text, author_name, created_at, cod_agent")
        .in("cod_agent", codes.length ? codes : ["__none__"])
        .ilike("whatsapp_number", `%${digits.slice(-8)}%`)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw new Error(error.message);
      if (!data?.length) return "Nenhuma nota interna para este lead.";
      // deno-lint-ignore no-explicit-any
      return data.map((n: any) => `- [${fmtDate(n.created_at)}] ${n.author_name || "—"}: ${n.note_text}`).join("\n");
    },
  },
  {
    name: "julia_builder_listar_quadros",
    description:
      "Quadros (boards) e pipelines do CRM Builder do escritório, com as etapas de cada quadro e a quantidade de negócios por etapa.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    run: async (ctx) => {
      const { data: boards, error } = await ctx.supabase
        .from("crm_boards")
        .select("id, name, description, is_active")
        .eq("client_id", ctx.clientId)
        .order("name");
      if (error) throw new Error(error.message);
      if (!boards?.length) return "Nenhum quadro do CRM Builder neste escritório.";

      const out: string[] = [];
      for (const b of boards) {
        const { data: pipes } = await ctx.supabase
          .from("crm_pipelines")
          .select("id, name, position")
          .eq("board_id", b.id)
          .order("position");
        const lines: string[] = [];
        for (const p of pipes || []) {
          const { count } = await ctx.supabase
            .from("crm_deals")
            .select("id", { count: "exact", head: true })
            .eq("client_id", ctx.clientId)
            .eq("pipeline_id", p.id);
          lines.push(`  - ${p.position}. ${p.name} — ${count ?? 0} negócios (pipeline_id: ${p.id})`);
        }
        out.push(`### ${b.name}${b.is_active ? "" : " (inativo)"} (board_id: ${b.id})\n${lines.join("\n") || "  (sem etapas)"}`);
      }
      return out.join("\n\n");
    },
  },
  {
    name: "julia_builder_listar_negocios",
    description:
      "Negócios (cards) do CRM Builder com filtros por quadro, etapa, responsável e busca. Retorna deal_id, valor, etapa, responsável e datas.",
    inputSchema: {
      type: "object",
      properties: {
        board_id: { type: "string", description: "UUID do quadro." },
        pipeline_id: { type: "string", description: "UUID da etapa." },
        busca: { type: "string", description: "Título, nome do contato ou telefone." },
        limite: { type: "number", description: "Máx. 200 (padrão 30)." },
      },
      additionalProperties: false,
    },
    run: async (ctx, args) => {
      let query = ctx.supabase
        .from("crm_deals")
        .select("id, title, contact_name, contact_phone, value, status, pipeline_id, assigned_to, created_at, updated_at, stage_entered_at")
        .eq("client_id", ctx.clientId)
        .order("updated_at", { ascending: false })
        .limit(num(args.limite, 30, MAX_ROWS));

      if (str(args.board_id)) query = query.eq("board_id", str(args.board_id));
      if (str(args.pipeline_id)) query = query.eq("pipeline_id", str(args.pipeline_id));
      const busca = str(args.busca);
      if (busca) {
        const digits = busca.replace(/\D/g, "");
        query = digits.length >= 4 ? query.ilike("contact_phone", `%${digits}%`) : query.ilike("title", `%${busca}%`);
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);
      if (!data?.length) return "Nenhum negócio encontrado com esses filtros.";

      const pipeIds = [...new Set(data.map((d: { pipeline_id: string }) => d.pipeline_id).filter(Boolean))];
      const { data: pipes } = await ctx.supabase.from("crm_pipelines").select("id, name").in("id", pipeIds);
      const pipeName = new Map((pipes || []).map((p: { id: string; name: string }) => [p.id, p.name]));

      // deno-lint-ignore no-explicit-any
      return data
        .map(
          (d: any) =>
            `- ${d.title || d.contact_name || "(sem título)"} · ${d.contact_phone || "sem telefone"} · etapa ${
              pipeName.get(d.pipeline_id) || "—"
            } · valor ${d.value ?? 0} · status ${d.status || "—"} · responsável ${d.assigned_to || "—"} · na etapa desde ${fmtDate(
              d.stage_entered_at || d.updated_at,
            )}\n  deal_id: ${d.id}`,
        )
        .join("\n");
    },
  },
  {
    name: "julia_builder_obter_negocio",
    description:
      "Detalhes de um negócio do CRM Builder: campos, valor, etapa, responsável, checklists e histórico de movimentações.",
    inputSchema: {
      type: "object",
      properties: { deal_id: { type: "string", description: "UUID do negócio." } },
      required: ["deal_id"],
      additionalProperties: false,
    },
    run: async (ctx, args) => {
      const id = str(args.deal_id);
      const { data: d, error } = await ctx.supabase
        .from("crm_deals")
        .select("*")
        .eq("client_id", ctx.clientId)
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!d) throw new Error("Negócio não encontrado neste escritório.");

      const [{ data: pipe }, { data: hist }, { data: checklists }] = await Promise.all([
        d.pipeline_id ? ctx.supabase.from("crm_pipelines").select("name").eq("id", d.pipeline_id).maybeSingle() : Promise.resolve({ data: null }),
        ctx.supabase.from("crm_deal_history").select("action, changed_by, changed_at, notes").eq("deal_id", id).order("changed_at").limit(100),
        ctx.supabase.from("crm_checklists").select("id, title, crm_checklist_items(title, is_completed)").eq("deal_id", id),
      ]);

      return [
        "=== NEGÓCIO (CRM BUILDER) ===",
        `Título: ${d.title || "—"}`,
        `Contato: ${d.contact_name || "—"} · ${d.contact_phone || "—"}`,
        `Etapa: ${pipe?.name || "—"} · Status: ${d.status || "—"} · Valor: ${d.value ?? 0}`,
        `Responsável: ${d.assigned_to || "—"} · Prioridade: ${d.priority || "—"}`,
        `Criado: ${fmtDate(d.created_at)} · Na etapa desde: ${fmtDate(d.stage_entered_at)}`,
        d.notes ? `Notas: ${d.notes}` : null,
        d.custom_fields ? `Campos personalizados: ${JSON.stringify(d.custom_fields)}` : null,
        "",
        "--- CHECKLISTS ---",
        checklists?.length
          ? // deno-lint-ignore no-explicit-any
            checklists
              .map(
                (cl: any) =>
                  `- ${cl.title}\n${(cl.crm_checklist_items || [])
                    // deno-lint-ignore no-explicit-any
                    .map((i: any) => `  [${i.is_completed ? "x" : " "}] ${i.title}`)
                    .join("\n")}`,
              )
              .join("\n")
          : "Nenhum checklist.",
        "",
        "--- HISTÓRICO ---",
        hist?.length
          ? // deno-lint-ignore no-explicit-any
            hist.map((h: any) => `- [${fmtDate(h.changed_at)}] ${h.action} por ${h.changed_by || "sistema"}${h.notes ? ` · ${h.notes}` : ""}`).join("\n")
          : "Sem histórico.",
      ]
        .filter(Boolean)
        .join("\n");
    },
  },
];
