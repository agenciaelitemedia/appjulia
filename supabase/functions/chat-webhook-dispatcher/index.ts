// chat-webhook-dispatcher: envia eventos para webhooks externos com HMAC opcional
// Detecta automaticamente provedores (Slack, Discord, Teams) pela URL e formata o payload
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function hmacSha256(secret: string, body: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

type Provider = "slack" | "discord" | "teams" | "generic";

function detectProvider(url: string): Provider {
  try {
    const u = new URL(url);
    if (u.hostname.includes("slack.com")) return "slack";
    if (u.hostname.includes("discord.com") || u.hostname.includes("discordapp.com")) return "discord";
    if (u.hostname.includes("office.com") || u.hostname.includes("outlook.com") || u.hostname.includes("webhook.office.com")) return "teams";
  } catch { /* ignore */ }
  return "generic";
}

const EVENT_LABELS: Record<string, { title: string; emoji: string; color: string }> = {
  conversation_created: { title: "Nova conversa", emoji: "💬", color: "#3b82f6" },
  message_received: { title: "Mensagem recebida", emoji: "📨", color: "#22c55e" },
  conversation_resolved: { title: "Conversa resolvida", emoji: "✅", color: "#10b981" },
  conversation_assigned: { title: "Atribuição", emoji: "👤", color: "#8b5cf6" },
  sla_breached: { title: "SLA estourado", emoji: "⚠️", color: "#ef4444" },
};

function summarizePayload(payload: any): string {
  if (!payload || typeof payload !== "object") return "";
  const parts: string[] = [];
  if (payload.contact_name) parts.push(`*Contato:* ${payload.contact_name}`);
  if (payload.protocol) parts.push(`*Protocolo:* ${payload.protocol}`);
  if (payload.channel) parts.push(`*Canal:* ${payload.channel}`);
  if (payload.text) {
    const t = String(payload.text).slice(0, 200);
    parts.push(`*Mensagem:* ${t}${String(payload.text).length > 200 ? "…" : ""}`);
  }
  if (payload.assigned_to) parts.push(`*Atribuído a:* ${payload.assigned_to}`);
  return parts.join("\n");
}

function formatForProvider(provider: Provider, event: string, payload: any): { body: string; headers: Record<string, string> } {
  const meta = EVENT_LABELS[event] ?? { title: event, emoji: "🔔", color: "#6b7280" };
  const summary = summarizePayload(payload);

  if (provider === "slack") {
    const body = JSON.stringify({
      text: `${meta.emoji} *${meta.title}*`,
      blocks: [
        { type: "header", text: { type: "plain_text", text: `${meta.emoji} ${meta.title}` } },
        ...(summary ? [{ type: "section", text: { type: "mrkdwn", text: summary } }] : []),
        { type: "context", elements: [{ type: "mrkdwn", text: `_via Lovable Chat • ${new Date().toLocaleString("pt-BR")}_` }] },
      ],
    });
    return { body, headers: { "Content-Type": "application/json" } };
  }

  if (provider === "discord") {
    const colorInt = parseInt(meta.color.replace("#", ""), 16);
    const fields: any[] = [];
    if (payload?.contact_name) fields.push({ name: "Contato", value: String(payload.contact_name), inline: true });
    if (payload?.protocol) fields.push({ name: "Protocolo", value: String(payload.protocol), inline: true });
    if (payload?.channel) fields.push({ name: "Canal", value: String(payload.channel), inline: true });
    if (payload?.text) fields.push({ name: "Mensagem", value: String(payload.text).slice(0, 1000) });
    const body = JSON.stringify({
      embeds: [
        {
          title: `${meta.emoji} ${meta.title}`,
          color: colorInt,
          fields,
          footer: { text: "Lovable Chat" },
          timestamp: new Date().toISOString(),
        },
      ],
    });
    return { body, headers: { "Content-Type": "application/json" } };
  }

  if (provider === "teams") {
    const facts: any[] = [];
    if (payload?.contact_name) facts.push({ name: "Contato", value: String(payload.contact_name) });
    if (payload?.protocol) facts.push({ name: "Protocolo", value: String(payload.protocol) });
    if (payload?.channel) facts.push({ name: "Canal", value: String(payload.channel) });
    const body = JSON.stringify({
      "@type": "MessageCard",
      "@context": "http://schema.org/extensions",
      themeColor: meta.color.replace("#", ""),
      summary: meta.title,
      sections: [
        {
          activityTitle: `${meta.emoji} ${meta.title}`,
          facts,
          text: payload?.text ?? "",
        },
      ],
    });
    return { body, headers: { "Content-Type": "application/json" } };
  }

  // generic
  const body = JSON.stringify({ event, timestamp: new Date().toISOString(), data: payload ?? {} });
  return { body, headers: { "Content-Type": "application/json", "X-Lovable-Event": event } };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Missing SUPABASE env vars" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { event, client_id, payload } = await req.json();
    if (!event || !client_id) {
      return new Response(JSON.stringify({ error: "event and client_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: hooks } = await supabase
      .from("chat_webhooks").select("*")
      .eq("client_id", client_id).eq("is_active", true).contains("events", [event]);

    if (!hooks || hooks.length === 0) {
      return new Response(JSON.stringify({ delivered: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Timeout per individual webhook delivery — prevents one slow endpoint
    // from blocking all other deliveries in the Promise.all batch.
    const DELIVERY_TIMEOUT_MS = 8_000;
    const RETRY_DELAY_MS = 1_000;

    const deliverOne = async (h: any): Promise<void> => {
      const provider = detectProvider(h.url);
      const { body, headers } = formatForProvider(provider, event, payload);
      if (h.secret && provider === "generic") {
        headers["X-Lovable-Signature"] = `sha256=${await hmacSha256(h.secret, body)}`;
      }

      let lastError: string | null = null;
      let statusCode: number | null = null;
      let success = false;

      for (let attempt = 1; attempt <= 2; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);
        try {
          const r = await fetch(h.url, { method: "POST", headers, body, signal: controller.signal });
          clearTimeout(timer);
          statusCode = r.status;
          success = r.ok;
          lastError = r.ok ? null : `HTTP ${r.status}`;
          if (r.ok) break;
          // Retry once on 5xx
          if (r.status < 500 || attempt === 2) break;
          await new Promise(res => setTimeout(res, RETRY_DELAY_MS));
        } catch (err) {
          clearTimeout(timer);
          const msg = err instanceof Error ? err.message : String(err);
          lastError = controller.signal.aborted ? `timeout after ${DELIVERY_TIMEOUT_MS}ms` : msg;
          if (attempt === 2) break;
          await new Promise(res => setTimeout(res, RETRY_DELAY_MS));
        }
      }

      await supabase.from("chat_webhook_deliveries").insert({
        webhook_id: h.id, event, payload: { ...payload, _provider: provider },
        status_code: statusCode, success, error_message: lastError,
      });
      if (success) delivered++;
    };

    let delivered = 0;
    await Promise.all(hooks.map(deliverOne));

    return new Response(JSON.stringify({ delivered }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("dispatcher error", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
