// Runs every minute via pg_cron. Finds scheduled internal notifications whose
// time has come and invokes the dispatcher for each one.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { data: due } = await supabase
      .from("internal_notifications")
      .select("id")
      .eq("status", "scheduled")
      .lte("scheduled_for", new Date().toISOString())
      .limit(50);

    const ids = (due || []).map((d) => d.id);
    for (const id of ids) {
      await supabase.functions.invoke("internal-notification-dispatch", { body: { notification_id: id } })
        .then(() => {}, (e) => console.warn("[internal-notification-scheduler] dispatch failed:", id, e));
    }

    return new Response(JSON.stringify({ ok: true, dispatched: ids.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
