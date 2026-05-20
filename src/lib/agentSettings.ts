// Helpers to safely read automation flags from an agent's settings JSON.
// The settings are stored in the external `agents.settings` column (JSONB),
// but the frontend wizard serializes them via `config_json` (string).

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