// ============================================================
// dsp-optout-scan
// Varre respostas recebidas no chat procurando intenção de descadastro
// (SAIR, PARAR, CANCELAR, REMOVER, STOP, NÃO QUERO...). Ao detectar:
// grava supressão, cancela mensagens pendentes e marca o destinatário.
// NÃO responde nada ao contato (supressão silenciosa).
// Também marca `delivered/read/replied` dos destinatários com base no chat.
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { hasOptoutIntent, toE164Br, phoneVariants } from "../_shared/dsp-core.ts";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const stats = { scanned: 0, optouts: 0, replies: 0 };

  try {
    const body = await req.json().catch(() => ({}));
    const lookbackMinutes = Number(body?.lookback_minutes ?? 30);
    const since = new Date(Date.now() - lookbackMinutes * 60_000).toISOString();

    // Destinatários que receberam disparo nos últimos 7 dias
    const { data: recipients } = await admin
      .from("dsp_recipients")
      .select("id, client_id, campaign_id, contact_id, phone_e164, sent_at, replied_at")
      .not("sent_at", "is", null)
      .gte("sent_at", new Date(Date.now() - 7 * 86400_000).toISOString())
      .limit(5000);

    if (!recipients || recipients.length === 0) return json({ ok: true, ...stats });

    const byPhone = new Map<string, any[]>();
    for (const r of recipients) {
      for (const v of phoneVariants(r.phone_e164)) {
        const list = byPhone.get(v) ?? [];
        list.push(r);
        byPhone.set(v, list);
      }
    }

    const contactIds = [...new Set(recipients.map((r) => r.contact_id).filter(Boolean))] as string[];

    // Mensagens recebidas recentemente desses contatos
    const inbound: any[] = [];
    for (let i = 0; i < contactIds.length; i += 300) {
      const { data } = await admin
        .from("chat_messages")
        .select("id, client_id, contact_id, text, from_me, timestamp")
        .in("contact_id", contactIds.slice(i, i + 300))
        .eq("from_me", false)
        .gte("timestamp", since)
        .limit(2000);
      inbound.push(...(data ?? []));
    }
    stats.scanned = inbound.length;

    const contactPhone = new Map<string, string>();
    for (let i = 0; i < contactIds.length; i += 300) {
      const { data } = await admin
        .from("chat_contacts").select("id, phone").in("id", contactIds.slice(i, i + 300));
      for (const c of data ?? []) contactPhone.set(c.id, toE164Br(c.phone));
    }

    for (const msg of inbound) {
      const phone = contactPhone.get(msg.contact_id) ?? "";
      const targets = byPhone.get(phone) ?? [];
      const target = targets.find((t) => new Date(msg.timestamp) > new Date(t.sent_at));
      if (!target) continue;

      // Marca resposta
      if (!target.replied_at) {
        await admin.from("dsp_recipients").update({
          status: "replied", replied_at: msg.timestamp,
        }).eq("id", target.id);
        target.replied_at = msg.timestamp;
        stats.replies++;
      }

      if (!hasOptoutIntent(msg.text)) continue;

      // 1) Supressão
      await admin.from("dsp_suppression").upsert({
        client_id: String(target.client_id),
        phone_e164: target.phone_e164,
        contact_id: target.contact_id,
        reason: "opt_out",
        source_campaign_id: target.campaign_id,
        source_message_id: msg.id,
      }, { onConflict: "client_id,phone_e164", ignoreDuplicates: true });

      // 2) Cancela pendências desse telefone (todas as campanhas do cliente)
      const { data: pendingRecipients } = await admin
        .from("dsp_recipients")
        .select("id")
        .eq("client_id", String(target.client_id))
        .in("phone_e164", phoneVariants(target.phone_e164))
        .eq("status", "pending");
      const ids = (pendingRecipients ?? []).map((r: any) => r.id);
      if (ids.length > 0) {
        await admin.from("dsp_message_queue")
          .update({ status: "cancelled", locked_by: null, locked_at: null })
          .in("recipient_id", ids).in("status", ["pending", "processing"]);
        await admin.from("dsp_recipients")
          .update({ status: "excluded", is_eligible: false, exclusion_reason: "opt_out" })
          .in("id", ids);
      }

      // 3) Marca o destinatário de origem
      await admin.from("dsp_recipients").update({ status: "opted_out" }).eq("id", target.id);
      await admin.from("dsp_audit_log").insert({
        client_id: String(target.client_id),
        campaign_id: target.campaign_id,
        action: "opt_out",
        details: { phone: target.phone_e164, message_id: msg.id },
      });
      stats.optouts++;
    }

    return json({ ok: true, ...stats });
  } catch (e) {
    console.error("[dsp-optout-scan]", (e as Error).message);
    return json({ error: (e as Error).message, ...stats }, 500);
  }
});
