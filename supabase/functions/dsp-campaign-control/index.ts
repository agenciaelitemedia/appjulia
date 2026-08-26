// ============================================================
// dsp-campaign-control — start / pause / resume / cancel de campanhas.
// Retomada exige canal saudável: limpa cooldown apenas com confirmação humana.
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { loadChannel, canSendNow, isUazapi } from "../_shared/dsp-core.ts";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_KEY);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, campaign_id, actor, clear_cooldown } = await req.json();
    if (!action || !campaign_id) return json({ error: "action and campaign_id are required" }, 400);

    const { data: campaign } = await admin
      .from("dsp_campaigns").select("*").eq("id", campaign_id).maybeSingle();
    if (!campaign) return json({ error: "campaign not found" }, 404);
    const clientId = String(campaign.client_id);

    const audit = (details: unknown) =>
      admin.from("dsp_audit_log").insert({ client_id: clientId, campaign_id, action, actor: actor ?? null, details });

    switch (action) {
      case "start": {
        if (!["draft", "scheduled", "paused"].includes(campaign.status)) {
          return json({ error: `cannot start from status ${campaign.status}` }, 400);
        }
        const { data: channels } = await admin
          .from("dsp_campaign_channels").select("queue_id").eq("campaign_id", campaign_id).eq("is_active", true);
        if (!channels || channels.length === 0) return json({ error: "nenhuma fila selecionada" }, 400);

        const { data: variants } = await admin
          .from("dsp_campaign_variants").select("id").eq("campaign_id", campaign_id).eq("is_active", true);
        if ((!variants || variants.length === 0) && !campaign.waba_template_name) {
          return json({ error: "nenhuma variante de mensagem configurada" }, 400);
        }

        // ---- Guardrails: nenhuma chamada a API não oficial sem limites válidos ----
        const queueIds = channels.map((c: any) => c.queue_id);
        const { data: queueRows } = await admin.from("queues").select("*").in("id", queueIds);
        const guardrails: any[] = [];
        let anyUsable = false;
        let unofficialCount = 0;

        for (const q of queueRows ?? []) {
          const candidate = await loadChannel(admin, q);
          const limits = candidate.limits;
          const unofficial = isUazapi(q);
          if (unofficial) unofficialCount++;

          const problems: string[] = [];
          if (!(limits.max_per_minute > 0) || !(limits.max_per_hour > 0) || !(limits.max_per_day > 0)) {
            problems.push("limites_invalidos");
          }
          if (unofficial && !(limits.min_seconds_between_messages >= 1)) {
            problems.push("intervalo_entre_mensagens_obrigatorio");
          }
          if (unofficial && !(limits.block_size > 0 && limits.block_pause_seconds > 0)) {
            problems.push("pausa_entre_blocos_obrigatoria");
          }
          if (campaign.category === "marketing" && !limits.marketing_enabled) {
            problems.push("marketing_desativado_na_fila");
          }

          const decision = canSendNow(candidate, { category: campaign.category });
          if (problems.length === 0 && (decision.ok || ["throttled", "minute_limit", "hour_limit"].includes(String(decision.reason)))) {
            anyUsable = true;
          }

          guardrails.push({
            queue_id: q.id,
            queue_name: q.name,
            unofficial,
            problems,
            blocked_reason: decision.ok ? null : decision.reason,
          });
        }

        const invalid = guardrails.filter((g) => g.problems.length > 0);
        if (invalid.length > 0) {
          await audit({ rejected: "guardrails", guardrails });
          return json({ error: "guardrails_invalidos", guardrails: invalid }, 400);
        }
        if (!anyUsable) {
          await audit({ rejected: "no_usable_channel", guardrails });
          return json({ error: "nenhuma fila disponível agora", guardrails }, 409);
        }
        if (unofficialCount > 0 && channels.length === 1) {
          await audit({ warning: "single_unofficial_channel", guardrails });
        }



        const resp = await fetch(`${SUPABASE_URL}/functions/v1/dsp-campaign-prepare`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY },
          body: JSON.stringify({ campaign_id }),
        });
        const data = await resp.json().catch(() => ({}));
        await audit({ prepare: data });
        return json({ ok: resp.ok, prepare: data }, resp.ok ? 200 : 500);
      }

      case "schedule": {
        const { scheduled_at } = await Promise.resolve({ scheduled_at: campaign.scheduled_at });
        if (!scheduled_at) return json({ error: "campanha sem data de agendamento" }, 400);
        await admin.from("dsp_campaigns").update({ status: "scheduled" }).eq("id", campaign_id);
        await audit({ scheduled_at });
        return json({ ok: true });
      }

      case "pause": {
        await admin.from("dsp_campaigns").update({
          status: "paused", paused_at: new Date().toISOString(), pause_reason: "manual",
        }).eq("id", campaign_id);
        await audit({ manual: true });
        return json({ ok: true });
      }

      case "resume": {
        if (campaign.status !== "paused") return json({ error: "campanha não está pausada" }, 400);

        const { data: links } = await admin
          .from("dsp_campaign_channels").select("queue_id").eq("campaign_id", campaign_id).eq("is_active", true);
        const queueIds = (links ?? []).map((l: any) => l.queue_id);

        if (clear_cooldown && queueIds.length > 0) {
          await admin.from("dsp_channel_state").update({
            cooldown_until: null, cooldown_reason: null, consecutive_failures: 0, health_status: "healthy",
          }).in("queue_id", queueIds);
        } else if (queueIds.length > 0) {
          const { data: states } = await admin
            .from("dsp_channel_state").select("queue_id, cooldown_until, health_status").in("queue_id", queueIds);
          const blocked = (states ?? []).filter((s: any) =>
            s.health_status === "blocked" || (s.cooldown_until && new Date(s.cooldown_until) > new Date()));
          if (blocked.length === (states ?? []).length && blocked.length > 0) {
            return json({ error: "channels_in_cooldown", requires_confirmation: true, blocked }, 409);
          }
        }

        await admin.from("dsp_campaigns").update({
          status: "running", paused_at: null, pause_reason: null,
        }).eq("id", campaign_id);
        await audit({ clear_cooldown: !!clear_cooldown });
        return json({ ok: true });
      }

      case "cancel": {
        await admin.from("dsp_message_queue")
          .update({ status: "cancelled", locked_by: null, locked_at: null })
          .eq("campaign_id", campaign_id).in("status", ["pending", "processing"]);
        await admin.from("dsp_campaigns").update({
          status: "cancelled", completed_at: new Date().toISOString(),
        }).eq("id", campaign_id);
        await audit({ manual: true });
        return json({ ok: true });
      }

      default:
        return json({ error: `unknown action: ${action}` }, 400);
    }
  } catch (e) {
    console.error("[dsp-campaign-control]", (e as Error).message);
    return json({ error: (e as Error).message }, 500);
  }
});
