// ============================================
// x-julia-engine — motor do agente X-Julia (Extreme Julia)
// Acionado pela ingestão de mensagens (qualquer mensagem de fila vinculada).
// Independente do motor da Julia clássica.
// ============================================
import { createClient } from "npm:@supabase/supabase-js@2";
import { runXJTurn } from "../_shared/x-julia/runner.ts";
import { findAgentForQueue, getOrCreateSession, logXJEvent, updateSession } from "../_shared/x-julia/session.ts";
import { ensurePipelines } from "../_shared/x-julia/crm.ts";
import { xjSend } from "../_shared/x-julia/messaging.ts";
import {
  isWithinBusinessHours,
  matchesPhrase,
  offHoursMessage,
  restartMessage,
  type XJActivation,
} from "../_shared/x-julia/activation.ts";
import type { XJInboundMessage, XJQueueCreds } from "../_shared/x-julia/types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const body = await req.json();
    const action = body.action ?? "run";
    const data = body.data ?? body;

    if (action === "ping") return json({ ok: true, module: "x-julia" });

    // Intervenção manual: muda a etapa (advance_stage) ou apenas força um turno
    // na etapa atual (continue_now). Em ambos o agente age agora.
    if (action === "advance_stage" || action === "continue_now") {
      const keepStage = action === "continue_now";
      const sessionId: string | null = data.session_id ?? null;
      const requestedStage: string = String(data.stage ?? "").trim();
      if (!sessionId || (!keepStage && !requestedStage)) {
        return json({ error: "session_id e stage são obrigatórios" }, 400);
      }

      const { data: sessionRow } = await supabase
        .from("xj_sessions")
        .select("*")
        .eq("id", sessionId)
        .maybeSingle();
      if (!sessionRow) return json({ error: "sessão não encontrada" }, 404);

      const nextStage: string = keepStage ? String(sessionRow.stage ?? "recepcao") : requestedStage;
      const session = { ...sessionRow, slots: (sessionRow.slots ?? {}) as Record<string, unknown> } as any;
      const noSendStages = ["humano", "encerrado"];
      const patch: Record<string, unknown> = { stage: nextStage };
      if (!noSendStages.includes(nextStage)) {
        patch.is_active = true;
        patch.paused_reason = null;
      }
      await updateSession(supabase, session, patch);
      await logXJEvent(supabase, session, {
        kind: keepStage ? "turn_forced" : "stage_forced",
        detail: keepStage
          ? `continuação manual do atendimento na etapa ${nextStage}`
          : `etapa alterada manualmente para ${nextStage}`,
      }).catch(() => {});

      if (noSendStages.includes(nextStage)) {
        return json({ ok: true, stage: nextStage, replied: false, skipped: "etapa sem ação do agente" });
      }

      const stageAgent = session.agent_id
        ? await supabase.from("xj_agents").select("*").eq("id", session.agent_id).maybeSingle()
            .then((r: any) => r.data)
        : null;
      if (!stageAgent || !stageAgent.is_active) {
        return json({ ok: true, stage: nextStage, replied: false, skipped: "agente inativo ou ausente" });
      }
      if (!session.phone) {
        return json({ ok: true, stage: nextStage, replied: false, skipped: "sessão sem telefone" });
      }
      if (!isWithinBusinessHours(stageAgent.business_hours)) {
        return json({ ok: true, stage: nextStage, replied: false, skipped: "fora do horário de atuação" });
      }

      const { data: stageQueueRow } = await supabase
        .from("queues")
        .select("id, name, hub, evo_url, evo_apikey, waba_token, waba_number_id, channel_type")
        .eq("id", session.queue_id)
        .maybeSingle();
      if (!stageQueueRow) {
        return json({ ok: true, stage: nextStage, replied: false, skipped: "fila sem credenciais" });
      }

      const stageInbound: XJInboundMessage = {
        message_id: null,
        text: keepStage
          ? `[INSTRUÇÃO INTERNA DO SUPERVISOR — não é mensagem do lead] ` +
            `Continue o atendimento agora na etapa "${nextStage}", a partir do que já foi coletado, ` +
            `com uma única mensagem natural para o lead, sem repetir perguntas já respondidas ` +
            `e sem mencionar esta instrução.`
          :
          `[INSTRUÇÃO INTERNA DO SUPERVISOR — não é mensagem do lead] ` +
          `O atendimento foi movido manualmente para a etapa "${nextStage}". ` +
          `Continue a conversa a partir do que já foi coletado e conduza esta etapa agora, ` +
          `com uma única mensagem natural para o lead, sem repetir perguntas já respondidas ` +
          `e sem mencionar esta instrução.`,
        type: "text",
        media_url: null,
        mime_type: null,
        file_name: null,
        campaign_id: null,
        campaign_title: null,
        cta_payload: null,
      };

      const forced = await runXJTurn({
        supabase,
        agent: {
          ...stageAgent,
          stage_prompts: stageAgent.stage_prompts ?? {},
          voice_settings: stageAgent.voice_settings ?? {},
          business_hours: stageAgent.business_hours ?? {},
          handoff_policy: stageAgent.handoff_policy ?? {},
        },
        session,
        queue: stageQueueRow as XJQueueCreds,
        legalCase: null,
        inbound: stageInbound,
        replies: [],
        events: [],
      });

      return json({ ok: true, stage: forced.stage, replied: !!forced.reply });
    }

    if (action !== "run") return json({ error: `ação desconhecida: ${action}` }, 400);

    const conversationId: string | null = data.conversation_id ?? null;

    // Mensagem enviada manualmente pelo escritório: o agente não responde a si mesmo,
    // apenas registra na trilha que a sessão está aguardando o lead.
    if (data.manual_outbound === true) {
      if (!conversationId) return json({ ok: true, skipped: "sem conversa para registrar" });
      const { data: waitingSession } = await supabase
        .from("xj_sessions")
        .select("id, client_id, stage")
        .eq("conversation_id", conversationId)
        .maybeSingle();
      if (!waitingSession) return json({ ok: true, skipped: "sem sessão X-Julia nesta conversa" });
      await logXJEvent(supabase, waitingSession as any, {
        kind: "waiting_customer",
        detail: "resposta manual do atendente — o agente aguarda a próxima mensagem do lead",
      }).catch(() => {});
      return json({ ok: true, skipped: "mensagem própria (manual): aguardando lead" });
    }

    const contactId: string | null = data.contact_id ?? null;
    let queueId: string | null = data.queue_id ?? null;
    let clientId: string | null = data.client_id ? String(data.client_id) : null;
    let phone: string | null = data.phone ?? null;
    let contactName: string | null = data.contact_name ?? null;
    let channel: string | null = data.channel ?? null;

    // Completa contexto pela conversa/contato quando o chamador não enviou tudo.
    if (conversationId) {
      const { data: conv } = await supabase
        .from("chat_conversations")
        .select("id, client_id, queue_id, channel, contact_id, status, assigned_to")
        .eq("id", conversationId)
        .maybeSingle();
      if (conv) {
        clientId = clientId ?? String(conv.client_id);
        queueId = queueId ?? conv.queue_id;
        channel = channel ?? conv.channel;
        // Conversa já assumida por humano: o agente não interfere.
        if (conv.assigned_to) {
          return json({ ok: true, skipped: "conversa atribuída a atendente humano" });
        }
      }
    }

    if (!clientId || !queueId) return json({ ok: true, skipped: "sem client_id/queue_id" });

    const agent = await findAgentForQueue(supabase, clientId, queueId);
    if (!agent) return json({ ok: true, skipped: "nenhum agente X-Julia ativo nesta fila" });

    const activation: XJActivation = ((agent as any).activation ?? {}) as XJActivation;

    // Sessão já existente para esta conversa? Define se os gatilhos de início se aplicam.
    let existingSession: any = null;
    if (conversationId) {
      const { data: found } = await supabase
        .from("xj_sessions")
        .select("id, stage, is_active, slots")
        .eq("conversation_id", conversationId)
        .maybeSingle();
      existingSession = found ?? null;
    }

    const inboundText = String(data.message_text ?? data.text ?? "");
    const hasCampaignMarker = !!(data.campaign_id ?? data.campaign_title);
    const hasCampaignPhrases = !!String(activation.start_campaign ?? "").trim();
    const matchedCampaignPhrase = matchesPhrase(activation.start_campaign, inboundText);
    // Com frases configuradas, a campanha só conta quando a mensagem contém uma delas.
    const isCampaign = hasCampaignPhrases ? matchedCampaignPhrase : hasCampaignMarker;

    const startPhrasesRaw = String(activation.session_start ?? "").trim();
    const matchedStartPhrase = startPhrasesRaw ? matchesPhrase(activation.session_start, inboundText) : false;
    // Entrada restrita: toggle "apenas campanha" ou frases de campanha configuradas.
    const restrictedEntry = !!activation.only_campaign || hasCampaignPhrases;

    // Frase de início com entrada restrita: APAGA a sessão do lead (fica como se
    // nunca tivesse entrado em contato). A nova sessão só nasce na mensagem de CTA/campanha.
    if (matchedStartPhrase && restrictedEntry) {
      const { data: queueRowForRestart } = await supabase
        .from("queues")
        .select("id, name, hub, evo_url, evo_apikey, waba_token, waba_number_id, channel_type")
        .eq("id", queueId)
        .maybeSingle();
      const restartQueue = (queueRowForRestart ?? null) as XJQueueCreds | null;

      // Telefone é necessário para confirmar o reset ao lead.
      if (contactId && !phone) {
        const { data: contact } = await supabase
          .from("chat_contacts")
          .select("phone")
          .eq("id", contactId)
          .maybeSingle();
        phone = phone ?? contact?.phone ?? null;
      }

      // Sessões do lead (por conversa e, quando houver, por contato) são removidas.
      const idsToDelete = new Set<string>();
      if (existingSession?.id) idsToDelete.add(existingSession.id);
      if (contactId) {
        const { data: byContact } = await supabase
          .from("xj_sessions")
          .select("id")
          .eq("client_id", String(clientId))
          .eq("contact_id", contactId);
        for (const row of byContact ?? []) idsToDelete.add(row.id);
      }
      const ids = [...idsToDelete];

      // Confirma antes de apagar (o envio registra na sessão atual, se existir).
      const stub = {
        id: ids[0] ?? null,
        client_id: String(clientId),
        conversation_id: conversationId,
        contact_id: contactId,
        phone,
        channel,
        stage: "recepcao",
      } as any;
      await xjSend(supabase, restartQueue, stub, restartMessage(activation)).catch(() => {});

      if (ids.length) {
        try {
          await supabase.from("xj_session_events").delete().in("session_id", ids);
        } catch { /* trilha opcional */ }
        try {
          await supabase.from("xj_followups").delete().in("session_id", ids);
        } catch { /* followups opcionais */ }
        await supabase.from("xj_sessions").delete().in("id", ids);
      }

      return json({ ok: true, deleted_sessions: ids.length, reset: true });
    }

    // Gatilhos de início só valem para conversas ainda sem sessão X-Julia.
    if (!existingSession) {
      const startPhrases = startPhrasesRaw;
      const matchedStart = matchedStartPhrase;
      // Frases de campanha configuradas já implicam entrada restrita, mesmo que o
      // toggle "apenas campanha" não esteja marcado.
      const campaignOnly = restrictedEntry;

      if (campaignOnly) {
        if (!isCampaign && !matchedStart) {
          return json({
            ok: true,
            skipped: hasCampaignPhrases
              ? "apenas campanha: mensagem não contém frase de início de campanha"
              : "agente configurado apenas para campanha",
          });
        }
      } else if (startPhrases && !matchedStart) {
        return json({ ok: true, skipped: "sem frase de início de sessão" });
      }
    }

    if (contactId && (!phone || !contactName)) {
      const { data: contact } = await supabase
        .from("chat_contacts")
        .select("phone, name, push_name")
        .eq("id", contactId)
        .maybeSingle();
      phone = phone ?? contact?.phone ?? null;
      contactName = contactName ?? contact?.name ?? contact?.push_name ?? null;
    }

    const { data: queueRow } = await supabase
      .from("queues")
      .select("id, name, hub, evo_url, evo_apikey, waba_token, waba_number_id, channel_type")
      .eq("id", queueId)
      .maybeSingle();
    const queue = (queueRow ?? null) as XJQueueCreds | null;

    const inbound: XJInboundMessage = {
      message_id: data.message_id ?? null,
      text: String(data.message_text ?? data.text ?? ""),
      type: String(data.message_type ?? data.type ?? "text"),
      media_url: data.media_url ?? null,
      mime_type: data.mime_type ?? null,
      file_name: data.file_name ?? null,
      campaign_id: data.campaign_id ?? null,
      campaign_title: data.campaign_title ?? null,
      cta_payload: data.cta_payload ?? null,
    };

    const { session, created } = await getOrCreateSession(supabase, {
      clientId,
      agent,
      conversationId,
      contactId,
      queue,
      phone,
      contactName,
      channel,
      inbound,
    });

    if (created) {
      await ensurePipelines(supabase, clientId, agent.id).catch(() => {});
      // Sessão nova = atendimento do zero: histórico do prompt conta a partir daqui.
      await updateSession(supabase, session, {
        slots: { ...(session.slots ?? {}), __restarted_at: new Date().toISOString() },
      });
      await logXJEvent(supabase, session, { kind: "session_started", detail: `origem: ${session.origin ?? "-"}` });
    }

    // Sessão parada (humano/encerrada): reabre só se o lead voltar a falar.
    if (!session.is_active) {
      if (session.stage === "humano") {
        return json({ ok: true, skipped: "sessão em atendimento humano" });
      }
      await updateSession(supabase, session, { is_active: true, paused_reason: null, stage: "recepcao" });
    }

    // Pedido explícito de atendimento especializado → transfere para humano.
    if (matchesPhrase(activation.check_specialized, inbound.text)) {
      await updateSession(supabase, session, {
        stage: "humano",
        is_active: false,
        paused_reason: "atendimento especializado solicitado",
        handoff_at: new Date().toISOString(),
      });
      await logXJEvent(supabase, session, {
        kind: "handoff",
        detail: "frase de atendimento especializado",
      }).catch(() => {});
      return json({ ok: true, skipped: "transferido para atendimento especializado" });
    }

    // Fora do horário de atuação: não processa o turno (avisa uma vez por sessão).
    if (!isWithinBusinessHours((agent as any).business_hours)) {
      const slots = (session.slots ?? {}) as Record<string, any>;
      const message = offHoursMessage((agent as any).business_hours);
      if (message && !slots.__off_hours_notified) {
        await xjSend(supabase, queue, session, message).catch(() => {});
        await updateSession(supabase, session, { slots: { ...slots, __off_hours_notified: true } });
      }
      return json({ ok: true, skipped: "fora do horário de atuação" });
    }

    // Volta ao horário: libera novo aviso na próxima ausência.
    if ((session.slots as Record<string, any>)?.__off_hours_notified) {
      const slots = { ...(session.slots as Record<string, any>) };
      delete slots.__off_hours_notified;
      await updateSession(supabase, session, { slots });
    }

    const result = await runXJTurn({
      supabase,
      agent,
      session,
      queue,
      legalCase: null,
      inbound,
      replies: [],
      events: [],
    });

    return json({ ok: true, session_id: session.id, stage: result.stage, replied: !!result.reply });
  } catch (error) {
    console.error("[x-julia-engine] erro:", error);
    return json({ error: (error as Error).message }, 500);
  }
});