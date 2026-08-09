/**
 * Catálogo de modelos LLM do X-Julia: preço (US$ por 1M de tokens),
 * janela de contexto e uso recomendado. Espelha
 * supabase/functions/_shared/x-julia/pricing.ts.
 */
export interface XJModelInfo {
  inputPer1M: number;
  outputPer1M: number;
  context: number;
  note: string;
}

export const XJ_MODEL_CATALOG: Record<string, XJModelInfo> = {
  'lovable/google/gemini-3.6-flash': { inputPer1M: 0.3, outputPer1M: 2.5, context: 1_000_000, note: 'Rápido e barato; padrão recomendado.' },
  'lovable/google/gemini-3.1-pro-preview': { inputPer1M: 1.25, outputPer1M: 10, context: 1_000_000, note: 'Raciocínio forte para casos complexos.' },
  'lovable/google/gemini-3.1-flash-lite': { inputPer1M: 0.1, outputPer1M: 0.4, context: 1_000_000, note: 'Mais econômico; ideal para alto volume.' },
  'lovable/openai/gpt-5.6-terra': { inputPer1M: 1.25, outputPer1M: 10, context: 400_000, note: 'Equilíbrio entre qualidade e custo.' },
  'lovable/openai/gpt-5.6-luna': { inputPer1M: 0.25, outputPer1M: 2, context: 400_000, note: 'Rápido e barato da família GPT-5.6.' },
  'lovable/openai/gpt-5.5': { inputPer1M: 1.75, outputPer1M: 14, context: 400_000, note: 'Máxima qualidade; custo mais alto.' },

  'openai/gpt-4.1': { inputPer1M: 2, outputPer1M: 8, context: 1_000_000, note: 'Robusto para instruções longas.' },
  'openai/gpt-4o': { inputPer1M: 2.5, outputPer1M: 10, context: 128_000, note: 'Multimodal consolidado.' },
  'openai/gpt-4o-mini': { inputPer1M: 0.15, outputPer1M: 0.6, context: 128_000, note: 'Econômico para conversas simples.' },

  'openrouter/anthropic/claude-sonnet-4': { inputPer1M: 3, outputPer1M: 15, context: 200_000, note: 'Excelente redação e negociação.' },
  'openrouter/openai/gpt-4.1': { inputPer1M: 2, outputPer1M: 8, context: 1_000_000, note: 'GPT-4.1 via OpenRouter.' },
  'openrouter/google/gemini-2.5-pro': { inputPer1M: 1.25, outputPer1M: 10, context: 1_000_000, note: 'Contexto gigante.' },
  'openrouter/deepseek/deepseek-chat': { inputPer1M: 0.27, outputPer1M: 1.1, context: 64_000, note: 'Custo muito baixo.' },

  'anthropic/claude-sonnet-4-20250514': { inputPer1M: 3, outputPer1M: 15, context: 200_000, note: 'Melhor equilíbrio da Anthropic.' },
  'anthropic/claude-3-7-sonnet-latest': { inputPer1M: 3, outputPer1M: 15, context: 200_000, note: 'Geração anterior, estável.' },
  'anthropic/claude-3-5-haiku-latest': { inputPer1M: 0.8, outputPer1M: 4, context: 200_000, note: 'Rápido e mais barato.' },

  'deepseek/deepseek-chat': { inputPer1M: 0.27, outputPer1M: 1.1, context: 64_000, note: 'Ótimo custo-benefício.' },
  'deepseek/deepseek-reasoner': { inputPer1M: 0.55, outputPer1M: 2.19, context: 64_000, note: 'Raciocínio passo a passo.' },

  'grok/grok-4': { inputPer1M: 3, outputPer1M: 15, context: 256_000, note: 'Modelo topo de linha da xAI.' },
  'grok/grok-3': { inputPer1M: 3, outputPer1M: 15, context: 131_000, note: 'Geração anterior.' },
  'grok/grok-3-mini': { inputPer1M: 0.3, outputPer1M: 0.5, context: 131_000, note: 'Barato para tarefas simples.' },

  'gemini/gemini-2.5-pro': { inputPer1M: 1.25, outputPer1M: 10, context: 1_000_000, note: 'Contexto de 1M tokens.' },
  'gemini/gemini-2.5-flash': { inputPer1M: 0.3, outputPer1M: 2.5, context: 1_000_000, note: 'Rápido e econômico.' },

  'llmapi/gpt-4o': { inputPer1M: 2.5, outputPer1M: 10, context: 128_000, note: 'GPT-4o via LLM API.' },
  'llmapi/claude-3-5-sonnet': { inputPer1M: 3, outputPer1M: 15, context: 200_000, note: 'Claude via LLM API.' },
  'llmapi/llama3.1-70b': { inputPer1M: 0.6, outputPer1M: 0.8, context: 128_000, note: 'Open source, custo baixo.' },
};

/** Preços mantidos pelo admin (tabela xj_model_pricing) — sobrepõem o catálogo estático. */
let PRICING_OVERRIDES: Record<string, XJModelInfo> = {};

export function applyXJPricingOverrides(
  rows: Array<{
    provider: string;
    model: string;
    input_per_1m: number | string;
    output_per_1m: number | string;
    context_tokens: number | string;
    note?: string | null;
    is_active?: boolean;
  }> = [],
) {
  const map: Record<string, XJModelInfo> = {};
  for (const row of rows) {
    if (row.is_active === false) continue;
    map[`${row.provider}/${row.model}`] = {
      inputPer1M: Number(row.input_per_1m ?? 0),
      outputPer1M: Number(row.output_per_1m ?? 0),
      context: Number(row.context_tokens ?? 0),
      note: row.note ?? '',
    };
  }
  PRICING_OVERRIDES = map;
}

export function getXJModelInfo(provider: string, model: string): XJModelInfo | null {
  return (
    PRICING_OVERRIDES[`${provider}/${model}`] ??
    PRICING_OVERRIDES[model] ??
    XJ_MODEL_CATALOG[`${provider}/${model}`] ??
    XJ_MODEL_CATALOG[model] ??
    null
  );
}

export function formatUsd(value: number, digits = 2): string {
  return `US$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

export function formatContext(tokens: number): string {
  return tokens >= 1_000_000 ? `${tokens / 1_000_000}M ctx` : `${Math.round(tokens / 1000)}k ctx`;
}

/** Resumo curto de preço: "in US$ 0,30 / out US$ 2,50 por 1M · 1M ctx" */
export function formatModelPricing(provider: string, model: string): string | null {
  const info = getXJModelInfo(provider, model);
  if (!info) return null;
  return `in ${formatUsd(info.inputPer1M)} / out ${formatUsd(info.outputPer1M)} por 1M · ${formatContext(info.context)}`;
}