// ============================================
// assigned-user-id-backfill-cron
// Roda periodicamente: descobre clients com linhas faltando assigned_user_id
// em qualquer das tabelas alvo, dispara o backfill por client e ao final
// refresca as MVs de performance (uma única vez).
// ============================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TABLES = [
  { table: "chat_conversations", clientCol: "client_id" },
  { table: "crm_deals",          clientCol: "client_id" },
  { table: "support_tickets",    clientCol: "requester_client_id" },
  { table: "tasks",              clientCol: "client_id" },
] as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const started = Date.now();
  const perClient: Record<string, unknown> = {};

  try {
    // 1) Coleta client_ids candidatos (linhas com assigned_to preenchido e assigned_user_id nulo).
    const clientIds = new Set<string>();
    for (const { table, clientCol } of TABLES) {
      const { data, error } = await supabase
        .from(table)
        .select(clientCol)
        .is("assigned_user_id", null)
        .not("assigned_to", "is", null)
        .neq("assigned_to", "")
        .limit(5000);
      if (error) {
        console.warn(`[backfill-cron] scan ${table} failed`, error.message);
        continue;
      }
      for (const row of (data || []) as any[]) {
        const cid = row[clientCol];
        if (cid != null) clientIds.add(String(cid));
      }
    }

    // 2) Dispara backfill por client (sem refresh; faremos um único refresh ao final).
    for (const clientId of clientIds) {
      try {
        const { data, error } = await supabase.functions.invoke("assigned-user-id-backfill", {
          body: { client_id: clientId, dry_run: false, skip_mv_refresh: true },
        });
        if (error) throw error;
        perClient[clientId] = data;
      } catch (e: any) {
        perClient[clientId] = { error: e?.message || String(e) };
      }
    }

    // 3) Refresh único das MVs de performance.
    let mvsRefreshed = false;
    let mvsError: string | null = null;
    const { error: rpcErr } = await supabase.rpc("refresh_team_performance_mvs");
    if (rpcErr) {
      mvsError = rpcErr.message || String(rpcErr);
    } else {
      mvsRefreshed = true;
    }

    return new Response(JSON.stringify({
      ok: true,
      duration_ms: Date.now() - started,
      clients_scanned: clientIds.size,
      mvs_refreshed: mvsRefreshed,
      mvs_error: mvsError,
      per_client: perClient,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("[assigned-user-id-backfill-cron] error", err);
    return new Response(JSON.stringify({ error: err?.message || String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});