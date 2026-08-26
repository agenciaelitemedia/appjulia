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
