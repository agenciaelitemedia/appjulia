// ============================================
// X-Julia — leitura de mídias recebidas (áudio, imagem, documento)
// O agente nunca para: se não conseguir ler, devolve descrição neutra.
// ============================================
import { xjComplete } from "./llm.ts";
import type { XJAgent, XJInboundMessage } from "./types.ts";

const MEDIA_PROMPT = `Você recebe uma mídia enviada por um lead de um escritório de advocacia.
Descreva objetivamente o conteúdo relevante para triagem jurídica (valores, datas, nomes, empresa, tipo de documento).
Se for áudio, transcreva fielmente. Responda em português, sem comentários extras.`;

/** Converte a mídia recebida em texto que o motor pode usar como entrada. */
// deno-lint-ignore no-explicit-any
export async function xjReadInbound(
  supabase: any,
  agent: XJAgent,
  inbound: XJInboundMessage,
): Promise<string> {
  const text = (inbound.text ?? "").trim();
  const type = (inbound.type ?? "text").toLowerCase();
  if (type === "text") return text;
  const isAudio = type === "audio" || type === "ptt";
  if (!inbound.media_url && !isAudio) return text;

  const label = isAudio ? "áudio" : type === "image" ? "imagem" : type === "video" ? "vídeo" : "documento";

  // Áudio: usa a transcrição do próprio sistema (decripta .enc / WABA e respeita
  // a permissão de exibição no chat). Se falhar, cai na leitura inline abaixo.
  if (isAudio) {
    const transcript = await transcribeViaChatFunction(supabase, inbound.message_id);
    if (transcript) {
      return [text, `[áudio recebido — transcrição: ${transcript}]`].filter(Boolean).join("\n");
    }
    if (!inbound.media_url) {
      return text || `[${label} recebido, conteúdo não legível — peça ao lead que descreva]`;
    }
  }

  try {
    const content: any[] = [{ type: "text", text: MEDIA_PROMPT }];
    if (type === "image" || type === "sticker") {
      content.push({ type: "image_url", image_url: { url: inbound.media_url } });
    } else if (type === "audio" || type === "ptt") {
      const audio = await fetch(inbound.media_url);
      const base64 = toBase64(new Uint8Array(await audio.arrayBuffer()));
      const format = guessAudioFormat(inbound.mime_type);
      content.push({ type: "input_audio", input_audio: { data: base64, format } });
    } else {
      const file = await fetch(inbound.media_url);
      const base64 = toBase64(new Uint8Array(await file.arrayBuffer()));
      const mime = inbound.mime_type || "application/pdf";
      if (!mime.includes("pdf") && !mime.startsWith("image/")) {
        return text || `[${label} recebido: ${inbound.file_name ?? "arquivo"} — não foi possível ler o conteúdo]`;
      }
      content.push({
        type: "file",
        file: { filename: inbound.file_name ?? "documento", file_data: `data:${mime};base64,${base64}` },
      });
    }

    const result = await xjComplete({
      supabase,
      provider: "lovable",
      model: "google/gemini-3.6-flash",
      fallbackEnabled: false,
      messages: [{ role: "user", content: content as any }],
    });

    const read = result.text.trim();
    if (!read) return text || `[${label} recebido]`;
    return [text, `[${label} recebido — conteúdo: ${read}]`].filter(Boolean).join("\n");
  } catch (err) {
    console.warn("[x-julia/documents] falha ao ler mídia:", String(err));
    return text || `[${label} recebido, conteúdo não legível — peça ao lead que descreva]`;
  }
}

function guessAudioFormat(mime?: string | null): string {
  const m = (mime ?? "").toLowerCase();
  if (m.includes("mp4") || m.includes("m4a")) return "m4a";
  if (m.includes("mpeg") || m.includes("mp3")) return "mp3";
  if (m.includes("wav")) return "wav";
  if (m.includes("ogg")) return "ogg";
  return "webm";
}

/** Transcreve via edge function `chat-transcribe-audio` (uso interno do agente). */
// deno-lint-ignore no-explicit-any
async function transcribeViaChatFunction(supabase: any, messageId?: string | null): Promise<string | null> {
  if (!messageId) return null;
  try {
    const { data, error } = await supabase.functions.invoke("chat-transcribe-audio", {
      body: { message_id: messageId, internal: true },
    });
    if (error) {
      console.warn("[x-julia/documents] transcrição falhou:", error.message ?? String(error));
      return null;
    }
    const t = typeof data?.text === "string" ? data.text.trim() : "";
    if (!t || /^\[(transcrição indisponível|áudio inaudível)\]$/i.test(t)) return null;
    return t;
  } catch (err) {
    console.warn("[x-julia/documents] transcrição erro:", String(err));
    return null;
  }
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}