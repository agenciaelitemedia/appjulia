// ============================================
// Logger centralizado de uso de IA
// Insere em public.ai_usage_logs capturando tokens, custo (USD) e
// duração de áudio quando o provider retorna esses campos.
// Fire-and-forget: falhas no log nunca quebram a chamada principal.
// ============================================

export interface AIUsageRow {
  client_id?: string | null;
  user_id?: string | null;
  feature: string;
  provider: string;
  endpoint: string;
  model: string;
  status: string; // ok | failed | fallback
  duration_ms?: number | null;
  /**
   * Bloco `usage` retornado pelo provider. Pode conter:
   *  - prompt_tokens / completion_tokens / total_tokens (OpenAI-like)
   *  - input_tokens  / output_tokens                   (OpenRouter audio)
   *  - cost                                            (USD, OpenRouter)
   *  - seconds                                         (duração do áudio)
   */
  usage?: Record<string, unknown> | null;
  /** Sobrescreve audio_seconds extraído de usage.seconds. */
  audio_seconds?: number | null;
  error_reason?: string | null;
  context?: Record<string, unknown>;
}

function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function logAIUsage(supabase: any, row: AIUsageRow): Promise<void> {
  try {
    const u = (row.usage ?? {}) as Record<string, unknown>;
    const prompt_tokens     = num(u.prompt_tokens)     ?? num(u.input_tokens);
    const completion_tokens = num(u.completion_tokens) ?? num(u.output_tokens);
    const total_tokens      = num(u.total_tokens)
      ?? ((prompt_tokens ?? 0) + (completion_tokens ?? 0) || null);
    const cost_usd          = num(u.cost);
    const audio_seconds     = row.audio_seconds != null ? num(row.audio_seconds) : num(u.seconds);

    await supabase.from("ai_usage_logs").insert({
      client_id: row.client_id ?? null,
      user_id: row.user_id ?? null,
      feature: row.feature,
      provider: row.provider,
      endpoint: row.endpoint,
      model: row.model,
      status: row.status,
      duration_ms: row.duration_ms ?? null,
      prompt_tokens,
      completion_tokens,
      total_tokens,
      cost_usd,
      audio_seconds,
      error_reason: row.error_reason ?? null,
      context: row.context ?? {},
    });
  } catch (e) {
    console.warn(`[aiUsageLogger] insert failed (${row.feature}):`, e);
  }
}