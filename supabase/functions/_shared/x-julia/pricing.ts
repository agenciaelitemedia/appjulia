// ============================================
// X-Julia — catálogo de modelos: preço, contexto e uso recomendado.
// Preços em US$ por 1 milhão de tokens (referência pública dos provedores).
// Modelo desconhecido => custo 0 (nunca quebra o turno).
// ============================================

export interface XJModelInfo {
  /** US$ por 1M de tokens de entrada */
  inputPer1M: number;
  /** US$ por 1M de tokens de saída */
  outputPer1M: number;
  /** janela de contexto em tokens */
  context: number;
  /** descrição curta de quando usar */
  note: string;
}

/** Chave: `provider/model` ou apenas `model` (fallback). */
export const XJ_MODEL_CATALOG: Record<string, XJModelInfo> = {
  // Lovable AI Gateway
  "lovable/google/gemini-3.6-flash": { inputPer1M: 0.3, outputPer1M: 2.5, context: 1_000_000, note: "Rápido e barato; padrão recomendado." },
  "lovable/google/gemini-3.1-pro-preview": { inputPer1M: 1.25, outputPer1M: 10, context: 1_000_000, note: "Raciocínio forte para casos complexos." },
  "lovable/google/gemini-3.1-flash-lite": { inputPer1M: 0.1, outputPer1M: 0.4, context: 1_000_000, note: "Mais econômico; ideal para alto volume." },
  "lovable/openai/gpt-5.6-terra": { inputPer1M: 1.25, outputPer1M: 10, context: 400_000, note: "Equilíbrio entre qualidade e custo." },
  "lovable/openai/gpt-5.6-luna": { inputPer1M: 0.25, outputPer1M: 2, context: 400_000, note: "Rápido e barato da família GPT-5.6." },
  "lovable/openai/gpt-5.5": { inputPer1M: 1.75, outputPer1M: 14, context: 400_000, note: "Máxima qualidade; custo mais alto." },

  // OpenAI direto
  "openai/gpt-4.1": { inputPer1M: 2, outputPer1M: 8, context: 1_000_000, note: "Robusto para instruções longas." },
  "openai/gpt-4o": { inputPer1M: 2.5, outputPer1M: 10, context: 128_000, note: "Multimodal consolidado." },
  "openai/gpt-4o-mini": { inputPer1M: 0.15, outputPer1M: 0.6, context: 128_000, note: "Econômico para conversas simples." },

  // OpenRouter
  "openrouter/anthropic/claude-sonnet-4": { inputPer1M: 3, outputPer1M: 15, context: 200_000, note: "Excelente redação e negociação." },
  "openrouter/openai/gpt-4.1": { inputPer1M: 2, outputPer1M: 8, context: 1_000_000, note: "GPT-4.1 via OpenRouter." },
  "openrouter/google/gemini-2.5-pro": { inputPer1M: 1.25, outputPer1M: 10, context: 1_000_000, note: "Contexto gigante." },
  "openrouter/deepseek/deepseek-chat": { inputPer1M: 0.27, outputPer1M: 1.1, context: 64_000, note: "Custo muito baixo." },

  // Anthropic direto
  "anthropic/claude-sonnet-4-20250514": { inputPer1M: 3, outputPer1M: 15, context: 200_000, note: "Melhor equilíbrio da Anthropic." },
  "anthropic/claude-3-7-sonnet-latest": { inputPer1M: 3, outputPer1M: 15, context: 200_000, note: "Geração anterior, estável." },
  "anthropic/claude-3-5-haiku-latest": { inputPer1M: 0.8, outputPer1M: 4, context: 200_000, note: "Rápido e mais barato." },

  // DeepSeek
  "deepseek/deepseek-chat": { inputPer1M: 0.27, outputPer1M: 1.1, context: 64_000, note: "Ótimo custo-benefício." },
  "deepseek/deepseek-reasoner": { inputPer1M: 0.55, outputPer1M: 2.19, context: 64_000, note: "Raciocínio passo a passo." },

  // xAI
  "grok/grok-4": { inputPer1M: 3, outputPer1M: 15, context: 256_000, note: "Modelo topo de linha da xAI." },
  "grok/grok-3": { inputPer1M: 3, outputPer1M: 15, context: 131_000, note: "Geração anterior." },
  "grok/grok-3-mini": { inputPer1M: 0.3, outputPer1M: 0.5, context: 131_000, note: "Barato para tarefas simples." },

  // Gemini direto
  "gemini/gemini-2.5-pro": { inputPer1M: 1.25, outputPer1M: 10, context: 1_000_000, note: "Contexto de 1M tokens." },
  "gemini/gemini-2.5-flash": { inputPer1M: 0.3, outputPer1M: 2.5, context: 1_000_000, note: "Rápido e econômico." },

  // LLM API
  "llmapi/gpt-4o": { inputPer1M: 2.5, outputPer1M: 10, context: 128_000, note: "GPT-4o via LLM API." },
  "llmapi/claude-3-5-sonnet": { inputPer1M: 3, outputPer1M: 15, context: 200_000, note: "Claude via LLM API." },
  "llmapi/llama3.1-70b": { inputPer1M: 0.6, outputPer1M: 0.8, context: 128_000, note: "Open source, custo baixo." },
};

export function getModelInfo(provider: string, model: string): XJModelInfo | null {
  return XJ_MODEL_CATALOG[`${provider}/${model}`] ?? XJ_MODEL_CATALOG[model] ?? null;
}

/** Custo estimado em US$ de uma chamada. Retorna 0 quando o modelo é desconhecido. */
export function estimateCost(
  provider: string,
  model: string,
  promptTokens: number | null,
  completionTokens: number | null,
): number {
  const info = getModelInfo(provider, model);
  if (!info) return 0;
  const inTok = Number(promptTokens ?? 0);
  const outTok = Number(completionTokens ?? 0);
  const cost = (inTok / 1_000_000) * info.inputPer1M + (outTok / 1_000_000) * info.outputPer1M;
  return Math.round(cost * 1_000_000) / 1_000_000;
}