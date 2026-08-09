// ============================================
// X-Julia — resolvedor de mídia recebida.
// UaZapi entrega URLs criptografadas (.enc): é obrigatório baixar via
// POST /message/download para obter o arquivo decriptado. WABA grava
// `waba_media:<id>`, que precisa passar pelo download_media da Graph API.
// ============================================

export type XJResolvedMedia = {
  base64: string;
  mimeType: string;
  fileName?: string | null;
  source: "uazapi_download" | "waba_download" | "public_url";
};

const MAX_BASE64_BYTES = 28_000_000; // ~21MB binário

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

// deno-lint-ignore no-explicit-any
function isWabaChannel(msg: any, queue: any): boolean {
  const ct = String(queue?.channel_type ?? msg?.channel_type ?? "").toLowerCase();
  if (ct === "waba" || ct === "whatsapp_waba") return true;
  if (String(queue?.hub ?? "").toLowerCase() === "waba") return true;
  if (typeof msg?.media_url === "string" && msg.media_url.startsWith("waba_media:")) return true;
  return false;
}

// deno-lint-ignore no-explicit-any
function extractWabaMediaId(msg: any): string | null {
  if (typeof msg?.media_url === "string" && msg.media_url.startsWith("waba_media:")) {
    return msg.media_url.replace("waba_media:", "").trim() || null;
  }
  if (msg?.metadata?.waba_media_id) return String(msg.metadata.waba_media_id);
  const raw = msg?.raw_payload || {};
  for (const k of ["image", "document", "video", "sticker", "audio", "voice"]) {
    if (raw?.[k]?.id) return String(raw[k].id);
  }
  if (raw?.media?.id) return String(raw.media.id);
  return null;
}

