// ============================================================
// dsp-campaign-worker
// Consome a fila de disparos em lotes curtos (chamado por pg_cron a cada minuto).
// TODA regra anti-bloqueio é aplicada aqui, imediatamente antes de cada envio.
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  loadChannel,
  pickChannel,
  commitSend,
  registerFailure,
  isPermanentError,
  isDisconnectionError,
  insideWindow,
  renderTemplate,
  phoneVariants,
  isUazapi,
  type ChannelCandidate,
} from "../_shared/dsp-core.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_KEY);

const BATCH_SIZE = 25;
const RETRY_BACKOFF_MS = [60_000, 300_000, 900_000, 3_600_000];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function invokeFunction(name: string, body: unknown) {
  const resp = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_KEY}`,
      apikey: SERVICE_KEY,
    },
    body: JSON.stringify(body),
  });
  const data = await resp.json().catch(() => ({}));
  return { ok: resp.ok, status: resp.status, data };
}

/** Envia pela fila escolhida. Devolve o id da mensagem no provedor. */
async function sendMessage(
  candidate: ChannelCandidate,
  phone: string,
  variant: any,
  vars: Record<string, unknown>,
  campaign: any,
): Promise<{ ok: boolean; providerId?: string; error?: string }> {
  const queue = candidate.queue;
  const text = variant?.message_text ? renderTemplate(variant.message_text, vars) : "";

  if (isUazapi(queue)) {
    if (!queue.evo_url || !queue.evo_apikey) return { ok: false, error: "uazapi credentials missing" };
    const endpoint = variant?.media_url ? "/send/media" : "/send/text";
    const body: Record<string, unknown> = variant?.media_url
      ? { number: phone, type: variant.media_type || "image", file: variant.media_url, text, docName: variant.file_name ?? undefined }
      : { number: phone, text };

    const res = await invokeFunction("uazapi-proxy", {
      method: "POST",
      endpoint,
      token: queue.evo_apikey,
      baseUrl: queue.evo_url,
      body,
    });
    if (!res.ok) {
      return { ok: false, error: JSON.stringify(res.data ?? {}).slice(0, 500) };
    }
    const providerId = (res.data as any)?.id ?? (res.data as any)?.messageid ?? (res.data as any)?.key?.id;
    return { ok: true, providerId };
  }

  // API Oficial
  if (campaign.waba_template_name) {
    const res = await invokeFunction("waba-send", {
      action: "send_template",
      queue_id: queue.id,
      to: phone,
      template_name: campaign.waba_template_name,
      language: campaign.waba_template_language || "pt_BR",
      components: variant?.template_params ?? undefined,
      sender_name: `Campanha:${campaign.name}`,
      source: "dsp_campaign",
    });
    if (!res.ok || (res.data as any)?.error) {
      return { ok: false, error: JSON.stringify((res.data as any)?.error ?? res.data ?? {}).slice(0, 500) };
    }
    return { ok: true, providerId: (res.data as any)?.messages?.[0]?.id };
  }

  const res = await invokeFunction("waba-send", {
    action: "send_text",
    queue_id: queue.id,
    to: phone,
    text,
    sender_name: `Campanha:${campaign.name}`,
    source: "dsp_campaign",
  });
  if (!res.ok || (res.data as any)?.error) {
    return { ok: false, error: JSON.stringify((res.data as any)?.error ?? res.data ?? {}).slice(0, 500) };
  }
  return { ok: true, providerId: (res.data as any)?.messages?.[0]?.id };
}

async function pauseCampaign(campaignId: string, clientId: string, reason: string) {
  await admin.from("dsp_campaigns").update({
    status: "paused", paused_at: new Date().toISOString(), pause_reason: reason,
  }).eq("id", campaignId);
  await admin.from("dsp_audit_log").insert({
    client_id: clientId, campaign_id: campaignId, action: "auto_paused", details: { reason },
  });
}

async function releaseItem(itemId: string, availableInMs: number, error?: string) {
  await admin.from("dsp_message_queue").update({
    status: "pending",
    locked_by: null,
    locked_at: null,
    available_at: new Date(Date.now() + availableInMs).toISOString(),
    last_error: error ?? null,
  }).eq("id", itemId);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const workerId = `w-${crypto.randomUUID().slice(0, 8)}`;
  const result = { picked: 0, sent: 0, failed: 0, deferred: 0, skipped: 0 };

  try {
    await admin.rpc("dsp_release_stale_locks");

    // Ativa campanhas agendadas cujo horário chegou
    const { data: due } = await admin
      .from("dsp_campaigns")
      .select("id")
      .eq("status", "scheduled")
      .lte("scheduled_at", new Date().toISOString());
    for (const c of due ?? []) {
      await invokeFunction("dsp-campaign-prepare", { campaign_id: c.id });
    }

    const { data: items } = await admin.rpc("dsp_pick_queue_items", {
      p_worker_id: workerId,
      p_limit: BATCH_SIZE,
    });
    result.picked = (items ?? []).length;
    if (result.picked === 0) return json({ ok: true, ...result });

    // Caches por campanha
    const campaignCache = new Map<string, any>();
    const channelCache = new Map<string, { candidates: ChannelCandidate[]; weights: Record<string, number> }>();
    const variantCache = new Map<string, any[]>();

    for (const item of items ?? []) {
      const campaignId = item.campaign_id as string;

      if (!campaignCache.has(campaignId)) {
        const { data } = await admin.from("dsp_campaigns").select("*").eq("id", campaignId).maybeSingle();
        campaignCache.set(campaignId, data);
      }
      const campaign = campaignCache.get(campaignId);
      if (!campaign || campaign.status !== "running") {
        await releaseItem(item.id, 60_000, "campaign_not_running");
        result.skipped++;
        continue;
      }

      // Janela de horário da campanha
      if (!insideWindow(campaign.send_window_start, campaign.send_window_end, campaign.send_week_days)) {
        await releaseItem(item.id, 15 * 60_000, "outside_campaign_window");
        result.deferred++;
        continue;
      }

      if (!channelCache.has(campaignId)) {
        const { data: links } = await admin
          .from("dsp_campaign_channels")
          .select("queue_id, weight, is_active")
          .eq("campaign_id", campaignId)
          .eq("is_active", true);
        const queueIds = (links ?? []).map((l: any) => l.queue_id);
        const weights: Record<string, number> = {};
        for (const l of links ?? []) weights[l.queue_id] = l.weight ?? 1;

        const { data: queues } = await admin
          .from("queues").select("*").in("id", queueIds.length ? queueIds : ["00000000-0000-0000-0000-000000000000"]);
        const candidates: ChannelCandidate[] = [];
        for (const q of queues ?? []) candidates.push(await loadChannel(admin, q));
        channelCache.set(campaignId, { candidates, weights });
      }
      const { candidates, weights } = channelCache.get(campaignId)!;
      if (candidates.length === 0) {
        await pauseCampaign(campaignId, String(campaign.client_id), "no_channel_configured");
        await releaseItem(item.id, 60_000, "no_channel");
        result.skipped++;
        continue;
      }

      const { candidate, reasons } = pickChannel(candidates, weights, { category: campaign.category });
      if (!candidate) {
        const allBlocked = Object.values(reasons).every((r) => String(r).startsWith("cooldown") || r === "channel_blocked");
        if (allBlocked) await pauseCampaign(campaignId, String(campaign.client_id), `channels_blocked:${JSON.stringify(reasons)}`);
        await releaseItem(item.id, 60_000, `no_channel_available:${JSON.stringify(reasons).slice(0, 200)}`);
        result.deferred++;
        continue;
      }

      const { data: recipient } = await admin
        .from("dsp_recipients").select("*").eq("id", item.recipient_id).maybeSingle();
      if (!recipient || !recipient.is_eligible) {
        await admin.from("dsp_message_queue").update({ status: "cancelled", locked_by: null }).eq("id", item.id);
        result.skipped++;
        continue;
      }

      // Revalidação de supressão imediatamente antes do envio
      const { data: sup } = await admin
        .from("dsp_suppression")
        .select("id")
        .eq("client_id", String(campaign.client_id))
        .in("phone_e164", phoneVariants(recipient.phone_e164))
        .limit(1);
      if (sup && sup.length > 0) {
        await admin.from("dsp_recipients").update({
          status: "excluded", is_eligible: false, exclusion_reason: "suppressed",
        }).eq("id", recipient.id);
        await admin.from("dsp_message_queue").update({ status: "cancelled", locked_by: null }).eq("id", item.id);
        result.skipped++;
        continue;
      }

      if (!variantCache.has(campaignId)) {
        const { data } = await admin.from("dsp_campaign_variants").select("*").eq("campaign_id", campaignId);
        variantCache.set(campaignId, data ?? []);
      }
      const variant = (variantCache.get(campaignId) ?? []).find((v: any) => v.id === recipient.variant_id)
        ?? (variantCache.get(campaignId) ?? [])[0];

      const send = await sendMessage(candidate, recipient.phone_e164, variant, recipient.variables ?? {}, campaign);

      if (send.ok) {
        await commitSend(admin, candidate);
        // Atualiza o candidato em memória para o próximo item do lote
        const idx = candidates.findIndex((c) => c.queue.id === candidate.queue.id);
        if (idx >= 0) candidates[idx] = await loadChannel(admin, candidate.queue);

        await admin.from("dsp_recipients").update({
          status: "sent",
          sent_at: new Date().toISOString(),
          queue_id: candidate.queue.id,
          channel_provider: isUazapi(candidate.queue) ? "uazapi" : "meta_cloud",
          provider_message_id: send.providerId ?? null,
          attempts: (recipient.attempts ?? 0) + 1,
        }).eq("id", recipient.id);

        await admin.from("dsp_message_queue").update({
          status: "sent", locked_by: null, locked_at: null, attempts: (item.attempts ?? 0) + 1,
        }).eq("id", item.id);

        await admin.from("dsp_campaigns").update({ total_sent: (campaign.total_sent ?? 0) + 1 }).eq("id", campaignId);
        campaign.total_sent = (campaign.total_sent ?? 0) + 1;
        result.sent++;
        continue;
      }

      // Falha
      const err = send.error ?? "unknown_error";
      const attempts = (item.attempts ?? 0) + 1;
      const permanent = isPermanentError(err);
      const disconnected = isDisconnectionError(err);

      const { tripped } = await registerFailure(admin, candidate, err, { hardStop: disconnected });
      const idx = candidates.findIndex((c) => c.queue.id === candidate.queue.id);
      if (idx >= 0) candidates[idx] = await loadChannel(admin, candidate.queue);
      if (tripped) {
        await pauseCampaign(campaignId, String(campaign.client_id), disconnected ? "channel_disconnected" : "consecutive_failures");
      }

      if (permanent) {
        await admin.from("dsp_recipients").update({
          status: "failed_permanent", failed_at: new Date().toISOString(), error_message: err, attempts,
        }).eq("id", recipient.id);
        await admin.from("dsp_message_queue").update({
          status: "failed", locked_by: null, locked_at: null, attempts, last_error: err,
        }).eq("id", item.id);
        await admin.from("dsp_suppression").upsert({
          client_id: String(campaign.client_id),
          phone_e164: recipient.phone_e164,
          contact_id: recipient.contact_id,
          reason: "invalid_number",
          source_campaign_id: campaignId,
        }, { onConflict: "client_id,phone_e164", ignoreDuplicates: true });
        await admin.from("dsp_campaigns").update({ total_failed: (campaign.total_failed ?? 0) + 1 }).eq("id", campaignId);
        campaign.total_failed = (campaign.total_failed ?? 0) + 1;
        result.failed++;
        continue;
      }

      if (disconnected) {
        // Não consome tentativa: canal caiu.
        await releaseItem(item.id, 10 * 60_000, err);
        result.deferred++;
        continue;
      }

      if (attempts >= RETRY_BACKOFF_MS.length) {
        await admin.from("dsp_recipients").update({
          status: "failed_transient", failed_at: new Date().toISOString(), error_message: err, attempts,
        }).eq("id", recipient.id);
        await admin.from("dsp_message_queue").update({
          status: "dead_letter", locked_by: null, locked_at: null, attempts, last_error: err,
        }).eq("id", item.id);
        await admin.from("dsp_campaigns").update({ total_failed: (campaign.total_failed ?? 0) + 1 }).eq("id", campaignId);
        campaign.total_failed = (campaign.total_failed ?? 0) + 1;
        result.failed++;
        continue;
      }

      await admin.from("dsp_message_queue").update({
        status: "pending",
        locked_by: null,
        locked_at: null,
        attempts,
        last_error: err,
        available_at: new Date(Date.now() + RETRY_BACKOFF_MS[attempts - 1]).toISOString(),
      }).eq("id", item.id);
      result.deferred++;
    }

    // Conclui campanhas sem itens pendentes
    for (const [campaignId, campaign] of campaignCache) {
      if (!campaign || campaign.status !== "running") continue;
      const { count } = await admin
        .from("dsp_message_queue")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", campaignId)
        .in("status", ["pending", "processing"]);
      if ((count ?? 0) === 0) {
        await admin.from("dsp_campaigns").update({
          status: "completed", completed_at: new Date().toISOString(),
        }).eq("id", campaignId);
      }
    }

    return json({ ok: true, ...result });
  } catch (e) {
    console.error("[dsp-campaign-worker]", (e as Error).message);
    return json({ error: (e as Error).message, ...result }, 500);
  }
});
