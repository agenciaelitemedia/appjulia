import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
        ssl, connect_timeout: 15, idle_timeout: 20, max: 2,
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

    const rawCaCert = Deno.env.get("EXTERNAL_DB_CA_CERT") ?? "";
    const caCerts = rawCaCert ? normalizeCaCert(rawCaCert) : [];
    console.log("crm-copilot-monitor: CA certs:", caCerts.length);
    sql = createDbConnection(caCerts);

    let forceRun = false;
    try { const body = await req.json(); forceRun = body?.force === true; } catch {}

    // 1. Get agents with COPILOT_ENABLED
    const agents = await sql`
      SELECT DISTINCT ON (a.cod_agent) a.id, a.cod_agent, a.settings, ua.user_id
      FROM agents a
      JOIN user_agents ua ON ua.agent_id = a.id
      WHERE a.status = true
        AND ua.agent_id IS NOT NULL
      ORDER BY a.cod_agent, ua.id ASC
    `;

    const copilotAgents = agents.filter((a: any) => {
      try {
        const settings = typeof a.settings === "string" ? JSON.parse(a.settings) : a.settings;
        return settings?.COPILOT_ENABLED === true;
      } catch { return false; }
    });

    console.log(`Copilot agents: ${copilotAgents.length} / ${agents.length}`);

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

        let config = existingConfig as any;
        if (!config) {
          const { data: newConfig } = await supabase
            .from("crm_copilot_config")
            .insert({ user_id: Number(agent.user_id), cod_agent: agent.cod_agent } as any)
            .select()
            .single();
          config = newConfig as any;
        }
        if (!config) continue;

        // 3. Check frequency (skip if forceRun)
        const now = new Date();
        if (!forceRun) {
          const tz = config.timezone || "America/Sao_Paulo";
          const localHour = parseInt(
            now.toLocaleString("en-US", { timeZone: tz, hour: "numeric", hour12: false })
          );
          const bhStart = parseInt((config.business_hours_start || "08:00").split(":")[0]);
          const bhEnd = parseInt((config.business_hours_end || "20:00").split(":")[0]);
          const isBusinessHours = localHour >= bhStart && localHour < bhEnd;
          const interval = isBusinessHours
            ? (config.check_interval_business || 15)
            : (config.check_interval_off || 120);

          if (config.last_check_at) {
            const lastCheck = new Date(config.last_check_at);
            const minutesSince = (now.getTime() - lastCheck.getTime()) / 60000;
            if (minutesSince < interval) {
              results.push({ cod_agent: agent.cod_agent, status: "skipped_interval" });
              continue;
            }
          }
        }

        // 4. Get CRM cards with stage info and time calculations
        const cards = await sql`
          SELECT 
            c.id, c.contact_name, c.whatsapp_number, c.stage_id, 
            c.cod_agent, c.created_at, c.updated_at, c.stage_entered_at,
            c.end_stage, c.notes,
            s.name as stage_name, s.position as stage_position,
            EXTRACT(EPOCH FROM (now() - c.stage_entered_at)) / 3600 as hours_in_stage,
            EXTRACT(EPOCH FROM (now() - c.updated_at)) / 3600 as hours_since_update
          FROM crm_atendimento_cards c
          LEFT JOIN crm_atendimento_stages s ON s.id = c.stage_id
          WHERE c.cod_agent = ${agent.cod_agent}
            AND c.end_stage = false
          ORDER BY c.updated_at DESC
          LIMIT 25
        `;

        console.log(`Agent ${agent.cod_agent}: ${cards.length} active cards`);

        if (cards.length === 0) {
          results.push({ cod_agent: agent.cod_agent, status: "no_cards" });
          await supabase.from("crm_copilot_config")
            .update({ last_check_at: now.toISOString() } as any)
            .eq("cod_agent", agent.cod_agent);
          continue;
        }

        // 5. Hash check for incremental analysis
        const hashData = cards.map((c: any) => `${c.id}:${c.stage_id}:${c.updated_at}`).join("|");
        const encoder = new TextEncoder();
        const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(hashData));
        const currentHash = Array.from(new Uint8Array(hashBuffer))
          .map((b) => b.toString(16).padStart(2, "0")).join("");

        if (!forceRun && currentHash === config.last_data_hash) {
          results.push({ cod_agent: agent.cod_agent, status: "skipped_no_changes" });
          await supabase.from("crm_copilot_config")
            .update({ last_check_at: now.toISOString() } as any)
            .eq("cod_agent", agent.cod_agent);
          continue;
        }

        // 6. Get recent stage transitions
        const cardIds = cards.map((c: any) => c.id);
        const history = await sql`
          SELECT h.card_id, h.from_stage_id, h.to_stage_id, h.changed_at, h.notes,
                 fs.name as from_stage, ts.name as to_stage
          FROM crm_atendimento_history h
          LEFT JOIN crm_atendimento_stages fs ON fs.id = h.from_stage_id
          LEFT JOIN crm_atendimento_stages ts ON ts.id = h.to_stage_id
          WHERE h.card_id = ANY(${cardIds})
          ORDER BY h.changed_at DESC
          LIMIT 50
        `;

        // 7. Build AI context
        const cardsSummary = cards.map((c: any) => ({
          id: c.id,
          contact: c.contact_name || "Sem nome",
          phone: c.whatsapp_number,
          stage: c.stage_name || "Desconhecido",
          stage_position: Number(c.stage_position),
          notes: c.notes?.substring(0, 200),
          created_at: c.created_at,
          hours_in_current_stage: Math.round(Number(c.hours_in_stage) * 10) / 10,
          hours_since_last_update: Math.round(Number(c.hours_since_update) * 10) / 10,
          recent_transitions: history
            .filter((h: any) => String(h.card_id) === String(c.id))
            .slice(0, 3)
            .map((h: any) => ({
              from: h.from_stage,
              to: h.to_stage,
              at: h.changed_at,
            })),
        }));

        console.log(`Agent ${agent.cod_agent}: calling AI with ${cardsSummary.length} cards`);

        // 8. Call Lovable AI
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
                content: `Você é um analista de CRM jurídico especializado. Analise os cards/leads e identifique:
- stuck_lead: leads parados na mesma etapa há mais de 48h sem atualização
- hot_opportunity: leads que avançaram recentemente de etapa (sinal positivo)
- risk: leads que podem ser perdidos (parados há muito tempo, sem movimentação)
- follow_up_needed: leads que precisam de ação imediata

Regras:
- Seja conciso e objetivo em português brasileiro
- Max 5 insights por análise
- Priorize insights críticos e acionáveis
- Cite o nome do contato e a etapa atual
- Data/hora atual: ${now.toISOString()}`,
              },
              {
                role: "user",
                content: `Analise estes ${cards.length} cards do CRM:\n\n${JSON.stringify(cardsSummary, null, 2)}`,
              },
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "report_insights",
                  description: "Reportar insights do CRM",
                  parameters: {
                    type: "object",
                    properties: {
                      insights: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            insight_type: { type: "string", enum: ["stuck_lead", "hot_opportunity", "risk", "follow_up_needed", "summary"] },
                            severity: { type: "string", enum: ["info", "warning", "critical"] },
                            title: { type: "string" },
                            description: { type: "string" },
                            related_card_ids: { type: "array", items: { type: "number" } },
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
          console.error(`AI error ${agent.cod_agent}:`, aiResponse.status, errText);
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

        // 9. Deduplicate 24h
        const oneDayAgo = new Date(now.getTime() - 86400000).toISOString();
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

        // 10. Save
        if (newInsights.length > 0) {
          const rows = newInsights.map((i: any) => ({
            user_id: Number(agent.user_id),
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
        await supabase.from("crm_copilot_config")
          .update({ last_check_at: now.toISOString(), last_data_hash: currentHash } as any)
          .eq("cod_agent", agent.cod_agent);

        results.push({
          cod_agent: agent.cod_agent,
          status: "processed",
          cards_analyzed: cards.length,
          insights_generated: newInsights.length,
          insights_skipped: aiInsights.length - newInsights.length,
        });
      } catch (agentErr) {
        console.error(`Error ${agent.cod_agent}:`, agentErr);
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
