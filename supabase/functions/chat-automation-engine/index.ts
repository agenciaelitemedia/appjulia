// ============================================
// chat-automation-engine
// Processes automation rules for chat events.
// Triggers: new_conversation, keyword, inactivity, outside_hours, tag_added
// ============================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Rule {
  id: string;
  client_id: string;
  cod_agent: string | null;
  name: string;
  is_active: boolean;
  trigger_type: string;
  trigger_config: Record<string, any>;
  conditions: any[];
  action_type: string;
  action_config: Record<string, any>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing env", { hasUrl: !!supabaseUrl, hasKey: !!serviceRoleKey });
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const body = await req.json();
    const { event, conversation_id, client_id, message_text, tag } = body;

    if (!event) {
      return new Response(JSON.stringify({ error: "event required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Map event → trigger_type
    const triggerMap: Record<string, string> = {
      conversation_created: "new_conversation",
      message_received: "keyword",
      cron_inactivity: "inactivity",
      cron_outside_hours: "outside_hours",
      tag_added: "tag_added",
    };
    const triggerType = triggerMap[event];
    if (!triggerType) {
      return new Response(JSON.stringify({ error: "unknown event" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For cron events without a specific client, iterate over all active inactivity rules
    const isCron = event === "cron_inactivity" || event === "cron_outside_hours";
    let query = supabase
      .from("chat_automation_rules")
      .select("*")
      .eq("is_active", true)
      .eq("trigger_type", triggerType)
      .order("position");
    if (!isCron) {
      if (!client_id) {
        return new Response(JSON.stringify({ error: "client_id required for non-cron events" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      query = query.eq("client_id", client_id);
    }
    const { data: rules } = await query;

    if (!rules || rules.length === 0) {
      return new Response(JSON.stringify({ executed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let executed = 0;

    for (const rule of rules as Rule[]) {
      try {
        // For cron-based events, iterate over candidate conversations
        if (event === "cron_inactivity") {
          await runInactivityRule(supabase, rule);
          executed++;
          continue;
        }
        if (event === "cron_outside_hours") {
          // Outside hours runs against new pending conversations only
          if (!conversation_id) continue;
        }

        // Per-conversation rules
        if (!conversation_id) continue;

        const { data: conv } = await supabase
          .from("chat_conversations")
          .select("*")
          .eq("id", conversation_id)
          .maybeSingle();
        if (!conv) continue;

        // Trigger filter
        if (triggerType === "keyword") {
          const keywords: string[] = rule.trigger_config?.keywords ?? [];
          const text = (message_text ?? "").toLowerCase();
          const matchAny = keywords.some(k => text.includes(k.toLowerCase()));
          if (!matchAny) continue;
        }
        if (triggerType === "tag_added") {
          const targetTag = rule.trigger_config?.tag;
          if (targetTag && tag !== targetTag) continue;
        }
        if (triggerType === "outside_hours") {
          const start = rule.trigger_config?.start ?? "08:00";
          const end = rule.trigger_config?.end ?? "18:00";
          const tz = rule.trigger_config?.timezone ?? "America/Sao_Paulo";
          const now = new Date(new Date().toLocaleString("en-US", { timeZone: tz }));
          const hh = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
          const inside = hh >= start && hh <= end;
          if (inside) continue;
        }

        // Execute action
        await executeAction(supabase, rule, conv);
        executed++;

        await supabase.from("chat_automation_rules").update({
          execution_count: (rule as any).execution_count ? (rule as any).execution_count + 1 : 1,
          last_executed_at: new Date().toISOString(),
        }).eq("id", rule.id);

        await supabase.from("chat_automation_logs").insert({
          rule_id: rule.id,
          conversation_id,
          client_id,
          trigger_type: triggerType,
          action_type: rule.action_type,
          success: true,
          details: { event, action_config: rule.action_config },
        });
      } catch (err) {
        console.error("rule error", rule.id, err);
        await supabase.from("chat_automation_logs").insert({
          rule_id: rule.id,
          conversation_id: conversation_id ?? null,
          client_id,
          trigger_type: triggerType,
          action_type: rule.action_type,
          success: false,
          error_message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return new Response(JSON.stringify({ executed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("automation engine error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function executeAction(supabase: any, rule: Rule, conv: any) {
  const cfg = rule.action_config ?? {};
  switch (rule.action_type) {
    case "auto_assign": {
      const target = cfg.assigned_to;
      if (!target) return;
      const targetUserId = Number(target);
      const targetUserIdSafe = Number.isFinite(targetUserId) ? targetUserId : null;
      await supabase
        .from("chat_conversations")
        .update({
          assigned_to: target,
          assigned_user_id: targetUserIdSafe,
          status: conv.status === "pending" ? "open" : conv.status,
        })
        .eq("id", conv.id);
      break;
    }
    case "auto_tag": {
      const tag = cfg.tag;
      if (!tag) return;
      const tags: string[] = Array.isArray(conv.tags) ? conv.tags : [];
      if (!tags.includes(tag)) tags.push(tag);
      await supabase.from("chat_conversations").update({ tags }).eq("id", conv.id);
      break;
    }
    case "send_message": {
      const text = cfg.text;
      if (!text || !conv.contact_id) return;
      await supabase.from("chat_messages").insert({
        contact_id: conv.contact_id,
        conversation_id: conv.id,
        client_id: conv.client_id,
        text,
        from_me: true,
        type: "text",
        status: "sent",
        sender_name: "Automação",
        channel_type: conv.channel ?? "whatsapp_uazapi",
        timestamp: new Date().toISOString(),
      });
      break;
    }
    case "auto_close": {
      await supabase.from("chat_conversations").update({
        status: "closed",
        closed_at: new Date().toISOString(),
        close_reason: cfg.reason ?? "Fechamento automático por inatividade",
      }).eq("id", conv.id);
      break;
    }
    case "set_priority": {
      const priority = cfg.priority ?? "normal";
      await supabase.from("chat_conversations").update({ priority }).eq("id", conv.id);
      break;
    }
    case "transfer_queue": {
      const queue_id = cfg.queue_id;
      if (!queue_id) return;
      await supabase.from("chat_conversations").update({ queue_id }).eq("id", conv.id);
      break;
    }
  }
}

async function runInactivityRule(supabase: any, rule: Rule) {
  const minutes = Number(rule.trigger_config?.minutes ?? 60);
  const cutoff = new Date(Date.now() - minutes * 60_000).toISOString();
  const { data: candidates } = await supabase
    .from("chat_conversations")
    .select("*")
    .eq("client_id", rule.client_id)
    .in("status", ["pending", "open"])
    .lt("updated_at", cutoff)
    .limit(50);
  for (const conv of candidates ?? []) {
    try {
      await executeAction(supabase, rule, conv);
      await supabase.from("chat_automation_logs").insert({
        rule_id: rule.id,
        conversation_id: conv.id,
        client_id: rule.client_id,
        trigger_type: "inactivity",
        action_type: rule.action_type,
        success: true,
        details: { minutes_idle: minutes },
      });
    } catch (err) {
      await supabase.from("chat_automation_logs").insert({
        rule_id: rule.id,
        conversation_id: conv.id,
        client_id: rule.client_id,
        trigger_type: "inactivity",
        action_type: rule.action_type,
        success: false,
        error_message: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
