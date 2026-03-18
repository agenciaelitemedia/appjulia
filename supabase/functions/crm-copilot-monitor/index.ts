import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Normalize CA cert PEM for Deno SSL
 */
function normalizeCaCert(input: string): string[] {
  let text = input.trim();
  text = text.replace(/\\n/g, "\n").replace(/\r\n/g, "\n");
  if (!text.includes("BEGIN CERTIFICATE")) {
    try { const decoded = atob(text); if (decoded.includes("BEGIN CERTIFICATE")) text = decoded; } catch {}
  }
  text = text
    .replace(/-----BEGIN CERTIFICATE-----\s+/g, "-----BEGIN CERTIFICATE-----\n")
    .replace(/\s+-----END CERTIFICATE-----/g, "\n-----END CERTIFICATE-----")
    .replace(/-----END CERTIFICATE-----\s+/g, "-----END CERTIFICATE-----\n");
  const blocks = text.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g);
  if (!blocks || blocks.length === 0) return [];
  const wrap64 = (s: string) => s.match(/.{1,64}/g)?.join("\n") ?? s;
  return blocks.map((block) => {
    const b64 = block.replace(/-----BEGIN CERTIFICATE-----/g, "").replace(/-----END CERTIFICATE-----/g, "").replace(/\s+/g, "").trim();
    return `-----BEGIN CERTIFICATE-----\n${wrap64(b64)}\n-----END CERTIFICATE-----\n`;
  });
}

