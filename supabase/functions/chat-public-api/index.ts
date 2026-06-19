// Public REST API for chat conversations & messages
// Auth: header "X-API-Key: cak_xxxxx"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function authenticate(req: Request) {
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) return { error: "Missing X-API-Key header", status: 401 };
  const hash = await sha256(apiKey);
  const { data: keyRow } = await supabase
    .from("chat_api_keys")
    .select("*")
    .eq("key_hash", hash)
    .eq("is_active", true)
    .maybeSingle();
  if (!keyRow) return { error: "Invalid API key", status: 401 };
  if (keyRow.expires_at && new Date(keyRow.expires_at) < new Date()) {
    return { error: "API key expired", status: 401 };
  }
  await supabase.from("chat_api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", keyRow.id);
  return { keyRow };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await authenticate(req);
  if ("error" in auth) return json({ error: auth.error }, auth.status);
  const { keyRow } = auth;
  const clientId = keyRow.client_id;

  const url = new URL(req.url);
  const path = url.pathname.replace(/^.*\/chat-public-api/, "").replace(/\/$/, "");

  try {
    // GET /conversations
    if (req.method === "GET" && (path === "" || path === "/conversations")) {
      const status = url.searchParams.get("status");
      const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);
      let q = supabase
        .from("chat_conversations")
        .select("id, protocol, status, priority, channel, contact_id, opened_at, first_response_at, resolved_at, closed_at, assigned_to, tags")
        .eq("client_id", clientId)
        .order("opened_at", { ascending: false })
        .limit(limit);
      if (status) q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw error;
      return json({ data });
    }

    // GET /conversations/:id
    const convMatch = path.match(/^\/conversations\/([a-f0-9-]{36})$/);
    if (req.method === "GET" && convMatch) {
      const { data, error } = await supabase
        .from("chat_conversations")
        .select("*, contact:chat_contacts(*)")
        .eq("id", convMatch[1])
        .eq("client_id", clientId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: "Not found" }, 404);
      return json({ data });
    }

    // GET /conversations/:id/messages
    const msgMatch = path.match(/^\/conversations\/([a-f0-9-]{36})\/messages$/);
    if (req.method === "GET" && msgMatch) {
      const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 200);
      const { data, error } = await supabase
        .from("chat_messages")
        .select("id, text, type, from_me, status, timestamp, sender_name, media_url, caption")
        .eq("conversation_id", msgMatch[1])
        .eq("client_id", clientId)
        .order("timestamp", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return json({ data });
    }

    // POST /conversations/:id/messages -> create internal note via API
    if (req.method === "POST" && msgMatch) {
      if (!keyRow.scopes.includes("messages:write")) return json({ error: "Forbidden scope" }, 403);
      const body = await req.json().catch(() => ({}));
      if (!body.text || typeof body.text !== "string") return json({ error: "text required" }, 400);
      const { data: conv } = await supabase
        .from("chat_conversations")
        .select("contact_id")
        .eq("id", msgMatch[1])
        .eq("client_id", clientId)
        .maybeSingle();
      if (!conv) return json({ error: "Conversation not found" }, 404);
      const { data, error } = await supabase
        .from("chat_messages")
        .insert({
          conversation_id: msgMatch[1],
          contact_id: conv.contact_id,
          client_id: clientId,
          text: body.text.slice(0, 4000),
          type: "text",
          from_me: true,
          internal_note: !!body.internal_note,
          sender_name: body.sender_name || `API:${keyRow.name}`,
          status: "sent",
        })
        .select()
        .single();
      if (error) throw error;
      return json({ data }, 201);
    }

    // PATCH /conversations/:id -> update status/priority/assigned
    if (req.method === "PATCH" && convMatch) {
      if (!keyRow.scopes.includes("conversations:write")) return json({ error: "Forbidden scope" }, 403);
      const body = await req.json().catch(() => ({}));
      const update: Record<string, unknown> = {};
      if (body.status) update.status = body.status;
      if (body.priority) update.priority = body.priority;
      if (body.assigned_to !== undefined) {
        update.assigned_to = body.assigned_to;
        const n = Number(body.assigned_to);
        update.assigned_user_id = Number.isFinite(n) ? n : null;
      }
      if (body.tags) update.tags = body.tags;
      if (body.status === "resolved") update.resolved_at = new Date().toISOString();
      if (body.status === "closed") update.closed_at = new Date().toISOString();
      const { data, error } = await supabase
        .from("chat_conversations")
        .update(update)
        .eq("id", convMatch[1])
        .eq("client_id", clientId)
        .select()
        .single();
      if (error) throw error;
      return json({ data });
    }

    return json({ error: "Not found", path, method: req.method }, 404);
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
