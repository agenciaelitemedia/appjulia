// ============================================
// X-Julia — FinOps: teto de custo e limite de mensagens (disjuntor)
//
// Consultado ANTES de chamar o LLM. Se o escritório estourou o teto do dia/mês
// ou o limite de mensagens por hora (por lead ou por escritório), o provedor não
// é chamado. Com on_breach='pause' a sessão é pausada e o lead recebe uma única
// mensagem informativa; com 'notify_only' apenas o evento é registrado.
// ============================================

export interface XJUsageLimits {
  client_id: string;
  daily_cost_usd: number;
  monthly_cost_usd: number;
  max_msgs_per_hour_per_lead: number;
  max_msgs_per_hour_per_client: number;
  on_breach: "notify_only" | "pause";
  breach_message: string;
  is_active: boolean;
}

export interface XJUsageSnapshot {
  dayCostUsd: number;
  dayTurns: number;
  monthCostUsd: number;
  monthTurns: number;
}

export interface XJBreach {
  breached: boolean;
  reason?: string;
  detail?: string;
  action?: "notify_only" | "pause";
  message?: string;
}

/** Limites do escritório. Ausente/inativo => sem limite (nunca bloqueia por falta de config). */
// deno-lint-ignore no-explicit-any
export async function loadUsageLimits(supabase: any, clientId: string): Promise<XJUsageLimits | null> {
  try {
    const { data } = await supabase
      .from("xj_usage_limits")
      .select("*")
      .eq("client_id", String(clientId))
      .maybeSingle();
    if (!data || data.is_active === false) return null;
    return {
      client_id: String(data.client_id),
      daily_cost_usd: Number(data.daily_cost_usd ?? 0),
      monthly_cost_usd: Number(data.monthly_cost_usd ?? 0),
      max_msgs_per_hour_per_lead: Number(data.max_msgs_per_hour_per_lead ?? 0),
      max_msgs_per_hour_per_client: Number(data.max_msgs_per_hour_per_client ?? 0),
      on_breach: data.on_breach === "pause" ? "pause" : "notify_only",
      breach_message: String(data.breach_message ?? ""),
      is_active: true,
    };
  } catch (err) {
    console.warn("[x-julia/limits] falha ao ler limites:", String(err));
    return null;
  }
}

/** Custo/turnos do dia e do mês (horário de Brasília), via RPC. */
// deno-lint-ignore no-explicit-any
export async function loadUsageSnapshot(supabase: any, clientId: string): Promise<XJUsageSnapshot> {
  try {
    const { data } = await supabase.rpc("xj_usage_snapshot", { p_client_id: String(clientId) });
    const row = Array.isArray(data) ? data[0] : data;
    return {
      dayCostUsd: Number(row?.day_cost_usd ?? 0),
      dayTurns: Number(row?.day_turns ?? 0),
      monthCostUsd: Number(row?.month_cost_usd ?? 0),
      monthTurns: Number(row?.month_turns ?? 0),
    };
  } catch (err) {
    console.warn("[x-julia/limits] falha ao ler contadores:", String(err));
    return { dayCostUsd: 0, dayTurns: 0, monthCostUsd: 0, monthTurns: 0 };
  }
}

/** Turnos na última hora, por sessão (lead) e por escritório. */
// deno-lint-ignore no-explicit-any
async function countRecentTurns(supabase: any, clientId: string, sessionId: string) {
  const since = new Date(Date.now() - 60 * 60_000).toISOString();
  const base = () =>
    supabase
      .from("xj_session_events")
      .select("id", { count: "exact", head: true })
      .eq("kind", "turn")
      .gte("created_at", since);
  const [lead, client] = await Promise.all([
    base().eq("session_id", sessionId),
    base().eq("client_id", String(clientId)),
  ]);
  return { lead: Number(lead?.count ?? 0), client: Number(client?.count ?? 0) };
}

/** Avalia os limites do escritório. Nunca lança: em caso de erro, libera o turno. */
// deno-lint-ignore no-explicit-any
export async function checkUsageBreach(
  supabase: any,
  clientId: string,
  sessionId: string,
): Promise<XJBreach> {
  try {
    const limits = await loadUsageLimits(supabase, clientId);
    if (!limits) return { breached: false };

    const [snapshot, recent] = await Promise.all([
      loadUsageSnapshot(supabase, clientId),
      countRecentTurns(supabase, clientId, sessionId),
    ]);

    const hit = (reason: string, detail: string): XJBreach => ({
      breached: true,
      reason,
      detail,
      action: limits.on_breach,
      message: limits.breach_message,
    });

    if (limits.daily_cost_usd > 0 && snapshot.dayCostUsd >= limits.daily_cost_usd) {
      return hit(
        "daily_cost",
        `custo do dia US$ ${snapshot.dayCostUsd.toFixed(4)} atingiu o teto de US$ ${limits.daily_cost_usd}`,
      );
    }
    if (limits.monthly_cost_usd > 0 && snapshot.monthCostUsd >= limits.monthly_cost_usd) {
      return hit(
        "monthly_cost",
        `custo do mês US$ ${snapshot.monthCostUsd.toFixed(4)} atingiu o teto de US$ ${limits.monthly_cost_usd}`,
      );
    }
    if (limits.max_msgs_per_hour_per_lead > 0 && recent.lead >= limits.max_msgs_per_hour_per_lead) {
      return hit("rate_lead", `${recent.lead} turnos na última hora neste atendimento`);
    }
    if (limits.max_msgs_per_hour_per_client > 0 && recent.client >= limits.max_msgs_per_hour_per_client) {
      return hit("rate_client", `${recent.client} turnos na última hora no escritório`);
    }

    return { breached: false };
  } catch (err) {
    console.warn("[x-julia/limits] verificação falhou, liberando turno:", String(err));
    return { breached: false };
  }
}

/** Acumula custo e turnos do dia (contador por escritório). Falha silenciosa. */
// deno-lint-ignore no-explicit-any
export async function bumpUsage(supabase: any, clientId: string, costUsd: number, turns: number) {
  try {
    await supabase.rpc("xj_bump_usage", {
      p_client_id: String(clientId),
      p_cost_usd: Number(costUsd ?? 0),
      p_turns: Number(turns ?? 0),
    });
  } catch (err) {
    console.warn("[x-julia/limits] falha ao acumular consumo:", String(err));
  }
}
