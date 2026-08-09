// ============================================
// X-Julia — leitura de mídias recebidas (áudio, imagem, documento)
// O agente nunca para: se não conseguir ler, devolve descrição neutra.
// ============================================
import { xjComplete } from "./llm.ts";
import type { XJAgent, XJInboundMessage } from "./types.ts";

const MEDIA_PROMPT = `Você recebe uma mídia/arquivo enviado por um lead de um escritório de advocacia.
Sua tarefa: identificar de que arquivo se trata e extrair só o que é útil para a triagem jurídica em andamento.
Responda em português, em no máximo 5 linhas, no formato:
- Tipo do documento: (ex.: laudo médico, CNIS, carteira de trabalho, print de conversa, planilha de valores, comprovante)
- Dados relevantes: (nomes, CPF, datas, valores, CID/diagnóstico, empresa, período)
- Serve para o caso? (sim/não e por quê, em uma frase)
Se for áudio, transcreva fielmente. Sem comentários extras.`;

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
      const bytes = new Uint8Array(await file.arrayBuffer());
      const mime = (inbound.mime_type || "application/pdf").toLowerCase();
      const name = inbound.file_name ?? "documento";

      const extracted = await extractTextFromFile(bytes, mime, name);
      if (extracted) {
        // Planilha / CSV / texto: extraímos o conteúdo e pedimos um resumo objetivo.
        content.push({
          type: "text",
          text: `Conteúdo extraído do arquivo "${name}":\n\n${extracted.slice(0, 20000)}`,
        });
      } else if (mime.includes("pdf") || mime.startsWith("image/")) {
        content.push({
          type: "file",
          file: { filename: name, file_data: `data:${mime};base64,${toBase64(bytes)}` },
        });
      } else {
        return text || `[${label} recebido: ${name} — não foi possível ler o conteúdo, peça ao lead que descreva]`;
      }
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

/**
 * Extrai texto de planilhas (xlsx/xls/csv) e arquivos textuais.
 * Retorna null quando o formato não é suportado por essa via.
 */
async function extractTextFromFile(
  bytes: Uint8Array,
  mime: string,
  fileName: string,
): Promise<string | null> {
  const ext = (fileName.split(".").pop() ?? "").toLowerCase();
  const isSheet = mime.includes("spreadsheet") || mime.includes("excel") ||
    mime.includes("ms-excel") || ["xlsx", "xls", "xlsm", "ods"].includes(ext);
  const isCsv = mime.includes("csv") || ext === "csv" || ext === "tsv";
  const isPlain = mime.startsWith("text/") || mime.includes("json") ||
    ["txt", "md", "json", "xml", "html"].includes(ext);

  try {
    if (isSheet) {
      const XLSX = await import("npm:xlsx@0.18.5");
      const wb = XLSX.read(bytes, { type: "array" });
      const parts: string[] = [];
      for (const sheetName of wb.SheetNames.slice(0, 5)) {
        const csv = XLSX.utils.sheet_to_csv(wb.Sheets[sheetName]);
        parts.push(`--- planilha: ${sheetName} ---\n${csv.split("\n").slice(0, 200).join("\n")}`);
      }
      const out = parts.join("\n\n").trim();
      return out || null;
    }
    if (isCsv || isPlain) {
      const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes).trim();
      return decoded || null;
    }
  } catch (err) {
    console.warn("[x-julia/documents] falha ao extrair arquivo:", String(err));
  }
  return null;
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