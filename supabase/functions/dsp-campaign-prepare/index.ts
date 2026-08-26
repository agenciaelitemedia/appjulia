// ============================================================
// dsp-campaign-prepare
// Gera os destinatários de uma campanha (com elegibilidade) e enfileira
// as mensagens. Também serve como "simulação" (dry_run) para o wizard.
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  toE164Br,
  phoneVariants,
  isValidBrPhone,
  pickVariant,
  renderTemplate,
  loadChannel,
  rollWindows,
  effectiveDailyLimit,
  canSendNow,
} from "../_shared/dsp-core.ts";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface AudienceFilters {
  manual_phones?: string[];
  channel_type?: string | null;
  tag_ids?: string[];
  crm_stage_ids?: string[];
  last_interaction_days?: number | null;
  only_with_conversation?: boolean;
  limit?: number | null;
}


/**
 * Capacidade diária somando as filas da campanha, com os motivos que estão
 * bloqueando cada fila agora. Serve para a simulação e como guardrail no start.
 */
async function estimateCapacity(
  campaignId: string,
  clientId: string,
  category: string,
  eligible: number,
) {
  const { data: links } = await admin
    .from("dsp_campaign_channels")
    .select("queue_id, weight")
    .eq("campaign_id", campaignId)
    .eq("is_active", true);

  const queueIds = (links ?? []).map((l: any) => l.queue_id);
  if (queueIds.length === 0) {
    return { daily_capacity: 0, queues: 0, estimated_days: 0, estimated_minutes: 0, blocking: ["no_channels"] };
  }

  const { data: queues } = await admin
    .from("queues").select("*").in("id", queueIds);

  let dailyCapacity = 0;
  let throughputPerMinute = 0;
  const blocking: string[] = [];

  for (const q of queues ?? []) {
    const candidate = await loadChannel(admin, q);
    const state = rollWindows(candidate.state);
    const limits = candidate.limits;

    if (limits.is_enabled === false) {
      blocking.push(`${q.id}:channel_not_enabled`);
      continue;
    }


    dailyCapacity += Math.max(0, effectiveDailyLimit(limits, state) - state.sent_in_day);
    const gap = Math.max(1, limits.min_seconds_between_messages);
    throughputPerMinute += Math.min(limits.max_per_minute, 60 / gap);

    const decision = canSendNow({ ...candidate, state }, { category });
    if (!decision.ok) blocking.push(`${q.id}:${decision.reason}`);
  }

  const estimatedDays = dailyCapacity > 0 ? Math.ceil(eligible / dailyCapacity) : 0;
  const estimatedMinutes = throughputPerMinute > 0 ? Math.ceil(eligible / throughputPerMinute) : 0;

  return {
    daily_capacity: dailyCapacity,
    queues: (queues ?? []).length,
    estimated_days: estimatedDays,
    estimated_minutes: estimatedMinutes,
    blocking,
  };
}

/** Coleta candidatos: contatos do chat pelos filtros + telefones manuais/CSV. */

