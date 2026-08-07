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

    if (action !== "run") return json({ error: `ação desconhecida: ${action}` }, 400);

    const conversationId: string | null = data.conversation_id ?? null;
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
    const isCampaign = !!(data.campaign_id ?? data.campaign_title) ||
      matchesPhrase(activation.start_campaign, inboundText);

    // Gatilhos de início só valem para conversas ainda sem sessão X-Julia.
    if (!existingSession) {
      if (matchesPhrase(activation.session_start, inboundText) === false && (activation.session_start ?? "").trim()) {
        if (!isCampaign) return json({ ok: true, skipped: "sem frase de início de sessão" });
      }
      if (activation.only_campaign && !isCampaign) {
        return json({ ok: true, skipped: "agente configurado apenas para campanha" });
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