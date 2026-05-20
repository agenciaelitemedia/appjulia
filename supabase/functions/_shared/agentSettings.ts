// Deno-side helper. Mirrors src/lib/agentSettings.ts.

export interface AgentAutomationFlags {
  autoTranscribeAudio: boolean;
  autoSummaryOnResolve: boolean;
  autoSummaryOnClose: boolean;
  usingAudio: boolean;
}

export const DEFAULT_AUTOMATION_FLAGS: AgentAutomationFlags = {
  autoTranscribeAudio: false,
  autoSummaryOnResolve: false,
  autoSummaryOnClose: false,
  usingAudio: false,
};

function parseSettings(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
  if (typeof raw === 'object') return raw as Record<string, unknown>;
  return null;
}

function asBool(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (v === 'true' || v === '1' || v === 'yes') return true;
    if (v === 'false' || v === '0' || v === 'no' || v === '') return false;
  }
  return fallback;
}

export function getAgentAutomationFlags(settingsRaw: unknown): AgentAutomationFlags {
  const parsed = parseSettings(settingsRaw);
  if (!parsed) return { ...DEFAULT_AUTOMATION_FLAGS };
  return {
    autoTranscribeAudio: asBool(parsed.AUTO_TRANSCRIBE_AUDIO, false),
    autoSummaryOnResolve: asBool(parsed.AUTO_SUMMARY_ON_RESOLVE, false),
    autoSummaryOnClose: asBool(parsed.AUTO_SUMMARY_ON_CLOSE, false),
    usingAudio: asBool(parsed.USING_AUDIO, false),
  };
}

/**
 * Fetch automation flags for an agent identified by cod_agent.
 * Uses the internal db-query edge function (service role auth).
 */
export async function fetchAgentFlagsByCod(
  codAgent: string | number | null | undefined,
): Promise<AgentAutomationFlags> {
  if (codAgent === null || codAgent === undefined || codAgent === '') {
    return { ...DEFAULT_AUTOMATION_FLAGS };
  }
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) return { ...DEFAULT_AUTOMATION_FLAGS };

  try {
    const resp = await fetch(`${supabaseUrl}/functions/v1/db-query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
      },
      body: JSON.stringify({
        action: 'raw',
        data: {
          query: `SELECT settings FROM agents WHERE cod_agent = $1::bigint LIMIT 1`,
          params: [String(codAgent)],
        },
      }),
    });
    if (!resp.ok) return { ...DEFAULT_AUTOMATION_FLAGS };
    const out = await resp.json();
    const rows = Array.isArray(out?.result) ? out.result : Array.isArray(out) ? out : [];
    const settings = rows[0]?.settings;
    return getAgentAutomationFlags(settings);
  } catch (_err) {
    return { ...DEFAULT_AUTOMATION_FLAGS };
  }
}