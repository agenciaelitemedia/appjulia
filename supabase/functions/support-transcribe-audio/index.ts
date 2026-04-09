import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("[transcribe] LOVABLE_API_KEY not set");
      return new Response(JSON.stringify({ error: "API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch untranscribed audio messages (limit 10 per run)
    const { data: messages, error: fetchError } = await supabase
      .from("support_group_messages")
      .select("id, media_url, sender_name, sender_role, group_name")
      .eq("message_type", "audio")
      .eq("is_transcribed", false)
      .not("media_url", "is", null)
      .order("created_at", { ascending: true })
      .limit(10);

    if (fetchError) {
      console.error("[transcribe] Fetch error:", fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[transcribe] Processing ${messages.length} audio messages`);
    let processed = 0;
    let errors = 0;

    for (const msg of messages) {
      try {
        // Download audio
        const audioResp = await fetch(msg.media_url);
        if (!audioResp.ok) {
          console.warn(`[transcribe] Failed to download audio for ${msg.id}`);
          errors++;
          continue;
        }

        const audioBuffer = await audioResp.arrayBuffer();
        const base64Audio = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));

        // Transcribe via Lovable AI (multimodal)
        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "system",
                content: "Você é um transcritor de áudio. Transcreva o áudio fornecido fielmente em português brasileiro. Retorne APENAS a transcrição, sem comentários adicionais. Se não conseguir entender o áudio, retorne '[Áudio inaudível]'."
              },
              {
                role: "user",
                content: [
                  {
                    type: "input_audio",
                    input_audio: {
                      data: base64Audio,
                      format: "wav",
                    }
                  },
                  { type: "text", text: "Transcreva este áudio:" }
                ],
              }
            ],
          }),
        });

        if (!aiResp.ok) {
          const errText = await aiResp.text();
          console.warn(`[transcribe] AI error for ${msg.id}:`, aiResp.status, errText);
          errors++;
          continue;
        }

        const aiData = await aiResp.json();
        const transcription = aiData.choices?.[0]?.message?.content?.trim() || "[Transcrição indisponível]";

        const roleLabel = msg.sender_role === "suporte" ? `suporte ${msg.sender_name || ""}`.trim() : "cliente";

        // Update message
        await supabase
          .from("support_group_messages")
          .update({
            transcription,
            is_transcribed: true,
            message_text: `🎤 Áudio do ${roleLabel}: "${transcription}"`,
          })
          .eq("id", msg.id);

        processed++;
        console.log(`[transcribe] Transcribed ${msg.id}`);
      } catch (innerErr) {
        console.error(`[transcribe] Error processing ${msg.id}:`, innerErr);
        errors++;
      }
    }

    return new Response(JSON.stringify({ ok: true, processed, errors }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[transcribe] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
