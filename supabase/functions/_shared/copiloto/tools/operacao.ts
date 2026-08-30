/**
 * Domínio: filas, equipe/permissões, campanhas, telefonia e tickets (leitura).
 */
import { agentCodes, legacyRaw } from "../legacy.ts";
import { fmtDate, MAX_ROWS, num, str, type CopilotoTool } from "../types.ts";

export const operacaoTools: CopilotoTool[] = [
  {
    name: "julia_filas_listar",
    description:
      "Filas de atendimento do escritório: nome, canal (UaZapi/WABA/Instagram/WebChat), status de conexão, número vinculado e agentes ligados.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    run: async (ctx) => {
      const { data, error } = await ctx.supabase
        .from("queues")
        .select("id, name, channel_type, channel_source, phone_number, is_active, created_at")
        .eq("client_id", ctx.clientId)
        .order("name");
      if (error) throw new Error(error.message);
      if (!data?.length) return "Nenhuma fila cadastrada.";

      const { data: links } = await ctx.supabase
        .from("queue_agent_links")
        .select("queue_id, cod_agent, is_primary")
        .in("queue_id", data.map((q: { id: string }) => q.id));

      // deno-lint-ignore no-explicit-any
      return data
        .map((q: any) => {
          const agents = (links || [])
            // deno-lint-ignore no-explicit-any
            .filter((l: any) => l.queue_id === q.id)
            // deno-lint-ignore no-explicit-any
            .map((l: any) => `${l.cod_agent}${l.is_primary ? " (principal)" : ""}`)
            .join(", ");
          return `- ${q.name} · canal ${q.channel_type || q.channel_source || "—"} · número ${q.phone_number || "—"} · ${
            q.is_active ? "ativa" : "inativa"
          }\n  agentes: ${agents || "nenhum"} · queue_id: ${q.id}`;
        })
        .join("\n");
    },
  },
  {
    name: "julia_equipe_listar",
    description:
      "Equipe do escritório espelhando o dashboard de Equipe: nome, e-mail, papel, acesso ativo, status de presença (Online/Ausente/Offline e 'ativo há X'), último login, último logout (com selo Inatividade/Manual), alerta de som ativo e contadores de chats abertos, cards de CRM abertos e tarefas abertas por usuário. Não retorna senhas.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    run: async (ctx) => {
      const rows = await legacyRaw(
        ctx,
        `SELECT id, name, email, role, is_active, created_at
           FROM users
          WHERE client_id = $1::bigint OR user_id IN (SELECT id FROM users WHERE client_id = $1::bigint)
          ORDER BY name LIMIT 200`,
        [ctx.clientId],
      );
      if (!rows.length) return "Nenhum usuário encontrado neste escritório.";

      // deno-lint-ignore no-explicit-any
      const users = rows as any[];
      const ids = users.map((u) => Number(u.id)).filter((n) => Number.isFinite(n));
      const names = [...new Set(users.map((u) => String(u.name || "").trim()).filter(Boolean))];
      const nameToIds: Record<string, string[]> = {};
      for (const u of users) {
        const key = String(u.name || "").trim();
        if (!key) continue;
        (nameToIds[key] ||= []).push(String(u.id));
      }
      const idsCsv = ids.join(",") || "0";
      const namesCsv = names.map((n) => `"${n.replace(/"/g, '\\"')}"`).join(",");
      const nameOrIdFilter = `assigned_user_id.in.(${idsCsv}),assigned_to.in.(${namesCsv})`;

      const [presenceRes, activityRes, settingsRes, chatsRes, dealsRes, tasksRes] = await Promise.all([
        ctx.supabase
          .from("user_presence_status")
          .select("user_id,last_seen_at,is_online,is_away")
          .eq("client_id", Number(ctx.clientId)),
        ctx.supabase.from("user_last_activity").select("*").in("user_id", ids),
        ctx.supabase.from("chat_client_settings").select("settings").eq("client_id", ctx.clientId).maybeSingle(),
        names.length
          ? ctx.supabase
              .from("chat_conversations")
              .select("assigned_to, assigned_user_id")
              .eq("client_id", ctx.clientId)
              .in("status", ["open", "pending"])
              .or(nameOrIdFilter)
          : Promise.resolve({ data: [] }),
        names.length
          ? ctx.supabase
              .from("crm_deals")
              .select("assigned_to, assigned_user_id, status")
              .eq("client_id", ctx.clientId)
              .or(nameOrIdFilter)
          : Promise.resolve({ data: [] }),
        ctx.supabase
          .from("tasks")
          .select("assigned_to, assigned_user_id")
          .eq("client_id", ctx.clientId)
          .in("status", ["pending", "in_progress"])
          .or(`assigned_user_id.in.(${idsCsv}),assigned_to.in.(${ids.map((i: number) => `"${i}"`).join(",")})`),
      ]);

      // Presença / atividade / som
      // deno-lint-ignore no-explicit-any
      const presence = new Map<number, any>(
        (presenceRes.data || []).map((r: any) => [Number(r.user_id), r]),
      );
      // deno-lint-ignore no-explicit-any
      const activity = new Map<number, any>(
        (activityRes.data || []).map((r: any) => [Number(r.user_id), r]),
      );
      const s = (settingsRes.data?.settings || {}) as Record<string, unknown>;
      const soundEnabled = Boolean(s.sound_alert_enabled ?? true);
      const muted = (s.sound_alert_muted_users || {}) as Record<string, boolean>;
      const soundActiveFor = (id: number) => soundEnabled && !muted[String(id)];

      // Contadores (mesma lógica do dashboard: id primeiro, fallback por nome)
      const counters: Record<string, { chats: number; deals: number; tasks: number }> = {};
      for (const id of ids) counters[String(id)] = { chats: 0, deals: 0, tasks: 0 };
      // deno-lint-ignore no-explicit-any
      const resolveIds = (row: any): string[] => {
        if (row.assigned_user_id != null) {
          const id = String(row.assigned_user_id);
          return counters[id] ? [id] : [];
        }
        const key = String(row.assigned_to || "").trim();
        return key ? nameToIds[key] || [] : [];
      };
      // deno-lint-ignore no-explicit-any
      for (const row of (chatsRes.data || []) as any[]) for (const id of resolveIds(row)) counters[id].chats++;
      // deno-lint-ignore no-explicit-any
      for (const row of (dealsRes.data || []) as any[]) {
        const st = String(row.status || "").toLowerCase();
        if (st === "won" || st === "lost") continue;
        for (const id of resolveIds(row)) counters[id].deals++;
      }
      // deno-lint-ignore no-explicit-any
      for (const row of (tasksRes.data || []) as any[]) {
        const st = String(row.assigned_to || "").trim();
        const target = row.assigned_user_id != null
          ? [String(row.assigned_user_id)]
          : (counters[st] ? [st] : []);
        for (const id of target) if (counters[id]) counters[id].tasks++;
      }

      const statusOf = (id: number): string => {
        const p = presence.get(id);
        if (p?.is_online) return "Online";
        if (p?.is_away) return "Ausente";
        return "Offline";
      };
      const relativeSeen = (id: number): string => {
        const ts = presence.get(id)?.last_seen_at;
        if (!ts) return "";
        const diff = Date.now() - new Date(ts).getTime();
        if (diff < 60_000) return "ativo agora";
        const min = Math.floor(diff / 60_000);
        if (min < 60) return `ativo há ${min} min`;
        const h = Math.floor(min / 60);
        if (h < 24) return `ativo há ${h} h`;
        const d = Math.floor(h / 24);
        return d < 7 ? `ativo há ${d} d` : "ativo há +7 d";
      };

      let chatsTotal = 0, dealsTotal = 0, tasksTotal = 0, onlineTotal = 0;
      const lines = users.map((u) => {
        const id = Number(u.id);
        const status = statusOf(id);
        if (status === "Online") onlineTotal++;
        const act = activity.get(id);
        const c = counters[String(id)] || { chats: 0, deals: 0, tasks: 0 };
        chatsTotal += c.chats; dealsTotal += c.deals; tasksTotal += c.tasks;
        const seen = status !== "Online" ? relativeSeen(id) : "";
        const logout = status === "Online"
          ? "—"
          : act?.last_logout_at
          ? `${fmtDate(act.last_logout_at)} (${act.last_logout_type === "logout_inactivity" ? "Inatividade" : "Manual"})`
          : "—";
        return (
          `- ${u.name || "(sem nome)"} · ${u.email} · papel ${u.role || "—"} · ${
            u.is_active ? "ativo" : "inativo"
          } (user_id: ${u.id})\n` +
          `  status: ${status}${seen ? ` · ${seen}` : ""} · último login: ${
            act?.last_login_at ? fmtDate(act.last_login_at) : "—"
          } · último logout: ${logout}\n` +
          `  som: ${soundActiveFor(id) ? "ativo" : "desativado"} · chats abertos: ${c.chats} · CRM abertos: ${c.deals} · tarefas abertas: ${c.tasks}`
        );
      });

      return (
        `Resumo: ${onlineTotal}/${users.length} online · chats atribuídos: ${chatsTotal} · CRM atribuídos: ${dealsTotal} · tarefas abertas: ${tasksTotal}\n\n` +
        lines.join("\n")
      );
    },
  },
  {
    name: "julia_agentes_listar",
    description:
      "Agentes de IA (Julia) do escritório: cod_agent, nome do titular, empresa e telefone vinculado — base do escopo do CRM clássico e dos contratos.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    run: async (ctx) => {
      const rows = await legacyRaw(
        ctx,
        `SELECT cod_agent::text AS cod_agent, owner_name, business_name, whatsapp, is_active
           FROM agents WHERE client_id = $1::bigint ORDER BY owner_name LIMIT 200`,
        [ctx.clientId],
      );
      if (!rows.length) return "Nenhum agente vinculado a este escritório.";
      // deno-lint-ignore no-explicit-any
      return rows
        .map(
          (a: any) =>
            `- cod_agent ${a.cod_agent} · ${a.owner_name || "—"} · ${a.business_name || "—"} · ${a.whatsapp || "—"} · ${
              a.is_active === false ? "inativo" : "ativo"
            }`,
        )
        .join("\n");
    },
  },
  {
    name: "julia_campanhas_listar",
    description:
      "Campanhas de disparo do escritório com status, janela de envio, agendamento, aprovação e resultados (enviadas, entregues, lidas, respondidas, falhas, opt-out).",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", description: "Filtrar por status (draft, running, paused, completed...)." },
        limite: { type: "number", description: "Máx. 200 (padrão 20)." },
      },
      additionalProperties: false,
    },
    run: async (ctx, args) => {
      let query = ctx.supabase
        .from("dsp_campaigns")
        .select(
          "id, name, status, risk_level, approval_status, scheduled_at, schedule_start_at, send_window_start, send_window_end, total_recipients, total_sent, total_delivered, total_read, total_replied, total_failed, total_optout, created_at",
        )
        .eq("client_id", ctx.clientId)
        .order("created_at", { ascending: false })
        .limit(num(args.limite, 20, MAX_ROWS));
      if (str(args.status)) query = query.eq("status", str(args.status));
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      if (!data?.length) return "Nenhuma campanha encontrada.";
      // deno-lint-ignore no-explicit-any
      return data
        .map(
          (c: any) =>
            `- ${c.name} · status ${c.status} · aprovação ${c.approval_status || "—"} · risco ${c.risk_level || "—"}\n  janela ${
              c.send_window_start || "—"
            }–${c.send_window_end || "—"} · agendada ${fmtDate(c.schedule_start_at || c.scheduled_at)}\n  destinatários ${
              c.total_recipients ?? 0
            } · enviadas ${c.total_sent ?? 0} · entregues ${c.total_delivered ?? 0} · lidas ${c.total_read ?? 0} · respondidas ${
              c.total_replied ?? 0
            } · falhas ${c.total_failed ?? 0} · opt-out ${c.total_optout ?? 0}\n  campaign_id: ${c.id}`,
        )
        .join("\n");
    },
  },
  {
    name: "julia_telefonia_listar_chamadas",
    description:
      "Ligações registradas no escritório (ZAP Call via WhatsApp e VoIP SIP): direção, status amigável, duração, transcrição quando houver e contato vinculado.",
    inputSchema: {
      type: "object",
      properties: {
        contato_id: { type: "string", description: "Filtrar por contato." },
        dias: { type: "number", description: "Janela em dias (padrão 7)." },
        limite: { type: "number", description: "Máx. 200 (padrão 30)." },
      },
      additionalProperties: false,
    },
    run: async (ctx, args) => {
      const dias = num(args.dias, 7, 365);
      const since = new Date(Date.now() - dias * 86400000).toISOString();
      const limit = num(args.limite, 30, MAX_ROWS);

      let zap = ctx.supabase
        .from("wavoip_call_logs")
        .select("direction, status, from_number, to_number, started_at, duration_seconds, transcription_summary, contact_id")
        .eq("client_id", ctx.clientId)
        .gte("started_at", since)
        .order("started_at", { ascending: false })
        .limit(limit);
      let voip = ctx.supabase
        .from("phone_call_logs")
        .select("direction, status, caller, called, started_at, duration_seconds, contact_id")
        .eq("client_id", ctx.clientId)
        .gte("started_at", since)
        .order("started_at", { ascending: false })
        .limit(limit);
      if (str(args.contato_id)) {
        zap = zap.eq("contact_id", str(args.contato_id));
        voip = voip.eq("contact_id", str(args.contato_id));
      }

      const [{ data: z }, { data: v }] = await Promise.all([zap, voip]);
      const lines = [
        // deno-lint-ignore no-explicit-any
        ...(z || []).map(
          (c: any) =>
            `- [ZAP Call] ${fmtDate(c.started_at)} · ${c.direction || "—"} · ${c.status || "—"} · ${c.from_number || "—"} → ${
              c.to_number || "—"
            } · ${c.duration_seconds || 0}s${c.transcription_summary ? `\n  resumo: ${c.transcription_summary}` : ""}`,
        ),
        // deno-lint-ignore no-explicit-any
        ...(v || []).map(
          (c: any) =>
            `- [VoIP] ${fmtDate(c.started_at)} · ${c.direction || "—"} · ${c.status || "—"} · ${c.caller || "—"} → ${
              c.called || "—"
            } · ${c.duration_seconds || 0}s`,
        ),
      ];
      return lines.length ? lines.join("\n") : `Nenhuma ligação nos últimos ${dias} dias.`;
    },
  },
  {
    name: "julia_tickets_listar",
    description:
      "Tickets de helpdesk do escritório: protocolo, assunto, status, prioridade, responsável, SLA e datas de abertura/resolução.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", description: "Filtrar por status (open, pending, resolved, closed...)." },
        limite: { type: "number", description: "Máx. 200 (padrão 20)." },
      },
      additionalProperties: false,
    },
    run: async (ctx, args) => {
      let query = ctx.supabase
        .from("support_tickets")
        .select(
          "id, protocol, number, subject, status, priority, assigned_to_name, requester_name, opened_at, resolved_at, sla_resolution_due_at, conversation_id",
        )
        .eq("requester_client_id", ctx.clientId)
        .order("opened_at", { ascending: false })
        .limit(num(args.limite, 20, MAX_ROWS));
      if (str(args.status)) query = query.eq("status", str(args.status));
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      if (!data?.length) return "Nenhum ticket encontrado.";
      // deno-lint-ignore no-explicit-any
      return data
        .map(
          (t: any) =>
            `- ${t.protocol || `#${t.number}`} · ${t.subject || "(sem assunto)"} · ${t.status} · prioridade ${
              t.priority || "—"
            } · responsável ${t.assigned_to_name || "—"}\n  solicitante ${t.requester_name || "—"} · aberto ${fmtDate(
              t.opened_at,
            )} · resolvido ${fmtDate(t.resolved_at)} · SLA ${fmtDate(t.sla_resolution_due_at)}\n  ticket_id: ${t.id}`,
        )
        .join("\n");
    },
  },
  {
    name: "julia_tickets_obter",
    description: "Detalhes de um ticket com todas as mensagens/interações registradas nele.",
    inputSchema: {
      type: "object",
      properties: { ticket_id: { type: "string", description: "UUID do ticket." } },
      required: ["ticket_id"],
      additionalProperties: false,
    },
    run: async (ctx, args) => {
      const id = str(args.ticket_id);
      const { data: t, error } = await ctx.supabase
        .from("support_tickets")
        .select("*")
        .eq("requester_client_id", ctx.clientId)
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!t) throw new Error("Ticket não encontrado neste escritório.");
      const { data: msgs } = await ctx.supabase
        .from("support_ticket_messages")
        .select("author_name, body, is_internal, created_at")
        .eq("ticket_id", id)
        .order("created_at")
        .limit(MAX_ROWS);
      return [
        "=== TICKET ===",
        `${t.protocol || `#${t.number}`} · ${t.subject || "(sem assunto)"}`,
        `Status: ${t.status} · Prioridade: ${t.priority || "—"} · Responsável: ${t.assigned_to_name || "—"}`,
        `Solicitante: ${t.requester_name || "—"} (${t.requester_email || t.requester_phone || "—"})`,
        `Aberto: ${fmtDate(t.opened_at)} · 1ª resposta: ${fmtDate(t.first_response_at)} · Resolvido: ${fmtDate(t.resolved_at)}`,
        t.description ? `\nDescrição:\n${t.description}` : null,
        t.resolution_note ? `\nResolução: ${t.resolution_note}` : null,
        "",
        "--- INTERAÇÕES ---",
        msgs?.length
          ? // deno-lint-ignore no-explicit-any
            msgs
              .map((m: any) => `- [${fmtDate(m.created_at)}] ${m.author_name || "—"}${m.is_internal ? " (interno)" : ""}: ${m.body}`)
              .join("\n")
          : "Sem interações.",
      ]
        .filter(Boolean)
        .join("\n");
    },
  },
  {
    name: "julia_operacao_indicadores",
    description:
      "Painel operacional do escritório no período: atendimentos por status, tempo médio de primeira resposta, atendimentos sem responsável, carga por atendente e leads sem resposta.",
    inputSchema: {
      type: "object",
      properties: { dias: { type: "number", description: "Janela em dias (padrão 7)." } },
      additionalProperties: false,
    },
    run: async (ctx, args) => {
      const dias = num(args.dias, 7, 90);
      const since = new Date(Date.now() - dias * 86400000).toISOString();
      const { data, error } = await ctx.supabase
        .from("chat_conversations")
        .select("status, assigned_to, opened_at, first_response_at, last_customer_message_at, last_message_from_me")
        .eq("client_id", ctx.clientId)
        .gte("opened_at", since)
        .limit(2000);
      if (error) throw new Error(error.message);
      if (!data?.length) return `Nenhum atendimento aberto nos últimos ${dias} dias.`;

      const byStatus = new Map<string, number>();
      const byAgent = new Map<string, number>();
      let frtSum = 0;
      let frtCount = 0;
      let semResponsavel = 0;
      let semResposta = 0;

      // deno-lint-ignore no-explicit-any
      for (const c of data as any[]) {
        byStatus.set(c.status, (byStatus.get(c.status) || 0) + 1);
        if (c.assigned_to) byAgent.set(c.assigned_to, (byAgent.get(c.assigned_to) || 0) + 1);
        else semResponsavel++;
        if (c.opened_at && c.first_response_at) {
          frtSum += (new Date(c.first_response_at).getTime() - new Date(c.opened_at).getTime()) / 60000;
          frtCount++;
        }
        // Sem coluna de "última mensagem do agente": usamos o flag da última mensagem.
        if (c.last_customer_message_at && !c.last_message_from_me) semResposta++;
      }

      return [
        `=== INDICADORES (últimos ${dias} dias) ===`,
        `Total de atendimentos: ${data.length}`,
        `Por status: ${[...byStatus].map(([s, n]) => `${s} ${n}`).join(" · ")}`,
        `Tempo médio de 1ª resposta: ${frtCount ? (frtSum / frtCount).toFixed(1) : "—"} min (${frtCount} medidos)`,
        `Sem responsável: ${semResponsavel}`,
        `Aguardando resposta do escritório: ${semResposta}`,
        "",
        "Carga por atendente:",
        [...byAgent]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 20)
          .map(([a, n]) => `- ${a}: ${n}`)
          .join("\n") || "—",
      ].join("\n");
    },
  },
];
