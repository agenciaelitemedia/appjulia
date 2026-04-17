// Dispatch a chat campaign: load recipients by filters, send messages with throttling.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { campaign_id } = await req.json();
    if (!campaign_id) return json({ error: "campaign_id required" }, 400);

    const { data: campaign, error: cErr } = await supabase
      .from("chat_campaigns")
      .select("*")
      .eq("id", campaign_id)
      .maybeSingle();
    if (cErr || !campaign) return json({ error: "Campaign not found" }, 404);
    if (campaign.status === "running") return json({ error: "Already running" }, 400);

    // Build contact filter
    let q = supabase
      .from("chat_contacts")
      .select("id, phone, channel_type")
      .eq("client_id", campaign.client_id);
    if (campaign.filter_channel) q = q.eq("channel_type", campaign.filter_channel);
    const { data: contacts } = await q;
    const recipients = (contacts || []).filter((c) => !!c.phone);

    if (recipients.length === 0) {
      await supabase.from("chat_campaigns").update({ status: "completed", contacts_total: 0, completed_at: new Date().toISOString() }).eq("id", campaign_id);
      return json({ ok: true, sent: 0 });
    }

    await supabase.from("chat_campaigns").update({
      status: "running",
      started_at: new Date().toISOString(),
      contacts_total: recipients.length,
    }).eq("id", campaign_id);

    // Persist recipients
    await supabase.from("chat_campaign_recipients").insert(
      recipients.map((r) => ({ campaign_id, contact_id: r.id, phone: r.phone, status: "pending" }))
    );

    // Process in background (EdgeRuntime.waitUntil if available)
    const work = (async () => {
      let sent = 0;
      let failed = 0;
      for (const r of recipients) {
        try {
          // Insert as outgoing message; downstream realtime/sender will pick up.
          await supabase.from("chat_messages").insert({
            client_id: campaign.client_id,
            contact_id: r.id,
            text: campaign.message_text,
            type: campaign.media_url ? (campaign.media_type || "image") : "text",
            from_me: true,
            sender_name: `Campanha:${campaign.name}`,
            status: "queued",
            media_url: campaign.media_url,
            metadata: { campaign_id, broadcast: true },
          });
          await supabase.from("chat_campaign_recipients").update({
            status: "sent",
            sent_at: new Date().toISOString(),
          }).eq("campaign_id", campaign_id).eq("contact_id", r.id);
          sent++;
        } catch (e) {
          failed++;
          await supabase.from("chat_campaign_recipients").update({
            status: "failed",
            error_message: (e as Error).message,
          }).eq("campaign_id", campaign_id).eq("contact_id", r.id);
        }
        await supabase.from("chat_campaigns").update({
          contacts_sent: sent,
          contacts_failed: failed,
        }).eq("id", campaign_id);

        if (campaign.throttle_seconds > 0) {
          await new Promise((res) => setTimeout(res, campaign.throttle_seconds * 1000));
        }
      }
      await supabase.from("chat_campaigns").update({
        status: "completed",
        completed_at: new Date().toISOString(),
      }).eq("id", campaign_id);
    })();

    // @ts-ignore
    if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(work);
    else work.catch(console.error);

    return json({ ok: true, queued: recipients.length });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
