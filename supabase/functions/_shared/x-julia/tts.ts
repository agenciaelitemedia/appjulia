// ============================================
// X-Julia — voz (texto → áudio) com provedores plugáveis
// Provedores: elevenlabs, voicemaker. Áudio vai para o bucket chat-media.
// ============================================

// deno-lint-ignore no-explicit-any
async function providerKey(
  supabase: any,
  provider: string,
  opts?: { clientId?: string | null; keyMode?: string | null },
): Promise<string> {
  if (opts?.keyMode === "custom" && opts?.clientId) {
    const { data } = await supabase
      .from("xj_client_provider_keys")
      .select("api_key")
      .eq("client_id", String(opts.clientId))
      .eq("provider", provider)
      .eq("kind", "voice")
      .maybeSingle();
    const custom = (data?.api_key ?? "").toString().trim();
    if (custom) return custom;
  }

  const { data: settings } = await supabase
    .from("xj_provider_settings")
    .select("api_key:default_key")
    .eq("provider", provider)
    .eq("kind", "voice")
    .maybeSingle();
  const std = (settings?.api_key ?? "").toString().trim();
  if (std) return std;

  const { data } = await supabase
    .from("ai_provider_keys")
    .select("api_key")
    .eq("provider", provider)
    .maybeSingle();
  return (data?.api_key ?? "").toString().trim();
}

// deno-lint-ignore no-explicit-any
export async function xjSynthesize(
  supabase: any,
  params: {
    clientId: string;
    text: string;
    provider: string;
    voiceId: string | null;
    settings?: Record<string, unknown>;
    /** 'default' | 'custom' — origem da chave de voz. */
    keyMode?: string | null;
  },
): Promise<{ url: string } | { error: string }> {
  const text = params.text.trim();
  if (!text) return { error: "texto vazio" };

  const key = await providerKey(supabase, params.provider, {
    clientId: params.clientId,
    keyMode: params.keyMode,
  });
  if (!key) return { error: `chave de voz (${params.provider}) não configurada` };

  try {
    let bytes: Uint8Array;
    if (params.provider === "voicemaker") {
      const res = await fetch("https://developer.voicemaker.in/voice/api", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          Engine: "neural",
          VoiceId: params.voiceId || "pt-BR-Standard-A",
          LanguageCode: "pt-BR",
          Text: text,
          OutputFormat: "mp3",
          SampleRate: "48000",
          Effect: "default",
          MasterVolume: "0",
          MasterSpeed: "0",
          MasterPitch: "0",
        }),
      });
      const json = await res.json();
      if (!json?.path) return { error: `voicemaker: ${JSON.stringify(json).slice(0, 200)}` };
      const audio = await fetch(json.path);
      bytes = new Uint8Array(await audio.arrayBuffer());
    } else {
      const voice = params.voiceId || "21m00Tcm4TlvDq8ikWAM";
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "xi-api-key": key },
        body: JSON.stringify({
          text,
          model_id: (params.settings?.model_id as string) || "eleven_multilingual_v2",
          voice_settings: {
            stability: Number(params.settings?.stability ?? 0.45),
            similarity_boost: Number(params.settings?.similarity_boost ?? 0.8),
          },
        }),
      });
      if (!res.ok) return { error: `elevenlabs ${res.status}: ${(await res.text()).slice(0, 200)}` };
      bytes = new Uint8Array(await res.arrayBuffer());
    }

    const path = `x-julia/${params.clientId}/${crypto.randomUUID()}.mp3`;
    const { error: upErr } = await supabase.storage
      .from("chat-media")
      .upload(path, bytes, { contentType: "audio/mpeg", upsert: true });
    if (upErr) return { error: `upload: ${upErr.message}` };

    const { data } = supabase.storage.from("chat-media").getPublicUrl(path);
    return { url: data.publicUrl };
  } catch (err) {
    return { error: String(err) };
  }
}