async function collectCandidates(clientId: string, f: AudienceFilters) {
  const out = new Map<string, { phone: string; name: string | null; contact_id: string | null }>();

  for (const raw of f.manual_phones ?? []) {
    const phone = toE164Br(raw);
    if (phone) out.set(phone, { phone, name: null, contact_id: null });
  }

  const wantsContacts =
    !!f.channel_type || (f.tag_ids?.length ?? 0) > 0 || (f.crm_stage_ids?.length ?? 0) > 0 ||
    f.last_interaction_days != null || f.only_with_conversation ||
    (f.manual_phones?.length ?? 0) === 0;

  if (wantsContacts) {
    let q = admin
      .from("chat_contacts")
      .select("id, phone, name, lead_full_name, last_message_at, channel_type")
      .eq("client_id", clientId)
      .eq("is_group", false)
      .not("phone", "is", null)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(Math.min(f.limit ?? 5000, 20000));

    if (f.channel_type) q = q.eq("channel_type", f.channel_type);
    if (f.last_interaction_days != null) {
      const since = new Date(Date.now() - f.last_interaction_days * 86400_000).toISOString();
      q = q.gte("last_message_at", since);
    }

    const { data: contacts, error } = await q;
    if (error) throw new Error(`contacts query failed: ${error.message}`);

    let allowed: Set<string> | null = null;

    if ((f.tag_ids?.length ?? 0) > 0) {
      const { data: tagged } = await admin
        .from("chat_conversation_tags")
        .select("conversation_id")
        .in("tag_id", f.tag_ids!);
      const convIds = (tagged ?? []).map((t: any) => t.conversation_id).filter(Boolean);
      allowed = new Set<string>();
      for (let i = 0; i < convIds.length; i += 500) {
        const { data: convs } = await admin
          .from("chat_conversations")
          .select("contact_id")
          .in("id", convIds.slice(i, i + 500));
        for (const c of convs ?? []) if (c.contact_id) allowed.add(c.contact_id);
      }
    }

    if ((f.crm_stage_ids?.length ?? 0) > 0) {
      const { data: deals } = await admin
        .from("crm_deals")
        .select("phone")
        .eq("client_id", clientId)
        .in("stage_id", f.crm_stage_ids!);
      const stagePhones = new Set((deals ?? []).map((d: any) => toE164Br(d.phone)).filter(Boolean));
      for (const c of contacts ?? []) {
        const phone = toE164Br(c.phone);
        if (!phone || !stagePhones.has(phone)) continue;
        if (allowed && !allowed.has(c.id)) continue;
        out.set(phone, { phone, name: c.lead_full_name || c.name || null, contact_id: c.id });
      }
    } else {
      for (const c of contacts ?? []) {
        const phone = toE164Br(c.phone);
        if (!phone) continue;
        if (allowed && !allowed.has(c.id)) continue;
        if (!out.has(phone) || out.get(phone)!.contact_id === null) {
          out.set(phone, { phone, name: c.lead_full_name || c.name || null, contact_id: c.id });
        }
      }
    }
  }

  return [...out.values()];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { campaign_id, dry_run } = await req.json();
    if (!campaign_id) return json({ error: "campaign_id required" }, 400);

    const { data: campaign } = await admin
      .from("dsp_campaigns").select("*").eq("id", campaign_id).maybeSingle();
    if (!campaign) return json({ error: "campaign not found" }, 404);

    const clientId = String(campaign.client_id);
    const filters = (campaign.audience_filters ?? {}) as AudienceFilters;

    if (!dry_run) {
      await admin.from("dsp_campaigns").update({ status: "preparing" }).eq("id", campaign_id);
    }

    const candidates = await collectCandidates(clientId, filters);

    // Supressão
    const { data: suppressed } = await admin
      .from("dsp_suppression").select("phone_e164").eq("client_id", clientId);
    const suppressedSet = new Set((suppressed ?? []).map((s: any) => s.phone_e164));

    // Frequência: 1 marketing / 24h e 2 / 7d por contato (mesmo cliente)
    const since7d = new Date(Date.now() - 7 * 86400_000).toISOString();
    const { data: recent } = await admin
      .from("dsp_recipients")
      .select("phone_e164, sent_at")
      .eq("client_id", clientId)
      .not("sent_at", "is", null)
      .gte("sent_at", since7d);
    const freq = new Map<string, { d1: number; d7: number }>();
    const since24h = Date.now() - 86400_000;
    for (const r of recent ?? []) {
      const cur = freq.get(r.phone_e164) ?? { d1: 0, d7: 0 };
      cur.d7 += 1;
      if (new Date(r.sent_at).getTime() >= since24h) cur.d1 += 1;
      freq.set(r.phone_e164, cur);
    }

    const { data: variants } = await admin
      .from("dsp_campaign_variants").select("*").eq("campaign_id", campaign_id);

    const isMarketing = campaign.category === "marketing";
    const rows: any[] = [];
    const stats = { total: candidates.length, eligible: 0, suppressed: 0, invalid: 0, frequency: 0 };

    for (const c of candidates) {
      let reason: string | null = null;
      if (!isValidBrPhone(c.phone)) { reason = "invalid_phone"; stats.invalid++; }
      else if (suppressedSet.has(c.phone) || phoneVariants(c.phone).some((v) => suppressedSet.has(v))) {
        reason = "suppressed"; stats.suppressed++;
      } else if (isMarketing) {
        const f = freq.get(c.phone);
        if (f && (f.d1 >= 1 || f.d7 >= 2)) { reason = "frequency_cap"; stats.frequency++; }
      }
      if (!reason) stats.eligible++;

      const variant = pickVariant(variants ?? []);
      const vars = { nome: c.name ?? "", primeiro_nome: (c.name ?? "").split(" ")[0] ?? "", telefone: c.phone };

      rows.push({
        campaign_id,
        client_id: clientId,
        contact_id: c.contact_id,
        phone_e164: c.phone,
        name: c.name,
        variables: vars,
        is_eligible: !reason,
        exclusion_reason: reason,
        variant_id: variant?.id ?? null,
        status: reason ? "excluded" : "pending",
      });
    }

    if (dry_run) {
      const preview = rows.slice(0, 5).map((r) => {
        const v = (variants ?? []).find((x: any) => x.id === r.variant_id);
        return { phone: r.phone_e164, text: v?.message_text ? renderTemplate(v.message_text, r.variables) : null };
      });
      const capacity = await estimateCapacity(campaign_id, clientId, campaign.category, stats.eligible);
      return json({ ok: true, dry_run: true, stats, preview, capacity });
    }


    // Grava destinatários em lotes (idempotente por campaign_id + phone)
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { error } = await admin
        .from("dsp_recipients")
        .upsert(chunk, { onConflict: "campaign_id,phone_e164", ignoreDuplicates: true });
      if (error) console.error("[dsp-prepare] upsert recipients:", error.message);
    }

    // Enfileira somente os elegíveis
    const { data: eligibleRecipients } = await admin
      .from("dsp_recipients")
      .select("id, phone_e164, variant_id")
      .eq("campaign_id", campaign_id)
      .eq("is_eligible", true)
      .eq("status", "pending");

    const queueRows = (eligibleRecipients ?? []).map((r: any) => ({
      client_id: clientId,
      campaign_id,
      recipient_id: r.id,
      idempotency_key: `${clientId}:${campaign_id}:${r.phone_e164}:${r.variant_id ?? "v0"}`,
      priority: isMarketing ? 6 : 4,
    }));

    for (let i = 0; i < queueRows.length; i += 500) {
      const { error } = await admin
        .from("dsp_message_queue")
        .upsert(queueRows.slice(i, i + 500), { onConflict: "idempotency_key", ignoreDuplicates: true });
      if (error) console.error("[dsp-prepare] upsert queue:", error.message);
    }

    await admin.from("dsp_campaigns").update({
      total_recipients: rows.length,
      total_eligible: stats.eligible,
      status: "running",
      started_at: campaign.started_at ?? new Date().toISOString(),
    }).eq("id", campaign_id);

    await admin.from("dsp_audit_log").insert({
      client_id: clientId, campaign_id, action: "prepared", details: stats,
    });

    return json({ ok: true, stats, queued: queueRows.length });
  } catch (e) {
    console.error("[dsp-campaign-prepare]", (e as Error).message);
    return json({ error: (e as Error).message }, 500);
  }
});
