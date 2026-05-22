// Dispatch an internal notification: resolve the target audience from the
// EXTERNAL users DB (via the db-query edge function), materialize recipients
// into internal_notification_recipients, and mark the notification as sent.
// Idempotent: unique(notification_id,user_id) + onConflict do nothing.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Run a raw SELECT against the external users DB through the db-query function.
// deno-lint-ignore no-explicit-any
async function externalRaw(query: string, params: any[]): Promise<any[]> {
  const { data, error } = await supabase.functions.invoke("db-query", {
    body: { action: "raw", data: { query, params } },
  });
  if (error) throw new Error(`db-query failed: ${error.message}`);
  return Array.isArray(data) ? data : [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  let notificationId: string | undefined;
  try {
    const body = await req.json().catch(() => ({}));
    notificationId = body?.notification_id;
    if (!notificationId) return json({ error: "notification_id required" }, 400);

    const { data: n, error: nErr } = await supabase
      .from("internal_notifications")
      .select("*")
      .eq("id", notificationId)
      .maybeSingle();
    if (nErr || !n) return json({ error: "notification not found" }, 404);
    if (n.status === "sent" || n.status === "sending") {
      return json({ ok: true, skipped: n.status });
    }

    await supabase.from("internal_notifications")
      .update({ status: "sending", updated_at: new Date().toISOString() })
      .eq("id", notificationId);

    // ── Build the audience query against the external users table ──
    const where: string[] = ["u.is_active = true"];
    // deno-lint-ignore no-explicit-any
    const params: any[] = [];

    if (n.scope === "office") {
      // Resolve the creator's real client_id from the external DB (don't trust
      // the inherited client_id from the frontend).
      const creatorId = String(n.created_by);
      const creatorRows = await externalRaw(
        "SELECT COALESCE(u.client_id, p.client_id) AS client_id FROM users u LEFT JOIN users p ON p.id = u.user_id WHERE u.id = $1 LIMIT 1",
        [creatorId],
      );
      const clientId = creatorRows?.[0]?.client_id ?? n.created_by_client_id ?? null;
      // office = creator + their direct subordinates + anyone sharing the client_id
      params.push(creatorId);
      const cidIdx = params.length;
      let officeClause = `(u.id = $${cidIdx} OR u.user_id = $${cidIdx}`;
      if (clientId != null) {
        params.push(clientId);
        officeClause += ` OR u.client_id = $${params.length}`;
      }
      officeClause += ")";
      where.push(officeClause);
    }

    if (n.audience === "owners") {
      where.push("u.client_id IS NOT NULL");
    } else if (n.audience === "teams") {
      where.push("u.role NOT IN ('admin','user','colaborador')");
    } // 'all' → no extra filter

    const sql = `SELECT u.id, u.name, u.role, u.client_id FROM users u WHERE ${where.join(" AND ")}`;
    const users = await externalRaw(sql, params);

    if (!users || users.length === 0) {
      await supabase.from("internal_notifications")
        .update({ status: "sent", sent_at: new Date().toISOString(), recipients_total: 0, updated_at: new Date().toISOString() })
        .eq("id", notificationId);
      return json({ ok: true, recipients: 0 });
    }

    // Insert recipients in chunks (idempotent).
    const CHUNK = 500;
    let inserted = 0;
    for (let i = 0; i < users.length; i += CHUNK) {
      const slice = users.slice(i, i + CHUNK).map((u) => ({
        notification_id: notificationId,
        user_id: String(u.id),
        user_name: u.name ?? null,
        user_role: u.role ?? null,
        client_id: u.client_id != null ? String(u.client_id) : null,
      }));
      const { error: insErr } = await supabase
        .from("internal_notification_recipients")
        .upsert(slice, { onConflict: "notification_id,user_id", ignoreDuplicates: true });
      if (insErr) console.warn("[internal-notification-dispatch] insert chunk failed:", insErr.message);
      else inserted += slice.length;
    }

    await supabase.from("internal_notifications")
      .update({ status: "sent", sent_at: new Date().toISOString(), recipients_total: users.length, updated_at: new Date().toISOString() })
      .eq("id", notificationId);

    return json({ ok: true, recipients: users.length, inserted });
  } catch (e) {
    console.error("[internal-notification-dispatch] error:", e);
    if (notificationId) {
      await supabase.from("internal_notifications")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", notificationId).then(() => {}, () => {});
    }
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