function createDbConnection(caCerts: string[]) {
  const externalDbUrl = (Deno.env.get("EXTERNAL_DB_URL") ?? "").trim();
  const ssl = caCerts.length > 0 ? { caCerts, rejectUnauthorized: true } : ("require" as const);
  return externalDbUrl
    ? postgres(externalDbUrl, { ssl, connect_timeout: 15, idle_timeout: 20, max: 2 })
    : postgres({
        host: Deno.env.get("EXTERNAL_DB_HOST"),
        port: parseInt(Deno.env.get("EXTERNAL_DB_PORT") || "25061"),
        database: Deno.env.get("EXTERNAL_DB_DATABASE"),
        username: Deno.env.get("EXTERNAL_DB_USERNAME"),
        password: Deno.env.get("EXTERNAL_DB_PASSWORD"),
        ssl,
        connect_timeout: 15,
        idle_timeout: 20,
        max: 2,
      });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let sql: ReturnType<typeof postgres> | null = null;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Connect to external DB with proper SSL (same pattern as db-query)
    const rawCaCert = Deno.env.get("EXTERNAL_DB_CA_CERT") ?? "";
    const caCerts = rawCaCert ? normalizeCaCert(rawCaCert) : [];
    console.log("crm-copilot-monitor: CA certificates found:", caCerts.length);
    console.log("crm-copilot-monitor: External DB URL provided:", Boolean(Deno.env.get("EXTERNAL_DB_URL")));
    sql = createDbConnection(caCerts);

    // Parse request body for force flag
    let forceRun = false;
    try {
      const body = await req.json();
      forceRun = body?.force === true;
    } catch {}

    // 1. Get agents with COPILOT_ENABLED in settings
    const agents = await sql`
      SELECT a.id, a.cod_agent, a.settings, ua.user_id
      FROM agents a
      JOIN user_agents ua ON ua.agent_id = a.id
      WHERE a.is_active = true
        AND ua.is_owner = true
    `;

    const copilotAgents = agents.filter((a: any) => {
      try {
        const settings = typeof a.settings === "string" ? JSON.parse(a.settings) : a.settings;
        return settings?.COPILOT_ENABLED === true;
      } catch {
        return false;
      }
    });

    console.log(`Found ${copilotAgents.length} agents with COPILOT_ENABLED out of ${agents.length} total`);

    if (copilotAgents.length === 0) {
      await sql.end();
      return new Response(JSON.stringify({ status: "no_agents", processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];

    for (const agent of copilotAgents) {
      try {
        // 2. Get or create copilot config
        const { data: existingConfig } = await supabase
          .from("crm_copilot_config")
          .select("*")
          .eq("cod_agent", agent.cod_agent)
          .single();

        let config = existingConfig;
        if (!config) {
          const { data: newConfig } = await supabase
            .from("crm_copilot_config")
            .insert({ user_id: agent.user_id, cod_agent: agent.cod_agent } as any)
            .select()
            .single();
          config = newConfig;
        }
        if (!config) continue;

        // 3. Check frequency (skip if forceRun)
        if (!forceRun) {
          const now = new Date();
          const tz = (config as any).timezone || "America/Sao_Paulo";
          const localHour = parseInt(
            now.toLocaleString("en-US", { timeZone: tz, hour: "numeric", hour12: false })
          );
          const bhStart = parseInt(((config as any).business_hours_start || "08:00").split(":")[0]);
          const bhEnd = parseInt(((config as any).business_hours_end || "20:00").split(":")[0]);
          const isBusinessHours = localHour >= bhStart && localHour < bhEnd;
          const interval = isBusinessHours
            ? ((config as any).check_interval_business || 15)
            : ((config as any).check_interval_off || 120);

          if ((config as any).last_check_at) {
            const lastCheck = new Date((config as any).last_check_at);
            const minutesSince = (now.getTime() - lastCheck.getTime()) / 60000;
            if (minutesSince < interval) {
              results.push({ cod_agent: agent.cod_agent, status: "skipped_interval" });
              continue;
            }
          }
        }

        const now = new Date();

        // 4. Get CRM cards for this agent
        const cards = await sql`
          SELECT c.id, c.name, c.phone, c.stage_id, c.cod_agent, c.created_at, c.updated_at,
                 s.name as stage_name,
                 (SELECT COUNT(*) FROM crm_atendimento_messages m WHERE m.card_id = c.id) as msg_count
          FROM crm_atendimento_cards c
          LEFT JOIN crm_atendimento_stages s ON s.id = c.stage_id
          WHERE c.cod_agent = ${agent.cod_agent}
            AND c.is_active = true
          ORDER BY c.updated_at DESC
          LIMIT 20
        `;

        console.log(`Agent ${agent.cod_agent}: found ${cards.length} cards`);

        if (cards.length === 0) {
          results.push({ cod_agent: agent.cod_agent, status: "no_cards" });
          await supabase
            .from("crm_copilot_config")
            .update({ last_check_at: now.toISOString() } as any)
            .eq("cod_agent", agent.cod_agent);
          continue;
        }

        // 5. Generate data hash for incremental check
        const hashData = cards.map((c: any) => `${c.id}:${c.msg_count}:${c.stage_id}`).join("|");
        const encoder = new TextEncoder();
        const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(hashData));
        const currentHash = Array.from(new Uint8Array(hashBuffer))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

        if (!forceRun && currentHash === (config as any).last_data_hash) {
          results.push({ cod_agent: agent.cod_agent, status: "skipped_no_changes" });
          await supabase
            .from("crm_copilot_config")
            .update({ last_check_at: now.toISOString() } as any)
            .eq("cod_agent", agent.cod_agent);
          continue;
        }

        // 6. Get recent messages for cards with activity
        const cardIds = cards.map((c: any) => c.id);
        const messages = await sql`
          SELECT m.card_id, m.message, m.from_me, m.created_at
          FROM crm_atendimento_messages m
          WHERE m.card_id = ANY(${cardIds})
          ORDER BY m.created_at DESC
          LIMIT 100
        `;

        // Group messages by card
        const msgsByCard: Record<string, any[]> = {};
        for (const msg of messages) {
          if (!msgsByCard[msg.card_id]) msgsByCard[msg.card_id] = [];
          if (msgsByCard[msg.card_id].length < 10) {
            msgsByCard[msg.card_id].push(msg);
          }
        }

        // 7. Build context for AI
        const cardsSummary = cards.map((c: any) => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          stage: c.stage_name,
          created_at: c.created_at,
          updated_at: c.updated_at,
          msg_count: Number(c.msg_count),
          recent_messages: (msgsByCard[c.id] || []).map((m: any) => ({
            text: m.message?.substring(0, 200),
            from_me: m.from_me,
            at: m.created_at,
          })),
        }));

        console.log(`Agent ${agent.cod_agent}: calling AI with ${cardsSummary.length} cards context`);

        // 8. Call Lovable AI with tool calling
        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              {
                role: "system",
                content: `Você é um analista de CRM jurídico especializado. Analise os cards/leads do CRM e suas mensagens recentes.
Identifique:
- Leads parados há muito tempo sem resposta (stuck_lead)
- Oportunidades quentes que precisam de atenção imediata (hot_opportunity)
- Riscos de perda de leads (risk)
- Leads que precisam de follow-up (follow_up_needed)

Seja conciso e objetivo. Gere apenas insights realmente relevantes. Não gere mais de 5 insights por análise.
A data/hora atual é: ${now.toISOString()}`,
              },
              {
                role: "user",
                content: `Analise os seguintes ${cards.length} cards do CRM:\n\n${JSON.stringify(cardsSummary, null, 2)}`,
              },
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "report_insights",
                  description: "Reportar insights encontrados na análise do CRM",
                  parameters: {
                    type: "object",
                    properties: {
                      insights: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            insight_type: {
                              type: "string",
                              enum: ["stuck_lead", "hot_opportunity", "risk", "follow_up_needed", "summary"],
                            },
                            severity: {
                              type: "string",
                              enum: ["info", "warning", "critical"],
                            },
                            title: { type: "string" },
                            description: { type: "string" },
                            related_card_ids: {
                              type: "array",
                              items: { type: "number" },
                            },
                          },
                          required: ["insight_type", "severity", "title", "description"],
                          additionalProperties: false,
                        },
                      },
                    },
                    required: ["insights"],
                    additionalProperties: false,
                  },
                },
              },
            ],
            tool_choice: { type: "function", function: { name: "report_insights" } },
          }),
        });

        if (!aiResponse.ok) {
          const errText = await aiResponse.text();
          console.error(`AI error for ${agent.cod_agent}:`, aiResponse.status, errText);
          results.push({ cod_agent: agent.cod_agent, status: "ai_error", error: aiResponse.status });
          continue;
        }

        const aiData = await aiResponse.json();
        const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
        if (!toolCall) {
          results.push({ cod_agent: agent.cod_agent, status: "no_tool_call" });
          continue;
        }

        let aiInsights: any[];
        try {
          aiInsights = JSON.parse(toolCall.function.arguments).insights;
        } catch {
          results.push({ cod_agent: agent.cod_agent, status: "parse_error" });
          continue;
        }

        console.log(`Agent ${agent.cod_agent}: AI returned ${aiInsights.length} insights`);

        // 9. Deduplicate: skip insights with same type+title in last 24h
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
        const { data: recentInsights } = await supabase
          .from("crm_copilot_insights")
          .select("title, insight_type")
          .eq("cod_agent", agent.cod_agent)
          .gte("created_at", oneDayAgo);

        const existingKeys = new Set(
          (recentInsights || []).map((r: any) => `${r.insight_type}:${r.title}`)
        );

        const newInsights = aiInsights.filter(
          (i: any) => !existingKeys.has(`${i.insight_type}:${i.title}`)
        );

        // 10. Save insights
        if (newInsights.length > 0) {
          const rows = newInsights.map((i: any) => ({
            user_id: agent.user_id,
            cod_agent: agent.cod_agent,
            insight_type: i.insight_type,
            severity: i.severity,
            title: i.title,
            description: i.description,
            related_cards: i.related_card_ids || [],
          }));

          const { error: insertError } = await supabase.from("crm_copilot_insights").insert(rows as any);
          if (insertError) console.error("Insert error:", insertError);
        }

        // 11. Update config
        await supabase
          .from("crm_copilot_config")
          .update({
            last_check_at: now.toISOString(),
            last_data_hash: currentHash,
          } as any)
          .eq("cod_agent", agent.cod_agent);

        results.push({
          cod_agent: agent.cod_agent,
          status: "processed",
          cards_analyzed: cards.length,
          insights_generated: newInsights.length,
          insights_skipped_dedup: aiInsights.length - newInsights.length,
        });
      } catch (agentErr) {
        console.error(`Error processing ${agent.cod_agent}:`, agentErr);
        results.push({
          cod_agent: agent.cod_agent,
          status: "error",
          error: agentErr instanceof Error ? agentErr.message : String(agentErr),
        });
      }
    }

    await sql.end();

    return new Response(JSON.stringify({ status: "ok", results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("crm-copilot-monitor error:", err);
    if (sql) try { await sql.end(); } catch {}
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
