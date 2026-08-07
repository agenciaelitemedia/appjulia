// ============================================
// Gating de ativação do agente X-Julia:
// frases de início de sessão, campanha, atendimento especializado
// e horário de atuação (múltiplas faixas por dia).
// ============================================

const DAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const DAY_MAP: Record<string, string> = {
  Sun: "sunday", Mon: "monday", Tue: "tuesday", Wed: "wednesday",
  Thu: "thursday", Fri: "friday", Sat: "saturday",
};

export interface XJActivation {
  session_start?: string;
  only_campaign?: boolean;
  start_campaign?: string;
  check_specialized?: string;
}

export function parsePhrases(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return String(raw)
    .split("||")
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
}

function normalizeText(text: string): string {
  return String(text ?? "").trim().toLowerCase();
}

/** True quando o texto contém (ou é) uma das frases configuradas. */
export function matchesPhrase(raw: string | null | undefined, text: string): boolean {
  const phrases = parsePhrases(raw);
  if (!phrases.length) return false;
  const needle = normalizeText(text);
  if (!needle) return false;
  return phrases.some((p) => needle === p || needle.includes(p));
}

interface HourRange { start: string; end: string }

export function normalizeBusinessHours(raw: Record<string, any> | null | undefined) {
  const source = raw ?? {};
  const schedule: Record<string, { enabled: boolean; ranges: HourRange[] }> = {};
  const incoming = source.schedule ?? {};
  for (const key of DAY_KEYS) {
    const day = incoming[key];
    const ranges: HourRange[] = Array.isArray(day?.ranges) && day.ranges.length
      ? day.ranges.map((r: any) => ({ start: String(r.start ?? "00:00"), end: String(r.end ?? "23:59") }))
      : day
      ? [{ start: String(day.start ?? "08:00"), end: String(day.end ?? "18:00") }]
      : [];
    schedule[key] = { enabled: !!day?.enabled, ranges };
  }
  return {
    enabled: !!source.enabled,
    timezone: String(source.timezone ?? "America/Sao_Paulo"),
    off_message: String(source.off_message ?? ""),
    schedule,
  };
}

/** True quando o agente pode atuar agora (ou quando o horário está desligado). */
export function isWithinBusinessHours(raw: Record<string, any> | null | undefined, now = new Date()): boolean {
  const config = normalizeBusinessHours(raw);
  if (!config.enabled) return true;

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: config.timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
  }).formatToParts(now);

  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  const time = `${hour}:${minute}`;

  const day = config.schedule[DAY_MAP[weekday] ?? "monday"];
  if (!day?.enabled || !day.ranges.length) return false;

  return day.ranges.some((r) => {
    if (!r.start || !r.end) return false;
    if (r.end < r.start) return time >= r.start || time <= r.end; // faixa cruzando meia-noite
    return time >= r.start && time <= r.end;
  });
}

export function offHoursMessage(raw: Record<string, any> | null | undefined): string {
  return normalizeBusinessHours(raw).off_message.trim();
}
