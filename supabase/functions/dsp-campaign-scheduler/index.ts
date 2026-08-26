// ============================================================
// dsp-campaign-scheduler — executa o cronograma das campanhas.
// Roda a cada minuto (pg_cron):
//  - inicia campanhas agendadas (schedule_start_at <= agora, aprovadas, dentro da janela);
//  - pausa automaticamente ao sair da janela de horário/dias (fuso da campanha);
//  - retoma automaticamente quando a janela volta a abrir;
//  - pausa ao atingir schedule_end_at.
// Nunca inicia campanha sem approval_status = 'approved'.
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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

const WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Hora/minuto/dia da semana em um fuso arbitrário (IANA). */
function localNow(timeZone: string, now = new Date()) {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
    }).formatToParts(now);
  } catch {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo",
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
    }).formatToParts(now);
  }
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const hour = Number(get("hour")) % 24;
  const minute = Number(get("minute"));
  return { minutes: hour * 60 + minute, weekDay: Math.max(0, WEEK.indexOf(get("weekday"))) };
}

function hhmmToMinutes(v: string | null | undefined): number | null {
  if (!v) return null;
  const [h, m] = String(v).split(":");
  const hh = Number(h), mm = Number(m ?? 0);
  if (!Number.isFinite(hh)) return null;
  return hh * 60 + mm;
}

function insideCampaignWindow(campaign: any, now = new Date()): boolean {
  const { minutes, weekDay } = localNow(campaign.timezone || "America/Sao_Paulo", now);
  const days: number[] | null = campaign.send_week_days;
  if (days && days.length > 0 && !days.includes(weekDay)) return false;
  const s = hhmmToMinutes(campaign.send_window_start);
  const e = hhmmToMinutes(campaign.send_window_end);
  if (s == null || e == null) return true;
  return s <= e ? minutes >= s && minutes <= e : minutes >= s || minutes <= e;
}

async function audit(campaign: any, action: string, details: unknown) {
  await admin.from("dsp_audit_log").insert({
    client_id: String(campaign.client_id),
    campaign_id: campaign.id,
    action,
    actor: "scheduler",
    details,
  });
}

async function callControl(action: string, campaignId: string) {
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/dsp-campaign-control`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY },
    body: JSON.stringify({ action, campaign_id: campaignId, actor: "scheduler" }),
  });
  const data = await resp.json().catch(() => ({}));
  return { ok: resp.ok, data };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const now = new Date();
  const nowIso = now.toISOString();
  const results: any[] = [];

  try {
    const { data: campaigns } = await admin
      .from("dsp_campaigns")
      .select("*")
      .in("status", ["scheduled", "running", "paused"]);

    for (const c of campaigns ?? []) {
      const inside = insideCampaignWindow(c, now);
      const endReached = c.schedule_end_at && new Date(c.schedule_end_at) <= now;

      // ---- Fim do cronograma: pausa (não cancela, para permitir reprogramar) ----
      if (endReached && ["running", "scheduled"].includes(c.status)) {
        await admin.from("dsp_campaigns").update({
          status: "paused", paused_at: nowIso, pause_reason: "schedule_end",
        }).eq("id", c.id);
        await audit(c, "scheduler_pause", { reason: "schedule_end", schedule_end_at: c.schedule_end_at });
        results.push({ id: c.id, action: "pause", reason: "schedule_end" });
        continue;
      }
      if (endReached) continue;

      // ---- Início automático ----
      if (c.status === "scheduled") {
        const startAt = c.schedule_start_at || c.scheduled_at;
        if (!startAt || new Date(startAt) > now) continue;
        if (c.approval_status !== "approved") {
          await audit(c, "scheduler_blocked", { reason: "not_approved", approval_status: c.approval_status });
          results.push({ id: c.id, action: "skip", reason: "not_approved" });
          continue;
        }
        if (!inside) {
          results.push({ id: c.id, action: "wait", reason: "outside_window" });
          continue;
        }
        const r = await callControl("start", c.id);
        await audit(c, "scheduler_start", { ok: r.ok, response: r.data });
        results.push({ id: c.id, action: "start", ok: r.ok });
        continue;
      }

      // ---- Pausa automática ao sair da janela ----
      if (c.status === "running" && c.auto_window_control && !inside) {
        await admin.from("dsp_campaigns").update({
          status: "paused", paused_at: nowIso, pause_reason: "outside_window",
        }).eq("id", c.id);
        await audit(c, "scheduler_pause", { reason: "outside_window", timezone: c.timezone });
        results.push({ id: c.id, action: "pause", reason: "outside_window" });
        continue;
      }

      // ---- Retomada automática quando a janela reabre ----
      if (
        c.status === "paused" &&
        c.auto_window_control &&
        inside &&
        ["outside_window", "schedule_end"].includes(String(c.pause_reason)) === false
      ) {
        continue;
      }
      if (c.status === "paused" && c.auto_window_control && inside && c.pause_reason === "outside_window") {
        if (c.approval_status !== "approved") continue;
        await admin.from("dsp_campaigns").update({
          status: "running", paused_at: null, pause_reason: null,
        }).eq("id", c.id);
        await audit(c, "scheduler_resume", { reason: "window_reopened", timezone: c.timezone });
        results.push({ id: c.id, action: "resume", reason: "window_reopened" });
      }
    }

    return json({ ok: true, checked: (campaigns ?? []).length, results });
  } catch (e) {
    console.error("[dsp-campaign-scheduler]", (e as Error).message);
    return json({ error: (e as Error).message }, 500);
  }
});