async function fetchPublic(url: string, fallbackMime?: string | null): Promise<XJResolvedMedia | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[x-julia/media] public fetch ${res.status} (${url.slice(0, 120)})`);
      return null;
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (!bytes.length || bytes.length > MAX_BASE64_BYTES) {
      console.warn("[x-julia/media] arquivo vazio ou muito grande:", bytes.length);
      return null;
    }
    const mimeType = res.headers.get("content-type") || fallbackMime || "application/octet-stream";
    return { base64: toBase64(bytes), mimeType, source: "public_url" };
  } catch (err) {
    console.warn("[x-julia/media] public fetch erro:", String(err));
    return null;
  }
}

/**
 * Resolve o conteúdo real (decriptado) de uma mídia de `chat_messages`.
 * Retorna null quando não é possível — o chamador deve seguir com fallback neutro.
 */
// deno-lint-ignore no-explicit-any
export async function xjResolveMediaBytes(
  supabase: any,
  messageId?: string | null,
  fallbackUrl?: string | null,
  fallbackMime?: string | null,
): Promise<XJResolvedMedia | null> {
  if (!messageId) {
    if (fallbackUrl && /^https?:\/\//i.test(fallbackUrl)) return await fetchPublic(fallbackUrl, fallbackMime);
    return null;
  }

  const { data: msg } = await supabase
    .from("chat_messages")
    .select(
      "id, client_id, type, conversation_id, message_id, external_id, metadata, media_url, file_name, channel_type, raw_payload",
    )
    .eq("id", messageId)
    .maybeSingle();

  if (!msg) {
    if (fallbackUrl && /^https?:\/\//i.test(fallbackUrl)) return await fetchPublic(fallbackUrl, fallbackMime);
    return null;
  }

  const fileName = msg.file_name ?? null;
  const metaMime = msg.metadata?.mimetype ?? fallbackMime ?? null;

  // Fila (credenciais)
  let queue: any = null;
  if (msg.conversation_id) {
    const { data: conv } = await supabase
      .from("chat_conversations")
      .select("queue_id")
      .eq("id", msg.conversation_id)
      .maybeSingle();
    if (conv?.queue_id) {
      const { data } = await supabase
        .from("queues")
        .select("id, channel_type, hub, evo_url, evo_apikey, waba_token, waba_number_id, client_id")
        .eq("id", conv.queue_id)
        .maybeSingle();
      queue = data ?? null;
    }
  }

  const storedUrl = typeof msg.media_url === "string" ? msg.media_url : null;
  const isEnc = !!storedUrl && /\.enc(\?|$)/i.test(storedUrl);
  const isPublicHttp = !!storedUrl && /^https?:\/\//i.test(storedUrl) && !storedUrl.startsWith("waba_media:");

  if (isWabaChannel(msg, queue)) {
    // WABA: mídia já persistida em URL pública (storage) tem prioridade.
    if (isPublicHttp) {
      const direct = await fetchPublic(storedUrl!, metaMime);
      if (direct) return { ...direct, fileName };
    }

    let wabaQueue = queue?.waba_token && queue?.waba_number_id ? queue : null;
    if (!wabaQueue) {
      const { data } = await supabase
        .from("queues")
        .select("id, waba_token, waba_number_id")
        .eq("client_id", msg.client_id)
        .in("channel_type", ["whatsapp_waba", "waba"])
        .not("waba_token", "is", null)
        .not("waba_number_id", "is", null)
        .limit(1)
        .maybeSingle();
      wabaQueue = data ?? null;
    }
    if (!wabaQueue) {
      console.warn("[x-julia/media] waba_credentials_missing");
      return null;
    }
    const mediaId = extractWabaMediaId(msg);
    if (!mediaId) {
      console.warn("[x-julia/media] waba_media_id_missing");
      return null;
    }
    const { data: dlData, error: dlErr } = await supabase.functions.invoke("waba-send", {
      body: { action: "download_media", queue_id: wabaQueue.id, media_id: mediaId },
    });
    if (dlErr || !dlData?.base64) {
      console.warn("[x-julia/media] waba download_failed:", dlErr?.message || dlData?.error);
      return null;
    }
    return {
      base64: dlData.base64,
      mimeType: dlData.mimetype || metaMime || "application/octet-stream",
      fileName,
      source: "waba_download",
    };
  }

  // UaZapi: sempre tenta o download decriptado primeiro (URL .enc é ilegível).
  const extId = msg.external_id || msg.message_id || null;
  if (queue?.evo_url && queue?.evo_apikey && extId) {
    try {
      const baseUrl = String(queue.evo_url).replace(/\/$/, "");
      const resp = await fetch(`${baseUrl}/message/download`, {
        method: "POST",
        headers: { token: queue.evo_apikey, "Content-Type": "application/json" },
        body: JSON.stringify({ id: extId, return_base64: true, return_link: false, generate_mp3: false }),
      });
      if (resp.ok) {
        const dl = await resp.json();
        const base64 = dl.base64Data || dl.base64 || dl.data || dl.file || null;
        if (base64 && String(base64).length <= MAX_BASE64_BYTES) {
          return {
            base64: String(base64).replace(/^data:[^;]+;base64,/, ""),
            mimeType: dl.mimetype || dl.mimeType || dl.mime || metaMime || "application/octet-stream",
            fileName,
            source: "uazapi_download",
          };
        }
        console.warn("[x-julia/media] uazapi_no_base64");
      } else {
        console.warn(
          `[x-julia/media] uazapi enc_download_failed ${resp.status}:`,
          (await resp.text().catch(() => "")).slice(0, 200),
        );
      }
    } catch (err) {
      console.warn("[x-julia/media] uazapi download erro:", String(err));
    }
  } else {
    console.warn("[x-julia/media] queue_credentials_missing ou external_id ausente");
  }

  // Último recurso: URL pública direta (não serve para .enc).
  const candidate = isPublicHttp && !isEnc ? storedUrl : (fallbackUrl && /^https?:\/\//i.test(fallbackUrl) && !/\.enc(\?|$)/i.test(fallbackUrl) ? fallbackUrl : null);
  if (candidate) {
    const direct = await fetchPublic(candidate, metaMime);
    if (direct) return { ...direct, fileName };
  }
  return null;
}