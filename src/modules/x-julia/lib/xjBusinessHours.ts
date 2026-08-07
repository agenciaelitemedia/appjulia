/**
 * Horário de atuação do agente X-Julia — múltiplas faixas por dia da semana.
 * Dentro das faixas o agente responde; fora delas ele não atua.
 */
export interface XJHourRange {
  start: string; // "HH:MM"
  end: string;   // "HH:MM"
}

export interface XJDaySchedule {
  enabled: boolean;
  ranges: XJHourRange[];
}

export type XJWeekday =
  | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export type XJSchedule = Record<XJWeekday, XJDaySchedule>;

export interface XJBusinessHours {
  enabled: boolean;
  timezone: string;
  off_message: string;
  schedule: XJSchedule;
}

export const XJ_WEEKDAYS: { key: XJWeekday; label: string; short: string }[] = [
  { key: 'monday', label: 'Segunda-feira', short: 'Seg' },
  { key: 'tuesday', label: 'Terça-feira', short: 'Ter' },
  { key: 'wednesday', label: 'Quarta-feira', short: 'Qua' },
  { key: 'thursday', label: 'Quinta-feira', short: 'Qui' },
  { key: 'friday', label: 'Sexta-feira', short: 'Sex' },
  { key: 'saturday', label: 'Sábado', short: 'Sáb' },
  { key: 'sunday', label: 'Domingo', short: 'Dom' },
];

const DAY_MAP: Record<string, XJWeekday> = {
  Sun: 'sunday', Mon: 'monday', Tue: 'tuesday', Wed: 'wednesday',
  Thu: 'thursday', Fri: 'friday', Sat: 'saturday',
};

export function defaultXJSchedule(): XJSchedule {
  const day = (): XJDaySchedule => ({ enabled: true, ranges: [{ start: '08:00', end: '18:00' }] });
  return {
    monday: day(), tuesday: day(), wednesday: day(), thursday: day(), friday: day(),
    saturday: { enabled: false, ranges: [{ start: '08:00', end: '12:00' }] },
    sunday: { enabled: false, ranges: [{ start: '08:00', end: '12:00' }] },
  };
}

export function normalizeXJBusinessHours(raw: Record<string, any> | null | undefined): XJBusinessHours {
  const source = raw ?? {};
  const schedule = defaultXJSchedule();
  const incoming = source.schedule ?? {};
  for (const { key } of XJ_WEEKDAYS) {
    const day = incoming[key];
    if (!day) continue;
    // Compatibilidade com o formato antigo de um intervalo único (start/end).
    const ranges: XJHourRange[] = Array.isArray(day.ranges) && day.ranges.length
      ? day.ranges.map((r: any) => ({ start: String(r.start ?? '00:00'), end: String(r.end ?? '23:59') }))
      : [{ start: String(day.start ?? '08:00'), end: String(day.end ?? '18:00') }];
    schedule[key] = { enabled: !!day.enabled, ranges };
  }
  return {
    enabled: !!source.enabled,
    timezone: String(source.timezone ?? 'America/Sao_Paulo'),
    off_message: String(source.off_message ?? ''),
    schedule,
  };
}

/** Retorna dia/hora atuais no fuso configurado. */
export function nowInTimezone(timezone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone || 'America/Sao_Paulo',
    weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false, hourCycle: 'h23',
  }).formatToParts(now);
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon';
  const hour = parts.find((p) => p.type === 'hour')?.value ?? '00';
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '00';
  return { day: DAY_MAP[weekday] ?? 'monday', time: `${hour}:${minute}` };
}

/** True quando o agente pode atuar agora (ou quando o horário está desligado). */
export function isWithinXJHours(raw: Record<string, any> | null | undefined, now = new Date()): boolean {
  const config = normalizeXJBusinessHours(raw);
  if (!config.enabled) return true;
  const { day, time } = nowInTimezone(config.timezone, now);
  const daySchedule = config.schedule[day];
  if (!daySchedule?.enabled) return false;
  return daySchedule.ranges.some((r) => {
    if (!r.start || !r.end) return false;
    // Faixa que cruza a meia-noite (ex.: 22:00–02:00).
    if (r.end < r.start) return time >= r.start || time <= r.end;
    return time >= r.start && time <= r.end;
  });
}

export function formatXJScheduleSummary(config: XJBusinessHours): string[] {
  return XJ_WEEKDAYS.map(({ key, label }) => {
    const day = config.schedule[key];
    if (!day?.enabled || !day.ranges.length) return `${label}: sem atuação`;
    return `${label}: ${day.ranges.map((r) => `${r.start} - ${r.end}`).join(', ')}`;
  });
}
