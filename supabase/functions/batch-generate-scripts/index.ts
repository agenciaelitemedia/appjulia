import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveAI, providerHeaders } from "../_shared/aiGateway.ts";
import { logAIUsage } from "../_shared/aiUsageLogger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const ai = await resolveAI(supabase, "script_generation");

  // Fetch prompt config
  let systemPrompt = "Você é um especialista em direito. Gere roteiros usando marcadores ===SECAO_1_INICIO===, ===SECAO_1_FIM===, ===SECAO_2_INICIO===, ===SECAO_2_FIM===, ===SECAO_3_INICIO===, ===SECAO_3_FIM===.";
  const { data: config } = await supabase.from("generation_prompt_config").select("prompt_text").eq("config_key", "script_generator").single();
  if (config?.prompt_text) systemPrompt = config.prompt_text;

  // Get all cases without content
  const { data: cases } = await supabase.from("generation_legal_cases").select("id, case_name").eq("is_active", true).is("case_info", null);
  
  if (!cases || cases.length === 0) {
    // Try cases with empty string
    const { data: cases2 } = await supabase.from("generation_legal_cases").select("id, case_name").eq("is_active", true).eq("case_info", "");
    if (!cases2 || cases2.length === 0) {
      return new Response(JSON.stringify({ message: "No cases to process" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    cases?.push(...cases2);
  }

  const results: any[] = [];
  const allCases = cases || [];

  for (const c of allCases) {
    try {
      const aiStarted = Date.now();
      const aiResponse = await fetch(ai.endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${ai.apiKey}`, "Content-Type": "application/json", ...providerHeaders(ai.provider) },
        body: JSON.stringify({
          model: ai.model,
          messages: [{ role: "system", content: systemPrompt }, { role: "user", content: `Caso: ${c.case_name}` }],
        }),
      });
      const aiDurationMs = Date.now() - aiStarted;

      if (aiResponse.status === 429) {
        await logAIUsage(supabase, {
          feature: "script_generation_batch",
          provider: ai.provider,
          endpoint: ai.endpoint,
          model: ai.model,
          status: "failed",
          duration_ms: aiDurationMs,
          error_reason: "ai_429",
          context: { case_id: c.id, case_name: c.case_name },
        });
        await new Promise(r => setTimeout(r, 30000));
        continue;
      }
      if (!aiResponse.ok) {
        await logAIUsage(supabase, {
          feature: "script_generation_batch",
          provider: ai.provider,
          endpoint: ai.endpoint,
          model: ai.model,
          status: "failed",
          duration_ms: aiDurationMs,
          error_reason: `ai_${aiResponse.status}`,
          context: { case_id: c.id, case_name: c.case_name },
        });
        results.push({ id: c.id, name: c.case_name, status: "ai_error" }); continue;
      }

      const aiData = await aiResponse.json();
      const fullContent = aiData.choices?.[0]?.message?.content || "";
      await logAIUsage(supabase, {
        feature: "script_generation_batch",
        provider: ai.provider,
        endpoint: ai.endpoint,
        model: ai.model,
        status: "ok",
        duration_ms: aiDurationMs,
        usage: aiData?.usage,
        context: { case_id: c.id, case_name: c.case_name },
      });

      const parseSection = (start: string, end: string): string => {
        const si = fullContent.indexOf(start);
        const ei = fullContent.indexOf(end);
        if (si === -1 || ei === -1) return "";
        return fullContent.substring(si + start.length, ei).trim();
      };

      let case_info = parseSection("===SECAO_1_INICIO===", "===SECAO_1_FIM===");
      let qualification_script = parseSection("===SECAO_2_INICIO===", "===SECAO_2_FIM===");
      let fees_info = parseSection("===SECAO_3_INICIO===", "===SECAO_3_FIM===");

      if (!case_info && !qualification_script && !fees_info) {
        case_info = fullContent;
      }

      const { error } = await supabase.from("generation_legal_cases").update({ case_info, qualification_script, fees_info }).eq("id", c.id);
      results.push({ id: c.id, name: c.case_name, status: error ? "db_error" : "ok" });

      // Rate limit delay
      await new Promise(r => setTimeout(r, 6000));
    } catch (e) {
      results.push({ id: c.id, name: c.case_name, status: "error", message: e instanceof Error ? e.message : String(e) });
    }
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
