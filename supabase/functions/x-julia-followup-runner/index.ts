// ============================================
// x-julia-followup-runner — dispara os followups devidos do X-Julia
// Conteúdo fixo ou gerado por IA; texto, áudio, vídeo, imagem, documento ou link.
//
// Execução: agendado por pg_cron (1 min). Lote fixo, lock por linha via
// xj_pick_due_followups (FOR UPDATE SKIP LOCKED), concorrência limitada e
// retentativas com backoff antes de marcar erro definitivo.
// ============================================
import { createClient } from "npm:@supabase/supabase-js@2";
import { resolveStepContent, scheduleNextFollowup } from "../_shared/x-julia/followups.ts";
import { xjSend, xjSendComposed } from "../_shared/x-julia/messaging.ts";
import { logXJEvent } from "../_shared/x-julia/session.ts";
import { xjSynthesize } from "../_shared/x-julia/tts.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH_LIMIT = 100;
const CONCURRENCY = 8;
const MAX_ATTEMPTS = 3;
/** Backoff em minutos por número de tentativas já feitas. */
const BACKOFF_MINUTES = [2, 10, 30];

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const stats = { due: 0, sent: 0, errors: 0, retried: 0, skipped: 0 };

  try {
    // Devolve à fila itens travados por execuções interrompidas.
    await supabase.rpc("xj_release_stale_followups", { p_minutes: 5 });

    const workerId = Math.floor(Math.random() * 1000) + 1;
    const { data: due, error: pickError } = await supabase.rpc("xj_pick_due_followups", {
      p_worker_id: workerId,
      p_limit: BATCH_LIMIT,
    });
    if (pickError) throw new Error(pickError.message);

    const items = (due ?? []) as any[];
    stats.due = items.length;

    // Carrega passos e sessões dos itens do lote.
    const stepIds = [...new Set(items.map((i) => i.step_id).filter(Boolean))];
    const sessionIds = [...new Set(items.map((i) => i.session_id).filter(Boolean))];
    const [{ data: steps }, { data: sessions }] = await Promise.all([
      stepIds.length
        ? supabase.from("xj_followup_steps").select("*").in("id", stepIds)
        : Promise.resolve({ data: [] as any[] }),
      sessionIds.length
        ? supabase.from("xj_sessions").select("*").in("id", sessionIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);
    const stepById = new Map((steps ?? []).map((s: any) => [s.id, s]));
    const sessionById = new Map((sessions ?? []).map((s: any) => [s.id, s]));

    const processOne = async (followup: any) => {
      const session = sessionById.get(followup.session_id);
      const step = stepById.get(followup.step_id);

      if (!session || !step || !session.is_active || ["humano", "encerrado"].includes(session.stage)) {
        await supabase.from("xj_followups").update({ status: "cancelled" }).eq("id", followup.id);
        stats.skipped++;
        return;
      }

      const { data: agent } = await supabase
        .from("xj_agents")
        .select("*")
        .eq("id", session.agent_id)
        .maybeSingle();
      if (!agent || !agent.is_active) {
        await supabase.from("xj_followups").update({ status: "cancelled" }).eq("id", followup.id);
        stats.skipped++;
        return;
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

        const sent = mediaUrl
          ? await xjSend(supabase, queue as any, session, content.text, {
            type,
            mediaUrl,
            caption: content.text,
            senderName: "X-Julia (follow-up)",
          })
          : await xjSendComposed(supabase, queue as any, session, content.text, {
            senderName: "X-Julia (follow-up)",
          });

        if (!sent.ok) throw new Error(sent.error ?? "falha no envio");

        await supabase
          .from("xj_followups")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            locked_at: null,
            worker_id: null,
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
        const retries = Number(followup.retry_count ?? 0) + 1;
        const message = String(err).slice(0, 500);

        if (retries < MAX_ATTEMPTS) {
          const minutes = BACKOFF_MINUTES[Math.min(retries - 1, BACKOFF_MINUTES.length - 1)];
          await supabase
            .from("xj_followups")
            .update({
              status: "pending",
              retry_count: retries,
              error_message: message,
              run_at: new Date(Date.now() + minutes * 60_000).toISOString(),
              locked_at: null,
              worker_id: null,
            })
            .eq("id", followup.id);
          stats.retried++;
        } else {
          await supabase
            .from("xj_followups")
            .update({
              status: "error",
              retry_count: retries,
              error_message: message,
              locked_at: null,
              worker_id: null,
            })
            .eq("id", followup.id);
          stats.errors++;
        }

        await logXJEvent(supabase, session, {
          kind: "followup",
          status: retries < MAX_ATTEMPTS ? "retry" : "error",
          detail: message.slice(0, 400),
          payload: { attempt: followup.attempt, retry_count: retries },
        });
      }
    };

    for (const block of chunk(items, CONCURRENCY)) {
      await Promise.allSettled(block.map(processOne));
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
