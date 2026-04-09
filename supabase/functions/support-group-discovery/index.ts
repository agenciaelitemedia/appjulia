import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const JULIA_REGEX = /j[uú]lia/i;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get assistant config for API credentials
    const { data: config } = await supabase
      .from("support_assistant_config")
      .select("api_url, instance_token")
      .limit(1)
      .maybeSingle();

    if (!config?.api_url || !config?.instance_token) {
      console.log("[group-discovery] No assistant config found");
      return new Response(JSON.stringify({ ok: true, skipped: "no config" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch groups via UaZapi proxy
    const proxyUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/uazapi-proxy`;
    const proxyResp = await fetch(proxyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
      },
      body: JSON.stringify({
        method: "GET",
        endpoint: "/group/list",
        token: config.instance_token,
        baseUrl: config.api_url,
      }),
    });

    const proxyData = await proxyResp.json();
    let rawGroups: any[] = [];
    if (proxyData?.ok) {
      const d = proxyData.data;
      rawGroups = Array.isArray(d) ? d : (d?.groups || d?.data || []);
    }

    if (rawGroups.length === 0) {
      console.log("[group-discovery] No groups returned from API");
      return new Response(JSON.stringify({ ok: true, newGroups: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get existing monitored group JIDs
    const { data: existing } = await supabase
      .from("support_monitored_groups")
      .select("group_jid");
    const existingJids = new Set((existing || []).map((g: any) => g.group_jid));

    // Find new groups that match "Julia" pattern
    const newJuliaGroups: any[] = [];
    for (const g of rawGroups) {
      const jid = g.JID || g.jid || g.id || "";
      const name = g.Name || g.name || g.subject || "";
      if (!jid || existingJids.has(jid)) continue;
      if (JULIA_REGEX.test(name)) {
        newJuliaGroups.push({
          group_jid: jid,
          group_name: name,
          picture_url: g.ProfilePictureUrl || g.pictureUrl || null,
          is_active: true,
          auto_added: true,
        });
      }
    }

    if (newJuliaGroups.length > 0) {
      const { error } = await supabase
        .from("support_monitored_groups")
        .upsert(newJuliaGroups, { onConflict: "group_jid" });
      if (error) {
        console.error("[group-discovery] Upsert error:", error);
      } else {
        console.log(`[group-discovery] Auto-added ${newJuliaGroups.length} new Julia groups`);
      }
    } else {
      console.log("[group-discovery] No new Julia groups found");
    }

    return new Response(JSON.stringify({ ok: true, newGroups: newJuliaGroups.length, totalChecked: rawGroups.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[group-discovery] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
