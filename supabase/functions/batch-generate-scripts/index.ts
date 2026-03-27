import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

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
      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [{ role: "system", content: systemPrompt }, { role: "user", content: `Caso: ${c.case_name}` }],
        }),
      });

      if (aiResponse.status === 429) {
        await new Promise(r => setTimeout(r, 30000));
        continue;
      }
      if (!aiResponse.ok) { results.push({ id: c.id, name: c.case_name, status: "ai_error" }); continue; }

      const aiData = await aiResponse.json();
      const fullContent = aiData.choices?.[0]?.message?.content || "";

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
      results.push({ id: c.id, name: c.case_name, status: "error", message: e.message });
    }
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
