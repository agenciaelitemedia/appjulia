import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FALLBACK_PROMPT = `Você é um especialista em direito previdenciário, trabalhista e assistencial. Gere roteiros de qualificação jurídica separados em 3 seções usando marcadores ===SECAO_1_INICIO===, ===SECAO_1_FIM===, ===SECAO_2_INICIO===, ===SECAO_2_FIM===, ===SECAO_3_INICIO===, ===SECAO_3_FIM===.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { case_name, custom_questions } = await req.json();

    if (!case_name) {
      return new Response(JSON.stringify({ error: "case_name é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch prompt from DB
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let systemPrompt = FALLBACK_PROMPT;
    const { data: config } = await supabase
      .from("generation_prompt_config")
      .select("prompt_text")
      .eq("config_key", "script_generator")
      .single();

    if (config?.prompt_text) {
      systemPrompt = config.prompt_text;
    }

    // Build user message
    let userMessage = `Caso: ${case_name}`;
    if (custom_questions?.trim()) {
      userMessage += `\n\nPerguntas personalizadas:\n${custom_questions}`;
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY não configurada");
    }

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
          { role: "user", content: userMessage },
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit excedido. Tente novamente em alguns instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const fullContent = aiData.choices?.[0]?.message?.content || "";

    // Parse 3 sections
    const parseSection = (start: string, end: string): string => {
      const startIdx = fullContent.indexOf(start);
      const endIdx = fullContent.indexOf(end);
      if (startIdx === -1 || endIdx === -1) return "";
      return fullContent.substring(startIdx + start.length, endIdx).trim();
    };

    let case_info = parseSection("===SECAO_1_INICIO===", "===SECAO_1_FIM===");
    let qualification_script = parseSection("===SECAO_2_INICIO===", "===SECAO_2_FIM===");
    let fees_info = parseSection("===SECAO_3_INICIO===", "===SECAO_3_FIM===");

    // Fallback: try splitting by ## SEÇÃO headers if markers not found
    if (!case_info && !qualification_script && !fees_info) {
      const sections = fullContent.split(/##\s*SE[ÇC][ÃA]O\s*\d+/i);
      if (sections.length >= 4) {
        case_info = sections[1]?.replace(/^[:\s]+/, '').trim() || "";
        qualification_script = sections[2]?.replace(/^[:\s]+/, '').trim() || "";
        fees_info = sections[3]?.replace(/^[:\s]+/, '').trim() || "";
      } else if (sections.length >= 2) {
        // Try splitting by --- 
        const parts = fullContent.split(/\n---\n/);
        if (parts.length >= 3) {
          case_info = parts[0]?.trim() || "";
          qualification_script = parts[1]?.trim() || "";
          fees_info = parts[2]?.trim() || "";
        } else {
          case_info = fullContent;
        }
      } else {
        case_info = fullContent;
      }
    }

    return new Response(JSON.stringify({ case_info, qualification_script, fees_info }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("prompt-generator error:", error);
    return new Response(JSON.stringify({ error: error.message || "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
