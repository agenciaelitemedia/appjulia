// ============================================
// x-julia-followup-runner — dispara os followups devidos do X-Julia
// Conteúdo fixo ou gerado por IA; texto, áudio, vídeo, imagem, documento ou link.
// ============================================
import { createClient } from "npm:@supabase/supabase-js@2";
import { resolveStepContent, scheduleNextFollowup } from "../_shared/x-julia/followups.ts";
import { xjSend } from "../_shared/x-julia/messaging.ts";
import { logXJEvent } from "../_shared/x-julia/session.ts";
import { xjSynthesize } from "../_shared/x-julia/tts.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const stats = { due: 0, sent: 0, errors: 0, skipped: 0 };

  try {
    const { data: due } = await supabase
      .from("xj_followups")
      .select("*, xj_followup_steps(*), xj_sessions(*)")
      .eq("status", "pending")
      .lte("run_at", new Date().toISOString())
      .order("run_at")
      .limit(40);

    stats.due = (due ?? []).length;

    for (const followup of due ?? []) {
      const session = (followup as any).xj_sessions;
      const step = (followup as any).xj_followup_steps;
      if (!session || !step) {
        await supabase.from("xj_followups").update({ status: "cancelled" }).eq("id", followup.id);
        stats.skipped++;
        continue;
      }

      if (!session.is_active || ["humano", "encerrado"].includes(session.stage)) {
        await supabase.from("xj_followups").update({ status: "cancelled" }).eq("id", followup.id);
        stats.skipped++;
        continue;
      }

      const { data: agent } = await supabase
        .from("xj_agents")
        .select("*")
        .eq("id", session.agent_id)
        .maybeSingle();
      if (!agent || !agent.is_active) {
        await supabase.from("xj_followups").update({ status: "cancelled" }).eq("id", followup.id);
        stats.skipped++;
        continue;
      }

      const { data: queue } = await supabase
        .from("queues")
        .select("id, name, hub, evo_url, evo_apikey, waba_token, waba_number_id, channel_type")
        .eq("id", session.queue_id)
        .maybeSingle();

      try {
        const content = await resolveStepContent(supabase, agent, session, step);
        let mediaUrl = content.mediaUrl;
        let type = content.type as any;

        // Passo de áudio sem arquivo: sintetiza a voz do agente.
        if (type === "audio" && !mediaUrl && content.text) {
          const voice = await xjSynthesize(supabase, {
            clientId: session.client_id,
            text: content.text,
            provider: agent.voice_provider ?? "elevenlabs",
            voiceId: agent.voice_id,
            settings: agent.voice_settings ?? {},
            keyMode: (agent as any).voice_key_mode ?? "default",
          });
          if ("url" in voice) mediaUrl = voice.url;
          else type = "text";
        }

        const sent = await xjSend(supabase, queue as any, session, content.text, {
          type: mediaUrl ? type : "text",
          mediaUrl,
          caption: content.text,
          senderName: "X-Julia (follow-up)",
        });

        if (!sent.ok) throw new Error(sent.error ?? "falha no envio");

        await supabase
          .from("xj_followups")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            resolved_content: { type: mediaUrl ? type : "text", text: content.text, media_url: mediaUrl },
          })
          .eq("id", followup.id);

        await logXJEvent(supabase, session, {
          kind: "followup",
          status: "ok",
          detail: content.text.slice(0, 400),
          payload: { attempt: followup.attempt, step_id: step.id },
        });

        await scheduleNextFollowup(supabase, session, Number(followup.attempt ?? 1) + 1);
        stats.sent++;
      } catch (err) {
        await supabase
          .from("xj_followups")
          .update({ status: "error", error_message: String(err).slice(0, 500) })
          .eq("id", followup.id);
        await logXJEvent(supabase, session, {
          kind: "followup",
          status: "error",
          detail: String(err).slice(0, 400),
        });
        stats.errors++;
      }
    }

    return new Response(JSON.stringify({ ok: true, ...stats }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[x-julia-followup-runner] erro:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});