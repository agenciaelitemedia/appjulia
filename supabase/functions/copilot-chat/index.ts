import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
    const { message, userId } = await req.json();
    if (!message || !userId) {
      return new Response(JSON.stringify({ error: "message and userId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const rawCaCert = Deno.env.get("EXTERNAL_DB_CA_CERT") ?? "";
    const caCerts = rawCaCert ? normalizeCaCert(rawCaCert) : [];
    sql = createDbConnection(caCerts);

    // SECURITY: Only fetch agents belonging to this user
    const userAgents = await sql`
      SELECT DISTINCT a.cod_agent, a.name
      FROM agents a
      JOIN user_agents ua ON ua.agent_id = a.id
      WHERE ua.user_id = ${userId}
        AND ua.agent_id IS NOT NULL
        AND a.status = true
    `;

    if (userAgents.length === 0) {
      await sql.end();
      return new Response(JSON.stringify({ error: "Nenhum agente vinculado ao seu usuário" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const agentCodes = userAgents.map((a: any) => a.cod_agent);

    // Fetch CRM data ONLY for user's agents
    const cards = await sql`
      SELECT 
        c.id, c.contact_name, c.whatsapp_number, c.stage_id,
        c.cod_agent, c.created_at, c.updated_at, c.stage_entered_at,
        c.end_stage, c.notes,
        s.name as stage_name,
        EXTRACT(EPOCH FROM (now() - c.stage_entered_at)) / 3600 as hours_in_stage
      FROM crm_atendimento_cards c
      LEFT JOIN crm_atendimento_stages s ON s.id = c.stage_id
      WHERE c.cod_agent = ANY(${agentCodes})
        AND c.end_stage = false
      ORDER BY c.updated_at DESC
      LIMIT 50
    `;

    await sql.end();
    sql = null;

    // Build context
    const crmContext = cards.map((c: any) => ({
      contact: c.contact_name || "Sem nome",
      phone: c.whatsapp_number,
      stage: c.stage_name || "Desconhecido",
      agent: c.cod_agent,
      hours_in_stage: Math.round(Number(c.hours_in_stage) * 10) / 10,
      notes: c.notes?.substring(0, 150),
    }));

    const systemPrompt = `Você é Julia, assistente IA de CRM jurídico. Responda perguntas sobre os leads/cards do CRM do usuário.

REGRAS DE SEGURANÇA:
- Você SÓ tem acesso aos agentes: ${agentCodes.join(', ')}
- NUNCA forneça dados de outros agentes/usuários
- Se pedirem dados de outros usuários, informe que não tem permissão

DADOS ATUAIS DO CRM (${cards.length} leads ativos):
${JSON.stringify(crmContext, null, 2)}

Agentes do usuário: ${userAgents.map((a: any) => `${a.cod_agent} (${a.name})`).join(', ')}

Responda em português brasileiro, seja conciso e objetivo.`;

    // Stream AI response
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
        stream: true,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit excedido, tente novamente em breve." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      return new Response(JSON.stringify({ error: "Erro na IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(aiResponse.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (err) {
    console.error("copilot-chat error:", err);
    if (sql) try { await sql.end(); } catch {}
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
