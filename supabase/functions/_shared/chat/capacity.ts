// ============================================
// Capacidade de atendentes (chat) — regra única, server-side.
//
// A carga real é calculada no banco (`chat_agent_live_load`), contando apenas
// conversas EM ATENDIMENTO (status = 'open') por atendente — conversas
// aguardando (`pending`), resolvidas ou fechadas não contam. Resolve tanto os
// registros que guardam o nome em `assigned_to` quanto os que guardam o user_id.
// `chat_agent_capacity.current_load` é apenas espelho (trigger) e não é
// usado como verdade aqui.
// ============================================

export interface CapacityInfo {
  identifier: string;
  name: string | null;
  load: number;
  /** Teto configurado, ou null quando o atendente não tem limite. */
  max_concurrent: number | null;
  blocked: boolean;
  /** Vagas restantes (>= 0), ou null quando sem limite. */
  slots: number | null;
  /** true somente quando existe limite em vigor para este atendente. */
  enforced: boolean;
}

/**
 * NÃO existe teto padrão. Um atendente só tem limite quando a distribuição
 * automática do escritório está ativada E existe registro ativo em
 * chat_agent_capacity com max_concurrent > 0.
 */

/** Identificador canônico de um atendente: sempre o user_id como string. */
export function agentIdentifier(
  assignedUserId: number | string | null | undefined,
  assignedTo?: string | null,
): string | null {
  if (assignedUserId != null && String(assignedUserId).trim() !== '') return String(assignedUserId);
  const t = (assignedTo ?? '').trim();
  if (/^[0-9]+$/.test(t)) return t;
  return null;
}

/** Carga real por identificador de atendente. */
// deno-lint-ignore no-explicit-any
export async function loadLiveLoads(supabase: any, clientId: string): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const { data, error } = await supabase.rpc('chat_agent_live_load', { p_client_id: String(clientId) });
  if (error) throw error;
  for (const row of (data ?? [])) {
    map.set(String(row.agent_identifier), Number(row.load) || 0);
  }
  return map;
}

/** Tetos configurados por identificador (somente registros ativos). */
// deno-lint-ignore no-explicit-any
export async function loadCapacityCaps(
  supabase: any,
  clientId: string,
): Promise<Map<string, { max: number | null; name: string | null; active: boolean }>> {
  const map = new Map<string, { max: number | null; name: string | null; active: boolean }>();
  const { data, error } = await supabase
    .from('chat_agent_capacity')
    .select('agent_identifier, agent_name, max_concurrent, is_active')
    .eq('client_id', String(clientId));
  if (error) throw error;
  for (const row of (data ?? [])) {
    map.set(String(row.agent_identifier), {
      max: Number(row.max_concurrent) > 0 ? Number(row.max_concurrent) : null,
      name: row.agent_name ?? null,
      active: row.is_active !== false,
    });
  }
  return map;
}

/** Capacidade de todos os atendentes do escritório (carga real + teto). */
// deno-lint-ignore no-explicit-any
export async function loadAllCapacity(supabase: any, clientId: string): Promise<CapacityInfo[]> {
  const [loads, caps, autoOn] = await Promise.all([
    loadLiveLoads(supabase, clientId),
    loadCapacityCaps(supabase, clientId),
    isAutoDistributionEnabled(supabase, clientId),
  ]);
  const ids = new Set<string>([...loads.keys(), ...caps.keys()]);
  const out: CapacityInfo[] = [];
  for (const id of ids) {
    const load = loads.get(id) ?? 0;
    const cap = caps.get(id);
    const max = autoOn && cap && cap.active && cap.max && cap.max > 0 ? cap.max : null;
    out.push({
      identifier: id,
      name: cap?.name ?? null,
      load,
      max_concurrent: max,
      blocked: max != null && load >= max,
      slots: max == null ? null : Math.max(0, max - load),
      enforced: max != null,
    });
  }
  return out.sort((a, b) => b.load - a.load);
}

/**
 * Capacidade de um atendente. Sem registro em chat_agent_capacity o teto
 * padrão (20) é aplicado — não há atendente ilimitado.
 */
// deno-lint-ignore no-explicit-any
export async function checkCapacity(
  supabase: any,
  clientId: string,
  identifier: string | null,
): Promise<CapacityInfo> {
  const id = identifier ? String(identifier) : '';
  if (!id) {
    return { identifier: '', name: null, load: 0, max_concurrent: null, blocked: false, slots: null, enforced: false };
  }
  const { data, error } = await supabase.rpc('chat_capacity_check', {
    p_client_id: String(clientId),
    p_agent_identifier: id,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  const load = Number(row?.load) || 0;
  const enforced = row?.enforced === true && Number(row?.max_concurrent) > 0;
  const max = enforced ? Number(row.max_concurrent) : null;
  return {
    identifier: id,
    name: row?.agent_name ?? null,
    load,
    max_concurrent: max,
    blocked: max != null && load >= max,
    slots: max == null ? null : Math.max(0, max - load),
    enforced,
  };
}

/** Mensagem padrão de bloqueio, usada em todas as camadas. */
/** A distribuição automática do escritório está ativada? */
// deno-lint-ignore no-explicit-any
export async function isAutoDistributionEnabled(supabase: any, clientId: string): Promise<boolean> {
  const { data } = await supabase
    .from('chat_client_settings')
    .select('settings')
    .eq('client_id', String(clientId))
    .maybeSingle();
  const s = (data?.settings ?? {}) as Record<string, unknown>;
  return s.auto_distribution_enabled === true || s.auto_distribution_enabled === 'true';
}

export function capacityBlockedMessage(info: CapacityInfo): string {
  const who = info.name || `atendente ${info.identifier}`;
  if (!info.enforced || info.max_concurrent == null) {
    return `${who} não possui limite de atendimentos configurado.`;
  }
  return `${who} está com ${info.load}/${info.max_concurrent} atendimentos — encerre atendimentos antes de receber novos.`;
}
